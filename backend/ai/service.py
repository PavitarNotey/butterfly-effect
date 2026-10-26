import asyncio
import logging
from collections import OrderedDict, deque
from time import monotonic

from .config import AISettings
from .evidence import build_packet, digest
from .models import Cue, Intelligence
from .providers import (
    PROMPT_VERSION,
    AIError,
    MicrosoftFoundryProvider,
    MockAIProvider,
    mock_draft,
)
from .validation import validate_draft

logger = logging.getLogger(__name__)


class IntelligenceService:
    def __init__(self, settings: AISettings, provider=None, now=monotonic):
        self.settings = settings
        self.provider = provider or (
            MicrosoftFoundryProvider(settings)
            if settings.provider == "foundry"
            else MockAIProvider()
        )
        self.now = now
        self.cache = OrderedDict()
        self.pending = {}
        self.clients = OrderedDict()
        self.calls = deque()
        self.semaphore = asyncio.Semaphore(settings.ai_concurrency)

    def limit_client(self, client: str):
        now = self.now()
        hits = self.clients.pop(client, deque())
        while hits and hits[0] <= now - 60:
            hits.popleft()
        self.clients[client] = hits
        if len(hits) >= self.settings.ai_requests_per_minute:
            raise AIError(
                "Too many intelligence requests. Wait a minute before retrying.", 429
            )
        hits.append(now)
        while len(self.clients) > 512:
            self.clients.popitem(last=False)

    async def get(self, scenario_id, mode, event_id=None, recap=False):
        if self.settings.provider == "disabled":
            raise AIError(
                "AI is disabled. Configure Foundry on the backend or explicitly select AI_PROVIDER=mock for offline demo."
            )
        packet = build_packet(scenario_id, event_id, recap)
        key = digest(
            [
                packet.input_hash,
                mode,
                PROMPT_VERSION,
                self.provider.name,
                self.provider.model,
            ]
        )
        cached = self.cache.get(key)
        if cached and self.now() - cached[0] < self.settings.ai_cache_ttl_seconds:
            self.cache.move_to_end(key)
            return cached[1].model_copy(update={"cached": True}, deep=True)
        if key not in self.pending:
            if len(self.pending) >= 8:
                raise AIError("Intelligence is busy. Retry shortly.", 429)
            task = asyncio.create_task(self.generate(key, packet, mode))
            self.pending[key] = task

            # Always remove and consume failed tasks, including disconnected callers.
            def done(completed):
                self.pending.pop(key, None)
                if not completed.cancelled():
                    completed.exception()

            task.add_done_callback(done)
        # Browser navigation must not cancel shared generation for other viewers.
        return await asyncio.shield(self.pending[key])

    async def generate(self, key, packet, mode):
        async with self.semaphore:
            now = self.now()
            while self.calls and self.calls[0] <= now - 3600:
                self.calls.popleft()
            # Reserve worst-case retry attempts, rather than calling TPM a budget.
            attempts = self.settings.ai_max_retries + 1
            if len(self.calls) + attempts > self.settings.ai_calls_per_hour:
                raise AIError(
                    "The local hourly AI call allowance is exhausted. Retry later.", 429
                )
            self.calls.extend([now] * attempts)
            try:
                async with asyncio.timeout(
                    self.settings.ai_timeout_seconds * attempts + 2
                ):
                    generation = await self.provider.generate(packet, mode)
            except TimeoutError:
                raise AIError(
                    "Intelligence generation timed out. Retry later.", 504
                ) from None
            provider_name = self.provider.name
            try:
                if generation.draft is None:
                    raise ValueError("Missing structured output")
                narratives = validate_draft(generation.draft, packet, mode)
            except ValueError as error:
                logger.warning(
                    "AI output rejected (%s); serving labeled fallback",
                    str(error),
                    extra={
                        "ai_rejection_reason": str(error),
                        "ai_scenario_id": packet.scenario_id,
                        "ai_target_ids": packet.target_ids,
                        "ai_mode": mode,
                        "ai_prompt_version": PROMPT_VERSION,
                    },
                )
                provider_name = "validation_fallback"
                narratives = validate_draft(mock_draft(packet, mode), packet, mode)
            cues = []
            for narrative in narratives:
                event = next(
                    (e for e in packet.events if e.event_id == narrative.event_id), None
                )
                if event:
                    cues.append(
                        Cue(
                            id=f"{key}:{event.event_id}",
                            event_id=event.event_id,
                            replay_time=event.replay_time,
                            narrative=narrative,
                        )
                    )
            response = Intelligence(
                scenario_id=packet.scenario_id,
                match_id=packet.match_id,
                mode=mode,
                input_hash=packet.input_hash,
                source_hash=packet.source_hash,
                prompt_version=PROMPT_VERSION,
                provider=provider_name,
                model=self.provider.model,
                narratives=narratives,
                cues=cues,
                events=packet.events,
                recorded_match_facts=[
                    s for s in packet.sources if s.kind == "match_metadata"
                ],
                usage=generation.usage,
                validation_note="Source references and quantitative/causal claim screening passed. Generated prose is interpretation, not independently proven fact.",
            )
            self.cache[key] = (self.now(), response)
            self.cache.move_to_end(key)
            while len(self.cache) > self.settings.ai_cache_entries:
                self.cache.popitem(last=False)
            return response.model_copy(deep=True)

    async def close(self):
        tasks = list(self.pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
