"""Single-process paid-attempt accounting, not an Azure subscription billing cap.

Short synchronous critical sections are atomic across async tasks and threads.
Never hold the lock across I/O. Failed/uncertain attempts retain their full cost
reservation; no attempt allowance is refunded after submission.
"""

from collections import deque
from dataclasses import dataclass
from decimal import Decimal
from threading import Lock
from time import monotonic

from .config import AISettings
from .errors import AIError
from .models import Usage


@dataclass(frozen=True)
class Reservation:
    id: int
    estimated_usd: Decimal


class PaidBudget:
    def __init__(self, settings: AISettings, now=monotonic):
        self.settings, self.now = settings, now
        self.lock = Lock()
        self.hourly = deque()
        self.pending: dict[int, Reservation] = {}
        self.attempts = self.rejected = self.uncertain = self.failed = 0
        self.reported_input = self.reported_output = 0
        self.committed = Decimal(0)

    @property
    def configured(self):
        return (
            self.settings.ai_input_usd_per_million > 0
            and self.settings.ai_output_usd_per_million > 0
        )

    def cost(self, input_tokens, output_tokens):
        return (
            Decimal(input_tokens) * Decimal(str(self.settings.ai_input_usd_per_million))
            + Decimal(output_tokens)
            * Decimal(str(self.settings.ai_output_usd_per_million))
        ) / 1_000_000

    def reserve(self, input_bound: int, output_bound: int) -> Reservation:
        if input_bound < 0 or output_bound < 0:
            raise ValueError("Token reservations must be non-negative")
        with self.lock:
            message = None
            status = 429
            if not self.settings.ai_paid_generation_enabled:
                message, status = (
                    "New AI generation is paused. Replay and measured evidence remain available.",
                    503,
                )
            elif not self.configured:
                message, status = (
                    "AI generation is unavailable until backend cost protection is configured.",
                    503,
                )
            now = self.now()
            while self.hourly and self.hourly[0] <= now - 3600:
                self.hourly.popleft()
            if not message and len(self.hourly) >= self.settings.ai_calls_per_hour:
                message = "The hourly AI call allowance is exhausted. Saved analysis and replay remain available."
            if not message and self.attempts >= self.settings.ai_calls_per_lifetime:
                message = "The session AI call allowance is exhausted. Saved analysis and replay remain available."
            amount = self.cost(input_bound, output_bound)
            held = sum((r.estimated_usd for r in self.pending.values()), Decimal(0))
            if not message and self.committed + held + amount > Decimal(
                str(self.settings.ai_estimated_budget_usd)
            ):
                message = "The estimated AI budget allowance is exhausted. Saved analysis and replay remain available."
            if message:
                self.rejected += 1
                raise AIError(message, status)
            self.attempts += 1
            self.hourly.append(now)
            result = Reservation(self.attempts, amount)
            self.pending[result.id] = result
            return result

    def settle(self, reservation: Reservation, usage: Usage | None, failed=False):
        with self.lock:
            if self.pending.pop(reservation.id, None) is None:
                return
            self.failed += bool(failed)
            if usage is None or usage.input_tokens < 0 or usage.output_tokens < 0:
                self.committed += reservation.estimated_usd
                self.uncertain += 1
            else:
                self.reported_input += usage.input_tokens
                self.reported_output += usage.output_tokens
                # Never cap an unexpectedly large provider report to the prior
                # reservation. Record it and block future work when exhausted.
                self.committed += self.cost(usage.input_tokens, usage.output_tokens)

    def snapshot(self):
        """Internal only. Do not attach aggregate spend/limits to public routes."""
        with self.lock:
            now = self.now()
            hourly = sum(t > now - 3600 for t in self.hourly)
            held = sum((r.estimated_usd for r in self.pending.values()), Decimal(0))
            return {
                "paid_generation_enabled": self.settings.ai_paid_generation_enabled,
                "pricing_configured": self.configured,
                "model_attempts": self.attempts,
                "failed_attempts": self.failed,
                "uncertain_attempts": self.uncertain,
                "budget_rejections": self.rejected,
                "reported_input_tokens": self.reported_input,
                "reported_output_tokens": self.reported_output,
                "estimated_accounted_usd": float(self.committed)
                if self.configured
                else None,
                "estimated_reserved_usd": float(held) if self.configured else None,
                "remaining_estimated_usd": max(
                    0,
                    float(
                        Decimal(str(self.settings.ai_estimated_budget_usd))
                        - self.committed
                        - held
                    ),
                )
                if self.configured
                else None,
                "remaining_hourly_attempts": max(
                    0, self.settings.ai_calls_per_hour - hourly
                ),
                "remaining_lifetime_attempts": max(
                    0, self.settings.ai_calls_per_lifetime - self.attempts
                ),
                "cost_is_approximate": True,
            }
