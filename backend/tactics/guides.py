"""Authored assignments only. Coordinates and measurements always come from Scenario."""

from dataclasses import dataclass, field

INVISIBLE_MOMENTS = [
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
        "Voss controls on the move and shoots after a short settling touch as Pike and Mercer close. These authored actions do not establish awareness or guarantee a successful finish.",
    ),
    (
        "finish",
        "The finish",
        "shot",
        "goal",
        ["a9", "d5", "d4", "d1"],
        "Voss releases the shot before the closing cover reaches the ball path. The replay does not establish what would happen without Rowan’s run.",
    ),
]
MISSED_MOMENTS = [
    (
        "shape",
        "Compact starting shape",
        "build",
        "run",
        ["s7", "c2", "s9", "c5"],
        "Rook covers the wide lane, Ward balances inside and Stone remains goal-side of Finch.",
    ),
    (
        "run",
        "Quinn threatens outside",
        "run",
        "shift",
        ["s7", "c2", "c4"],
        "Rook drops with the wide run; Ward does not abandon the central channel. These responsibilities are authored, not inferred awareness.",
    ),
    (
        "reshape",
        "Coordinated cover",
        "shift",
        "pass",
        ["c2", "c4", "c5", "c6", "s7"],
        "The line drops together, with Stone covering centrally and Hart screening in front.",
    ),
    (
        "pass",
        "The forward opportunity",
        "pass",
        "receive",
        ["s8", "s9", "c5", "c6"],
        "The recorded pass reaches Finch ahead of the back line; this is not an estimate of chance quality.",
    ),
    (
        "receive",
        "Finch collects",
        "receive",
        "recovery",
        ["s9", "c5", "c6", "c4"],
        "Finch receives with Stone goal-side and Hart recovering from behind.",
    ),
    (
        "recovery",
        "Stone closes the gap",
        "recovery",
        "shot",
        ["s9", "c5", "c6", "c4"],
        "Stone narrows the measured separation while Ward balances. The geometry supports nearby pressure, not proof that it causes the miss.",
    ),
    (
        "finish",
        "A pressured miss",
        "shot",
        "miss",
        ["s9", "c5", "c4", "c1"],
        "The shot crosses outside the post. No block, save, xG or causal necessity is claimed.",
    ),
]


@dataclass(frozen=True)
class Guide:
    moments: list
    passer: str
    receiver: str
    cover: str
    recovery: tuple[str, ...]
    pairs: tuple[tuple[str, str], ...]
    finish: str
    back_line: tuple[str, ...]
    midfield: tuple[str, ...]
    pressure: str
    balance: str
    focus: dict[str, str] = field(
        default_factory=lambda: {
            "receive": "space",
            "recovery": "relationships",
            "finish": "finish",
        }
    )


GUIDES = {
    "the-invisible-run": Guide(
        INVISIBLE_MOMENTS,
        "a8",
        "a9",
        "d5",
        ("d1", "d4", "d5"),
        (("a7", "d4"), ("a7", "d2"), ("a8", "a9"), ("a9", "d5")),
        "goal",
        ("d2", "d4", "d5", "d3"),
        ("d6", "d8", "d10"),
        "d8",
        "d3",
    ),
    "the-missed-chance": Guide(
        MISSED_MOMENTS,
        "s8",
        "s9",
        "c5",
        ("c1", "c4", "c5"),
        (("s7", "c2"), ("s7", "c4"), ("s8", "s9"), ("s9", "c5")),
        "miss",
        ("c2", "c4", "c5", "c3"),
        ("c6", "c8", "c10"),
        "c8",
        "c4",
    ),
}

GUIDES["the-untouched-pass"] = Guide(
    [
        (
            "shape",
            "Progression and support",
            "build",
            "run",
            ["v8", "v7", "v10", "t8"],
            "Wren progresses while Bellamy offers width and Merrick advances from midfield. These assignments are authored.",
        ),
        (
            "run",
            "The arriving midfielder",
            "run",
            "shift",
            ["v10", "t6", "v9", "t5"],
            "Merrick advances behind Ellery's position while Arden recovers. Movement does not establish awareness.",
        ),
        (
            "reshape",
            "Cover follows the developing attack",
            "shift",
            "pass",
            ["t5", "t6", "t3", "t4", "v9"],
            "Reid stays near Ellery as the line adjusts; Arden moves toward Merrick's route. These responsibilities are fictional authored context.",
        ),
        (
            "pass",
            "Bellamy's low diagonal",
            "pass",
            "dummy",
            ["v7", "v9", "v10", "t5", "t6"],
            "The recorded pass heads through Ellery's position toward Merrick's arrival. Corridor measurements describe defensive geometry, not completion probability.",
        ),
        (
            "dummy",
            "The Pass That Wasn't Touched",
            "dummy",
            "receive",
            ["v9", "v10", "t5", "t6", "v7"],
            "Ellery's explicitly authored non-contact dummy lets the continuous pass travel beyond him to Merrick. Centre geometry is measured; the stance and skeletal opening are simulated presentation.",
        ),
        (
            "receive",
            "A brief touch under closing pressure",
            "receive",
            "shot",
            ["v10", "t6", "t5"],
            "Merrick controls and shoots 0.22 seconds later as Arden and Reid close. The sequence does not prove what would happen without the dummy.",
        ),
        (
            "finish",
            "The quick finish",
            "shot",
            "goal",
            ["v10", "t6", "t5", "t1"],
            "Merrick releases before the closing defenders reach the ball path. Lorne responds to the recorded shot; no save or deflection is claimed.",
        ),
    ],
    "v7",
    "v10",
    "t6",
    ("t1", "t5", "t6"),
    (("v9", "t5"), ("v10", "t6"), ("v9", "v10"), ("v7", "v10")),
    "goal",
    ("t2", "t3", "t4", "t5"),
    ("t6", "t8", "t10"),
    "t8",
    "t3",
)
