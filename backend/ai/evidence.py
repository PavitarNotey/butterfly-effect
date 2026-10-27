"""Pure adapters over canonical data. Never computes new football geometry."""

import hashlib
import json

from league.service import get_catalog
from tactics.service import evidence_bundle, load_scenario

from .models import EvidencePacket, Source, StreamEvent


def digest(value) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def scenario_match(scenario_id):
    for match in get_catalog().matches:
        if any(e.replay and e.replay.scenarioId == scenario_id for e in match.events):
            return match
    raise KeyError("Unknown scenario")


def event_stream(scenario_id: str) -> list[StreamEvent]:
    scenario = load_scenario(scenario_id)
    bundle = evidence_bundle(scenario_id)
    # Canonical order breaks equal-timestamp ties. Sequence is a stateless cursor.
    return [
        StreamEvent(
            id=f"{scenario_id}:{bundle.sourceHash}:{event.id}",
            sequence=i,
            event_id=event.id,
            type=event.type,
            replay_time=event.t,
            match_seconds=scenario.matchStartSeconds + event.t,
            match_minute=int((scenario.matchStartSeconds + event.t) // 60) + 1,
            player_ids=event.playerIds,
            evidence_ids=[f.id for f in bundle.evidence if event.id in f.eventIds],
        )
        for i, event in enumerate(sorted(scenario.events, key=lambda e: e.t))
    ]


def build_packet(
    scenario_id: str, event_id: str | None = None, recap=False
) -> EvidencePacket:
    scenario = load_scenario(scenario_id)
    match = scenario_match(scenario_id)
    bundle = evidence_bundle(scenario_id)
    stream = event_stream(scenario_id)
    if event_id is not None and event_id not in {e.event_id for e in stream}:
        raise KeyError("Unknown event in scenario")
    target_ids = [event_id] if event_id else [e.event_id for e in stream]
    if recap:
        target_ids = [next(e.id for e in match.events if e.replay)]
    sources = []
    names = {
        p.id: f"{p.name} ({next(t.name for t in scenario.teams if t.id == p.teamId)})"
        for p in scenario.players
    }
    for event in scenario.events:
        # Event metadata is authored synthetic recording, never observed intent.
        statement = f"{event.label}. Recorded action: {event.type}. Players: {', '.join(names[p] for p in event.playerIds)}."
        if event.type == "dummy":
            statement += " Explicit non-contact: no touch and no possession transfer."
        sources.append(
            Source(
                id=f"event:{event.id}",
                kind="recorded_event",
                statement=statement,
                event_ids=[event.id],
            )
        )
    relevant = {e.event_id for e in stream} if event_id is None or recap else {event_id}
    primary = {m.focusEventId: m.primaryEvidenceId for m in bundle.moments}
    # At most two observations per target, preferring its exact tactical focus.
    for target in sorted(relevant):
        candidates = [f for f in bundle.evidence if target in f.eventIds]
        candidates.sort(
            key=lambda f: (
                0
                if f.id == primary.get(target)
                or (target == "dummy" and f.id.endswith(":dummy"))
                or (target in ("shot", "goal", "miss") and f.category == "finish")
                else 1
                if f.category == "corridor"
                else 2,
                f.id,
            )
        )
        for fact in candidates[:2]:
            if not any(s.id == fact.id for s in sources):
                sources.append(
                    Source(
                        id=fact.id,
                        kind="measurement",
                        statement=fact.observation,
                        event_ids=fact.eventIds,
                        evidence_id=fact.id,
                        units=sorted({m.unit for m in fact.metrics}),
                    )
                )
    for moment in bundle.moments:
        if (
            event_id is None
            or moment.start
            <= next(e.t for e in scenario.events if e.id == event_id)
            <= moment.end
        ):
            sources.append(
                Source(
                    id=f"authored:{moment.id}",
                    kind="authored_interpretation",
                    statement=moment.interpretation,
                    event_ids=[
                        e.id
                        for e in scenario.events
                        if moment.start <= e.t <= moment.end
                    ],
                )
            )
    clubs = {c.id: c.name for c in get_catalog().league.clubs}
    sources.append(
        Source(
            id=f"match:{match.id}",
            kind="match_metadata",
            statement=f"{clubs[match.homeId]} {match.score.home}–{match.score.away} {clubs[match.awayId]}. Final score; synthetic fixture.",
            event_ids=[],
        )
    )
    for event in match.events:
        sources.append(
            Source(
                id=f"match-event:{event.id}",
                kind="match_metadata",
                statement=f"{event.playerName}: {event.type} at minute {event.minute}. {event.headline}. "
                + (
                    "Linked reconstructed passage."
                    if event.replay
                    else "Metadata only; no reconstructed sequence available."
                ),
                event_ids=[event.id],
            )
        )
    allowed_source_ids = {}
    for target in target_ids:
        # A narrative may explain a linked pass/dummy/reception chain. Its
        # context is defined by measured event links, not guessed by the model.
        related = {target}
        for source in sources:
            if source.kind == "measurement" and target in source.event_ids:
                related.update(source.event_ids)
        is_recap = target not in {e.event_id for e in stream}
        allowed_source_ids[target] = [
            s.id
            for s in sources
            if is_recap
            or s.kind == "match_metadata"
            or (s.kind == "recorded_event" and bool(related.intersection(s.event_ids)))
            or target in s.event_ids
        ]
    content = {
        "scenario_id": scenario_id,
        "match_id": match.id,
        "source_hash": bundle.sourceHash,
        "evidence_hash": digest(bundle.model_dump(mode="json")),
        "evidence_version": bundle.version,
        "thresholds": bundle.thresholds.model_dump(),
        "target_ids": target_ids,
        "allowed_source_ids": allowed_source_ids,
        "events": [e.model_dump() for e in stream],
        "sources": [s.model_dump() for s in sources],
        "limitations": [
            "Synthetic reconstruction, not professional tracking or a live data feed.",
            "Geometry and recorded non-contact do not establish intent, deception, causation or alternative outcomes.",
            "Only the linked passage has replay geometry; other match events are metadata only.",
        ],
    }
    return EvidencePacket(**content, input_hash=digest(content))
