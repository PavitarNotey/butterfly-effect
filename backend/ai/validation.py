"""Conservative claim screening, not a semantic proof of generated prose."""

import re

from .citations import citation_policy
from .models import DraftSet, EvidencePacket, Mode, Narrative
from .reasoning import supported_mechanisms

# Quantities are only shown in immutable server excerpts. Block common written
# numbers as well as digits; this still is not a general natural-language proof.
QUANTITY_WORDS = (
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "twenty",
    "thirty",
    "hundred",
    "thousand",
    "million",
    "percent",
    "percentage",
    "half",
    "double",
    "twice",
    "xg",
)
QUANTITY = re.compile(
    r"\d|\b(" + "|".join(QUANTITY_WORDS) + r")\b",
    re.IGNORECASE,
)
UNSUPPORTED = re.compile(
    r"\b(fooled|deceiv\w*|hesitat\w*|intend\w*|intent\w*|wanted|knew|thought|aware\w*|caus\w*|forced|guarantee\w*|ensured|would have|could have|would've|probabilit\w*|ratings?|possession percentage|expected goals|tricked|distract\w*|decided|realized|realised|believed)\b",
    re.IGNORECASE,
)
REASONING = re.compile(
    r"\b(because|therefore|led to|results? in|resulted in|allows?|enables?|creates?|created|opens?|opened|frees|freed|draws?|drew|pulls?|pulled|designed|so that|means that|thanks to|as a result|consequently|due to|trigger\w*|set up)\b",
    re.IGNORECASE,
)


def normalized_sentence(text: str) -> str:
    return " ".join(text.casefold().replace("’", "'").split()).rstrip(".!?")


def validate_reasoning(narrative, packet):
    licenses = {}
    for mechanism in supported_mechanisms(packet, narrative.event_id):
        licenses.setdefault(normalized_sentence(mechanism.sentence), []).append(
            set(mechanism.support_ids)
        )
    for field in (narrative.headline, narrative.explanation, narrative.why_it_matters):
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", field):
            if not REASONING.search(sentence):
                continue
            support = licenses.get(normalized_sentence(sentence))
            if support is None:
                raise ValueError("Unsupported tactical mechanism")
            if not any(ids <= set(narrative.source_ids) for ids in support):
                raise ValueError("Tactical mechanism missing supporting citations")


def validate_draft(
    draft: DraftSet, packet: EvidencePacket, mode: Mode
) -> list[Narrative]:
    if [n.event_id for n in draft.narratives] != packet.target_ids:
        raise ValueError("Narrative target mismatch")
    sources = {s.id: s for s in packet.sources}
    result = []
    for narrative in draft.narratives:
        prose = (
            f"{narrative.headline} {narrative.explanation} {narrative.why_it_matters}"
        )
        quantity = QUANTITY.search(prose)
        unsupported = UNSUPPORTED.search(prose)
        if quantity or unsupported or re.search(r"[<>]|https?://", prose):
            # Safe diagnostic: only the policy category, never provider text.
            if quantity:
                rule = quantity.group().casefold()
                raise ValueError(
                    f"Quantitative prose (rule={rule if rule in QUANTITY_WORDS else 'digit'})"
                )
            raise ValueError("Causal/intent prose" if unsupported else "Unsafe markup")
        if len(set(narrative.source_ids)) != len(narrative.source_ids) or any(
            ref not in sources for ref in narrative.source_ids
        ):
            raise ValueError("Unknown or duplicate source")
        policy = citation_policy(packet, narrative.event_id, mode)
        anchor = policy.required_ids[0]
        if anchor not in narrative.source_ids:
            raise ValueError("Missing recorded event anchor")
        if any(id not in narrative.source_ids for id in policy.required_ids[1:]):
            raise ValueError("Recap requires recorded final score")
        selected = [sources[ref] for ref in narrative.source_ids]
        if any(
            s.id not in packet.allowed_source_ids[narrative.event_id] for s in selected
        ):
            raise ValueError("Source unrelated to event")
        # Surrounding-context measurements cannot substitute for observations
        # actually linked to this focus event in Analyst's citation contract.
        measured_count = sum(s.id in policy.measurement_ids for s in selected)
        if measured_count < policy.minimum_measurements:
            raise ValueError(
                f"Analyst requires measured spatial context (required={policy.minimum_measurements}, cited={measured_count})"
            )
        validate_reasoning(narrative, packet)
        result.append(
            Narrative(
                **narrative.model_dump(),
                mode=mode,
                key_evidence=selected,
                limitations=packet.limitations,
            )
        )
    return result
