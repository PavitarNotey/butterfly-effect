"""All prices are test fixtures. No network or paid model is used."""

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from openai import APITimeoutError

from ai.budget import PaidBudget
from ai.config import AISettings
from ai.errors import AIError
from ai.evidence import build_packet
from ai.models import Usage
from ai.providers import (
    MicrosoftFoundryProvider,
    MockAIProvider,
    grounded_output_schema,
    mock_draft,
)
from ai.request import compact_packet, prepare_request
from ai.service import IntelligenceService


def paid(**overrides):
    return AISettings(
        _env_file=None,
        **{
            "ai_provider": "foundry",
            "azure_openai_endpoint": "https://test.services.ai.azure.com/openai/v1",
            "azure_openai_api_key": "never-log-this-test-key",
            "ai_paid_generation_enabled": True,
            "ai_input_usd_per_million": 1,
            "ai_output_usd_per_million": 2,
            **overrides,
        },
    )


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    monkeypatch.setattr(
        "openai.resources.responses.AsyncResponses.parse",
        AsyncMock(side_effect=AssertionError("Network forbidden")),
    )


def test_atomic_concurrent_reservations_and_no_refund_of_attempts():
    budget = PaidBudget(paid(ai_calls_per_lifetime=2))

    def attempt(_):
        try:
            return budget.reserve(1000, 1000)
        except AIError:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(20)))
    accepted = [r for r in results if r]
    assert len(accepted) == 2
    assert budget.snapshot()["estimated_reserved_usd"] == 0.006
    budget.settle(accepted[0], Usage(input_tokens=100, output_tokens=20))
    budget.settle(accepted[1], None, failed=True)
    budget.settle(accepted[1], None)  # idempotent
    state = budget.snapshot()
    assert state["model_attempts"] == 2 and state["budget_rejections"] == 18
    assert state["estimated_accounted_usd"] == 0.00314
    assert state["estimated_reserved_usd"] == 0
    assert state["reported_input_tokens"] == 100
    assert state["uncertain_attempts"] == state["failed_attempts"] == 1
    with pytest.raises(AIError, match="session"):
        budget.reserve(1, 1)


def test_spend_hourly_and_lifetime_are_separate_and_unknown_is_not_free():
    now = [0]
    budget = PaidBudget(
        paid(ai_calls_per_hour=1, ai_estimated_budget_usd=0.004), now=lambda: now[0]
    )
    r = budget.reserve(1000, 1000)
    with pytest.raises(AIError, match="hourly"):
        budget.reserve(1, 1)
    budget.settle(r, None)
    now[0] = 3601
    with pytest.raises(AIError, match="budget"):
        budget.reserve(1000, 1000)
    assert budget.snapshot()["remaining_hourly_attempts"] == 1
    assert budget.snapshot()["remaining_lifetime_attempts"] == 11
    assert budget.snapshot()["estimated_accounted_usd"] == 0.003


def test_concurrent_cost_reservations_include_inflight_spend():
    budget = PaidBudget(paid(ai_estimated_budget_usd=0.004))

    def reserve(_):
        try:
            return budget.reserve(1000, 1000)
        except AIError:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        accepted = [r for r in pool.map(reserve, range(20)) if r]
    assert len(accepted) == 1
    assert budget.snapshot()["estimated_reserved_usd"] == 0.003
    assert budget.snapshot()["model_attempts"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"ai_paid_generation_enabled": False},
        {"ai_input_usd_per_million": 0},
        {"ai_estimated_budget_usd": 0.000001},
        {"ai_max_input_bytes": 4096},
    ],
)
async def test_rejected_requests_never_submit_to_sdk(monkeypatch, overrides):
    parse = AsyncMock()
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    provider = MicrosoftFoundryProvider(paid(**overrides))
    with pytest.raises(AIError):
        await provider.generate(build_packet("the-untouched-pass", "dummy"), "casual")
    parse.assert_not_called()
    assert provider.budget.snapshot()["model_attempts"] == 0


@pytest.mark.asyncio
async def test_retry_requires_its_own_allowance_and_unknown_failure_is_charged(
    monkeypatch,
):
    parse = AsyncMock(
        side_effect=APITimeoutError(
            request=httpx.Request("POST", "https://example.invalid")
        )
    )
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    provider = MicrosoftFoundryProvider(paid(ai_calls_per_lifetime=1))
    with pytest.raises(AIError, match="session"):
        await provider.generate(build_packet("the-untouched-pass", "dummy"), "casual")
    assert parse.call_count == 1
    state = provider.budget.snapshot()
    assert state["model_attempts"] == state["uncertain_attempts"] == 1
    assert state["estimated_accounted_usd"] > 0


