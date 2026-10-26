"""Shared citation requirements for prompting and deterministic verification."""

from dataclasses import dataclass

from .models import EvidencePacket, Mode


@dataclass(frozen=True)
class CitationPolicy:
    required_ids: tuple[str, ...]
    measurement_ids: tuple[str, ...]
    minimum_measurements: int


def citation_policy(packet: EvidencePacket, target: str, mode: Mode) -> CitationPolicy:
    is_recap = target not in {e.event_id for e in packet.events}
    required = (
        (f"match-event:{target}", f"match:{packet.match_id}")
        if is_recap
        else (f"event:{target}",)
    )
    measurements = tuple(
        s.id
        for s in packet.sources
        if s.kind == "measurement" and (is_recap or target in s.event_ids)
    )
    return CitationPolicy(
        required, measurements, min(2, len(measurements)) if mode == "analyst" else 0
    )


def suggested_citations(packet: EvidencePacket, target: str, mode: Mode) -> list[str]:
    policy = citation_policy(packet, target, mode)
    types = {e.event_id: e.type for e in packet.events}

    def priority(source):
        actions = {types.get(id) for id in source.event_ids}
        # For a recap, prefer evidence about the distinctive action and finish
        # over unrelated initial-shape observations. No new metric is computed.
        return (
            0 if "dummy" in actions else 1 if actions & {"shot", "goal", "miss"} else 2
        )

    measured = sorted(
        (s for s in packet.sources if s.id in policy.measurement_ids), key=priority
    )
    chosen = measured[: policy.minimum_measurements]
    if len(chosen) == 2:
        complement = next(
            (s for s in measured[1:] if priority(s) != priority(chosen[0])), None
        )
        if complement:
            chosen[1] = complement
    return [*policy.required_ids, *(s.id for s in chosen)]
