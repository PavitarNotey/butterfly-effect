"""Independent checks for the explicitly approved Phase 4.2 source revision."""

import json
from itertools import pairwise

import pytest

from authoring.missed_chance import EVENT_TIMES, revision
from authoring.routes import canonical_text
from league.service import get_catalog
from tactics.engine import at, closest_approach, distance, position
from tactics.guides import GUIDES
from tactics.service import evidence_bundle, load_source
from tracking.diagnostics import synthetic_report


def test_approved_recipe_is_reproducible_and_preserves_contact_anchors_and_ledger():
    s, text = load_source("the-missed-chance")
    assert text == canonical_text(revision(json.loads(text))) + "\n"
    assert s.duration == 12
    assert {e.id: e.t for e in s.events} == EVENT_TIMES
    assert [(p.t, p.playerId) for p in s.possession] == [
        (0, "s8"),
        (3.55, None),
        (4.75, "s9"),
        (7.65, None),
    ]
    assert at(s, "s8", 3.55) == (17, 0, -5)
    assert at(s, "s9", 4.75) == (33, 0, -1)
    assert at(s, "s9", 7.65) == (41, 0, 3)
    assert at(s, "c5", 4.75) == (37, 0, -4)
    assert at(s, "c5", 7.65) == (43, 0, 2.5)
    match = next(m for m in get_catalog().matches if m.id == "solstice-cinder")
    assert (match.score.home, match.score.away) == (0, 1)
    assert [(e.id, e.type, e.matchSeconds) for e in match.events] == [
        ("solstice-cinder-c9", "goal", 1938),
        ("solstice-cinder-finch", "major_miss", 3675.72),
        ("solstice-cinder-c1", "save", 5106),
    ]
    event = match.events[1]
    assert event.minute == 62 and event.replay.startTime == 3.2
    assert s.matchStartSeconds + EVENT_TIMES["miss"] == pytest.approx(
        event.matchSeconds
    )


def test_miss_has_purposeful_normal_speed_routes_and_valid_continuous_clearances():
    s, _ = load_source("the-missed-chance")
    report = synthetic_report(s, GUIDES[s.id])
    assert not report["warnings"] and not report["touch_warnings"]
    assert distance(at(s, "s8", 0), at(s, "s8", 1)) > 2
    assert distance(at(s, "s9", 4.75), at(s, "s9", 7.65)) / 2.9 > 2.8
    assert report["closest_players"]["distance"] > 1.9
    for player in s.players:
        assert max(b.t - a.t for a, b in pairwise(player.positions)) <= 0.101
        assert report["players"][player.id]["max_acceleration"] < 5
        assert report["players"][player.id]["max_deceleration"] < 4
    assert distance(
        position(s.ball, 3.55), position(s.ball, 4.75)
    ) / 1.2 == pytest.approx(13.743685, abs=0.001)
    assert (
        closest_approach(
            next(p.positions for p in s.players if p.id == "c5"), s.ball, 7.65, 8.37
        )[0]
        > 0.35
    )


def test_shot_flight_and_whole_ball_wide_outcome_are_preserved_in_new_evidence():
    s, _ = load_source("the-missed-chance")
    assert [(k.t, k.position) for k in s.ball if 7.65 <= k.t <= 8.37] == [
        (7.65, (41.65, 0.16, 3)),
        (8.05, (47.9, 0.75, 4.3)),
        (8.37, (52.8, 0.7, 5.35)),
    ]
    bundle = evidence_bundle(s.id)
    assert bundle.shotPath[0].t == 7.65 and bundle.shotPath[-1].t == 8.37
    assert bundle.actualPass.releaseTime == 3.55
    assert all(f.id.startswith("the-missed-chance:v1:") for f in bundle.evidence)
    assert (
        bundle.sourceHash
        != "edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9"
    )
    a, b = next(
        (a, b) for a, b in pairwise(s.ball) if a.position[0] <= 52.5 < b.position[0]
    )
    f = (52.5 - a.position[0]) / (b.position[0] - a.position[0])
    assert a.position[2] + f * (b.position[2] - a.position[2]) > 3.66 + 0.16
    assert all(e.type not in {"goal", "block"} for e in s.events)
