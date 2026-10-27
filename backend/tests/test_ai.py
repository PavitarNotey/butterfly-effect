import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError, APIStatusError, APITimeoutError
from pydantic import ValidationError

from ai.citations import citation_policy, suggested_citations
from ai.config import AISettings
from ai.evidence import build_packet, event_stream
from ai.models import DraftSet, Usage
from ai.prompts import build_instructions
from ai.providers import (
    AIError,
    Generation,
    MicrosoftFoundryProvider,
    MockAIProvider,
    grounded_output_schema,
    mock_draft,
    normalize_citations,
)
from ai.service import IntelligenceService
from ai.smoke import parse_args
from ai.validation import validate_draft
from league.service import get_catalog
from main import app
from tactics.service import REGISTRY, evidence_bundle


def settings(**kwargs):
    return AISettings(_env_file=None, ai_provider="mock", **kwargs)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "mock")
    # A surprise SDK call in any test fails before reaching a network.
    monkeypatch.setattr(
        "openai.resources.responses.AsyncResponses.parse",
        AsyncMock(side_effect=AssertionError("Live AI is forbidden in tests")),
    )


@pytest.mark.parametrize("scenario", REGISTRY)
def test_packets_are_bounded_typed_and_hash_stable(scenario):
    p = build_packet(scenario)
    assert p == build_packet(scenario)
    assert len(p.model_dump_json()) < 20000
    assert p.source_hash == evidence_bundle(scenario).sourceHash
    assert {s.kind for s in p.sources} == {
        "recorded_event",
        "measurement",
        "authored_interpretation",
        "match_metadata",
    }
    for source in p.sources:
        if source.kind == "measurement":
            original = next(
                e for e in evidence_bundle(scenario).evidence if e.id == source.id
            )
            assert source.statement == original.observation
            assert source.evidence_id == original.id
    for mode in ("casual", "analyst"):
        assert validate_draft(mock_draft(p, mode), p, mode)


def test_dummy_noncontact_is_recorded_not_inferred():
    p = build_packet("the-untouched-pass", "dummy")
    assert "no touch" in next(s.statement for s in p.sources if s.id == "event:dummy")
    assert any(s.id.endswith(":dummy") and s.kind == "measurement" for s in p.sources)
    assert p.events[0].match_seconds != p.events[0].replay_time


def test_stream_incremental_replay_is_ordered_and_stable():
    first = event_stream("the-untouched-pass")
    assert first == event_stream("the-untouched-pass")
    assert [e.replay_time for e in first] == sorted(e.replay_time for e in first)
    assert len({e.id for e in first}) == len(first)
    with TestClient(app) as client:
        seen, after = [], -1
        while batch := client.get(
            f"/api/ai/scenarios/the-untouched-pass/events?after={after}&limit=2"
        ).json():
            seen.extend(batch)
            after = batch[-1]["sequence"]
        assert seen == [e.model_dump() for e in first]
        assert (
            client.get(
                f"/api/ai/scenarios/the-untouched-pass/events?after={after}"
            ).json()
            == []
        )


@pytest.mark.parametrize(
    "claim",
    [
        "The defender was fooled.",
        "He hesitated for 0.4 seconds.",
        "The lane widened by five metres.",
        "The dummy caused the goal.",
        "He intended to deceive the defender.",
        "He knew where to run.",
        "The pass had a 90% chance.",
        "They would have scored anyway.",
        "The move forced the defender away.",
        "The dummy led to the goal.",
        "<script>alert('bad')</script>",
        "The expected goals were high.",
    ],
)
def test_rejects_unsupported_claims(claim):
    p = build_packet("the-untouched-pass", "dummy")
    draft = mock_draft(p, "casual")
    draft.narratives[0].explanation = claim
    with pytest.raises(ValueError):
        validate_draft(draft, p, "casual")


