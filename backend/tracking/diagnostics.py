"""Sample-aware authoring diagnostics; thresholds are warnings, not athlete laws."""

import math
from itertools import combinations, pairwise
from statistics import mean

from tactics.engine import at, closest_approach, distance, position, yaw
from tactics.models import PositionKey

DEFAULTS = {
    "sample_step": 0.5,
    "max_gap": 0.151,
    "speed": 9,
    "acceleration": 8,
    "turn_rate": 3,
    "key_turn": 1.5,
    "heading_rate": 3,
    "overlap": 0.8,
    "touch_distance": 1.5,
}


def motion(keys, facing=None, step=0.5):
    """Return finite-window planar motion diagnostics, or None for too few keys.

    step controls derivative sampling; facing optionally adds heading rates.
    Reported acceleration is a sampled speed change, not instantaneous dynamics
    at a piecewise-linear key or an athlete-specific biomechanical limit.
    """
    if len(keys) < 2:
        return None
    # Derivatives over a finite window, never the infinite acceleration at a linear key.
    start, end = keys[0].t, keys[-1].t
    times = [start + i * step for i in range(int((end - start) / step) + 1)]
    if times[-1] < end - 1e-7:
        times.append(end)
    velocities = []
    for a, b in pairwise(times):
        p, q = position(keys, a), position(keys, b)
        velocities.append(
            ((p[0] - q[0]) / (a - b), (p[2] - q[2]) / (a - b), (a + b) / 2)
        )
    speeds = [math.hypot(v[0], v[1]) for v in velocities]
    accelerations = []
    turns = []
    for a, b in pairwise(velocities):
        dt = b[2] - a[2]
        accelerations.append((math.hypot(b[0], b[1]) - math.hypot(a[0], a[1])) / dt)
        if min(math.hypot(*a[:2]), math.hypot(*b[:2])) > 1:
            delta = math.atan2(b[1], b[0]) - math.atan2(a[1], a[0])
            turns.append(abs(math.atan2(math.sin(delta), math.cos(delta))) / dt)
    headings = []
    if facing:
        for a, b in pairwise(times):
            d = yaw(facing, b) - yaw(facing, a)
            headings.append(abs(math.atan2(math.sin(d), math.cos(d))) / (b - a))
    raw_speed = [
        distance(a.position, b.position) / (b.t - a.t) for a, b in pairwise(keys)
    ]
    key_turns = []
    running_key_turns = []
    for a, b, c in zip(keys, keys[1:], keys[2:]):
        u = (b.position[0] - a.position[0], b.position[2] - a.position[2])
        v = (c.position[0] - b.position[0], c.position[2] - b.position[2])
        if math.hypot(*u) > 0.1 and math.hypot(*v) > 0.1:
            d = math.atan2(v[1], v[0]) - math.atan2(u[1], u[0])
            angle = abs(math.atan2(math.sin(d), math.cos(d)))
            key_turns.append(angle)
            if min(math.hypot(*u) / (b.t - a.t), math.hypot(*v) / (c.t - b.t)) > 1:
                running_key_turns.append(angle)
    return {
        "sample_step": step,
        "duration": end - start,
        "displacement": distance(keys[0].position, keys[-1].position),
        "path_length": sum(distance(a.position, b.position) for a, b in pairwise(keys)),
        "max_segment_speed": max(raw_speed, default=0),
        "max_window_speed": max(speeds, default=0),
        "mean_window_speed": mean(speeds) if speeds else 0,
        "max_acceleration": max([0, *accelerations]),
        "max_deceleration": abs(min([0, *accelerations])),
        "max_turn_rate": max(turns, default=0),
        "max_heading_rate": max(headings) if headings else None,
        "max_key_turn": max(key_turns, default=0),
        "max_running_key_turn": max(running_key_turns, default=0),
    }


def flags(metrics, thresholds):
    """Return metrics exceeding named warning thresholds; do not modify source tracks."""
    names = {
        "max_segment_speed": "speed",
        "max_acceleration": "acceleration",
        "max_deceleration": "acceleration",
        "max_turn_rate": "turn_rate",
        "max_heading_rate": "heading_rate",
        "max_running_key_turn": "key_turn",
    }
    return {
        key: value
        for key, limit in names.items()
        if (value := metrics[key]) is not None and value > thresholds[limit]
    }


