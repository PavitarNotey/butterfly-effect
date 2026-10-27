"""Compact model transport; server-owned evidence/contracts remain unchanged."""

import json
from dataclasses import dataclass

from .config import AISettings
from .errors import AIError
from .models import EvidencePacket, Mode
from .prompts import build_instructions

REQUEST_VERSION = "phase4c-compact-v1"


def output_limit(packet: EvidencePacket, settings: AISettings):
    events = {e.event_id for e in packet.events}
    limit = (
        settings.ai_recap_output_tokens
        if all(t not in events for t in packet.target_ids)
        else settings.ai_moment_output_tokens
        if len(packet.target_ids) == 1
        else settings.ai_commentary_output_tokens
    )
    return min(settings.ai_max_output_tokens, limit)


def compact_packet(packet: EvidencePacket):
    value = packet.model_dump(mode="json")
    # Stream envelope identities repeat the source hash and measurement IDs in
    # every event. They are transport metadata, not facts the model must retell.
    # Every source, exact statement, unit, allowlist, timestamp and player stays.
    for event in value["events"]:
        for key in ("id", "sequence", "evidence_ids"):
            event.pop(key)
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


@dataclass(frozen=True)
class ModelRequest:
    instructions: str
    input: str
    output_limit: int
    input_bound: int


def prepare_request(packet: EvidencePacket, mode: Mode, settings: AISettings, schema):
    if len(packet.model_dump_json()) > 40000:
        raise AIError("The evidence packet exceeds the configured input bound.", 422)
    instructions = build_instructions(packet, mode)
    content = f"Explanation mode: {mode}\nTrusted packet:\n{compact_packet(packet)}"
    # A conservative byte-derived token allowance, not an exact tokenizer.
    # Include JSON schema and 4096 tokens for protocol/schema overhead. It is
    # deliberately much larger than chars/4 estimates used for offline reports.
    size = len(
        (
            instructions
            + content
            + json.dumps(schema.model_json_schema(), ensure_ascii=False)
        ).encode()
    )
    if size > settings.ai_max_input_bytes:
        raise AIError("The model request exceeds the configured input bound.", 422)
    return ModelRequest(
        instructions, content, output_limit(packet, settings), size + 4096
    )