def test_rejects_unknown_event_source_and_unrelated_source():
    p = build_packet("the-untouched-pass", "dummy")
    for refs in (
        ["invented"],
        ["event:pass"],
        ["event:dummy", "event:shot"],
        ["event:dummy", "event:dummy"],
    ):
        draft = mock_draft(p, "casual")
        draft.narratives[0].source_ids = refs
        with pytest.raises(ValueError):
            validate_draft(draft, p, "casual")
    draft.narratives[0].event_id = "other"
    with pytest.raises(ValueError):
        validate_draft(draft, p, "casual")
    with pytest.raises(ValidationError):
        DraftSet.model_validate({"narratives": [], "html": "bad"})


def test_modes_differ_in_substance_and_reference_requirements():
    p = build_packet("the-untouched-pass", "dummy")
    casual = validate_draft(mock_draft(p, "casual"), p, "casual")[0]
    analyst = validate_draft(mock_draft(p, "analyst"), p, "analyst")[0]
    assert len(analyst.explanation) > len(casual.explanation)
    assert sum(s.kind == "measurement" for s in analyst.key_evidence) == 2
    assert "receiving run" in analyst.explanation
    with pytest.raises(ValueError):
        validate_draft(mock_draft(p, "casual"), p, "analyst")


@pytest.mark.asyncio
async def test_cache_dedup_modes_expiry_and_source_hash_invalidation(monkeypatch):
    provider = MockAIProvider()
    original = provider.generate
    provider.generate = AsyncMock(side_effect=original)
    now = [0]
    service = IntelligenceService(
        settings(ai_cache_ttl_seconds=2), provider, now=lambda: now[0]
    )
    a, b = await asyncio.gather(
        *(service.get("the-untouched-pass", "casual", "dummy") for _ in range(2))
    )
    assert a == b
    assert provider.generate.call_count == 1
    assert (await service.get("the-untouched-pass", "casual", "dummy")).cached
    await service.get("the-untouched-pass", "analyst", "dummy")
    assert provider.generate.call_count == 2
    now[0] = 3
    await service.get("the-untouched-pass", "casual", "dummy")
    assert provider.generate.call_count == 3
    packet = build_packet("the-untouched-pass", "dummy")
    packet.input_hash = "changed-evidence"
    monkeypatch.setattr("ai.service.build_packet", lambda *args: packet)
    await service.get("the-untouched-pass", "casual", "dummy")
    assert provider.generate.call_count == 4


@pytest.mark.asyncio
async def test_invalid_output_is_explicit_fallback_and_limits_are_bounded():
    provider = MockAIProvider()
    provider.generate = AsyncMock(return_value=Generation(None, Usage()))
    service = IntelligenceService(
        settings(ai_calls_per_hour=2, ai_requests_per_minute=1), provider
    )
    response = await service.get("the-untouched-pass", "casual", "dummy")
    assert response.provider == "validation_fallback"
    with pytest.raises(AIError, match="hourly"):
        await service.get("the-untouched-pass", "analyst", "dummy")
    service.limit_client("a")
    with pytest.raises(AIError, match="minute"):
        service.limit_client("a")


@pytest.mark.parametrize(
    "values",
    [
        {"ai_provider": "unknown"},
        {"ai_provider": "foundry"},
        {
            "ai_provider": "foundry",
            "azure_openai_endpoint": "https://evil.example/openai/v1",
            "azure_openai_api_key": "test-secret",
        },
        {"ai_provider": "auto", "azure_openai_endpoint": "http://localhost/openai/v1"},
    ],
)
def test_invalid_config_never_serializes_secrets(values):
    with pytest.raises(ValidationError) as error:
        AISettings(_env_file=None, **values)
    assert "test-secret" not in str(error.value)