@pytest.mark.asyncio
async def test_cancel_submitted_request_retains_full_reservation(monkeypatch):
    entered = asyncio.Event()

    async def wait(*args, **kwargs):
        entered.set()
        await asyncio.Event().wait()

    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", wait)
    provider = MicrosoftFoundryProvider(paid())
    task = asyncio.create_task(
        provider.generate(build_packet("the-untouched-pass", "dummy"), "casual")
    )
    await asyncio.wait_for(entered.wait(), 2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    state = provider.budget.snapshot()
    assert state["model_attempts"] == state["uncertain_attempts"] == 1
    assert state["estimated_accounted_usd"] > 0 and state["estimated_reserved_usd"] == 0


@pytest.mark.asyncio
async def test_cache_only_and_dedup_observability_without_paid_calls():
    provider = MockAIProvider()
    original = provider.generate
    provider.generate = AsyncMock(side_effect=original)
    service = IntelligenceService(
        AISettings(_env_file=None, ai_provider="mock"), provider
    )
    with pytest.raises(AIError) as error:
        await service.get("the-untouched-pass", "analyst", "dummy", cache_only=True)
    assert error.value.status == 409
    assert provider.generate.call_count == 0
    await asyncio.gather(
        *(service.get("the-untouched-pass", "casual", "dummy") for _ in range(3))
    )
    assert (
        await service.get("the-untouched-pass", "casual", "dummy", cache_only=True)
    ).cached
    state = service.diagnostics()
    assert state["cache_hits"] == 1 and state["inflight_deduplications"] == 2
    assert state["model_attempts"] == 0 and state["mock_generations"] == 1
    assert state["estimated_accounted_usd"] is None
    assert "never-log" not in json.dumps(state)
    await service.close()


@pytest.mark.asyncio
async def test_known_usage_reconciles_and_larger_report_is_never_clamped(monkeypatch):
    packet = build_packet("the-untouched-pass", "dummy")
    parse = AsyncMock(
        return_value=SimpleNamespace(
            status="completed",
            output_parsed=mock_draft(packet, "casual"),
            usage=SimpleNamespace(input_tokens=500000, output_tokens=20000),
        )
    )
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    provider = MicrosoftFoundryProvider(paid())
    await provider.generate(packet, "casual")
    assert provider.budget.snapshot()["estimated_accounted_usd"] == 0.54
    with pytest.raises(AIError, match="budget"):
        await provider.generate(packet, "casual")
    assert parse.call_count == 1


@pytest.mark.asyncio
async def test_distinct_concurrent_service_requests_cannot_bypass_paid_allowance(
    monkeypatch,
):
    async def respond(*args, **kwargs):
        await asyncio.sleep(0.01)
        return SimpleNamespace(status="incomplete", output_parsed=None, usage=None)

    parse = AsyncMock(side_effect=respond)
    monkeypatch.setattr("openai.resources.responses.AsyncResponses.parse", parse)
    service = IntelligenceService(paid(ai_calls_per_lifetime=1))
    results = await asyncio.gather(
        service.get("the-untouched-pass", "casual", "dummy"),
        service.get("the-untouched-pass", "analyst", "dummy"),
        return_exceptions=True,
    )
    assert parse.call_count == 1
    assert sum(isinstance(r, AIError) for r in results) == 1
    state = service.diagnostics()
    assert (
        state["model_attempts"]
        == state["uncertain_attempts"]
        == state["fallbacks"]
        == 1
    )
    assert state["estimated_accounted_usd"] > 0
    await service.close()


@pytest.mark.asyncio
async def test_cache_identity_includes_prompt_model_mode_transport_and_evidence(
    monkeypatch,
):
    provider = MockAIProvider()
    original = provider.generate
    provider.generate = AsyncMock(side_effect=original)
    service = IntelligenceService(
        AISettings(_env_file=None, ai_provider="mock"), provider
    )

    async def get():
        return await service.get("the-untouched-pass", "casual", "dummy")

    await get()
    assert (await get()).cached
    monkeypatch.setattr("ai.service.PROMPT_VERSION", "test-new-prompt")
    assert not (await get()).cached
    monkeypatch.setattr("ai.service.REQUEST_VERSION", "test-new-transport")
    assert not (await get()).cached
    provider.model = "test-new-model"
    assert not (await get()).cached
    packet = build_packet("the-untouched-pass", "dummy")
    packet.input_hash = "new-evidence-and-source-fingerprint"
    monkeypatch.setattr("ai.service.build_packet", lambda *args: packet)
    assert not (await get()).cached
    assert provider.generate.call_count == 5
    assert (
        await service.get("the-untouched-pass", "analyst", "dummy")
    ).mode == "analyst"
    assert provider.generate.call_count == 6
    await service.close()


@pytest.mark.parametrize(
    "scenario", ["the-invisible-run", "the-missed-chance", "the-untouched-pass"]
)
@pytest.mark.parametrize(
    "kind,limit", [("moment", 1400), ("recap", 1600), ("commentary", 3500)]
)
def test_compact_transport_preserves_every_fact_and_allowlist(scenario, kind, limit):
    packet = build_packet(
        scenario, "pass" if kind == "moment" else None, recap=kind == "recap"
    )
    original = packet.model_dump(mode="json")
    compact = json.loads(compact_packet(packet))
    for field in original:
        if field != "events":
            assert compact[field] == original[field]
    for old, new in zip(original["events"], compact["events"], strict=True):
        assert new == {
            k: v for k, v in old.items() if k not in ("id", "sequence", "evidence_ids")
        }
    request = prepare_request(packet, "analyst", paid(), grounded_output_schema(packet))
    assert request.output_limit == limit
    assert request.input_bound <= paid().ai_max_input_bytes + 4096
    assert len(compact_packet(packet)) < len(packet.model_dump_json())
