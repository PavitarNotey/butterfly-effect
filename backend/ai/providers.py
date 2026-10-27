"""One asynchronous model call per content set; explicit offline fixtures."""

import asyncio
import logging
from dataclasses import dataclass
from typing import Literal, Protocol

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI
from pydantic import Field, ValidationError, create_model

from .budget import PaidBudget
from .citations import suggested_citations
from .config import AISettings
from .errors import AIError
from .models import DraftNarrative, DraftSet, EvidencePacket, Mode, Usage
from .request import prepare_request

logger = logging.getLogger(__name__)
PROMPT_VERSION = "phase4-v3"


@dataclass
class Generation:
    draft: DraftSet | None
    usage: Usage


class AIProvider(Protocol):
    name: str
    model: str

    async def generate(self, packet: EvidencePacket, mode: Mode) -> Generation: ...


def grounded_output_schema(packet: EvidencePacket) -> type[DraftSet]:
    """Constrain generated IDs before decoding; relevance is checked afterward."""
    narrative = create_model(
        "GroundedNarrative",
        __base__=DraftNarrative,
        event_id=(Literal[tuple(packet.target_ids)], ...),
        source_ids=(
            list[Literal[tuple(s.id for s in packet.sources)]],
            Field(min_length=1, max_length=6),
        ),
    )
    return create_model(
        "GroundedNarrativeSet",
        __base__=DraftSet,
        narratives=(list[narrative], Field(min_length=1, max_length=16)),
    )


def normalize_citations(draft: DraftSet) -> DraftSet:
    # Repeating an existing citation adds no factual support. Normalize only
    # identical IDs; unknown IDs and relevance still fail validation.
    result = DraftSet.model_validate(draft.model_dump())
    for narrative in result.narratives:
        narrative.source_ids = list(dict.fromkeys(narrative.source_ids))
    return result


def mock_draft(packet: EvidencePacket, mode: Mode) -> DraftSet:
    """Deterministic fixtures and labeled validation fallback, never live AI."""
    drafts = []
    for target in packet.target_ids:
        event = next((e for e in packet.events if e.event_id == target), None)
        event_source = f"event:{target}" if event else f"match-event:{target}"
        measured = [
            s.id
            for s in packet.sources
            if s.kind == "measurement" and (not event or target in s.event_ids)
        ]
        refs = [event_source, *measured[: 2 if mode == "analyst" else 1]]
        takeaway = "Follow the movement around the ball."
        if event and event.type == "dummy":
            headline = "The ball continues untouched"
            casual = "The recorded dummy lets the pass continue without a touch. Follow the ball through to the receiver."
            analyst = "The pass continues beyond the dummy without a touch or a change of possession. The receiving run carries on beyond that passage. Follow the ball toward the arrival. Compare the receiver’s position with the path of the pass."
        elif event:
            headline = "Follow the recorded action"
            casual = "Watch the recorded action and the players around the ball. The supporting evidence shows how this passage develops."
            analyst = "Watch the players around the ball as the move develops. Compare the receiving position with the defending line. Follow the ball through this part of the passage. The replay details show the spacing around the action."
        else:
            if any(e.type == "dummy" for e in packet.events):
                headline = "The pass that stayed untouched"
                casual = "The pass continues beyond the dummy without a touch and reaches the arriving receiver. Follow the reception into the finish."
                analyst = "The diagonal continues beyond the dummy without a touch or a change of possession. The receiving run carries on beyond that passage. Follow the reception into the shot. Compare the arrival with the space around the finish."
                takeaway = "Follow the receiver beyond the dummy."
            elif any(e.type == "miss" for e in packet.events):
                headline = "The chance that stayed out"
                casual = "The move reaches a shooting chance, but the shot misses. Follow the ball from the receiving run to the finish."
                analyst = "The pass reaches the receiving run, followed by the shot. The ball finishes outside the goal. Compare the receiving position with the defending line. Follow the ball through the complete chance."
                takeaway = "Watch the receiving position before the shot."
            else:
                headline = "Follow the run into the finish"
                casual = "The replay follows the attacking run into a reception and a shot. The goal completes the passage."
                analyst = "Watch the run and the receiving position together. The passing corridor links the release to the arrival. The receiver then controls the ball and shoots. Compare that sequence with the defensive spacing."
                takeaway = "Watch the arrival as well as the ball."
            refs = suggested_citations(packet, target, mode)
            # A demo recap should also offer a useful measured replay to watch.
            # Casual prose does not require this citation, but the real source
            # is optional under the same unchanged validator/allowlist.
            if mode == "casual":
                optional = suggested_citations(packet, target, "analyst")
                refs.extend(id for id in optional[len(refs) : len(refs) + 1])
        drafts.append(
            DraftNarrative(
                event_id=target,
                headline=headline,
                explanation=casual if mode == "casual" else analyst,
                why_it_matters=takeaway,
                source_ids=refs,
            )
        )
    return DraftSet(narratives=drafts)


