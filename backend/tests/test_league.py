import copy
import hashlib
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from league.models import LeagueCatalog, MatchKeyEvent
from league.service import compute_standings, get_catalog, validate_catalog
from main import app
from tactics.service import load_source

client = TestClient(app)


def test_fixture_summaries_expose_only_the_real_analyzed_event():
    fixtures = client.get("/api/fixtures").json()
    for fixture in fixtures:
        match = next(m for m in get_catalog().matches if m.id == fixture["id"])
        if fixture["status"] == "finished":
            event = next(e for e in match.events if e.replay)
            assert fixture["analyzedEvent"] == event.model_dump(mode="json")
        else:
            assert fixture["analyzedEvent"] is None
        assert "players" not in fixture and "events" not in fixture


def test_catalog_counts_round_and_results():
    c = get_catalog()
    assert len(c.league.clubs) == 10
    assert len(c.matches) == 5
    assert Counter(m.status for m in c.matches) == {"finished": 3, "upcoming": 2}
    assert Counter(id for m in c.matches for id in (m.homeId, m.awayId)) == Counter(
        {club.id: 1 for club in c.league.clubs}
    )
    for m in c.matches:
        assert [e.matchSeconds for e in m.events] == sorted(
            e.matchSeconds for e in m.events
        )
        assert len([e for e in m.events if e.replay]) == (1 if m.score else 0)
        if m.score:
            assert [
                sum(e.type == "goal" and e.teamId == team for e in m.events)
                for team in (m.homeId, m.awayId)
            ] == [m.score.home, m.score.away]
        else:
            assert m.status == "upcoming" and not m.events


