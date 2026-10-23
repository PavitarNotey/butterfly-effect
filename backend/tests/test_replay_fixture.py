"""Offline scenario authoring checks; not a runtime tactical analysis service."""

import json
from itertools import combinations, pairwise
from math import acos, atan2, cos, dist, sin
from pathlib import Path

import pytest

SCENARIO = json.loads(
    (Path(__file__).parents[2] / "frontend/src/replay/invisible-run.json").read_text()
)
PLAYERS = {p["id"]: p for p in SCENARIO["players"]}


def position(keys, t):
    if t <= keys[0]["t"]:
        return keys[0]["position"][:]
    for a, b in pairwise(keys):
        if a["t"] <= t <= b["t"]:
            f = (t - a["t"]) / (b["t"] - a["t"])
            return [v + (w - v) * f for v, w in zip(a["position"], b["position"])]
    return keys[-1]["position"][:]


def player(id, t):
    return position(PLAYERS[id]["positions"], t)


def lane_distance(point, start, end):
    direction = [b - a for a, b in zip(start, end)]
    u = sum((p - a) * d for p, a, d in zip(point, start, direction)) / sum(
        d * d for d in direction
    )
    return dist(point, [a + max(0, min(1, u)) * d for a, d in zip(start, direction)])


def min_separation(track_a, track_b):
    """Exact closest approach of two linear tracks, including between keyframes."""
    times = sorted({k["t"] for k in track_a + track_b})
    minimum = float("inf")
    for start, end in pairwise(times):
        a0, b0 = position(track_a, start), position(track_b, start)
        a1, b1 = position(track_a, end), position(track_b, end)
        r = [a - b for a, b in zip(a0, b0)]
        v = [(a - b) - initial for a, b, initial in zip(a1, b1, r)]
        vv = sum(x * x for x in v)
        u = max(0, min(1, -sum(x * y for x, y in zip(r, v)) / vv)) if vv else 0
        minimum = min(minimum, sum((x + u * y) ** 2 for x, y in zip(r, v)) ** 0.5)
    return minimum


EVENTS = {e["id"]: e["t"] for e in SCENARIO["events"]}


def test_intentional_revision_sequence_and_quick_two_touch_finish():
    from authoring.invisible_run import revision

    assert revision(SCENARIO) == SCENARIO
    assert SCENARIO["version"] == 1  # Contract version, not a content revision.
    assert SCENARIO["duration"] == 13.2
    assert EVENTS == {
        "build": 0,
        "run": 1,
        "shift": 2.8,
        "pass": 4.4,
        "receive": 5.6,
        "shot": 6.8,
        "goal": 7.65,
    }
    assert 0.7 <= EVENTS["shot"] - EVENTS["receive"] <= 1.5
    assert player("a8", EVENTS["pass"])[0] - player("a8", 0)[0] > 9
    assert player("a9", EVENTS["shot"])[0] - player("a9", EVENTS["receive"])[0] < 4
    assert SCENARIO["possession"] == [
        {"t": 0, "playerId": "a8"},
        {"t": 4.4, "playerId": None},
        {"t": 5.6, "playerId": "a9"},
        {"t": 6.8, "playerId": None},
    ]


def test_run_and_handoff_open_actual_receiving_channel():
    release, receive, shot = [EVENTS[k] for k in ["pass", "receive", "shot"]]
    start, end = (
        position(SCENARIO["ball"], release),
        position(SCENARIO["ball"], receive),
    )
    start[1] = end[1] = 0
    assert lane_distance(player("d4", 0), start, end) < 0.6
    assert lane_distance(player("d4", release), start, end) > 4
    assert 8 < player("a7", release)[2] - player("a7", EVENTS["run"])[2] < 12
    assert 4 < player("d4", release)[2] - player("d4", EVENTS["run"])[2] < 7
    for t in [release, receive, shot]:
        assert player("d2", t)[0] > player("a7", t)[0]
        assert dist(player("d2", t), player("a7", t)) < 4
        assert player("d4", t)[0] > player("a9", t)[0]
        assert player("d5", t)[0] > player("a9", t)[0]
    assert player("d4", shot)[2] < player("d4", release)[2]
    assert player("d5", release)[2] - player("d5", 0)[2] > 3
    assert (
        sum(
            p["teamId"] == "boreal"
            and player(p["id"], release)[0] > player("a9", release)[0]
            for p in PLAYERS.values()
        )
        >= 2
    )  # Onside at release.