def test_status_errors_recap_all_finished_and_cors(monkeypatch):
    with TestClient(app) as client:
        assert client.get("/api/ai/status").json()["provider"] == "mock"
        assert "key" not in client.get("/api/ai/status").text.lower()
        assert (
            client.post(
                "/api/ai/moments/explain",
                json={"scenario_id": "the-untouched-pass", "event_id": "bad"},
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/api/ai/moments/explain",
                json={"scenario_id": "bad", "event_id": "dummy"},
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/api/ai/moments/explain",
                json={
                    "scenario_id": "the-untouched-pass",
                    "event_id": "dummy",
                    "mode": "bad",
                },
            ).status_code
            == 422
        )
        for match in get_catalog().matches:
            response = client.get(f"/api/ai/matches/{match.id}/recap")
            assert response.status_code == (200 if match.status == "finished" else 409)
            if match.status == "finished":
                assert "Metadata only" in response.text
                assert response.json()["match_id"] == match.id
        preflight = client.options(
            "/api/ai/moments/explain",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert preflight.status_code == 200
    monkeypatch.setenv("AI_PROVIDER", "disabled")
    with TestClient(app) as client:
        assert client.get("/api/ai/status").json()["available"] is False
        assert (
            client.get("/api/ai/scenarios/the-untouched-pass/commentary").status_code
            == 503
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "code,expected_calls,status",
    [(429, 1, 429), (401, 1, 503), (404, 1, 503), (500, 2, 503)],
)
async def test_foundry_retries_and_safe_errors(
    monkeypatch, code, expected_calls, status
):
    response = httpx.Response(
        code, request=httpx.Request("POST", "https://example.invalid")
    )
    parse = AsyncMock(
        side_effect=APIStatusError(
            "private-provider-body", response=response, body={"secret": "test-secret"}
        )
    )
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    provider = MicrosoftFoundryProvider(
        AISettings(
            _env_file=None,
            ai_provider="foundry",
            azure_openai_endpoint="https://test.services.ai.azure.com/openai/v1",
            azure_openai_api_key="test-secret",
            ai_paid_generation_enabled=True,
            ai_input_usd_per_million=1,
            ai_output_usd_per_million=2,
        )
    )
    with pytest.raises(AIError) as error:
        await provider.generate(build_packet("the-untouched-pass", "dummy"), "casual")
    assert error.value.status == status
    assert "test-secret" not in str(error.value) and "private-provider-body" not in str(
        error.value
    )
    assert parse.call_count == expected_calls


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error",
    [
        APITimeoutError(request=httpx.Request("POST", "https://example.invalid")),
        APIConnectionError(request=httpx.Request("POST", "https://example.invalid")),
    ],
)
async def test_connection_timeout_bounded(monkeypatch, error):
    parse = AsyncMock(side_effect=error)
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    provider = MicrosoftFoundryProvider(
        AISettings(
            _env_file=None,
            ai_provider="foundry",
            azure_openai_endpoint="https://test.services.ai.azure.com/openai/v1",
            azure_openai_api_key="test-secret",
            ai_paid_generation_enabled=True,
            ai_max_retries=0,
            ai_input_usd_per_million=1,
            ai_output_usd_per_million=2,
        )
    )
    with pytest.raises(AIError) as failure:
        await provider.generate(build_packet("the-untouched-pass", "dummy"), "casual")
    assert failure.value.status == 504
    assert parse.call_count == 1


@pytest.mark.asyncio
async def test_success_parameters_usage_and_secret_free_logs(monkeypatch, caplog):
    packet = build_packet("the-untouched-pass", "dummy")
    parse = AsyncMock(
        return_value=SimpleNamespace(
            status="completed",
            output_parsed=mock_draft(packet, "casual"),
            usage=SimpleNamespace(input_tokens=100, output_tokens=20),
        )
    )
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    provider = MicrosoftFoundryProvider(
        AISettings(
            _env_file=None,
            ai_provider="foundry",
            azure_openai_endpoint="https://test.services.ai.azure.com/openai/v1",
            azure_openai_api_key="test-secret",
            ai_paid_generation_enabled=True,
            ai_input_usd_per_million=1,
            ai_output_usd_per_million=2,
        )
    )
    with caplog.at_level("INFO"):
        generation = await provider.generate(packet, "casual")
    assert generation.usage.estimated_cost_usd == 0.00014
    assert "test-secret" not in caplog.text
    assert "input_tokens=100" in caplog.text
    kwargs = parse.call_args.kwargs
    assert kwargs["store"] is False and kwargs["max_output_tokens"] == 1400
    assert issubclass(kwargs["text_format"], DraftSet)
    assert "temperature" not in kwargs
    assert validate_draft(generation.draft, packet, "casual")


