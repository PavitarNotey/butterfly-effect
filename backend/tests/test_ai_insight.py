"""Offline acceptance/adversarial fixtures, including the SDK completion path."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from ai.config import AISettings
from ai.evidence import build_packet
from ai.models import Source
from ai.prompts import build_instructions
from ai.providers import (
    MicrosoftFoundryProvider,
    MockAIProvider,
    grounded_output_schema,
    mock_draft,
)
from ai.reasoning import supported_mechanisms
from ai.request import prepare_request
from ai.service import IntelligenceService
from ai.validation import validate_draft
from main import app
from tactics.service import REGISTRY, evidence_bundle


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(
        "openai.resources.responses.AsyncResponses.parse",
        AsyncMock(side_effect=AssertionError("Live AI forbidden")),
    )


@pytest.mark.parametrize("scenario", REGISTRY)
@pytest.mark.parametrize("mode", ["casual", "analyst"])
def test_each_selected_sequence_has_distinct_useful_bounded_reading(scenario, mode):
    outputs = []
    for moment in evidence_bundle(scenario).moments:
        packet = build_packet(scenario, moment.focusEventId)
        draft = mock_draft(packet, mode)
        narrative = validate_draft(draft, packet, mode)[0]
        assert moment.primaryEvidenceId in narrative.source_ids
        assert 45 <= len(narrative.explanation.split()) <= 130
        assert "Watch the recorded action" not in narrative.explanation
        outputs.append(narrative.explanation)
        request = prepare_request(
            packet, mode, AISettings(_env_file=None), grounded_output_schema(packet)
        )
        assert request.output_limit == 1400
        assert len(packet.model_dump_json()) < 40000
    assert len(set(outputs)) == 4


@pytest.mark.parametrize("mode", ["casual", "analyst"])
def test_every_licensed_mechanism_is_in_prompt_and_passes_only_with_its_support(mode):
    packet = build_packet("the-untouched-pass", "dummy")
    instructions = build_instructions(packet, mode)
    mechanisms = supported_mechanisms(packet, "dummy")
    assert any("because" in m.sentence for m in mechanisms)
    assert any("therefore" in m.sentence for m in mechanisms)
    assert any("led to" in m.sentence for m in mechanisms)
    assert any("appears designed" in m.sentence for m in mechanisms)
    for mechanism in mechanisms:
        assert mechanism.sentence in instructions
        draft = mock_draft(packet, mode)
        n = draft.narratives[0]
        n.explanation = mechanism.sentence
        n.source_ids = list(dict.fromkeys([*n.source_ids, *mechanism.support_ids]))
        assert len(n.source_ids) <= 6
        assert validate_draft(draft, packet, mode)
        # An otherwise valid event/citation plan cannot license a missing fact.
        alternatives = {
            id
            for m in mechanisms
            if m.sentence == mechanism.sentence
            for id in m.support_ids
        }
        n.source_ids = [id for id in n.source_ids if id not in alternatives]
        with pytest.raises(ValueError):
            validate_draft(draft, packet, mode)


@pytest.mark.parametrize(
    "claim",
    [
        "The dummy caused the goal.",
        "The dummy therefore guaranteed the goal.",
        "The dummy led to the goal.",
        "The goal resulted in victory because the defender was deceived.",
        "Ellery wanted to fool Reid.",
        "Ellery knew Merrick would score.",
        "Ellery decided to draw Reid away.",
        "The run appears designed to deceive the goalkeeper.",
        "The run created an unmarked receiver.",
        "The ball went in thanks to the dummy.",
        "The dummy forced the defender to stop.",
        "Without the dummy they would have missed.",
        "The chance had a high probability of success.",
    ],
)
@pytest.mark.parametrize("field", ["headline", "explanation", "why_it_matters"])
def test_citations_and_qualification_never_license_invented_intent_or_outcomes(
    claim, field
):
    packet = build_packet("the-untouched-pass", "dummy")
    draft = mock_draft(packet, "analyst")
    setattr(draft.narratives[0], field, claim)
    with pytest.raises(ValueError):
        validate_draft(draft, packet, "analyst")


def test_valid_sentence_does_not_license_adjacent_or_modified_claims():
    packet = build_packet("the-untouched-pass", "dummy")
    sentence = supported_mechanisms(packet, "dummy")[0].sentence
    for text in (
        sentence + " Therefore the dummy created the goal.",
        sentence.replace("Kian Merrick", "Cassian Reid"),
        sentence.replace("continues", "would have continued"),
        sentence + "; therefore the goal was inevitable.",
    ):
        draft = mock_draft(packet, "casual")
        draft.narratives[0].explanation = text
        with pytest.raises(ValueError):
            validate_draft(draft, packet, "casual")


def test_context_keeps_original_event_associations_and_exact_observations():
    packet = build_packet("the-untouched-pass", "dummy")
    original = {f.id: f for f in evidence_bundle(packet.scenario_id).evidence}
    for source in packet.sources:
        if source.kind == "measurement":
            assert source.statement == original[source.id].observation
            assert source.event_ids == original[source.id].eventIds
    for suffix in (
        ":sequence-run:v10",
        ":dummy:dummy",
        ":pass:corridor",
        ":receive:space",
        ":receive:cover",
        ":finish:shot",
    ):
        assert any(id.endswith(suffix) for id in packet.allowed_source_ids["dummy"])
    # Context is not relabeled as a dummy measurement to satisfy Analyst.
    route = next(s for s in packet.sources if ":sequence-run:" in s.id)
    assert "dummy" not in route.event_ids
    p = packet.model_copy(deep=True)
    p.source_hash = "stale"
    assert supported_mechanisms(p, "dummy") == []
    p = packet.model_copy(deep=True)
    next(s for s in p.sources if s.id.endswith(":dummy:dummy")).statement = "forged"
    assert not any("untouched" in m.sentence for m in supported_mechanisms(p, "dummy"))


def test_relevance_remains_strict_with_context_and_markup_is_not_licensed():
    packet = build_packet("the-untouched-pass", "dummy")
    packet.sources.append(
        Source(
            id="unrelated",
            kind="measurement",
            statement="Other action",
            event_ids=["other"],
        )
    )
    draft = mock_draft(packet, "casual")
    draft.narratives[0].source_ids.append("unrelated")
    with pytest.raises(ValueError, match="Source unrelated"):
        validate_draft(draft, packet, "casual")
    draft = mock_draft(packet, "casual")
    draft.narratives[0].explanation += " <b>Therefore</b>"
    with pytest.raises(ValueError, match="Unsafe markup"):
        validate_draft(draft, packet, "casual")


def test_analyst_context_cannot_replace_focus_measurements():
    packet = build_packet("the-untouched-pass", "dummy")
    draft = mock_draft(packet, "analyst")
    draft.narratives[0].source_ids = [
        "event:dummy",
        "the-untouched-pass:v1:dummy:dummy",
        "the-untouched-pass:v1:receive:cover",
    ]
    with pytest.raises(ValueError, match="required=2, cited=1"):
        validate_draft(draft, packet, "analyst")


@pytest.mark.parametrize("mode", ["casual", "analyst"])
@pytest.mark.asyncio
async def test_sdk_shaped_success_keeps_foundry_provenance_without_fallback(
    monkeypatch, mode, caplog
):
    packet = build_packet("the-untouched-pass", "dummy")
    draft = mock_draft(packet, mode)
    parse = AsyncMock(
        return_value=SimpleNamespace(
            status="completed",
            output_parsed=draft,
            usage=SimpleNamespace(input_tokens=100, output_tokens=200),
        )
    )
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    settings = AISettings(
        _env_file=None,
        ai_provider="foundry",
        azure_openai_endpoint="https://test.services.ai.azure.com/openai/v1",
        azure_openai_api_key="test-secret-never-log",
        ai_paid_generation_enabled=True,
        ai_input_usd_per_million=1,
        ai_output_usd_per_million=2,
        ai_max_retries=0,
    )
    service = IntelligenceService(settings, MicrosoftFoundryProvider(settings))
    with caplog.at_level("INFO"):
        response = await service.get(packet.scenario_id, mode, "dummy")
    assert response.provider == "foundry"
    assert parse.call_count == 1
    assert (
        await service.get(packet.scenario_id, mode, "dummy", cache_only=True)
    ).cached
    assert service.diagnostics()["foundry_generations"] == 1
    assert service.diagnostics()["fallbacks"] == 0
    assert any(
        getattr(r, "ai_output_provider", None) == "foundry" for r in caplog.records
    )
    assert "test-secret-never-log" not in caplog.text
    assert draft.narratives[0].explanation not in caplog.text
    await service.close()


@pytest.mark.asyncio
async def test_rejections_are_categorized_and_fallback_stays_specific(caplog):
    packet = build_packet("the-untouched-pass", "dummy")
    draft = mock_draft(packet, "analyst")
    draft.narratives[0].explanation = "The dummy led to the goal."
    provider = MockAIProvider()
    provider.generate = AsyncMock(return_value=SimpleNamespace(draft=draft, usage={}))
    service = IntelligenceService(
        AISettings(_env_file=None, ai_provider="mock"), provider
    )
    with caplog.at_level("WARNING"):
        result = await service.get(packet.scenario_id, "analyst", "dummy")
    assert result.provider == "validation_fallback"
    assert "Ellery" in result.narratives[0].explanation
    assert "because" in result.narratives[0].explanation
    assert service.diagnostics()["validation_rejection_categories"] == {
        "unsupported_mechanism": 1
    }
    assert "The dummy led to the goal" not in caplog.text
    await service.close()


def test_public_contract_is_unchanged():
    with open("openapi.json") as source:
        assert json.load(source) == app.openapi()