def compactness(points):
    """Summarize planar group width, depth and centroid radius, or None if empty."""
    if not points:
        return None
    center = (mean(p[0] for p in points), 0, mean(p[2] for p in points))
    return {
        "depth": max(p[0] for p in points) - min(p[0] for p in points),
        "width": max(p[2] for p in points) - min(p[2] for p in points),
        "mean_centroid_radius": mean(distance(p, center) for p in points),
        "players": len(points),
    }


def collective(s, guide, t):
    """Report defensive geometry at t using authored guide groups and responsibilities."""
    back = [at(s, id, t) for id in guide.back_line]
    middle = [at(s, id, t) for id in guide.midfield]
    receiver = at(s, guide.receiver, t)
    defending_team = next(p.teamId for p in s.players if p.id == guide.cover)
    return {
        "t": t,
        "outfield_compactness": compactness(
            [
                at(s, p.id, t)
                for p in s.players
                if p.teamId == defending_team and p.role != "Goalkeeper"
            ]
        ),
        "line_width": max(p[2] for p in back) - min(p[2] for p in back),
        "line_depth": max(p[0] for p in back) - min(p[0] for p in back),
        "unit_gap": abs(mean(p[0] for p in back) - mean(p[0] for p in middle)),
        "central_cover_count": sum(abs(p[2]) <= 10 for p in back),
        "goal_side_cover": [
            id
            for id in guide.back_line
            if (at(s, id, t)[0] - receiver[0])
            * next(
                team.attackDirection
                for team in s.teams
                if team.id
                == next(p.teamId for p in s.players if p.id == guide.receiver)
            )
            > 0
        ],
        "nearest_defender_to_ball": min(
            [
                p
                for p in s.players
                if p.teamId
                != next(p.teamId for p in s.players if p.id == guide.receiver)
            ],
            key=lambda p: distance(at(s, p.id, t), position(s.ball, t)),
        ).id,
        "authored_responsibilities": {
            "first_pressure": guide.pressure,
            "cover": guide.cover,
            "balance": guide.balance,
        },
        "cover_separation": distance(receiver, at(s, guide.cover, t)),
        "back_line_lateral_shift": mean(
            p[2] - at(s, id, 0)[2] for p, id in zip(back, guide.back_line)
        ),
    }


def synthetic_report(s, guide, thresholds=None):
    """Audit complete canonical tracks against optional warning thresholds.

    Returns motion, overlap, contact and authored-unit diagnostics; warning
    thresholds neither prove realism nor change canonical positions.
    """
    thresholds = DEFAULTS | (thresholds or {})
    movements = {
        p.id: motion(p.positions, p.facing, thresholds["sample_step"])
        for p in s.players
    }
    closest = min(
        (*closest_approach(a.positions, b.positions, 0, s.duration), a.id, b.id)
        for a, b in combinations(s.players, 2)
    )
    touches = [
        {
            "event": e.id,
            "t": e.t,
            "player": e.playerIds[0],
            "distance": distance(at(s, e.playerIds[0], e.t), position(s.ball, e.t)),
        }
        for e in s.events
        if e.type in ["carry", "pass", "receive", "shot"] and e.playerIds
    ]
    events = {e.id: e for e in s.events}
    return {
        "source": s.id,
        "provenance": "synthetic_authored",
        "thresholds": thresholds,
        "method": "Piecewise linear positions; finite-window speed changes at 0.5 s; not instantaneous biomechanical acceleration.",
        "players": movements,
        "warnings": {
            id: problem
            for id, m in movements.items()
            if (problem := flags(m, thresholds))
        },
        "closest_players": {
            "distance": closest[0],
            "t": closest[1],
            "players": closest[2:],
        },
        "overlap_warning": closest[0] < thresholds["overlap"],
        "continuity": "Complete finite validated tracks; segment-speed limits flag large position jumps. No runtime fills.",
        "touches": touches,
        "touch_warnings": [
            touch
            for touch in touches
            if touch["distance"] > thresholds["touch_distance"]
        ],
        "collective": [collective(s, guide, e.t) for e in s.events],
        "event_sync": {
            "pass_release": events["pass"].t,
            "receive": events["receive"].t,
            "shot": events["shot"].t,
            "finish": events[guide.finish].t,
            "final_ball": position(s.ball, events[guide.finish].t),
            "possession_release_matches": any(
                p.t == events["pass"].t and p.playerId is None for p in s.possession
            ),
            "possession_receive_matches": any(
                p.t == events["receive"].t and p.playerId == guide.receiver
                for p in s.possession
            ),
        },
    }