@pytest.mark.asyncio
async def test_concurrency_disconnect_and_pending_cleanup():
    class BlockingProvider(MockAIProvider):
        active = 0
        maximum = 0

        async def generate(self, packet, mode):
            self.active += 1
            self.maximum = max(self.maximum, self.active)
            try:
                await asyncio.sleep(0.02)
                return await super().generate(packet, mode)
            finally:
                self.active -= 1

    provider = BlockingProvider()
    service = IntelligenceService(settings(ai_concurrency=1), provider)
    abandoned = asyncio.create_task(
        service.get("the-untouched-pass", "casual", "dummy")
    )
    await asyncio.sleep(0)
    abandoned.cancel()
    with pytest.raises(asyncio.CancelledError):
        await abandoned
    results = await asyncio.gather(
        service.get("the-untouched-pass", "casual", "dummy"),
        service.get("the-untouched-pass", "analyst", "dummy"),
    )
    assert len(results) == 2 and provider.maximum == 1
    await asyncio.sleep(0)
    assert not service.pending
    await service.close()


def test_generation_schema_constrains_ids_and_normalization_only_deduplicates():
    packet = build_packet("the-untouched-pass", "dummy")
    schema = grounded_output_schema(packet)
    draft = mock_draft(packet, "casual")
    assert schema.model_validate(draft.model_dump())
    draft.narratives[0].source_ids = ["invented"]
    with pytest.raises(ValidationError):
        schema.model_validate(draft.model_dump())
    draft = mock_draft(packet, "casual")
    draft.narratives[0].source_ids.append("event:dummy")
    normalized = normalize_citations(draft)
    assert normalized.narratives[0].source_ids == list(
        dict.fromkeys(draft.narratives[0].source_ids)
    )
    assert validate_draft(normalized, packet, "casual")
    draft.narratives[0].source_ids = ["invented"]
    with pytest.raises(ValueError):
        validate_draft(normalize_citations(draft), packet, "casual")


def test_disabled_absent_and_invalid_configuration(monkeypatch):
    absent = AISettings(
        _env_file=None,
        ai_provider="auto",
        azure_openai_endpoint="",
        azure_openai_api_key="",
    )
    assert absent.provider == "disabled"
    monkeypatch.setenv("AI_PROVIDER", "not-a-provider")
    with TestClient(app) as client:
        status = client.get("/api/ai/status").json()
        assert status["provider"] == "invalid_configuration"
        assert (
            client.get("/api/ai/scenarios/the-untouched-pass/commentary").status_code
            == 503
        )


@pytest.mark.parametrize("scenario", REGISTRY)
@pytest.mark.parametrize("mode", ["casual", "analyst"])
@pytest.mark.parametrize("recap", [False, True])
def test_prompt_citation_plans_pass_the_same_validator(scenario, mode, recap):
    packet = build_packet(scenario, recap=recap)
    draft = mock_draft(packet, mode)
    instructions = build_instructions(packet, mode)
    for narrative in draft.narratives:
        policy = citation_policy(packet, narrative.event_id, mode)
        refs = suggested_citations(packet, narrative.event_id, mode)
        assert set(refs) <= set(packet.allowed_source_ids[narrative.event_id])
        assert len(refs) <= 6 and len(set(refs)) == len(refs)
        assert all(id in instructions for id in refs)
        assert set(policy.required_ids) <= set(refs)
        assert (
            sum(id in policy.measurement_ids for id in refs)
            >= policy.minimum_measurements
        )
        narrative.source_ids = refs
    assert validate_draft(draft, packet, mode)
    assert "professional broadcast studio" in instructions
    assert "collapsed" in instructions
    assert ("MATCH RECAP" in instructions) == recap


