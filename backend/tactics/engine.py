"""Small deterministic geometry engine. All distances are planar X/Z metres."""

from itertools import combinations, pairwise
from math import atan2, cos, hypot, isfinite, sin

from .models import (
    ClosestApproach,
    Corridor,
    Movement,
    PlayerSample,
    PositionKey,
    Relationship,
    Scenario,
    Space,
    Spatial,
    Thresholds,
)


def clamp_time(t, duration):
    return max(0.0, min(duration, t if isfinite(t) else 0.0))


def segment(keys, t):
    t = clamp_time(t, keys[-1].t)
    for a, b in pairwise(keys):
        if t < b.t:
            return a, b, (t - a.t) / (b.t - a.t)
    return keys[-1], keys[-1], 0.0


def position(keys, t):
    a, b, f = segment(keys, t)
    return tuple(v + (w - v) * f for v, w in zip(a.position, b.position))


def yaw(keys, t):
    a, b, f = segment(keys, t)
    return a.yaw + atan2(sin(b.yaw - a.yaw), cos(b.yaw - a.yaw)) * f


def distance(a, b):
    return hypot(a[0] - b[0], a[2] - b[2])


def speed(keys, t):
    a, b, _ = segment(keys, t)
    return 0.0 if a is b else distance(a.position, b.position) / (b.t - a.t)


def at(s, player_id, t):
    return position(find_player(s, player_id).positions, t)


def find_player(s, player_id):
    for p in s.players:
        if p.id == player_id:
            return p
    raise ValueError(f"Unknown player: {player_id}")


def interval(s, start, end):
    if (
        not all(isfinite(t) for t in (start, end))
        or not 0 <= start <= end <= s.duration
    ):
        raise ValueError("Require 0 <= start <= end <= scenario duration")


def crop(keys, start, end):
    times = sorted({start, end, *(k.t for k in keys if start < k.t < end)})
    return [PositionKey(t=t, position=position(keys, t)) for t in times]


def movement(s: Scenario, player_id: str, start: float, end: float) -> Movement:
    interval(s, start, end)
    p = find_player(s, player_id)
    path = crop(p.positions, start, end)
    a, b = path[0].position, path[-1].position
    length = sum(distance(x.position, y.position) for x, y in pairwise(path))
    vector = tuple(y - x for x, y in zip(a, b))
    return Movement(
        playerId=player_id,
        startTime=start,
        endTime=end,
        path=path,
        start=a,
        end=b,
        vector=vector,
        longitudinal=vector[0],
        lateral=vector[2],
        distance=distance(a, b),
        pathLength=length,
        meanSpeed=length / (end - start) if end > start else 0.0,
    )


def point_segment(p, a, b):
    dx, dz = b[0] - a[0], b[2] - a[2]
    norm = dx * dx + dz * dz
    u = (
        max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / norm))
        if norm
        else 0.0
    )
    return distance(p, (a[0] + u * dx, 0, a[2] + u * dz))


def segment_distance(a, b, c, d):
    # Intersection of finite planar segments; endpoints also handle parallel/degenerate cases.
    vx, vz, wx, wz = b[0] - a[0], b[2] - a[2], d[0] - c[0], d[2] - c[2]
    cross = vx * wz - vz * wx
    if abs(cross) > 1e-12:
        qx, qz = c[0] - a[0], c[2] - a[2]
        u, v = (qx * wz - qz * wx) / cross, (qx * vz - qz * vx) / cross
        if 0 <= u <= 1 and 0 <= v <= 1:
            return 0.0
    return min(
        point_segment(a, c, d),
        point_segment(b, c, d),
        point_segment(c, a, b),
        point_segment(d, a, b),
    )


def closest_approach(track_a, track_b, start, end):
    """Exact minimum of |r0 + u*relative_displacement| on every shared linear segment."""
    times = sorted({start, end, *(k.t for k in track_a + track_b if start < k.t < end)})
    candidates = [(distance(position(track_a, start), position(track_b, start)), start)]
    for lo, hi in pairwise(times):
        a0, b0 = position(track_a, lo), position(track_b, lo)
        a1, b1 = position(track_a, hi), position(track_b, hi)
        rx, rz = a0[0] - b0[0], a0[2] - b0[2]
        vx, vz = a1[0] - b1[0] - rx, a1[2] - b1[2] - rz
        norm = vx * vx + vz * vz
        u = max(0.0, min(1.0, -(rx * vx + rz * vz) / norm)) if norm else 0.0
        candidates.append((hypot(rx + u * vx, rz + u * vz), lo + u * (hi - lo)))
    return min(candidates)


def opponents(s, team_id):
    if team_id not in {t.id for t in s.teams}:
        raise ValueError(f"Unknown team: {team_id}")
    return sorted((p for p in s.players if p.teamId != team_id), key=lambda p: p.id)


def relationship(s, a_id, b_id, t):
    a, b = find_player(s, a_id), find_player(s, b_id)
    pa, pb = at(s, a_id, t), at(s, b_id, t)
    direction = next(team.attackDirection for team in s.teams if team.id == a.teamId)
    return Relationship(
        aId=a_id,
        bId=b_id,
        a=pa,
        b=pb,
        distance=distance(pa, pb),
        defenderGoalSide=a.teamId != b.teamId and (pb[0] - pa[0]) * direction > 0,
    )


