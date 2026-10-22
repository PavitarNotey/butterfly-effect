import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app
from tactics.engine import (
    at,
    closest_approach,
    corridor,
    distance,
    movement,
    point_segment,
    position,
    relationship,
    space,
    spatial,
    speed,
    yaw,
)
from tactics.models import FacingKey, PositionKey, Scenario, Thresholds
from tactics.service import build_bundle, evidence_bundle, load_source

client = TestClient(app)


def small(defender=None):
    def keys(a, b):
        return [{"t": 0, "position": a}, {"t": 2, "position": b}]

    def p(id, team, track):
        return {
            "id": id,
            "teamId": team,
            "name": id,
            "number": 1,
            "role": "Player",
            "positions": track,
            "facing": [{"t": 0, "yaw": 0}, {"t": 2, "yaw": 0}],
        }

    return Scenario.model_validate(
        {
            "version": 1,
            "id": "small",
            "title": "Test",
            "description": "Independent fixture",
            "seed": 1,
            "duration": 2,
            "matchStartSeconds": 0,
            "pitch": {"length": 105, "width": 68},
            "teams": [
                {
                    "id": id,
                    "name": id,
                    "shortName": id,
                    "color": "#fff",
                    "goalkeeperColor": "#fff",
                    "attackDirection": d,
                }
                for id, d in [("A", 1), ("B", -1)]
            ],
            "players": [
                p("p", "A", keys([0, 0, 0], [0, 0, 0])),
                p("r", "A", keys([10, 0, 0], [10, 0, 0])),
                p("d", "B", defender or keys([5, 0, 5], [5, 0, -5])),
            ],
            "ball": keys([0, 0.16, 0], [10, 0.16, 0]),
            "possession": [{"t": 0, "playerId": None}],
            "events": [
                {
                    "id": "pass",
                    "t": 0,
                    "type": "pass",
                    "label": "Pass",
                    "detail": "",
                    "playerIds": ["p", "r"],
                    "keyMoment": True,
                },
                {
                    "id": "receive",
                    "t": 2,
                    "type": "receive",
                    "label": "Receive",
                    "detail": "",
                    "playerIds": ["r"],
                    "keyMoment": True,
                },
            ],
            "relevantPlayerIds": ["p", "r", "d"],
        }
    )


def test_canonical_contract_and_invalid_scenarios():
    s, text = load_source("the-invisible-run")
    assert len(s.players) == 22 and s.version == 1
    for mutate in [
        lambda d: d["players"][0].update(positions=[]),
        lambda d: d["players"][0]["positions"][1].update(t=0),
        lambda d: d["players"][0]["positions"][0].update(position=[99, 0, 0]),
        lambda d: d["players"][0]["facing"][0].update(yaw=float("nan")),
        lambda d: d["events"][0].update(playerIds=["missing"]),
        lambda d: d["players"][0].update(teamId="missing"),
        lambda d: d.update(version=2),
        lambda d: d["possession"][0].update(playerId="missing"),
    ]:
        data = json.loads(text)
        mutate(data)
        with pytest.raises(ValidationError):
            Scenario.model_validate(data)


def test_shared_interpolation_parity():
    fixture = json.loads(
        (
            Path(__file__).parents[2] / "frontend/src/replay/interpolation-parity.json"
        ).read_text()
    )
    keys = [PositionKey(**p) for p in fixture["positions"]]
    headings = [FacingKey(**p) for p in fixture["facing"]]
    for sample in fixture["samples"]:
        assert position(keys, sample["t"]) == pytest.approx(sample["position"])
        assert yaw(headings, sample["t"]) == pytest.approx(sample["yaw"])
        assert speed(keys, sample["t"]) == pytest.approx(sample["speed"])


def test_spatial_movement_and_space_independent_expected_values():
    s = small()
    assert distance([0, 0, 0], [3, 10, 4]) == 5
    assert point_segment([5, 0, 3], [0, 0, 0], [10, 0, 0]) == 3
    assert point_segment([3, 0, 4], [0, 0, 0], [0, 0, 0]) == 5
    m = movement(s, "d", 0, 2)
    assert m.vector == (0, 0, -10) and m.longitudinal == 0 and m.lateral == -10
    assert m.pathLength == 10 and m.meanSpeed == 5
    assert movement(s, "d", 1, 1).meanSpeed == 0
    r = relationship(s, "p", "d", 0)
    assert r.distance == pytest.approx(50**0.5) and r.defenderGoalSide
    snapshot = spatial(s, 1)
    assert len(snapshot.pairwise) == 3 and snapshot.nearestOpponentDistance == 5
    area = space(s, (5, 0, 0), "A", 1, 6)
    assert area.nearestDistance == 0 and area.defendersWithinRadius == 1
    assert space(s, (0, 0, 0), "A", 0, 6).defendersWithinRadius == 0


def test_outside_at_release_can_intercept_during_travel():
    c = corridor(small(), "p", "r", 0, 2)
    assert c.staticDistance == 5 and c.movingClosest.distance == 0
    assert c.movingClosest.t == 1 and c.movingClosest.playerPosition == (5, 0, 0)
    assert c.state == "obstructed"


