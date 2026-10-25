"""Original fictional Phase 3D recipe. Run: uv run python -m authoring.untouched_pass [--check].

Shape-preserving routes are baked into linear canonical keys; pass flight is
one unbroken straight segment. No runtime routes, randomness or physics engine.
"""

import math
import sys
from pathlib import Path

from tactics.models import Scenario

from .routes import canonical_text, sample_route

PATH = Path(__file__).resolve().parents[2] / "frontend/src/replay/untouched-pass.json"
DURATION = 13.6
TIMES = {
    "build": 0,
    "run": 1.2,
    "shift": 2.6,
    "layoff": 3.2,
    "collect": 3.8,
    "pass": 5.6,
    "dummy": 6.65,
    "receive": 7.2,
    "shot": 7.42,
    "goal": 8.02,
}
PASS_START = (32.65, -14)
PASS_END = (42.65, 0)
FRACTION = (TIMES["dummy"] - TIMES["pass"]) / (TIMES["receive"] - TIMES["pass"])
DX, DZ = (a + FRACTION * (b - a) for a, b in zip(PASS_START, PASS_END))
DUMMY_YAW = math.atan2(10, 14) - math.pi

# Each sparse route represents one explicit football assignment, in metres.
ROUTES = {
    "v1": [(0, -48, 0), (8.02, -47, 1), (13.6, -46, 1)],
    "v2": [(0, -7, 25), (5.6, 7, 24), (8.02, 12, 23), (13.6, 22, 22)],
    "v3": [(0, -17, 10), (5.6, -7, 10), (8.02, -3, 9), (13.6, 5, 9)],
    "v4": [(0, -16, -10), (5.6, -6, -10), (8.02, -2, -9), (13.6, 6, -9)],
    "v5": [(0, 0, -27), (5.6, 12, -26), (8.02, 17, -24), (13.6, 27, -20)],
    "v6": [(0, 10, 15), (5.6, 21, 14), (8.02, 27, 12), (13.6, 38, 13)],
    "v8": [
        (0, 12, -14),
        (3.2, 24, -14),
        (5.6, 29, -10),
        (8.02, 35, -7),
        (10.5, 39, 0),
        (13.6, 44, 12),
    ],
    "v7": [
        (0, 20, -22),
        (3.2, 27, -18),
        (3.8, 29, -17),
        (5.6, 32.272195, -14.528927),
        (7.42, 35, -11),
        (8.02, 36, -10),
        (10.5, 39, -3),
        (13.6, 43, 9),
    ],
    "v9": [
        (0, 29, -4),
        (3.2, 34, -4.5),
        (5.6, 38, -4.8125),
        (6.05, DX, DZ),
        (7.05, DX, DZ),
        (8.02, 40.3, -4),
        (10.5, 44, 1),
        (13.6, 47, 11),
    ],
    "v10": [
        (0, 22, 8),
        (3.2, 29, 7),
        (5.6, 35.7, 4),
        (6.6, 39.4, 1.4),
        (7.2, 42, 0),
        (7.42, 42.7, 0),
        (8.02, 44.1, 0.1),
        (9, 45.2, 1.8),
        (11, 48, 8),
        (13.6, 50, 18),
    ],
    "v11": [(0, 25, 26), (5.6, 34, 24), (8.02, 39, 22), (10.5, 42, 19), (13.6, 46, 16)],
    "t1": [
        (0, 49, 0),
        (5.6, 49, -1),
        (7.2, 48.7, -0.1),
        (7.42, 48.7, -0.1),
        (7.6, 48.7, -0.1),
        (8.02, 49.2, -0.8),
        (8.6, 49.8, -1.7),
        (13.6, 50, -2),
    ],
    "t2": [
        (0, 29, -23),
        (3.2, 32, -21),
        (5.6, 34, -20),
        (6.65, 36, -17),
        (7.42, 38, -14),
        (8.02, 39, -12),
        (13.6, 42, -9),
    ],
    "t3": [
        (0, 35, -13),
        (3.2, 37, -14),
        (5.6, 39, -16),
        (6.65, 41, -13),
        (7.42, 43, -10),
        (8.02, 44, -8),
        (9.2, 45.3, -6.2),
        (13.6, 46, -5.5),
    ],
    "t4": [
        (0, 34, 12),
        (3.2, 36, 12),
        (5.6, 38, 11),
        (6.65, 40, 10),
        (7.42, 42, 8),
        (8.02, 43, 6),
        (13.6, 49, 5),
    ],
    "t5": [
        (0, 33, -2),
        (3.2, 37, -3.5),
        (5.6, 41, -6),
        (6.65, 41.3, -4.9),
        (7.42, 43.3, -2.1),
        (8.02, 45, -1),
        (13.6, 46, -2),
    ],
    "t6": [
        (0, 25, 9),
        (3.2, 31, 9),
        (5.6, 37, 6),
        (6.65, 40, 3.5),
        (7.42, 43.4, 1.5),
        (8.02, 45.2, 2),
        (9.5, 47.4, -1),
        (13.6, 49, -3),
    ],
    "t7": [(0, 19, 22), (5.6, 31, 21), (8.02, 37, 18), (13.6, 40, 16)],
    "t8": [
        (0, 16, -10),
        (3.2, 25, -11.5),
        (5.6, 30, -8),
        (7.42, 36, -5),
        (8.02, 38, -4),
        (10.5, 42, -6),
        (13.6, 44, -7),
    ],
    "t9": [(0, 6, -1), (5.6, 18, -2), (8.02, 26, -1), (13.6, 32, 0)],
    "t10": [
        (0, 21, 1),
        (3.2, 27, 1),
        (5.6, 33, 1),
        (7.42, 39, 2),
        (8.02, 41, 1),
        (9.4, 44, -2.5),
        (13.6, 45, -4.5),
    ],
    "t11": [(0, 17, -28), (5.6, 28, -25), (8.02, 34, -22), (13.6, 38, -19)],
}
NAMES = {
    "vesper": [
        "Milo Bracken",
        "Ivo Fenwick",
        "Luca Orrell",
        "Nico Dacre",
        "Elian Croft",
        "Rian Vale",
        "Asa Bellamy",
        "Tobin Wren",
        "Soren Ellery",
        "Kian Merrick",
        "Joss Alder",
    ],
    "tidal": [
        "Otis Lorne",
        "Bram Keene",
        "Ewan Rusk",
        "Dorian Hale",
        "Cassian Reid",
        "Felix Arden",
        "Remy Talbot",
        "Hugo Stroud",
        "Ansel Beck",
        "Oren Sayer",
        "Kit Hollis",
    ],
}
ROLES = [
    "Goalkeeper",
    "Right Back",
    "Centre Back",
    "Centre Back",
    "Left Back",
    "Defensive Midfield",
    "Right Wing",
    "Central Midfield",
    "Centre Forward",
    "Attacking Midfield",
    "Left Wing",
]


