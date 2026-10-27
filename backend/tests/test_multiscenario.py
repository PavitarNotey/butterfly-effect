import hashlib
import math
from itertools import combinations

import pytest
from fastapi.testclient import TestClient

from main import app
from tactics.engine import at, closest_approach, distance, position
from tactics.guides import GUIDES
from tactics.service import evidence_bundle, load_source
from tracking.diagnostics import synthetic_report

client = TestClient(app)


def test_approved_phase_4_2_missed_chance_source_hash():
    _, text = load_source("the-missed-chance")
    assert (
        hashlib.sha256(text.encode()).hexdigest()
        == "0d9214e800ed9053d40ff4f8fa94272a930d3bc9453af3f082fe8913bb3f9bee"
    )


@pytest.mark.parametrize("id", list(GUIDES))
def test_registered_replays_have_complete_distinct_rosters_hashes_and_generic_evidence(
    id,
):
    s, text = load_source(id)
    assert len(s.players) == 22
    assert len({p.id for p in s.players}) == 22
    assert len([p for p in s.players if p.role == "Goalkeeper"]) == 2
    assert len(s.teams) == 2 and {t.attackDirection for t in s.teams} == {-1, 1}
    bundle = evidence_bundle(id)
    assert bundle.sourceHash == hashlib.sha256(text.encode()).hexdigest()
    assert 3 <= len(bundle.moments) <= 5
    assert bundle.actualPass.passerId == GUIDES[id].passer
    assert bundle.shotPath[-1].t == next(
        e.t for e in s.events if e.id == GUIDES[id].finish
    )
    assert client.get(f"/api/scenarios/{id}/evidence").status_code == 200
    assert all(f.id.startswith(f"{id}:v1:") for f in bundle.evidence)


def test_discovery_matches_exact_sources_and_unknown_ids():
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    assert [s["outcome"] for s in r.json()] == ["goal", "miss", "goal"]
    for summary in r.json():
        s, text = load_source(summary["id"])
        assert summary["sourceHash"] == hashlib.sha256(text.encode()).hexdigest()
        assert summary["teams"] == [t.model_dump() for t in s.teams]
    assert client.get("/api/scenarios/unknown/evidence").status_code == 404


@pytest.mark.parametrize("id", list(GUIDES))
def test_reusable_motion_diagnostics_speed_spacing_heading_and_synchronized_touches(id):
    s, _ = load_source(id)
    r = synthetic_report(s, GUIDES[id])
    assert r["warnings"] == {} and r["touch_warnings"] == []
    assert r["closest_players"]["distance"] >= 1.2
    assert (
        r["event_sync"]["possession_release_matches"]
        and r["event_sync"]["possession_receive_matches"]
    )
    for m in r["players"].values():
        # Approved Phase 4.2 wide-run peak is 6.509m/s; retain the original
        # 6m/s authoring bound for both unchanged goal sequences.
        assert m["max_segment_speed"] <= (6.6 if id == "the-missed-chance" else 6)
        assert m["max_acceleration"] <= 6 and m["max_deceleration"] <= 6
        assert m["max_heading_rate"] <= 2
        assert m["max_running_key_turn"] < 1.5
    for a, b in combinations(s.players, 2):
        assert closest_approach(a.positions, b.positions, 0, s.duration)[0] >= 1.2
    # A local finite-window derivative remains finite at every authored key.
    assert all(math.isfinite(m["max_acceleration"]) for m in r["players"].values())


def test_missed_chance_geometry_supports_recovery_and_actual_miss_not_a_goal_or_block():
    s, _ = load_source("the-missed-chance")
    guide = GUIDES[s.id]
    r = synthetic_report(s, guide)
    assert not any(e.type in ["goal", "block"] for e in s.events)
    gap = lambda t: distance(at(s, "s9", t), at(s, "c5", t))
    assert gap(4.75) == 5
    assert gap(5.85) == pytest.approx(13**0.5)
    assert gap(7.65) == pytest.approx(4.25**0.5)
    assert gap(7.65) < gap(5.85) < gap(4.75)
    for t in [0, 1.3, 3.2, 3.55, 4.75, 5.85, 7.65]:
        assert at(s, "c5", t)[0] > at(s, "s9", t)[0]
        assert at(s, "c2", t)[0] > at(s, "s7", t)[0]
        assert at(s, "c4", t)[2] < at(s, "c2", t)[2]
    assert at(s, "s7", 3.2)[2] - at(s, "s7", 1.3)[2] == 7
    assert at(s, "c2", 3.2)[2] - at(s, "c2", 1.3)[2] == 3
    for frame in r["collective"]:
        assert frame["line_depth"] <= 4 and frame["line_width"] <= 42
        assert frame["unit_gap"] < 12
    release = 3.55
    defenders = sorted(
        at(s, p.id, release)[0] for p in s.players if p.teamId == "cinder"
    )
    assert at(s, "s9", release)[0] < defenders[-2]  # Onside at release.
    assert evidence_bundle(s.id).actualPass.movingClosest.distance > 2
    ball = position(s.ball, 8.37)
    assert ball[0] > 52.5 + 0.16 and ball[2] > 3.66 + 0.16
    assert not r["touch_warnings"]
    assert at(s, "c1", 7.65) == pytest.approx((48.5, 0, 1.7))


def test_invalid_authored_guide_references_fail_explicitly(monkeypatch):
    from dataclasses import replace

    guide = GUIDES["the-missed-chance"]
    monkeypatch.setitem(GUIDES, "the-missed-chance", replace(guide, cover="missing"))
    from tactics.models import Thresholds
    from tactics.service import build_bundle

    s, text = load_source("the-missed-chance")
    with pytest.raises(ValueError, match="Unknown player"):
        build_bundle(s, hashlib.sha256(text.encode()).hexdigest(), Thresholds())
    monkeypatch.setitem(
        GUIDES, "the-missed-chance", replace(guide, finish="nonexistent")
    )
    with pytest.raises(ValueError, match="missing"):
        build_bundle(s, hashlib.sha256(text.encode()).hexdigest(), Thresholds())


@pytest.mark.parametrize("id", list(GUIDES))
def test_possession_stays_near_ball_between_events(id):
    s, _ = load_source(id)
    for index in range(int(s.duration * 10) + 1):
        t = index / 10
        owner = next(p.playerId for p in reversed(s.possession) if p.t <= t)
        if owner:
            assert distance(at(s, owner, t), position(s.ball, t)) < 1.1


def test_missed_shot_crosses_goal_line_outside_posts_and_clears_nearby_defender():
    s, _ = load_source("the-missed-chance")
    crossings = []
    for a, b in zip(s.ball, s.ball[1:]):
        if a.position[0] <= 52.5 < b.position[0]:
            fraction = (52.5 - a.position[0]) / (b.position[0] - a.position[0])
            z = a.position[2] + fraction * (b.position[2] - a.position[2])
            crossings.append(z)
    assert len(crossings) == 1 and crossings[0] > 3.66 + 0.16
    assert (
        closest_approach(
            next(p.positions for p in s.players if p.id == "c5"), s.ball, 7.65, 8.37
        )[0]
        > 0.35
    )
