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
        # A single-focus packet already puts its primary observation first.
        # Recap-style dummy preference must not displace arrival/finish focus.
        if target in types:
            return 0
        actions = {types.get(id) for id in source.event_ids}
        # For a recap, prefer evidence about the distinctive action and finish
        # over unrelated initial-shape observations. No new metric is computed.
        return (
            0 if "dummy" in actions else 1 if actions & {"shot", "goal", "miss"} else 2
        )

    measured = sorted(
        (s for s in packet.sources if s.id in policy.measurement_ids), key=priority
    )
    # A Casual moment also benefits from an exact replayable observation. This
    # is a citation suggestion, not a relaxation of Analyst's minimum.
    is_recap = target not in types
    chosen = measured[: max(policy.minimum_measurements, 0 if is_recap else 1)]
    if len(chosen) == 2:
        complement = next(
            (s for s in measured[1:] if priority(s) != priority(chosen[0])), None
        )
        if complement:
            chosen[1] = complement
    refs = [*policy.required_ids, *(s.id for s in chosen)]
    if not is_recap and len(packet.target_ids) == 1:
        suffix = ":run:cover" if target == "run" else ":receive:cover"
        cover = next(
            (
                s.id
                for s in packet.sources
                if s.id.endswith(suffix) and s.id in packet.allowed_source_ids[target]
            ),
            None,
        )
        if cover and cover not in refs:
            refs.append(cover)
    return refs
