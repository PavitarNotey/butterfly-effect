"""Reproducible Phase 3C.2 authored revision, not a runtime motion generator.

Metres/seconds, fictional assignments. Shape-preserving cubic control routes are
baked into canonical linear keys. The production replay/geometry stays linear.
Run from backend: uv run python -m authoring.invisible_run [--check]
"""

import json
import math
import sys
from pathlib import Path

from .routes import canonical_text, sample_route

PATH = Path(__file__).resolve().parents[2] / "frontend/src/replay/invisible-run.json"
DURATION = 13.2
TIMES = {
    "build": 0,
    "run": 1.0,
    "shift": 2.8,
    "pass": 4.4,
    "receive": 5.6,
    "shot": 6.8,
    "goal": 7.65,
}

# (t, X, Z). Each route is an explicit authored football assignment.
ROUTES = {
    "a1": [(0, -49, 0), (6.8, -48, 1), (13.2, -47, 1)],
    "a2": [(0, -12, 24), (4.4, -2, 24), (6.8, 3, 23), (13.2, 12, 22)],
    "a3": [(0, -22, 9), (4.4, -15, 9), (6.8, -12, 8), (13.2, -5, 8)],
    "a4": [(0, -21, -10), (4.4, -14, -10), (6.8, -11, -9), (13.2, -4, -9)],
    "a5": [(0, -8, -26), (4.4, 0, -25), (6.8, 5, -24), (13.2, 12, -22)],
    "a6": [(0, 0, 10), (4.4, 9, 10), (6.8, 14, 9), (7.65, 16, 9), (13.2, 26, 12)],
    "a8": [
        (0, 8, 0),
        (1, 10.3, 0),
        (2.8, 14, 0),
        (4.4, 17.5, 0),
        (5.6, 20.3, 0.6),
        (6.8, 23.8, 1.4),
        (7.65, 26.3, 2),
        (9, 31, 5),
        (10.5, 36.4, 9),
        (12, 42, 14.5),
        (13.2, 45.8, 19.2),
    ],
    "a10": [
        (0, 19, -14),
        (2.8, 24, -12),
        (4.4, 28, -10),
        (5.6, 30.6, -8),
        (6.8, 33, -6),
        (7.65, 34.5, -4.5),
        (9, 37, 0),
        (10.5, 40, 6),
        (12, 43, 12),
        (13.2, 45, 17),
    ],
    "a7": [
        (0, 25, 4),
        (1, 26.5, 4.8),
        (2.8, 30.5, 10),
        (4.4, 35, 16),
        (5.6, 38.3, 18),
        (6.8, 41.5, 19),
        (7.65, 43, 19.2),
        (8.4, 43.6, 18.5),
        (10, 43.8, 16.5),
        (11.6, 45, 18.5),
        (13.2, 47.3, 22.7),
    ],
    "a9": [
        (0, 23, -1),
        (1, 24.5, -0.7),
        (2.8, 27.8, 0.2),
        (4.4, 30.6, 2.4),
        (5.6, 34, 4.5),
        (6.8, 37.2, 4.5),
        (7.65, 38.9, 4.6),
        (8.4, 39.9, 5.7),
        (10, 43, 10.4),
        (11.6, 46.3, 16.7),
        (13.2, 49.4, 23.5),
    ],
    "a11": [
        (0, 21, -27),
        (4.4, 28, -25),
        (6.8, 32, -23),
        (7.65, 34, -22),
        (10, 38, -15),
        (13.2, 42, -8),
    ],
    "d1": [
        (0, 49, 0),
        (2.8, 49, 0.1),
        (4.4, 49, 0.3),
        (5.6, 48.7, 1),
        (6.5, 48.6, 1.8),
        (6.8, 48.6, 1.8),
        (6.98, 48.6, 1.8),
        (7.15, 48.7, 1.65),
        (7.4, 49, 1.15),
        (7.65, 49.35, 0.55),
        (8.2, 49.8, -0.8),
        (9.2, 50.1, -1.1),
        (13.2, 50.4, -1.3),
    ],
    "d2": [
        (0, 30, 16),
        (1, 31, 16),
        (2.8, 33, 16),
        (4.4, 36.5, 17),
        (5.6, 40.3, 19),
        (6.8, 43.5, 20),
        (7.65, 45, 21),
        (8.4, 46.2, 22),
        (10, 48, 23.8),
        (13.2, 48.5, 27.5),
    ],
    "d4": [
        (0, 29, 3),
        (1, 30, 3.8),
        (2.8, 32.7, 7),
        (4.4, 35.7, 10),
        (4.9, 36.5, 10),
        (5.6, 37.4, 8.4),
        (6.8, 38.6, 6.5),
        (7.65, 41, 7),
        (8.4, 42.4, 8.1),
        (9.2, 43.6, 8.7),
        (10, 45, 9),
        (13.2, 46, 8),
    ],
    "d5": [
        (0, 30, -6),
        (1, 30.6, -5.5),
        (2.8, 31.3, -4.1),
        (4.4, 32, -2.5),
        (5.0, 33.6, -0.8),
        (5.6, 35.7, 1),
        (6.2, 37, 2.2),
        (6.8, 38, 3),
        (7.65, 38.8, 2.5),
        (8.8, 40, 1.7),
        (10, 41, 1),
        (13.2, 42, -1),
    ],
    "d3": [
        (0, 30, -17),
        (1, 30.7, -17),
        (2.8, 32, -16),
        (4.4, 33.5, -14),
        (5.6, 35.2, -11),
        (6.8, 37.5, -7),
        (7.65, 39.5, -4.5),
        (9.2, 41, -2),
        (13.2, 44, -2.5),
    ],
    "d6": [
        (0, 23, -5),
        (1, 23.8, -4.5),
        (2.8, 25.5, -3.3),
        (4.4, 27, -2),
        (5.6, 31, -0.5),
        (6.8, 36, 1),
        (7.65, 38, -0.3),
        (9.2, 39, -0.4),
        (13.2, 40.2, -0.5),
    ],
    "d8": [
        (0, 17, -2.5),
        (1, 17.6, -2.1),
        (2.8, 18.8, -1.8),
        (4.4, 21, -1.3),
        (5.6, 25, -0.6),
        (6.8, 30, 0),
        (7.65, 33, 0.4),
        (9.2, 36, 0.7),
        (13.2, 38.5, 0.5),
    ],
    "d10": [
        (0, 18, -12),
        (1, 19, -11.5),
        (2.8, 22, -10.5),
        (4.4, 25, -9),
        (5.6, 29, -6),
        (6.8, 33, -3.5),
        (7.65, 37, -2.6),
        (9.2, 40, -3),
        (13.2, 41.5, -4.5),
    ],
    "d7": [
        (0, 21, 19),
        (1, 22.5, 19),
        (2.8, 26, 18.5),
        (4.4, 30, 18.5),
        (5.6, 34, 18),
        (6.8, 38, 17),
        (7.65, 40, 15.5),
        (8.4, 40.8, 15.5),
        (9.8, 39.5, 17),
        (13.2, 36, 18),
    ],
    "d11": [
        (0, 19, -24),
        (1, 20.5, -23.5),
        (2.8, 23, -23),
        (4.4, 26, -22),
        (5.6, 29, -19),
        (6.8, 32, -16),
        (7.65, 34, -14),
        (9.2, 36, -12.5),
        (13.2, 38, -12),
    ],
    "d9": [
        (0, 8, -5),
        (1, 9.6, -4.8),
        (2.8, 12.6, -4.5),
        (4.4, 16, -4),
        (5.6, 20, -3),
        (6.8, 25, -2),
        (7.65, 28, -1.5),
        (9.2, 31, -2),
        (13.2, 34, -3),
    ],
}