def author():
    s = {
        "version": 1,
        "id": "the-untouched-pass",
        "title": "The Pass That Wasn't Touched",
        "description": "Wren progresses and finds Bellamy. Ellery lets the diagonal pass travel between his legs without a touch; Merrick arrives behind him, controls and finishes with Reid and Arden closing. Original fictional tracking, not a real match reconstruction.",
        "seed": 43,
        "duration": DURATION,
        "matchStartSeconds": 66 * 60,
        "pitch": {"length": 105, "width": 68},
        "teams": [
            {
                "id": "vesper",
                "name": "Vesper Athletic",
                "shortName": "VES",
                "color": "#e7b454",
                "goalkeeperColor": "#c08bea",
                "attackDirection": 1,
            },
            {
                "id": "tidal",
                "name": "Tidal Rovers",
                "shortName": "TID",
                "color": "#52b5d1",
                "goalkeeperColor": "#a1df8b",
                "attackDirection": -1,
            },
        ],
        "players": [],
        "ball": [],
        "possession": [],
        "events": [],
        "relevantPlayerIds": ["v7", "v9", "v10", "t5", "t6", "t1"],
    }
    for prefix, team in [("v", "vesper"), ("t", "tidal")]:
        for number in range(1, 12):
            id = f"{prefix}{number}"
            route = ROUTES[id]
            times = sorted(
                {round(i * 0.1, 4) for i in range(137)}
                | {r[0] for r in route}
                | set(TIMES.values())
            )
            facing = []
            for t in times:
                before, after = (
                    sample_route(route, max(0, t - 0.06)),
                    sample_route(route, min(DURATION, t + 0.06)),
                )
                desired = math.atan2(after[0] - before[0], after[1] - before[1])
                if number == 1:
                    desired = math.pi / 2 if prefix == "v" else -math.pi / 2
                if (
                    id == "v8"
                    and t <= 3.4
                    or id == "v7"
                    and 3.5 <= t <= 5.85
                    or id == "v10"
                    and 6.8 <= t <= 7.7
                ):
                    desired = math.pi / 2
                if id == "v7" and 4.3 <= t <= 5.85:
                    desired = math.atan2(10, 14)
                if id == "v9" and 4.2 <= t <= 7.1:
                    desired = DUMMY_YAW
                if facing:
                    previous = facing[-1]
                    delta = math.atan2(
                        math.sin(desired - previous["yaw"]),
                        math.cos(desired - previous["yaw"]),
                    )
                    limit = 1.8 * (t - previous["t"])
                    desired = previous["yaw"] + max(-limit, min(limit, delta))
                facing.append({"t": t, "yaw": round(desired, 7)})
            s["players"].append(
                {
                    "id": id,
                    "teamId": team,
                    "name": NAMES[team][number - 1],
                    "number": number,
                    "role": ROLES[number - 1],
                    "positions": [
                        {
                            "t": t,
                            "position": [
                                round(sample_route(route, t)[0], 6),
                                0,
                                round(sample_route(route, t)[1], 6),
                            ],
                        }
                        for t in times
                    ],
                    "facing": facing,
                }
            )

    def carried(id, start, end):
        headings = {
            key["t"]: key["yaw"]
            for p in s["players"]
            if p["id"] == id
            for key in p["facing"]
        }
        times = sorted(
            {start, end}
            | {
                round(i * 0.1, 4)
                for i in range(137)
                if start <= round(i * 0.1, 4) <= end
            }
        )
        return [
            {
                "t": t,
                "position": [
                    round(
                        sample_route(ROUTES[id], t)[0] + 0.65 * math.sin(headings[t]), 6
                    ),
                    0.16,
                    round(
                        sample_route(ROUTES[id], t)[1] + 0.65 * math.cos(headings[t]), 6
                    ),
                ],
            }
            for t in times
        ]

    s["ball"] = carried("v8", 0, 3.2) + carried("v7", 3.8, 5.6)
    # No key at the dummy: the very same linear flight continues through it.
    s["ball"] += carried("v10", 7.2, 7.42)
    s["ball"] += [
        {"t": t, "position": p}
        for t, p in [
            (7.72, [48.025, 0.72, -1.2]),
            (8.02, [52.7, 0.60, -2.4]),
            (8.12, [54.0, 0.51, -2.8]),
            (8.55, [53.75, 0.16, -2.7]),
            (9.0, [53.8, 0.16, -2.7]),
            (DURATION, [53.8, 0.16, -2.7]),
        ]
    ]
    s["possession"] = [
        {"t": t, "playerId": id}
        for t, id in [
            (0, "v8"),
            (3.2, None),
            (3.8, "v7"),
            (5.6, None),
            (7.2, "v10"),
            (7.42, None),
        ]
    ]
    labels = {
        "build": (
            "carry",
            "Wren progresses",
            ["v8", "t8"],
            "Wren carries forward while Bellamy offers a wide outlet.",
        ),
        "run": (
            "run",
            "Merrick starts his arrival",
            ["v10", "t6"],
            "Merrick advances from midfield with Arden moving alongside the inside channel.",
        ),
        "shift": (
            "shift",
            "The line adjusts",
            ["t5", "t3", "t4", "v9"],
            "Reid stays near Ellery while the back line drops and adjusts toward the ball side.",
        ),
        "layoff": (
            "pass",
            "Wren finds Bellamy",
            ["v8", "v7"],
            "Wren sends the ball out to Bellamy on the left.",
        ),
        "collect": (
            "receive",
            "Bellamy collects",
            ["v7", "t2"],
            "Bellamy controls on the move as Keene closes the wide lane.",
        ),
        "pass": (
            "pass",
            "The low diagonal",
            ["v7", "v10", "v9", "t5", "t6"],
            "Bellamy delivers toward Merrick’s arriving route, through Ellery’s position.",
        ),
        "dummy": (
            "dummy",
            "The Pass That Wasn't Touched",
            ["v9", "v10", "t5"],
            "Ellery opens his stance and lets the same pass travel between his legs without contact or possession.",
        ),
        "receive": (
            "receive",
            "Merrick arrives",
            ["v10", "t6", "t5"],
            "Merrick controls in stride behind Ellery, with Arden and Reid recovering.",
        ),
        "shot": (
            "shot",
            "The immediate finish",
            ["v10", "t6", "t5", "t1"],
            "Merrick shoots after a 0.22-second settling touch before the closing defenders reach the ball.",
        ),
        "goal": (
            "goal",
            "Beyond the keeper",
            ["v10", "t1"],
            "The whole ball crosses inside the posts; Merrick turns as Ellery, Wren and Bellamy converge.",
        ),
    }
    for id, t in TIMES.items():
        type, label, players, detail = labels[id]
        e = {
            "id": id,
            "t": t,
            "type": type,
            "label": label,
            "detail": detail,
            "playerIds": players,
            "keyMoment": id not in ("layoff", "collect"),
        }
        if type == "dummy":
            e.update(
                actorId="v9",
                start=6.12,
                end=7.02,
                passEventId="pass",
                receiveEventId="receive",
                nonContact=True,
                possessionTransfer=False,
            )
        s["events"].append(e)
    Scenario.model_validate(s)
    return s


def main():
    text = canonical_text(author()) + "\n"
    if "--check" in sys.argv:
        if PATH.read_text() != text:
            raise SystemExit("Canonical fixture differs from its authoring recipe")
    else:
        PATH.write_text(text)
    print("Phase 3D authoring validated")


if __name__ == "__main__":
    main()
