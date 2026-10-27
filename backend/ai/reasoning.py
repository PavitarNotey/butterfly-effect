"""Small, auditable licenses for observable mechanisms, not a semantic judge.

Prose outside these sentences remains free-form under the conservative screen.
Each license requires exact current observations AND explicit supporting citations.
Never grant an exception to an entire paragraph just because it has citations.
"""

from dataclasses import dataclass

from tactics.service import evidence_bundle, load_scenario

from .models import EvidencePacket


@dataclass(frozen=True)
class Mechanism:
    sentence: str
    support_ids: tuple[str, ...]


def supported_mechanisms(packet: EvidencePacket, target: str) -> list[Mechanism]:
    scenario = load_scenario(packet.scenario_id)
    bundle = evidence_bundle(packet.scenario_id)
    if packet.source_hash != bundle.sourceHash:
        return []
    available = {
        s.id: s for s in packet.sources if s.id in packet.allowed_source_ids[target]
    }
    facts = {
        f.id: f
        for f in bundle.evidence
        if f.id in available
        and available[f.id].kind == "measurement"
        and available[f.id].evidence_id == f.id
        and available[f.id].statement == f.observation
        and available[f.id].event_ids == f.eventIds
    }
    names = {p.id: p.name for p in scenario.players}
    result = []
    for event in scenario.events:
        if event.type != "dummy":
            continue
        fact = next((f for f in facts.values() if f.id.endswith(":dummy:dummy")), None)
        receive = next(e for e in scenario.events if e.id == event.receiveEventId)
        if fact and event.nonContact and not event.possessionTransfer:
            actor, receiver = names[event.actorId], names[receive.playerIds[0]]
            result.extend(
                Mechanism(sentence, (fact.id,))
                for sentence in (
                    f"The pass continues to {receiver} because {actor} leaves it untouched.",
                    f"{actor}'s dummy allows the same pass to continue to {receiver} without a touch.",
                    f"The ball therefore reaches {receiver} without an intervening touch by {actor}.",
                )
            )
    for fact in facts.values():
        metrics = {m.name: m.value for m in fact.metrics}
        if fact.category == "relationships" and metrics.get("Separation change", 0) < 0:
            attacker, defender = (names[p] for p in fact.playerIds)
            result.append(
                Mechanism(
                    f"The pressure is closer because {defender} narrows the gap to {attacker}.",
                    (fact.id,),
                )
            )
    # A recorded reception followed by the same player's shot is chronology,
    # explicitly not a claim that an earlier movement caused the goal/miss.
    receive = next((e for e in scenario.events if e.id == "receive"), None)
    shot = next((e for e in scenario.events if e.type == "shot"), None)
    if receive:
        for fact in facts.values():
            if (
                ":sequence-run:" in fact.id
                and fact.playerIds == [receive.playerIds[0]]
                and fact.end == receive.t
            ):
                result.append(
                    Mechanism(
                        "This run appears designed to meet the pass at the receiving point.",
                        (fact.id, f"event:{receive.id}"),
                    )
                )
    if (
        receive
        and shot
        and receive.t < shot.t
        and receive.playerIds[0] == shot.playerIds[0]
    ):
        refs = (f"event:{receive.id}", f"event:{shot.id}")
        if all(id in available for id in refs):
            result.append(
                Mechanism(
                    f"The reception led to a shot by {names[shot.playerIds[0]]}.",
                    refs,
                )
            )
    return result