class MockAIProvider:
    name = "mock"
    model = "deterministic-fixtures-v1"

    async def generate(self, packet, mode):
        return Generation(mock_draft(packet, mode), Usage())


class MicrosoftFoundryProvider:
    name = "foundry"

    def __init__(self, settings: AISettings, budget: PaidBudget | None = None):
        self.settings = settings
        self.model = settings.azure_openai_deployment
        self.budget = budget or PaidBudget(settings)

    async def generate(self, packet, mode):
        settings = self.settings
        schema = grounded_output_schema(packet)
        request = prepare_request(packet, mode, settings, schema)
        # SDK retries disabled. Every application attempt, including a retry,
        # reserves its own call/cost allowance immediately before submission.
        async with AsyncOpenAI(
            base_url=settings.azure_openai_endpoint.rstrip("/") + "/",
            api_key=settings.azure_openai_api_key.get_secret_value(),
            timeout=settings.ai_timeout_seconds,
            max_retries=0,
        ) as client:
            for attempt in range(settings.ai_max_retries + 1):
                reservation = self.budget.reserve(
                    request.input_bound, request.output_limit
                )
                settled = False
                try:
                    response = await client.responses.parse(
                        model=self.model,
                        instructions=request.instructions,
                        input=request.input,
                        text_format=schema,
                        max_output_tokens=request.output_limit,
                        reasoning={"effort": "minimal"},
                        store=False,
                    )
                    reported = response.usage
                    known = reported is not None and all(
                        isinstance(value, int)
                        and not isinstance(value, bool)
                        and value >= 0
                        for value in (
                            getattr(reported, "input_tokens", None),
                            getattr(reported, "output_tokens", None),
                        )
                    )
                    usage = (
                        Usage(
                            input_tokens=reported.input_tokens,
                            output_tokens=reported.output_tokens,
                        )
                        if known
                        else Usage()
                    )
                    if known and self.budget.configured:
                        usage.estimated_cost_usd = float(
                            self.budget.cost(usage.input_tokens, usage.output_tokens)
                        )
                    self.budget.settle(reservation, usage if known else None)
                    settled = True
                    logger.info(
                        "Foundry usage input_tokens=%d output_tokens=%d approximate_usd=%s reported=%s",
                        usage.input_tokens,
                        usage.output_tokens,
                        usage.estimated_cost_usd,
                        known,
                    )
                    return Generation(
                        normalize_citations(response.output_parsed)
                        if response.status == "completed"
                        and response.output_parsed is not None
                        else None,
                        usage,
                    )
                except (ValidationError, ValueError):
                    return Generation(None, Usage())
                except APIStatusError as error:
                    if error.status_code == 429:
                        raise AIError(
                            "Foundry quota or rate limit reached. Check Azure usage and retry later.",
                            429,
                        ) from None
                    if error.status_code in (401, 403):
                        raise AIError(
                            "Foundry credentials or access were rejected. Check backend configuration."
                        ) from None
                    if error.status_code == 404:
                        raise AIError(
                            "The configured Foundry deployment is unavailable."
                        ) from None
                    if error.status_code < 500 or attempt == settings.ai_max_retries:
                        raise AIError(
                            "Foundry could not complete this request. Replay and measured evidence remain available."
                        ) from None
                except (APIConnectionError, APITimeoutError):
                    if attempt == settings.ai_max_retries:
                        raise AIError(
                            "Foundry timed out or could not be reached. Retry later.",
                            504,
                        ) from None
                finally:
                    # Includes cancellation, parse failures and uncertain network
                    # outcomes. No usage report means no estimated-cost refund.
                    if not settled:
                        self.budget.settle(reservation, None, failed=True)
                await asyncio.sleep(0.5 * (2**attempt))
        raise AIError("Foundry is unavailable.")