def test_analyst_recap_requires_real_measurements_not_authored_readings():
    packet = build_packet("the-untouched-pass", recap=True)
    draft = mock_draft(packet, "analyst")
    target = packet.target_ids[0]
    required = list(citation_policy(packet, target, "analyst").required_ids)
    draft.narratives[0].source_ids = required
    with pytest.raises(ValueError, match=r"required=2, cited=0"):
        validate_draft(draft, packet, "analyst")
    draft.narratives[0].source_ids = (
        required
        + [s.id for s in packet.sources if s.kind == "authored_interpretation"][:2]
    )
    with pytest.raises(ValueError, match=r"required=2, cited=0"):
        validate_draft(draft, packet, "analyst")
    refs = suggested_citations(packet, target, "analyst")
    assert any(id.endswith(":dummy") for id in refs)
    assert any(id.endswith(":shot") for id in refs)
    draft.narratives[0].source_ids = refs
    assert validate_draft(draft, packet, "analyst")
    # Adding the correct measurements never authorizes unsupported prose.
    for claim in (
        "The dummy caused the goal.",
        "No causal link is established.",
        "The finish came after one touch.",
        "The lane widened by 2 m.",
    ):
        draft.narratives[0].explanation = claim
        with pytest.raises(ValueError):
            validate_draft(draft, packet, "analyst")


def test_smoke_cli_can_actually_request_both_recap_modes():
    for mode in ("casual", "analyst"):
        args = parse_args(["recap", "--mode", mode])
        assert args.kind == "recap" and args.mode == mode
    assert parse_args(["analyst"]).kind == "analyst"


@pytest.mark.parametrize(
    "claim,rule",
    [
        ("A one-touch finish.", "one"),
        ("The runner occupies the half-space.", "half"),
        ("The gap is 87392 metres. Do not log this body.", "digit"),
    ],
)
def test_quantity_diagnostics_disclose_only_a_fixed_policy_rule(claim, rule):
    packet = build_packet("the-untouched-pass", recap=True)
    draft = mock_draft(packet, "analyst")
    draft.narratives[0].explanation = claim
    with pytest.raises(ValueError) as error:
        validate_draft(draft, packet, "analyst")
    assert str(error.value) == f"Quantitative prose (rule={rule})"
    assert claim not in str(error.value)


@pytest.mark.asyncio
async def test_prompt_version_invalidates_cached_outputs(monkeypatch):
    provider = MockAIProvider()
    provider.generate = AsyncMock(side_effect=provider.generate)
    service = IntelligenceService(settings(), provider)
    first = await service.get("the-untouched-pass", "analyst", recap=True)
    monkeypatch.setattr("ai.service.PROMPT_VERSION", "test-next-prompt")
    changed = await service.get("the-untouched-pass", "analyst", recap=True)
    assert first.prompt_version != changed.prompt_version
    assert not changed.cached and provider.generate.call_count == 2


@pytest.mark.asyncio
async def test_rejection_logs_have_structured_context_without_output_or_secrets(caplog):
    packet = build_packet("the-untouched-pass", recap=True)
    draft = mock_draft(packet, "analyst")
    draft.narratives[0].explanation = "The lane widened by 87392 metres."
    provider = MockAIProvider()
    provider.generate = AsyncMock(return_value=Generation(draft, Usage()))
    with caplog.at_level("WARNING"):
        result = await IntelligenceService(settings(), provider).get(
            "the-untouched-pass", "analyst", recap=True
        )
    assert result.provider == "validation_fallback"
    record = next(r for r in caplog.records if hasattr(r, "ai_rejection_reason"))
    assert record.ai_rejection_reason == "Quantitative prose (rule=digit)"
    assert record.ai_mode == "analyst" and record.ai_scenario_id == packet.scenario_id
    assert record.ai_target_ids == packet.target_ids
    assert "87392" not in caplog.text