def spatial(s, t):
    interval(s, t, t)
    players = sorted(s.players, key=lambda p: p.id)
    locations = {p.id: at(s, p.id, t) for p in players}
    samples = []
    for p in players:
        nearest = min(
            (distance(locations[p.id], locations[d.id]), d.id)
            for d in opponents(s, p.teamId)
        )
        samples.append(
            PlayerSample(
                playerId=p.id,
                position=locations[p.id],
                yaw=yaw(p.facing, t),
                speed=speed(p.positions, t),
                nearestDefenderId=nearest[1],
                nearestDefenderDistance=nearest[0],
            )
        )
    pairs = [relationship(s, a.id, b.id, t) for a, b in combinations(players, 2)]
    centroids = []
    for team in s.teams:
        group = [locations[p.id] for p in players if p.teamId == team.id]
        centroids.append(
            tuple(sum(p[axis] for p in group) / len(group) for axis in range(3))
        )
    return Spatial(
        t=t,
        players=samples,
        pairwise=pairs,
        teamCentroidDistance=distance(*centroids),
        nearestOpponentDistance=min(
            r.distance
            for r in pairs
            if find_player(s, r.aId).teamId != find_player(s, r.bId).teamId
        ),
    )


def space(s, center, attacking_team_id, t, radius=6):
    interval(s, t, t)
    distances = sorted(
        (distance(center, at(s, d.id, t)), d.id)
        for d in opponents(s, attacking_team_id)
    )
    nearest, id = distances[0]
    return Space(
        center=center,
        radius=radius,
        nearestDefenderId=id,
        nearestDefenderPosition=at(s, id, t),
        nearestDistance=nearest,
        defendersWithinRadius=sum(d <= radius for d, _ in distances),
    )


def classify(actual_distance, swept_distance, thresholds):
    if actual_distance <= thresholds.corridorHalfWidth:
        return "obstructed"
    if (
        actual_distance <= thresholds.corridorHalfWidth + thresholds.contestedMargin
        or swept_distance <= thresholds.corridorHalfWidth
    ):
        return "contested"
    return "clear"


def corridor(s, passer_id, receiver_id, start, end, thresholds=None):
    interval(s, start, end)
    if start >= end:
        raise ValueError("Pass travel needs a positive time interval")
    thresholds = thresholds or Thresholds()
    passer, receiver = find_player(s, passer_id), find_player(s, receiver_id)
    if passer.teamId != receiver.teamId or passer.id == receiver.id:
        raise ValueError("Pass endpoints must be distinct teammates")
    path = crop(s.ball, start, end)
    a, b = path[0].position, path[-1].position
    if distance(a, b) < 1e-9:
        raise ValueError("Pass path must have non-zero planar length")
    if (
        distance(a, at(s, passer_id, start)) > 1.5
        or distance(b, at(s, receiver_id, end)) > 1.5
    ):
        raise ValueError(
            "Recorded ball endpoints do not match passer release and receiver arrival"
        )
    if max(k.position[1] for k in path) > 0.5:
        raise ValueError("Ground-pass analysis requires ball height <= 0.5 m")
    defenders = opponents(s, passer.teamId)
    static = min(
        (
            min(
                point_segment(at(s, d.id, start), x.position, y.position)
                for x, y in pairwise(path)
            ),
            d.id,
        )
        for d in defenders
    )
    moving = min(
        (*closest_approach(d.positions, s.ball, start, end), d.id) for d in defenders
    )
    swept = min(
        segment_distance(x.position, y.position, c.position, e.position)
        for d in defenders
        for x, y in pairwise(crop(d.positions, start, end))
        for c, e in pairwise(path)
    )
    gap, t, id = moving
    closest = ClosestApproach(
        playerId=id,
        distance=gap,
        t=t,
        playerPosition=at(s, id, t),
        ballPosition=position(s.ball, t),
    )
    return Corridor(
        kind="observed_travel",
        passerId=passer_id,
        receiverId=receiver_id,
        releaseTime=start,
        arrivalTime=end,
        start=a,
        end=b,
        staticDistance=static[0],
        staticDefenderId=static[1],
        sweptCorridorDistance=swept,
        movingClosest=closest,
        state=classify(gap, swept, thresholds),
        thresholds=thresholds,
        path=path,
    )


def preview_corridor(
    s, passer_id, receiver_id, target, t, thresholds, release_point=None
):
    a = release_point if release_point is not None else at(s, passer_id, t)
    defenders = opponents(s, find_player(s, passer_id).teamId)
    gap, id = min((point_segment(at(s, d.id, t), a, target), d.id) for d in defenders)
    return Corridor(
        kind="proposed_static",
        passerId=passer_id,
        receiverId=receiver_id,
        releaseTime=t,
        arrivalTime=t,
        start=a,
        end=target,
        staticDistance=gap,
        staticDefenderId=id,
        sweptCorridorDistance=gap,
        movingClosest=ClosestApproach(
            playerId=id, distance=gap, t=t, playerPosition=at(s, id, t), ballPosition=a
        ),
        state=classify(gap, gap, thresholds),
        thresholds=thresholds,
        path=[PositionKey(t=t, position=a), PositionKey(t=t, position=target)],
    )