def test_non_simultaneous_crossing_is_conservatively_contested():
    s = small(
        [
            {"t": 0, "position": [5, 0, 5]},
            {"t": 0.5, "position": [5, 0, -5]},
            {"t": 2, "position": [5, 0, -5]},
        ]
    )
    c = corridor(s, "p", "r", 0, 2)
    assert (
        c.movingClosest.distance > 3
        and c.sweptCorridorDistance == 0
        and c.state == "contested"
    )


def test_clear_threshold_boundaries_overlap_and_boundary_times():
    for z, expected in [
        (5, "clear"),
        (0.9, "obstructed"),
        (1.5, "contested"),
        (1.51, "clear"),
        (0, "obstructed"),
    ]:
        s = small([{"t": 0, "position": [5, 0, z]}, {"t": 2, "position": [5, 0, z]}])
        assert corridor(s, "p", "r", 0, 2).state == expected
    assert closest_approach(s.players[0].positions, s.players[0].positions, 2, 2) == (
        0,
        2,
    )


def test_invalid_corridors():
    s = small()
    for args in [
        ("p", "r", 1, 0),
        ("p", "r", 0, 0),
        ("p", "missing", 0, 2),
        ("p", "d", 0, 2),
    ]:
        with pytest.raises(ValueError):
            corridor(s, *args)
    data = s.model_dump()
    data["ball"][-1]["position"] = (0, 0.16, 0)
    with pytest.raises(ValueError, match="non-zero"):
        corridor(Scenario.model_validate(data), "p", "r", 0, 2)
    with pytest.raises(ValueError):
        movement(s, "p", -1, 2)
    with pytest.raises(ValueError):
        at(s, "missing", 0)


def test_bundle_determinism_identifiers_references_and_frame_coordinates():
    s, text = load_source("the-invisible-run")
    b = build_bundle(s, hashlib.sha256(text.encode()).hexdigest(), Thresholds())
    assert b.model_dump_json() == evidence_bundle(s.id).model_dump_json()
    assert b.sourceHash == hashlib.sha256(text.encode()).hexdigest()
    assert len(b.moments) == 6 and len({e.id for e in b.evidence}) == len(b.evidence)
    ids = {e.id for e in b.evidence}
    players = {p.id for p in s.players}
    events = {e.id for e in s.events}
    for m in b.moments:
        assert set(m.evidenceIds) <= ids
    for e in b.evidence:
        assert (
            set(e.playerIds) <= players
            and set(e.eventIds) <= events
            and e.status == "observation"
        )
    assert all(
        c.relation == "precedes_not_proven_cause" and set(c.evidenceIds) <= ids
        for c in b.chain
    )
    for f in b.frames:
        for r in f.relationships:
            assert r.a == at(s, r.aId, f.t) and r.b == at(s, r.bId, f.t)
    assert (
        b.actualPass.state == "clear"
        and b.actualPass.movingClosest.distance == pytest.approx(2.704272219, abs=1e-8)
    )


def test_typed_api_and_errors():
    base = "/api/scenarios/the-invisible-run"
    assert (
        client.get(base).json()["version"] == 1
        and len(client.get(base + "/moments").json()) == 6
    )
    a = client.get(base + "/evidence")
    b = client.get(base + "/evidence")
    assert a.status_code == 200 and a.content == b.content
    r = client.get(
        base + "/analysis",
        params={
            "t": 9,
            "start": 3,
            "end": 9,
            "passer_id": "a8",
            "receiver_id": "a9",
            "pass_start": 9,
            "pass_end": 10.4,
        },
    )
    assert r.status_code == 200 and r.json()["corridor"]["state"] == "clear"
    for params in [
        {"t": 21},
        {"t": -1},
        {"t": 3, "start": 9},
        {"t": "nan"},
        {"t": 9, "receiver_id": "missing"},
        {"t": 9, "passer_id": "a8"},
        {"t": 9, "corridor_half_width": 0},
    ]:
        assert client.get(base + "/analysis", params=params).status_code == 422
    assert client.get("/api/scenarios/missing").status_code == 404
    assert client.get(base + "/evidence?corridor_half_width=-1").status_code == 422


def test_malformed_registered_source_returns_useful_validation_error(
    tmp_path, monkeypatch
):
    from tactics import service

    _, text = load_source("the-invisible-run")
    bad = json.loads(text)
    bad["players"][0]["positions"] = []
    file = tmp_path / "invalid.json"
    file.write_text(json.dumps(bad))
    monkeypatch.setitem(service.REGISTRY, "invalid", file)
    for suffix in ["", "/evidence", "/moments", "/analysis?t=0"]:
        response = client.get("/api/scenarios/invalid" + suffix)
        assert response.status_code == 422
        assert "positions" in response.text


def test_configured_thresholds_and_centroid_definitions():
    s = small([{"t": 0, "position": [5, 0, 2]}, {"t": 2, "position": [5, 0, 2]}])
    assert corridor(s, "p", "r", 0, 2).state == "clear"
    assert (
        corridor(s, "p", "r", 0, 2, Thresholds(corridorHalfWidth=2)).state
        == "obstructed"
    )
    assert spatial(s, 1).teamCentroidDistance == 2
    assert space(s, (5, 0, 0), "A", 1, radius=2).defendersWithinRadius == 1
