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

SCENARIO_PATH = (
    Path(__file__).resolve().parents[2] / "frontend/src/replay/invisible-run.json"
)
REGISTRY = {"the-invisible-run": SCENARIO_PATH}
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
    # This is an authored guide, not an analytical algorithm or alternative scenario.
    # Its player/event references are validated before any evidence is generated.
    if s.id != "the-invisible-run":
        raise ValueError("No authored tactical guide registered for this scenario")
    events = {e.id: e for e in s.events}
    guide = [
        (
            "shape",
            "The initial shape",
            "build",
            "run",
            ["a7", "d4", "a9", "d5"],
            "The authored setup places Mercer inside Rowan and Pike in central cover.",
        ),
        (
            "run",
            "Rowan’s diagonal run",
            "run",
            "shift",
            ["a7", "d4", "d2"],
            "The authored run offers a plausible reason for nearby defenders to adjust; geometry cannot establish their motivation.",
        ),
        (
            "reshape",
            "Defensive reshaping",
            "shift",
            "pass",
            ["d4", "d2", "d5", "d3", "d6", "a7"],
            "The authored assignments give North the wide runner while Mercer recovers inside and Pike narrows. Assignment is metadata, not an inferred fact.",
        ),
        (
            "pass",
            "The passing corridor",
            "pass",
            "receive",
            ["a8", "a9", "d4", "d5"],
            "The recorded pass uses the inside-right channel after Mercer’s shift. This supports a tactical contribution, not proof of causation.",
        ),
        (
            "receive",
            "Voss receives",
            "receive",
            "shot",
            ["a9", "d5", "d4", "d6"],
            "Voss receives with cover still nearby; the scenario does not show an undefended area or guarantee a successful finish.",
        ),
        (
            "finish",
            "The finish",
            "shot",
            "goal",
            ["a9", "d5", "d4", "d1"],
            "The authored shot travels across recovering cover. The replay does not establish what would happen without Rowan’s run.",
        ),
    ]
    for _, _, a, b, players, _ in guide:
        if a not in events or b not in events:
            raise ValueError("Guide references missing event")
        for id in players:
            find_player(s, id)
    release, arrival = events["pass"].t, events["receive"].t
    actual = corridor(s, "a8", "a9", release, arrival, config)
    target = actual.end
    team_id = find_player(s, "a9").teamId
    facts, moments = [], []
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
                        "Signed change in X; positive is toward Aurora’s attacking goal.",
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
        earlier = preview_corridor(s, "a8", "a9", target, start, config)
        later = preview_corridor(s, "a8", "a9", target, min(end, release), config)
        if key == "pass":
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
        pair = relationship(s, "a9", "d5", start)
        add(
            "relationships",
            "cover",
            "Voss and Pike · cover distance",
            f"Pike is {pair.distance:.2f} m from Voss at {start:g} s and is {'goal-side' if pair.defenderGoalSide else 'not goal-side'} under the longitudinal definition.",
            [
                metric(
                    "Player separation",
                    pair.distance,
                    "m",
                    "Planar distance between the two tracking centres.",
                ),
                metric(
                    "Goal-side",
                    int(pair.defenderGoalSide),
                    "boolean",
                    "Defender is closer along the attacking X direction to the attacking goal; lateral coverage is not implied.",
                ),
            ],
            ["a9", "d5"],
        )
        if key == "finish":
            gap, t, id = min(
                (
                    *closest_approach(find_player(s, id).positions, s.ball, start, end),
                    id,
                )
                for id in ["d1", "d4", "d5"]
            )
            goal = position(s.ball, end)
            add(
                "finish",
                "shot",
                "Recorded finish · ball and recovery",
                f"Across the shot interval the nearest of Holt, Mercer and Pike is {gap:.2f} m from the ball in pitch projection. The recorded goal point is X={goal[0]:.2f}, Y={goal[1]:.2f}, Z={goal[2]:.2f} m.",
                [
                    metric(
                        "Recovery clearance",
                        gap,
                        "m",
                        "Exact simultaneous planar gap to Holt, Mercer or Pike during the shot.",
                    ),
                    metric(
                        "Closest instant",
                        t,
                        "s",
                        "Scenario time of that closest approach.",
                    ),
                    metric(
                        "Goal height",
                        goal[1],
                        "m",
                        "Recorded ball-centre height at the goal event.",
                    ),
                ],
            )
        moments.append(
            TacticalMoment(
                id=key,
                title=title,
                start=start,
                end=end,
                playerIds=players,
                evidenceIds=ids,
                interpretation=interpretation,
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
    pairs = [("a7", "d4"), ("a7", "d2"), ("a8", "a9"), ("a9", "d5")]
    frames = [
        TacticalFrame(
            t=t,
            relationships=[relationship(s, a, b, t) for a, b in pairs],
            corridor=preview_corridor(
                s, "a8", "a9", target, t, config, release_point=position(s.ball, t)
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
        shotPath=crop(s.ball, events["shot"].t, events["goal"].t),
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