def test_all_replay_references_resolve_and_preserve_exact_actor_time_and_semantics():
    c = get_catalog()
    for match in c.matches:
        for e in match.events:
            club = next(t for t in c.league.clubs if t.id == e.teamId)
            assert any(
                p.id == e.playerId and p.name == e.playerName for p in club.players
            )
            if not e.replay:
                continue
            s, _ = load_source(e.replay.scenarioId)
            anchor = next(a for a in s.events if a.id == e.replay.eventId)
            assert anchor.type == ("miss" if e.type == "major_miss" else "goal")
            assert anchor.playerIds[0] == e.playerId
            assert e.matchSeconds == pytest.approx(s.matchStartSeconds + anchor.t)
            assert e.minute == int(e.matchSeconds // 60) + 1
    featured = next(m for m in c.matches if m.id == c.league.featured.matchId)
    assert (
        next(
            e for e in featured.events if e.id == c.league.featured.eventId
        ).replay.scenarioId
        == "the-untouched-pass"
    )


def test_standings_derive_once_from_ledger_and_completed_round_only():
    c = get_catalog()
    assert len(c.history) == 45
    rows = compute_standings(c)
    assert len(rows) == 10
    assert sum(r.played for r in rows) == (45 + 3) * 2
    assert sum(r.wins for r in rows) == sum(r.losses for r in rows)
    assert sum(r.goalsFor for r in rows) == sum(r.goalsAgainst for r in rows)
    expected_order = sorted(
        rows, key=lambda r: (-r.points, -r.goalDifference, -r.goalsFor, r.clubId)
    )
    assert list(rows) == expected_order
    assert [r.position for r in rows] == list(range(1, 11))
    for row in rows:
        relevant = [
            (r.homeId, r.awayId, r.score)
            for r in c.history
            if row.clubId in (r.homeId, r.awayId)
        ]
        relevant += [
            (m.homeId, m.awayId, m.score)
            for m in c.matches
            if m.status == "finished" and row.clubId in (m.homeId, m.awayId)
        ]
        scores = [
            (s.home, s.away) if h == row.clubId else (s.away, s.home)
            for h, a, s in relevant
        ]
        assert row.played == len(scores) == row.wins + row.draws + row.losses
        assert row.wins == sum(a > b for a, b in scores)
        assert row.draws == sum(a == b for a, b in scores)
        assert row.losses == sum(a < b for a, b in scores)
        assert row.goalsFor == sum(a for a, b in scores)
        assert row.goalsAgainst == sum(b for a, b in scores)
        assert row.goalDifference == row.goalsFor - row.goalsAgainst
        assert row.points == 3 * row.wins + row.draws
        assert row.played in (9, 10)


@pytest.mark.parametrize(
    "mutation,message",
    [
        (lambda c: c["league"]["clubs"].append(c["league"]["clubs"][0]), "ten unique"),
        (lambda c: c["matches"][0].update(homeId="unknown"), "exactly once"),
        (lambda c: c["matches"][0]["score"].update(home=4), "Goal-event"),
        (lambda c: c["matches"][0]["events"].reverse(), "Unordered"),
        (
            lambda c: c["matches"][0]["events"][0].update(playerName="Wrong Name"),
            "membership",
        ),
        (
            lambda c: c["matches"][0]["events"][2]["replay"].update(eventId="unknown"),
            "anchor",
        ),
        (
            lambda c: c["matches"][0]["events"][2]["replay"].update(
                scenarioId="unknown"
            ),
            "scenario",
        ),
        (
            lambda c: c["matches"][0]["events"][2]["replay"].update(eventId="shot"),
            "type disagrees",
        ),
        (
            lambda c: c["matches"][0]["events"][2]["replay"].update(startTime=12),
            "entry time",
        ),
        (
            lambda c: c["matches"][0]["events"][2].update(matchSeconds=4388.65),
            "clock disagrees",
        ),
        (lambda c: c["history"].append(c["history"][0]), "Duplicate historical"),
        (lambda c: c["history"][0].update(homeId="unknown"), "historical round"),
        (
            lambda c: c["league"]["featured"].update(
                matchId="aurora-boreal", eventId="aurora-boreal-voss"
            ),
            "untouched pass",
        ),
    ],
)
def test_catalog_rejects_inconsistent_data(mutation, message):
    data = copy.deepcopy(get_catalog().model_dump(mode="json"))
    mutation(data)
    import json

    with pytest.raises(ValueError, match=message):
        validate_catalog(LeagueCatalog.model_validate_json(json.dumps(data)))


def test_strict_types_unknown_fields_and_invalid_upcoming_score_are_rejected():
    data = get_catalog().model_dump(mode="json")
    import json

    data["matches"][3]["score"] = {"home": 0, "away": 0}
    with pytest.raises(ValidationError, match="final score"):
        LeagueCatalog.model_validate_json(json.dumps(data))
    data = get_catalog().model_dump(mode="json")
    data["matches"][0]["score"]["home"] = "2"
    with pytest.raises(ValidationError):
        LeagueCatalog.model_validate_json(json.dumps(data))
    with pytest.raises(ValidationError):
        get_catalog().league.model_copy().name = "Mutated"


def test_stoppage_time_contract():
    data = get_catalog().matches[0].events[0].model_dump()
    assert (
        MatchKeyEvent.model_validate(
            data | {"minute": 90, "stoppageTime": 3, "matchSeconds": 5525}
        ).minute
        == 90
    )
    with pytest.raises(ValidationError, match="minute"):
        MatchKeyEvent.model_validate(
            data | {"minute": 90, "stoppageTime": 2, "matchSeconds": 5525}
        )


def test_endpoints_unknown_match_and_generated_contract():
    for path, name in [
        ("league", "League"),
        ("fixtures", "Fixture"),
        ("standings", "StandingsRow"),
        ("matches/vesper-tidal", "MatchDetail"),
    ]:
        response = client.get(f"/api/{path}")
        assert response.status_code == 200
        route = (
            "/api/matches/{match_id}" if path.startswith("matches/") else f"/api/{path}"
        )
        schema = app.openapi()["paths"][route]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]
        assert name in str(schema)
    assert client.get("/api/matches/unknown").status_code == 404
    import json

    assert json.loads(Path("openapi.json").read_text()) == app.openapi()


@pytest.mark.parametrize(
    "id,expected",
    [
        (
            "the-invisible-run",
            "8d2667ffaf9b1475ef40acfc8aa2f5319011abb14e22c2a80208139f3f9b7e30",
        ),
        (
            "the-missed-chance",
            "edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9",
        ),
        (
            "the-untouched-pass",
            "877de5ba96de6b8c50d7c4c05725665b87119927c4280cf1640c5fda98fad439",
        ),
    ],
)
def test_phase_3e_canonical_hashes_remain_byte_identical(id, expected):
    _, source = load_source(id)
    assert hashlib.sha256(source.encode()).hexdigest() == expected
