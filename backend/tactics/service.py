"""Scenario registry, authored presentation guides, and cached computed evidence."""

import hashlib
from functools import lru_cache
from itertools import pairwise
from pathlib import Path

from .engine import (
    closest_approach,
    corridor,
    crop,
    find_player,
    movement,
    position,
    preview_corridor,
    relationship,
    space,
)
from .models import (
    ChainLink,
    Evidence,
    EvidenceBundle,
    Metric,
    Scenario,
    TacticalFrame,
    TacticalMoment,
    Thresholds,
)

# Standalone deployments carry byte-identical canonical data beside the API.
# Repository development and Render retain the original source location.
SCENARIO_DIRECTORY = Path(__file__).resolve().parents[1] / "scenarios"
if not SCENARIO_DIRECTORY.is_dir():
    SCENARIO_DIRECTORY = Path(__file__).resolve().parents[2] / "frontend/src/replay"
SCENARIO_PATH = SCENARIO_DIRECTORY / "invisible-run.json"
REGISTRY = {
    "the-invisible-run": SCENARIO_PATH,
    "the-missed-chance": SCENARIO_PATH.with_name("missed-chance.json"),
    "the-untouched-pass": SCENARIO_PATH.with_name("untouched-pass.json"),
}
ASSUMPTIONS = [
    "Planar X/Z metres; linear track interpolation; authored headings do not establish awareness.",
    "Distances are between tracking centres, without body reach, reaction time, acceleration or interception probability.",
    "Obstructed: simultaneous centre gap <= half-width. Contested: gap <= half-width + margin, or a defender sweeps across the corridor.",
    "Clear means clear under these geometric thresholds; it is not a prediction of pass success.",
    "Observations and temporal chains do not establish causation; no counterfactual has been simulated.",
    "Live metrics are sampled at <=0.25 s intervals. Overlay coordinates interpolate across every authored position key.",
]


def load_source(id):
    if id not in REGISTRY:
        raise KeyError(id)
    text = REGISTRY[id].read_bytes().decode("utf-8")
    return Scenario.model_validate_json(text), text


def load_scenario(id):
    return load_source(id)[0]


def metric(name, value, unit, definition):
    return Metric(name=name, value=round(value, 4), unit=unit, definition=definition)


def fact_recorder(s, facts, key, ids, vector_start, start, end, players, a, b):
    def add(category, suffix, label, observation, metrics, player_ids=None):
        id = f"{s.id}:v1:{key}:{suffix}"
        ids.append(id)
        facts.append(
            Evidence(
                id=id,
                category=category,
                title=label,
                start=vector_start if category == "movement" else start,
                end=end,
                playerIds=player_ids or players,
                eventIds=[a, b],
                observation=observation,
                metrics=metrics,
                limitations=ASSUMPTIONS[:1] + ASSUMPTIONS[4:5],
            )
        )

    return add