def imported_report(segment, thresholds=None):
    """Audit provider observations without filling gaps or inferring body headings.

    segment supplies source-provenance frames; thresholds control warnings.
    Missing points and long gaps split motion chunks so unseen travel cannot
    produce a fabricated velocity between observations.
    """
    thresholds = DEFAULTS | (thresholds or {})
    # Split at gaps and missing points: no phantom velocity across unseen intervals.
    runs = {}
    for player in segment.roster:
        chunks = []
        current = []
        previous = None
        for f in segment.frames:
            o = next((o for o in f.players if o.id == player.id), None)
            if (
                o is None
                or o.position is None
                or (previous is not None and f.t - previous > thresholds["max_gap"])
            ):
                if len(current) >= 2:
                    chunks.append(current)
                current = []
            if o and o.position is not None:
                current.append(PositionKey(t=f.t, position=o.position))
            previous = f.t
        if len(current) >= 2:
            chunks.append(current)
        if chunks:
            runs[player.id] = [
                motion(chunk, step=thresholds["sample_step"]) for chunk in chunks
            ]
    first = segment.frames[0]
    present = [o for o in first.players if o.position is not None]
    pairs = [
        (distance(a.position, b.position), a.id, b.id)
        for a, b in combinations(present, 2)
        if next(p.team_id for p in segment.roster if p.id == a.id)
        != next(p.team_id for p in segment.roster if p.id == b.id)
    ]
    closest = min(pairs)
    by_id = {p.id: p for p in segment.roster}
    sampled_pairs = [
        (distance(a.position, b.position), f.t, a.id, b.id)
        for f in segment.frames
        for a, b in combinations([o for o in f.players if o.position is not None], 2)
    ]
    minimum = min(sampled_pairs, default=None)
    shape = []
    for f in [
        segment.frames[0],
        segment.frames[len(segment.frames) // 2],
        segment.frames[-1],
    ]:
        for team in segment.teams:
            obs = [
                o
                for o in f.players
                if o.position is not None and by_id[o.id].team_id == team
            ]
            back = [o for o in obs if "Back" in by_id[o.id].role]
            midfield = [o for o in obs if "Midfield" in by_id[o.id].role]
            if back and midfield:
                shape.append(
                    {
                        "t": f.t,
                        "team": team,
                        "grouping": "Source lineup roles; not inferred assignments",
                        "outfield_compactness": compactness(
                            [
                                o.position
                                for o in obs
                                if by_id[o.id].role != "Goalkeeper"
                            ]
                        ),
                        "line_width": max(o.position[2] for o in back)
                        - min(o.position[2] for o in back),
                        "line_depth": max(o.position[0] for o in back)
                        - min(o.position[0] for o in back),
                        "unit_gap": abs(
                            mean(o.position[0] for o in back)
                            - mean(o.position[0] for o in midfield)
                        ),
                        "central_cover_count": sum(
                            abs(o.position[2]) <= 10 for o in back
                        ),
                        "nearest_to_ball": min(
                            obs, key=lambda o: distance(o.position, f.ball.position)
                        ).id
                        if f.ball.position
                        else None,
                    }
                )
    return {
        "source": segment.match_id,
        "thresholds": thresholds,
        "method": "Unsmoothed provider points; finite-window derivatives split at >0.151 s gaps and missing observations. Extrapolation/identity noise prevents athletic calibration.",
        "players": runs,
        "warnings": {
            id: [flags(m, thresholds) for m in chunks if flags(m, thresholds)]
            for id, chunks in runs.items()
            if any(flags(m, thresholds) for m in chunks)
        },
        "nearest_opponents_at_start": {
            "distance": closest[0],
            "players": closest[1:],
            "t": first.t,
        },
        "quality": segment.quality,
        "sampled_closest_players": {
            "distance": minimum[0],
            "t": minimum[1],
            "players": minimum[2:],
        }
        if minimum
        else None,
        "overlap_samples": sum(
            pair[0] < thresholds["overlap"] for pair in sampled_pairs
        ),
        "collective": shape,
        "event_sync": "No pass/shot event annotations imported. Possession is retained as provider metadata; touches cannot be validated from it alone.",
        "heading": "Not supplied by this tracking source; unknown, never replaced by travel direction.",
    }
