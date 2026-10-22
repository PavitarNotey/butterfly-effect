"""Offline scenario authoring checks; not a runtime tactical analysis service."""
import json
from itertools import combinations, pairwise
from math import acos, atan2, cos, dist, sin
from pathlib import Path

import pytest

SCENARIO = json.loads(
    (Path(__file__).parents[2] / 'frontend/src/replay/invisible-run.json').read_text()
)
PLAYERS = {p['id']: p for p in SCENARIO['players']}


def position(keys, t):
    if t <= keys[0]['t']:
        return keys[0]['position'][:]
    for a, b in pairwise(keys):
        if a['t'] <= t <= b['t']:
            f = (t - a['t']) / (b['t'] - a['t'])
            return [v + (w - v) * f for v, w in zip(a['position'], b['position'])]
    return keys[-1]['position'][:]


def player(id, t):
    return position(PLAYERS[id]['positions'], t)


def lane_distance(point, start, end):
    direction = [b - a for a, b in zip(start, end)]
    u = sum((p - a) * d for p, a, d in zip(point, start, direction)) / sum(d*d for d in direction)
    return dist(point, [a + max(0, min(1, u)) * d for a, d in zip(start, direction)])


def min_separation(track_a, track_b):
    """Exact closest approach of two linear tracks, including between keyframes."""
    times = sorted({k['t'] for k in track_a + track_b})
    minimum = float('inf')
    for start, end in pairwise(times):
        a0, b0 = position(track_a, start), position(track_b, start)
        a1, b1 = position(track_a, end), position(track_b, end)
        r = [a - b for a, b in zip(a0, b0)]
        v = [(a - b) - initial for a, b, initial in zip(a1, b1, r)]
        vv = sum(x*x for x in v)
        u = max(0, min(1, -sum(x*y for x, y in zip(r, v)) / vv)) if vv else 0
        minimum = min(minimum, sum((x + u*y)**2 for x, y in zip(r, v))**.5)
    return minimum


def test_run_and_handoff_open_actual_receiving_channel():
    start, end = position(SCENARIO['ball'], 9), position(SCENARIO['ball'], 10.4)
    start[1] = end[1] = 0
    assert lane_distance(player('d4', 0), start, end) < .6
    assert lane_distance(player('d4', 9), start, end) > 4
    assert 8 < player('a7', 9)[2] - player('a7', 3)[2] < 12
    assert 4 < player('d4', 9)[2] - player('d4', 3)[2] < 7
    # Handoff: North stays goal-side of Rowan; Mercer recovers inside.
    for t in [9, 10.4, 12, 14]:
        assert player('d2', t)[0] > player('a7', t)[0]
        assert dist(player('d2', t), player('a7', t)) < 4
    assert player('d4', 14)[2] < player('d4', 9)[2]
    # Pike narrows but cannot close the receiving channel in time.
    assert player('d5', 9)[2] - player('d5', 0)[2] > 4
    for t in [0, 3, 6, 9, 10.4, 12, 14]:
        assert player('d5', t)[0] > player('a9', t)[0]
        assert player('d4', t)[0] > player('a9', t)[0]
    assert dist(player('d5', 14), player('a9', 14)) < 4
    for i in range(141):
        t = 9 + i / 100
        ball = position(SCENARIO['ball'], t)
        ball[1] = 0
        assert min(dist(player(p['id'], t), ball) for p in PLAYERS.values()
                   if p['teamId'] == 'boreal') > 2.4
    assert sum(p['teamId'] == 'boreal' and player(p['id'], 9)[0] > player('a9', 9)[0]
               for p in PLAYERS.values()) >= 2


def test_defensive_lines_are_compact_and_cover_responds():
    for t in [0, 3, 6, 9, 10.4, 12, 14]:
        back_line = [player(id, t) for id in ['d2', 'd4', 'd5', 'd3']]
        assert max(p[0] for p in back_line) - min(p[0] for p in back_line) <= 4.5
        assert 22 <= max(p[2] for p in back_line) - min(p[2] for p in back_line) <= 34
        if t <= 9:
            assert player('a8', t)[0] < player('d6', t)[0] < min(p[0] for p in back_line)
    assert player('d6', 14)[0] - player('d6', 9)[0] > 10
    assert player('d3', 14)[2] - player('d3', 9)[2] > 7


def test_ball_possession_events_and_goal_are_synchronized():
    for t, owner in [(0, 'a8'), (3, 'a8'), (6, 'a8'), (9, 'a8'),
                     (10.4, 'a9'), (12, 'a9'), (14, 'a9')]:
        assert dist(position(SCENARIO['ball'], t), player(owner, t)) < 1
    for t in [i/20 for i in range(281)]:
        owner = next(p['playerId'] for p in reversed(SCENARIO['possession']) if p['t'] <= t)
        if owner:
            assert dist(position(SCENARIO['ball'], t), player(owner, t)) < 1
    events = {e['type']: e for e in SCENARIO['events']}
    assert events['pass']['t'] == SCENARIO['possession'][1]['t'] == 9
    assert events['receive']['t'] == SCENARIO['possession'][2]['t'] == 10.4
    assert events['shot']['t'] == SCENARIO['possession'][3]['t'] == 14
    goal = events['goal']
    x, y, z = position(SCENARIO['ball'], goal['t'])
    assert x - .16 >= 52.5
    assert .16 <= y <= 2.44 - .16 and abs(z) + .16 < 3.66
    assert position(SCENARIO['ball'], goal['t'] - .02)[0] - .16 < 52.5
    for i in range(68):
        t = 14 + i/100
        ball = position(SCENARIO['ball'], t)
        ball[1] = 0
        assert min(dist(player(id, t), ball) for id in ['d1', 'd4', 'd5']) > .8


def test_goalkeeper_sets_then_reacts_after_shot():
    for t in [0, 6, 9, 10.4, 12, 14]:
        x, _, z = player('d1', t)
        assert 48 <= x <= 50 and abs(z) < 2
    assert player('d1', 14) == player('d1', 14.18)
    assert player('d1', 14.67)[2] < player('d1', 14.18)[2]
    assert player('d1', 14.67)[2] > position(SCENARIO['ball'], 14.67)[2] + 2


@pytest.mark.parametrize('p', SCENARIO['players'], ids=lambda p: p['id'])
def test_continuity_speed_and_turns(p):
    assert p['positions'][0]['t'] == 0 and p['positions'][-1]['t'] == 20
    velocities = []
    for key in p['positions']:
        x, y, z = key['position']
        assert abs(x) <= 52.5 and abs(z) <= 34 and y == 0
    for a, b in pairwise(p['positions']):
        assert b['t'] > a['t']
        dt = b['t'] - a['t']
        v = [(y - x)/dt for x, y in zip(a['position'], b['position'])]
        speed = sum(x*x for x in v)**.5
        assert speed <= 6
        velocities.append((v, speed))
        assert dist(position(p['positions'], b['t']-.001), b['position']) <= .0061
    for (a, sa), (b, sb) in pairwise(velocities):
        if min(sa, sb) > .75:
            angle = acos(max(-1, min(1, sum(x*y for x, y in zip(a, b)) / (sa*sb))))
            assert angle < 1.2
    for a, b in pairwise(p['facing']):
        angular_speed = abs(atan2(sin(b['yaw']-a['yaw']), cos(b['yaw']-a['yaw']))) / (b['t']-a['t'])
        assert angular_speed <= 2


def test_players_do_not_overlap_between_keyframes():
    for a, b in combinations(SCENARIO['players'], 2):
        assert min_separation(a['positions'], b['positions']) >= 1.2, (a['id'], b['id'])
