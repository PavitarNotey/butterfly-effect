from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from tactics.models import Thresholds

Mode = Literal["casual", "analyst"]


# Closed AI payload base: reject extra fields rather than silently trusting model additions.
class AIContract(BaseModel):
    model_config = ConfigDict(extra="forbid")


# Explicit user request; cache_only may retrieve/join work but cannot start a generation.
class ExplainRequest(AIContract):
    scenario_id: str = Field(min_length=1, max_length=80)
    event_id: str = Field(min_length=1, max_length=80)
    mode: Mode = "casual"
    cache_only: bool = False


# Server-owned excerpt; kind separates recorded actions, measurements, authored readings and metadata.
class Source(AIContract):
    id: str
    kind: Literal[
        "recorded_event", "match_metadata", "measurement", "authored_interpretation"
    ]
    statement: str
    event_ids: list[str]
    evidence_id: str | None = None
    # Exact backend excerpts carry quantities; the model cannot rewrite them.
    units: list[str] = Field(default_factory=list)


# Synthetic ordered cue identity with both replay-relative and full-match clocks.
class StreamEvent(AIContract):
    id: str
    sequence: int
    event_id: str
    type: str
    replay_time: float
    match_seconds: float
    match_minute: int
    player_ids: list[str]
    evidence_ids: list[str]


# Trusted packet boundary: hashes and per-target allowlists bind narratives to exact source evidence.
class EvidencePacket(AIContract):
    synthetic: Literal[True] = True
    scenario_id: str
    match_id: str
    source_hash: str
    evidence_hash: str
    evidence_version: int
    thresholds: Thresholds
    input_hash: str
    target_ids: list[str]
    allowed_source_ids: dict[str, list[str]]
    events: list[StreamEvent]
    sources: list[Source]
    limitations: list[str]


# Model-authored qualitative fields and citations; numerical excerpts are attached only after validation.
class DraftNarrative(AIContract):
    event_id: str
    headline: str = Field(min_length=1, max_length=110)
    explanation: str = Field(min_length=1, max_length=1300)
    why_it_matters: str = Field(min_length=1, max_length=450)
    source_ids: list[str] = Field(min_length=1, max_length=6)


# Ordered bounded narrative batch for a selected moment, commentary cues or a recap.
class DraftSet(AIContract):
    narratives: list[DraftNarrative] = Field(min_length=1, max_length=16)


# Screened draft enriched with immutable excerpts; confidence is not a semantic truth guarantee.
class Narrative(DraftNarrative):
    mode: Mode
    key_evidence: list[Source]
    limitations: list[str]
    confidence_label: Literal["references-and-claims-screened"] = (
        "references-and-claims-screened"
    )


# Narrative positioned on the authoritative replay timeline; playback never generates per tick.
class Cue(AIContract):
    id: str
    event_id: str
    replay_time: float
    narrative: Narrative


# Reported tokens and optional price estimate; absent reporting is not proof of zero billing.
class Usage(AIContract):
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float | None = None
    cost_is_approximate: Literal[True] = True


# Served result retains source/prompt identity and distinguishes live, demo and rejected-output fallback.
class Intelligence(AIContract):
    scenario_id: str
    match_id: str
    mode: Mode
    input_hash: str
    source_hash: str
    prompt_version: str
    provider: Literal["foundry", "mock", "validation_fallback"]
    model: str
    synthetic: Literal[True] = True
    cached: bool = False
    narratives: list[Narrative]
    cues: list[Cue]
    events: list[StreamEvent]
    recorded_match_facts: list[Source]
    usage: Usage
    validation_note: str


# Configuration availability only; this response never asserts a successful paid connectivity test.
class AIStatus(AIContract):
    provider: Literal["foundry", "mock", "disabled", "invalid_configuration"]
    available: bool
    message: str