def test_defensive_pressure_accelerates_and_closes_before_release_of_shot():
    from tactics.service import load_source
    from tracking.diagnostics import motion

    s, _ = load_source(SCENARIO["id"])
    receive, shot = EVENTS["receive"], EVENTS["shot"]
    gap = lambda id, t: dist(player(id, t), player("a9", t))
    assert gap("d5", shot) == pytest.approx(1.7)
    assert gap("d5", shot) < gap("d5", receive) < gap("d5", EVENTS["pass"])
    assert gap("d4", shot) < 2.5
    for id in ["d5", "d6"]:
        p = next(p for p in s.players if p.id == id)
        assert 4.4 < motion(p.positions, p.facing)["max_segment_speed"] <= 6
    from tactics.engine import yaw

    for id in ["d4", "d5", "d6"]:
        p = next(p for p in s.players if p.id == id)
        for i in range(1, int(SCENARIO["duration"] * 20)):
            t = i / 20
            a, b = player(id, t - 0.01), player(id, t + 0.01)
            dx, dz = b[0] - a[0], b[2] - a[2]
            if (dx * dx + dz * dz) ** 0.5 / 0.02 > 3:
                heading = atan2(dx, dz) - yaw(p.facing, t)
                assert abs(atan2(sin(heading), cos(heading))) < 0.5
    for t in [0, EVENTS["run"], EVENTS["shift"], EVENTS["pass"]]:
        back_line = [player(id, t) for id in ["d2", "d4", "d5", "d3"]]
        assert max(p[0] for p in back_line) - min(p[0] for p in back_line) <= 4.5
        assert 22 <= max(p[2] for p in back_line) - min(p[2] for p in back_line) <= 34
        assert player("a8", t)[0] < player("d6", t)[0] < min(p[0] for p in back_line)


def test_ball_possession_events_and_goal_are_synchronized():
    for event, owner in [
        ("build", "a8"),
        ("pass", "a8"),
        ("receive", "a9"),
        ("shot", "a9"),
    ]:
        assert (
            dist(
                position(SCENARIO["ball"], EVENTS[event]), player(owner, EVENTS[event])
            )
            < 1
        )
    for i in range(int(SCENARIO["duration"] * 100) + 1):
        t = i / 100
        owner = next(
            p["playerId"] for p in reversed(SCENARIO["possession"]) if p["t"] <= t
        )
        if owner:
            assert dist(position(SCENARIO["ball"], t), player(owner, t)) < 1
    goal = EVENTS["goal"]
    x, y, z = position(SCENARIO["ball"], goal)
    assert x - 0.16 >= 52.5
    assert 0.16 <= y <= 2.44 - 0.16 and abs(z) + 0.16 < 3.66
    assert position(SCENARIO["ball"], goal - 0.02)[0] - 0.16 < 52.5
    from tactics.engine import closest_approach
    from tactics.service import load_source

    s, _ = load_source(SCENARIO["id"])
    for p in s.players:
        if p.teamId == "boreal":
            assert closest_approach(p.positions, s.ball, EVENTS["shot"], goal)[0] > 0.8


def test_goalkeeper_sets_then_reacts_after_shot():
    shot, goal = EVENTS["shot"], EVENTS["goal"]
    assert player("d1", shot) == player("d1", shot + 0.18)
    assert player("d1", goal)[2] < player("d1", shot + 0.18)[2]
    assert player("d1", goal)[2] > position(SCENARIO["ball"], goal)[2] + 2


def test_post_goal_turn_and_teammate_convergence_are_canonical():
    goal, end = EVENTS["goal"], SCENARIO["duration"]
    assert player("a9", end)[2] - player("a9", goal)[2] > 18
    for id in ["a7", "a8", "a10"]:
        initial = dist(player(id, goal), player("a9", goal))
        final = dist(player(id, end), player("a9", end))
        assert final < initial
        assert dist(player(id, end - 0.2), player(id, end)) > 0.35
    assert dist(player("a9", end - 0.2), player("a9", end)) > 0.8


@pytest.mark.parametrize("p", SCENARIO["players"], ids=lambda p: p["id"])
def test_continuity_speed_and_turns(p):
    assert (
        p["positions"][0]["t"] == 0 and p["positions"][-1]["t"] == SCENARIO["duration"]
    )
    velocities = []
    for key in p["positions"]:
        x, y, z = key["position"]
        assert abs(x) <= 52.5 and abs(z) <= 34 and y == 0
    for a, b in pairwise(p["positions"]):
        assert b["t"] > a["t"]
        dt = b["t"] - a["t"]
        v = [(y - x) / dt for x, y in zip(a["position"], b["position"])]
        speed = sum(x * x for x in v) ** 0.5
        assert speed <= 6
        velocities.append((v, speed))
        assert dist(position(p["positions"], b["t"] - 0.001), b["position"]) <= 0.0061
    for (a, sa), (b, sb) in pairwise(velocities):
        if min(sa, sb) > 0.75:
            angle = acos(max(-1, min(1, sum(x * y for x, y in zip(a, b)) / (sa * sb))))
            assert angle < 1.2
    for a, b in pairwise(p["facing"]):
        angular_speed = abs(
            atan2(sin(b["yaw"] - a["yaw"]), cos(b["yaw"] - a["yaw"]))
        ) / (b["t"] - a["t"])
        assert angular_speed <= 2


def test_players_do_not_overlap_between_keyframes():
    for a, b in combinations(SCENARIO["players"], 2):
        assert min_separation(a["positions"], b["positions"]) >= 1.2, (a["id"], b["id"])