def build_bundle(s: Scenario, source_hash: str, config: Thresholds) -> EvidenceBundle:
    from .guides import GUIDES, SEQUENCES

    if s.id not in GUIDES:
        raise ValueError("No authored tactical guide registered for this scenario")
    config_guide = GUIDES[s.id]
    guide = config_guide.phases
    passer, receiver, cover = (
        config_guide.passer,
        config_guide.receiver,
        config_guide.cover,
    )
    events = {e.id: e for e in s.events}
    for id in [
        passer,
        receiver,
        cover,
        *config_guide.recovery,
        *config_guide.back_line,
        *config_guide.midfield,
        config_guide.pressure,
        config_guide.balance,
        *[id for pair in config_guide.pairs for id in pair],
    ]:
        find_player(s, id)
    for _, _, a, b, players, _ in guide:
        if a not in events or b not in events:
            raise ValueError("Guide references missing event")
        for id in players:
            find_player(s, id)
    if any(
        id not in events
        for id in ["pass", "receive", "run", "shot", config_guide.finish]
    ):
        raise ValueError("Guide references missing required event")
    release, arrival = events["pass"].t, events["receive"].t
    actual = corridor(s, passer, receiver, release, arrival, config)
    target = actual.end
    team_id = find_player(s, receiver).teamId
    facts, phase_ids = [], {}
    for key, title, a, b, players, interpretation in guide:
        start, end = events[a].t, events[b].t
        # The reshaping vector includes the preceding run interval, shown explicitly in its metrics.
        vector_start = events["run"].t if key == "reshape" else start
        moves = [movement(s, id, vector_start, end) for id in players]
        ids = []

        add = fact_recorder(s, facts, key, ids, vector_start, start, end, players, a, b)

        for m in moves:
            name = find_player(s, m.playerId).name
            add(
                "movement",
                m.playerId,
                f"{name} · displacement",
                f"{name} moves {m.longitudinal:+.1f} m along X and {m.lateral:+.1f} m along Z over {vector_start:g}–{end:g} s.",
                [
                    metric(
                        "Longitudinal shift",
                        m.longitudinal,
                        "m",
                        "Signed change in world X; consult the player team attackDirection for attacking sign.",
                    ),
                    metric(
                        "Lateral shift",
                        m.lateral,
                        "m",
                        "Signed change in Z across the pitch.",
                    ),
                    metric(
                        "Path length",
                        m.pathLength,
                        "m",
                        "Sum of planar distances along authored linear segments.",
                    ),
                    metric(
                        "Mean speed",
                        m.meanSpeed,
                        "m/s",
                        "Path length divided by interval duration.",
                    ),
                ],
                [m.playerId],
            )
        earlier = preview_corridor(s, passer, receiver, target, start, config)
        later = preview_corridor(s, passer, receiver, target, min(end, release), config)
        dummy = next((e for e in s.events if e.type == "dummy" and e.id == a), None)
        if dummy is not None:
            gap, passage = closest_approach(
                find_player(s, dummy.actorId).positions, s.ball, release, arrival
            )
            add(
                "corridor",
                "dummy",
                "The pass continues without a touch",
                f"The ball passes {gap:.3f} m from {find_player(s, dummy.actorId).name}'s tracking centre at {passage:.2f} s and reaches {find_player(s, receiver).name} at {arrival:.2f} s. The linked dummy explicitly records no contact or possession transfer; centre proximity alone cannot establish body clearance.",
                [
                    metric(
                        "Dummy centre gap",
                        gap,
                        "m",
                        "Exact simultaneous planar ball-to-actor tracking-centre separation over the linked pass flight; not body-surface clearance.",
                    ),
                    metric(
                        "Passage time",
                        passage,
                        "s",
                        "Time of the minimum tracking-centre separation.",
                    ),
                    metric(
                        "Arrival after passage",
                        arrival - passage,
                        "s",
                        "Real receiver contact time minus closest passage time.",
                    ),
                    metric(
                        "Moving ball clearance",
                        actual.movingClosest.distance,
                        "m",
                        "Exact simultaneous nearest defending tracking-centre distance during the complete pass.",
                    ),
                ],
            )
            facts[-1].eventIds = [dummy.passEventId, dummy.id, dummy.receiveEventId]
        elif key == "pass":
            add(
                "corridor",
                "corridor",
                "Recorded pass · moving defenders",
                f"The closest defender-to-ball gap is {actual.movingClosest.distance:.2f} m at {actual.movingClosest.t:.2f} s. The pass is {actual.state} under the selected thresholds.",
                [
                    metric(
                        "Release corridor clearance",
                        actual.staticDistance,
                        "m",
                        "Minimum defender distance to the complete ball-path polyline at release.",
                    ),
                    metric(
                        "Moving ball clearance",
                        actual.movingClosest.distance,
                        "m",
                        "Exact simultaneous defender-to-ball closest approach during travel.",
                    ),
                    metric(
                        "Swept corridor clearance",
                        actual.sweptCorridorDistance,
                        "m",
                        "Minimum separation between any defender path and the ball-path polyline, regardless of arrival time.",
                    ),
                    metric(
                        "Corridor half-width",
                        config.corridorHalfWidth,
                        "m",
                        "Distance threshold on each side of the centreline.",
                    ),
                ],
            )
        elif start < release:
            add(
                "corridor",
                "corridor",
                "Receiving corridor · static comparison",
                f"Geometric clearance to the receiving-point corridor changes from {earlier.staticDistance:.2f} m to {later.staticDistance:.2f} m; this static comparison is not a travel-time safety prediction.",
                [
                    metric(
                        "Start clearance",
                        earlier.staticDistance,
                        "m",
                        "Nearest defender to the proposed passer-to-receiving-point segment at interval start.",
                    ),
                    metric(
                        "Later clearance",
                        later.staticDistance,
                        "m",
                        "Same definition at the interval end, capped at ball release.",
                    ),
                ],
            )
        before = space(s, target, team_id, events["run"].t, config.coverageRadius)
        coverage = space(s, target, team_id, start, config.coverageRadius)
        add(
            "space",
            "space",
            "Receiving point · defensive coverage",
            f"At {start:g} s the nearest defender is {coverage.nearestDistance:.2f} m from the recorded receiving point; {coverage.defendersWithinRadius} defender{'' if coverage.defendersWithinRadius == 1 else 's'} within {coverage.radius:g} m.",
            [
                metric(
                    "Nearest defender",
                    coverage.nearestDistance,
                    "m",
                    "Planar distance from the fixed recorded receiving point to its nearest defender.",
                ),
                metric(
                    "Change since run began",
                    coverage.nearestDistance - before.nearestDistance,
                    "m",
                    "Nearest-defender distance now minus its value at the run event.",
                ),
                metric(
                    "Defenders within radius",
                    coverage.defendersWithinRadius,
                    "players",
                    f"Defender tracking centres within {config.coverageRadius:g} m of that point.",
                ),
                metric(
                    "Coverage radius",
                    config.coverageRadius,
                    "m",
                    "Radius used for the defender count.",
                ),
            ],
        )
        pair = relationship(s, receiver, cover, start)
        end_pair = relationship(s, receiver, cover, end)
        add(
            "relationships",
            "cover",
            f"{find_player(s, receiver).name} and {find_player(s, cover).name} · cover distance",
            f"Separation changes from {pair.distance:.2f} m at {start:g} s to {end_pair.distance:.2f} m at {end:g} s. {find_player(s, cover).name} is {'goal-side' if pair.defenderGoalSide else 'not goal-side'} under the longitudinal definition.",
            [
                metric(
                    "Player separation",
                    pair.distance,
                    "m",
                    "Planar distance between the two tracking centres.",
                ),
                metric(
                    "End separation",
                    end_pair.distance,
                    "m",
                    "Player centre separation at interval end.",
                ),
                metric(
                    "Separation change",
                    end_pair.distance - pair.distance,
                    "m",
                    "End minus start centre separation; negative means the gap narrows.",
                ),
                metric(
                    "Goal-side",
                    int(pair.defenderGoalSide),
                    "boolean",
                    "Defender is closer along the attacking X direction to the attacking goal; lateral coverage is not implied.",
                ),
            ],
            [receiver, cover],
        )
        if key == "finish":
            gap, t, id = min(
                (
                    *closest_approach(find_player(s, id).positions, s.ball, start, end),
                    id,
                )
                for id in config_guide.recovery
            )
            finish_point = position(s.ball, end)
            add(
                "finish",
                "shot",
                "Recorded finish · ball and recovery",
                f"Across the shot interval the nearest of the guide’s recovering defenders and goalkeeper is {gap:.2f} m from the ball in pitch projection. The recorded {config_guide.finish} point is X={finish_point[0]:.2f}, Y={finish_point[1]:.2f}, Z={finish_point[2]:.2f} m.",
                [
                    metric(
                        "Recovery clearance",
                        gap,
                        "m",
                        "Exact simultaneous planar gap to the guide’s recovery players during the shot.",
                    ),
                    metric(
                        "Closest instant",
                        t,
                        "s",
                        "Scenario time of that closest approach.",
                    ),
                    metric(
                        "Finish height",
                        finish_point[1],
                        "m",
                        "Recorded ball-centre height at the final shot event.",
                    ),
                ],
            )
        phase_ids[key] = ids
    # Preserve fine-grained observations/IDs, but expose only complete viewer
    # sequences. Their paths are cropped from the same canonical linear keys.
    moments = []
    for sequence in SEQUENCES[s.id]:
        start = events[sequence.start].t
        end = min(s.duration, events[sequence.end].t + sequence.after)
        ids = [id for key in sequence.steps for id in phase_ids[key]]
        moves = [movement(s, id, start, end) for id in sequence.players]
        if sequence.follow:
            move = next(m for m in moves if m.playerId == sequence.follow)
            name = find_player(s, move.playerId).name
            add = fact_recorder(
                s,
                facts,
                "sequence-run",
                ids,
                start,
                start,
                end,
                list(sequence.players),
                sequence.start,
                sequence.end,
            )
            add(
                "movement",
                move.playerId,
                f"{name} · complete recorded approach",
                f"{name}'s recorded route covers {move.pathLength:.2f} m over {start:g}–{end:g} s. Earlier movement is not reconstructed.",
                [
                    metric(
                        "Path length",
                        move.pathLength,
                        "m",
                        "Sum of planar distances along the complete recorded interval's linear keys.",
                    ),
                    metric(
                        "Mean speed",
                        move.meanSpeed,
                        "m/s",
                        "Recorded path length divided by the interval duration.",
                    ),
                ],
                [move.playerId],
            )
            facts[-1].eventIds = list(
                dict.fromkeys((sequence.start, sequence.focus, sequence.end))
            )
        primary = f"{s.id}:v1:{sequence.primary}"
        if primary not in ids:
            raise ValueError("Sequence primary must reference a computed observation")
        moments.append(
            TacticalMoment(
                id=sequence.id,
                title=sequence.title,
                start=start,
                focusTime=events[sequence.focus].t,
                end=end,
                focusEventId=sequence.focus,
                primaryEvidenceId=primary,
                followPlayerId=sequence.follow,
                focus=sequence.layer,
                playerIds=list(sequence.players),
                evidenceIds=[primary, *(id for id in ids if id != primary)],
                interpretation=sequence.interpretation,
                movements=moves,
            )
        )
    # Include every authored key: geometric interpolation between frames remains identical to replay tracks.
    times = sorted(
        {
            0.0,
            s.duration,
            *(i / 4 for i in range(int(s.duration * 4) + 1)),
            *(k.t for p in s.players for k in p.positions),
            *(k.t for k in s.ball),
        }
    )
    pairs = config_guide.pairs
    frames = [
        TacticalFrame(
            t=t,
            relationships=[relationship(s, a, b, t) for a, b in pairs],
            corridor=preview_corridor(
                s,
                passer,
                receiver,
                target,
                t,
                config,
                release_point=position(s.ball, t),
            )
            if t < release
            else actual,
            space=space(s, target, team_id, t, config.coverageRadius),
        )
        for t in times
    ]
    chain = [
        ChainLink(
            fromMomentId=a.id,
            toMomentId=b.id,
            evidenceIds=[*a.evidenceIds, *b.evidenceIds],
        )
        for a, b in pairwise(moments)
    ]
    return EvidenceBundle(
        scenarioId=s.id,
        sourceHash=source_hash,
        thresholds=config,
        sampleStep=0.25,
        moments=moments,
        evidence=facts,
        chain=chain,
        frames=frames,
        shotPath=crop(s.ball, events["shot"].t, events[config_guide.finish].t),
        actualPass=actual,
        assumptions=ASSUMPTIONS,
    )


@lru_cache(maxsize=8)
def cached_bundle(text, half_width, margin, radius):
    s = Scenario.model_validate_json(text)
    return build_bundle(
        s,
        hashlib.sha256(text.encode()).hexdigest(),
        Thresholds(
            corridorHalfWidth=half_width, contestedMargin=margin, coverageRadius=radius
        ),
    )


def evidence_bundle(id, config=None):
    _, text = load_source(id)
    config = config or Thresholds()
    return cached_bundle(
        text, config.corridorHalfWidth, config.contestedMargin, config.coverageRadius
    )
