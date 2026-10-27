"""Viewer windows change; canonical world state and evidence remain authoritative."""

import math

import pytest
from pydantic import ValidationError

from ai.config import AISettings
from ai.evidence import build_packet
from ai.service import IntelligenceService
from tactics.models import EvidenceBundle, TacticalMoment
from tactics.service import REGISTRY, evidence_bundle, load_scenario


@pytest.mark.parametrize("id", REGISTRY)
def test_sequences_have_valid_bounds_focus_events_and_exact_evidence_ownership(id):
    scenario = load_scenario(id)
    bundle = evidence_bundle(id)
    assert 3 <= len(bundle.moments) <= 5
    assert len(bundle.moments) == 4
    assert len(bundle.chain) == len(bundle.moments) - 1
    facts = {fact.id: fact for fact in bundle.evidence}
    assigned = []
    for moment in bundle.moments:
        assert 0 <= moment.start <= moment.focusTime <= moment.end <= scenario.duration
        assert moment.end - moment.start >= 1
        assert (
            next(e.t for e in scenario.events if e.id == moment.focusEventId)
            == moment.focusTime
        )
        assert moment.primaryEvidenceId in moment.evidenceIds
        assigned.extend(moment.evidenceIds)
        for fact_id in moment.evidenceIds:
            assert fact_id in facts
        for move in moment.movements:
            assert move.startTime == moment.start and move.endTime == moment.end
        if moment.followPlayerId:
            assert moment.followPlayerId in moment.playerIds
            assert facts[moment.primaryEvidenceId].playerIds == [moment.followPlayerId]
    # Every old observation remains accessible, owned by exactly one sequence.
    assert set(assigned) == set(facts) and len(assigned) == len(set(assigned))


def test_merrick_complete_recorded_approach_is_continuous_to_reception():
    scenario = load_scenario("the-untouched-pass")
    moments = evidence_bundle(scenario.id).moments
    assert [m.title for m in moments] == [
        "The Run Begins",
        "The Dummy",
        "The Arrival",
        "The Finish",
    ]
    run, dummy, arrival, finish = moments
    assert (run.start, run.focusTime, run.end) == (0, 1.2, 7.2)
    assert (dummy.start, dummy.focusTime, dummy.end) == (3.8, 6.65, 7.2)
    assert (arrival.start, arrival.focusTime, arrival.end) == (5.6, 7.2, 7.42)
    assert (finish.start, finish.focusTime, finish.end) == (6.65, 7.42, 9.02)
    player = next(p for p in scenario.players if p.id == "v10")
    route = next(m for m in run.movements if m.playerId == player.id)
    assert route.path == [key for key in player.positions if 0 <= key.t <= 7.2]
    assert route.start == (22, 0, 8)  # Already in the attacking half, no earlier keys.
    expected = sum(
        math.dist(a.position, b.position) for a, b in zip(route.path, route.path[1:])
    )
    assert route.pathLength == pytest.approx(expected)
    assert "earlier" in run.interpretation.lower()
    # Finish includes the dummy, reception, shot, goal and a bounded outcome hold.
    assert all(
        finish.start <= next(e.t for e in scenario.events if e.id == id) <= finish.end
        for id in ["dummy", "receive", "shot", "goal"]
    )


@pytest.mark.parametrize("id", REGISTRY)
@pytest.mark.parametrize("mode", ["casual", "analyst"])
@pytest.mark.asyncio
async def test_each_sequence_explains_its_recorded_focus_in_both_modes_without_model_calls(
    id, mode
):
    ai = IntelligenceService(AISettings(_env_file=None, ai_provider="mock"))
    try:
        for moment in evidence_bundle(id).moments:
            packet = build_packet(id, moment.focusEventId)
            source = next(s for s in packet.sources if s.id == moment.primaryEvidenceId)
            assert source.kind == "measurement"
            assert moment.focusEventId in source.event_ids
            response = await ai.get(id, mode, moment.focusEventId)
            assert response.provider == "mock" and response.mode == mode
            assert response.narratives[0].event_id == moment.focusEventId
            assert moment.primaryEvidenceId in response.narratives[0].source_ids
        assert ai.diagnostics()["model_attempts"] == 0
    finally:
        await ai.close()


def test_sequence_contract_rejects_bad_windows_and_unrelated_primary_references():
    bundle = evidence_bundle("the-untouched-pass")
    moment = bundle.moments[0].model_dump()
    for change in [
        {"focusTime": -1},
        {"focusTime": 8},
        {"end": 0},
        {"start": float("nan")},
        {"primaryEvidenceId": "unknown"},
        {"followPlayerId": "v7"},
    ]:
        with pytest.raises(ValidationError):
            TacticalMoment.model_validate({**moment, **change})
    for count in [2, 6]:
        with pytest.raises(ValidationError):
            EvidenceBundle.model_validate(
                {**bundle.model_dump(), "moments": [moment] * count}
            )