def revision(source):
    """Return the approved goal passage baked from the supplied source data.

    This offline recipe authors canonical keys; calling it does not write files.
    """
    s = json.loads(json.dumps(source))
    s["duration"] = DURATION
    s["description"] = (
        "Rowan runs wide as Mercer shifts and North drops. Linden finds Voss, who controls and shoots quickly with Pike and Mercer closing, then turns toward the corner as teammates follow."
    )
    for p in s["players"]:
        route = ROUTES[p["id"]]
        times = sorted(
            {round(i * 0.2, 4) for i in range(round(DURATION / 0.2) + 1)}
            | {r[0] for r in route}
            | set(TIMES.values())
        )
        p["positions"] = [
            {
                "t": t,
                "position": [
                    round(sample_route(route, t)[0], 6),
                    0,
                    round(sample_route(route, t)[1], 6),
                ],
            }
            for t in times
        ]
        # Running bodies face their authored travel; low-speed keeper orientation
        # stays goal-facing until the post-goal turn. Limit every authored turn.
        previous = None
        facing = []
        for t in times:
            before = sample_route(route, max(0, t - 0.06))
            after = sample_route(route, min(DURATION, t + 0.06))
            desired = math.atan2(after[0] - before[0], after[1] - before[1])
            if p["role"] == "Goalkeeper":
                desired = math.pi / 2 if p["teamId"] == "aurora" else -math.pi / 2
            if p["id"] == "a9" and 5.3 <= t <= 7.1:
                desired = math.pi / 2
            if previous is not None:
                delta = math.atan2(
                    math.sin(desired - previous), math.cos(desired - previous)
                )
                desired = previous + max(
                    -1.8 * (t - facing[-1]["t"]),
                    min(1.8 * (t - facing[-1]["t"]), delta),
                )
            facing.append({"t": t, "yaw": round(desired, 7)})
            previous = desired
        p["facing"] = facing
    players = {p["id"]: p for p in s["players"]}
    # Ball carrier and receiving touch stay within a metre of their root. A
    # shallow settling touch precedes the shot; flight is explicitly authored.
    ball = []
    for t in sorted({0, 1, 2.8, 4.4} | {round(i * 0.2, 4) for i in range(23)}):
        x, z = sample_route(ROUTES["a8"], t)
        ball.append({"t": t, "position": [round(x + 0.65, 6), 0.16, round(z, 6)]})
    ball += [
        {"t": 5.0, "position": [26.4, 0.20, 2.25]},
        {"t": 5.6, "position": [34.65, 0.16, 4.5]},
        {"t": 5.8, "position": [35.12, 0.17, 4.5]},
        {"t": 6.2, "position": [36.25, 0.16, 4.5]},
        {"t": 6.8, "position": [37.85, 0.16, 4.5]},
        {"t": 7.22, "position": [45.2, 0.85, 1.05]},
        {"t": 7.65, "position": [52.7, 0.62, -2.4]},
        {"t": 7.74, "position": [54.05, 0.55, -2.9]},
        {"t": 8.18, "position": [53.7, 0.16, -2.8]},
        {"t": 8.58, "position": [53.8, 0.16, -2.8]},
        {"t": DURATION, "position": [53.8, 0.16, -2.8]},
    ]
    s["ball"] = ball
    s["possession"] = [
        {"t": 0, "playerId": "a8"},
        {"t": 4.4, "playerId": None},
        {"t": 5.6, "playerId": "a9"},
        {"t": 6.8, "playerId": None},
    ]
    details = {
        "build": "Linden advances at a purposeful jog while Aurora's supporting players move forward.",
        "run": "Rowan accelerates diagonally wide, with Mercer shifting and North dropping toward the runner.",
        "shift": "North takes the wide route. Mercer starts recovering inside and Pike narrows toward Voss.",
        "pass": "Linden releases the diagonal pass through the inside-right channel as Pike accelerates toward the receiver.",
        "receive": "Voss cushions the pass while moving. Pike closes from inside and Mercer recovers from the wide channel.",
        "shot": "After one settling touch, Voss shoots across goal with Pike and Mercer still closing.",
        "goal": "The whole ball crosses inside the posts. Voss turns toward the attacking corner as Rowan, Linden and Sol converge.",
    }
    for event in s["events"]:
        event["t"] = TIMES[event["id"]]
        event["detail"] = details[event["id"]]
    s["relevantPlayerIds"] = ["a7", "d2", "d4", "d5", "a8", "a9", "d1"]
    assert set(players) == set(ROUTES)
    return s


def main():
    """Check or explicitly write the offline goal recipe according to CLI arguments."""
    source = json.loads(PATH.read_text())
    text = canonical_text(revision(source)) + "\n"
    if "--check" in sys.argv:
        if PATH.read_text() != text:
            raise SystemExit("Canonical fixture differs from its authored revision")
    else:
        PATH.write_text(text)




if __name__ == "__main__":
    main()
