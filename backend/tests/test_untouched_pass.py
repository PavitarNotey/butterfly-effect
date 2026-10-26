"""Independent Phase 3D contract, source integrity and football geometry checks."""

import hashlib
from copy import deepcopy
from itertools import combinations, pairwise

import pytest
from pydantic import ValidationError

from authoring.routes import canonical_text
from authoring.untouched_pass import author
from tactics.engine import at, closest_approach, distance, position
from tactics.models import DummyEvent, Scenario
from tactics.service import evidence_bundle, load_source


def test_reproducible_dummy_recipe_and_current_approved_other_sources():
    s, text = load_source("the-untouched-pass")
    assert text == canonical_text(author()) + "\n"
    assert s.duration == 13.6 and len(s.players) == 22
    assert len({p.name for p in s.players}) == 22
    for id, expected in [
        (
            "the-invisible-run",
            "8d2667ffaf9b1475ef40acfc8aa2f5319011abb14e22c2a80208139f3f9b7e30",
        ),
        (
            "the-missed-chance",
            "0d9214e800ed9053d40ff4f8fa94272a930d3bc9453af3f082fe8913bb3f9bee",
        ),
    ]:
        assert hashlib.sha256(load_source(id)[1].encode()).hexdigest() == expected


@pytest.mark.parametrize(
    "change",
    [
        {"nonContact": False},
        {"possessionTransfer": True},
        {"actorId": "v10"},
        {"actorId": "unknown"},
        {"passEventId": "shot"},
        {"receiveEventId": "goal"},
        {"start": 7},
        {"end": 8},
        {"t": 9},
        {"start": -1},
        {"touch": True},
    ],
)
def test_dummy_contract_rejects_invalid_semantics_and_references(change):
    s = author()
    next(e for e in s["events"] if e["type"] == "dummy").update(change)
    with pytest.raises(ValidationError):
        Scenario.model_validate(s)


def test_dummy_requires_explicit_flags_and_an_ownerless_uninterrupted_pass():
    for field in [
        "nonContact",
        "possessionTransfer",
        "actorId",
        "passEventId",
        "receiveEventId",
    ]:
        s = author()
        del next(e for e in s["events"] if e["type"] == "dummy")[field]
        with pytest.raises(ValidationError):
            Scenario.model_validate(s)
    for owner in ["v9", "v10", "t5"]:
        s = author()
        s["possession"].insert(4, {"t": 6.65, "playerId": owner})
        with pytest.raises(ValidationError, match="non-contact"):
            Scenario.model_validate(s)
    s = author()
    touch = deepcopy(next(e for e in s["events"] if e["type"] == "receive"))
    touch.update(id="invented-touch", t=6.6, playerIds=["v9"])
    s["events"].insert(6, touch)
    with pytest.raises(ValidationError):
        Scenario.model_validate(s)


def test_continuous_ball_passes_the_dummy_onside_then_reaches_the_true_receiver():
    s, _ = load_source("the-untouched-pass")
    e = next(e for e in s.events if isinstance(e, DummyEvent))
    assert e.actorId == "v9" and (e.start, e.t, e.end) == (6.12, 6.65, 7.02)
    assert e.nonContact and not e.possessionTransfer
    assert all(k.playerId != e.actorId for k in s.possession)
    assert not any(5.6 < k.t < 7.2 for k in s.ball)
    velocities = []
    for t in [5.7, 6.1, 6.64, 6.65, 6.66, 6.9]:
        a, b = position(s.ball, t - 0.001), position(s.ball, t + 0.001)
        velocities.append(tuple((y - x) / 0.002 for x, y in zip(a, b)))
    for v in velocities:
        assert v == pytest.approx((6.25, 0, 8.75), abs=1e-8)
    assert distance(at(s, e.actorId, e.t), position(s.ball, e.t)) < 1e-5
    assert distance(at(s, "v10", 7.2), position(s.ball, 7.2)) == pytest.approx(0.65)
    defenders = sorted(at(s, p.id, 5.6)[0] for p in s.players if p.teamId == "tidal")
    assert all(at(s, id, 5.6)[0] < defenders[-2] for id in ["v9", "v10"])
    assert evidence_bundle(s.id).actualPass.movingClosest.distance > 1.2


def test_pressure_spacing_shot_and_whole_ball_crossing():
    s, _ = load_source("the-untouched-pass")
    assert all(
        closest_approach(a.positions, b.positions, 0, s.duration)[0] >= 1.2
        for a, b in combinations(s.players, 2)
    )
    for defender in ["t5", "t6"]:
        gap = lambda t, defender=defender: distance(at(s, "v10", t), at(s, defender, t))
        assert gap(7.42) < gap(5.6)
        assert 1.2 < gap(7.42) < 2.4
    assert 7.42 - 7.2 == pytest.approx(0.22)
    for id in ["t5", "t6", "t1"]:
        assert (
            closest_approach(
                next(p.positions for p in s.players if p.id == id), s.ball, 7.42, 8.02
            )[0]
            > 0.5
        )
    crossings = []
    for a, b in pairwise(s.ball):
        if a.position[0] <= 52.5 + 0.16 < b.position[0]:
            u = (52.5 + 0.16 - a.position[0]) / (b.position[0] - a.position[0])
            crossings.append(
                (
                    a.t + u * (b.t - a.t),
                    a.position[1] + u * (b.position[1] - a.position[1]),
                    a.position[2] + u * (b.position[2] - a.position[2]),
                )
            )
    assert len(crossings) == 1
    t, y, z = crossings[0]
    assert 8 < t < 8.02 and 0.16 < y < 2.44 - 0.16 and abs(z) < 3.66 - 0.16


def test_evidence_reuses_categories_and_links_the_authored_dummy_without_claiming_body_measurement():
    s, text = load_source("the-untouched-pass")
    bundle = evidence_bundle(s.id)
    assert bundle.sourceHash == hashlib.sha256(text.encode()).hexdigest()
    moment = next(m for m in bundle.moments if m.id == "dummy")
    fact = next(
        e
        for e in bundle.evidence
        if e.id in moment.evidenceIds and e.category == "corridor"
    )
    assert fact.eventIds == ["pass", "dummy", "receive"]
    metrics = {m.name: m.value for m in fact.metrics}
    assert metrics["Dummy centre gap"] == 0
    assert metrics["Passage time"] == 6.65
    assert metrics["Arrival after passage"] == 0.55
    assert all(link.relation == "precedes_not_proven_cause" for link in bundle.chain)
    assert any(link.toMomentId == "dummy" for link in bundle.chain)
