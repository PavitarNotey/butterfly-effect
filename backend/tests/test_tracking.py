import itertools
import json
import math
import os
from pathlib import Path

import pytest
from pydantic import ValidationError

from tactics.models import PositionKey
from tracking.diagnostics import imported_report, motion
from tracking.models import TrackingSegment
from tracking.skillcorner import coordinates, ingest, load, seconds


def independent_source():
    # Tiny adapter unit fixture; intentionally not described as genuine provider data.
    metadata = {
        "id": 1,
        "pitch_length": 104,
        "pitch_width": 70,
        "home_team": {"id": 1, "name": "A"},
        "away_team": {"id": 2, "name": "B"},
        "home_team_side": ["right_to_left", "left_to_right"],
        "players": [
            {
                "id": i,
                "team_id": i,
                "short_name": str(i),
                "number": i,
                "player_role": {"name": "Centre Back"},
                "start_time": "00:00:00",
                "end_time": None,
            }
            for i in [1, 2]
        ],
    }

    def frame(t, players, ball=None):
        return (
            json.dumps(
                {
                    "frame": round(t * 10),
                    "period": 1,
                    "timestamp": f"00:00:{t:05.2f}",
                    "player_data": players,
                    "ball_data": ball
                    or {"x": 0, "y": 0, "z": None, "is_detected": True},
                    "possession": {"player_id": None, "group": None},
                }
            ).encode()
            + b"\n"
        )

    a = {"player_id": 1, "x": 1, "y": 2, "is_detected": True}
    b = {"player_id": 2, "x": 3, "y": 4, "is_detected": False}
    lines = [frame(10, [a, b]), frame(10.1, [a]), b"not json\n", frame(10.3, [a, b])]
    return metadata, lines


def test_provider_transform_scaling_sign_height_and_time():
    assert coordinates({"x": 52, "y": 35}, 104, 70) == (52.5, 0, -34)
    assert coordinates({"x": -52, "y": -35, "z": 2}, 104, 70, True) == (-52.5, 2, 34)
    assert seconds("01:02:03.40") == 3723.4
    for raw in [
        {"x": float("nan"), "y": 0},
        {"x": float("inf"), "y": 0},
        {"x": 10000, "y": 0},
    ]:
        with pytest.raises(ValueError):
            coordinates(raw, 105, 68)


def test_ir_keeps_provenance_raw_missing_unknown_height_gaps_and_quality():
    metadata, lines = independent_source()
    s = ingest(
        metadata, lines, source_url="unit fixture", revision="unit", start=10, end=10.3
    )
    assert [f.t for f in s.frames] == [0, 0.1, 0.3]
    assert s.frames[0].players[0].provenance == "observed"
    assert s.frames[0].players[1].provenance == "provider_extrapolated"
    missing = s.frames[1].players[1]
    assert (
        missing.position is None and missing.raw is None and missing.provenance is None
    )
    assert s.frames[0].players[0].raw["y"] == 2
    assert not s.frames[0].ball.height_known
    assert s.quality["missing_player_observations"] == 1
    assert s.quality["malformed_frames"] == 1 and len(s.quality["gaps"]) == 1
    assert s.attack_directions == {"1": -1, "2": 1}
    data = s.model_dump()
    data["frames"][0]["players"][0]["position"] = [float("nan"), 0, 0]
    with pytest.raises(ValidationError):
        TrackingSegment.model_validate(data)


def test_invalid_source_values_are_reported_without_fabricated_observations():
    metadata, lines = independent_source()
    row = json.loads(lines[0])
    row["player_data"][0]["x"] = float("inf")
    row["player_data"][1]["is_detected"] = None
    lines[0] = json.dumps(row).encode()
    s = ingest(metadata, lines, source_url="unit", revision="unit", start=10, end=10.3)
    assert (
        s.frames[0].players[0].position is None
        and s.frames[0].players[1].position is None
    )
    assert (
        s.quality["invalid_observations"] == 1
        and s.quality["unknown_detection_flags"] == 1
    )


def test_finite_window_acceleration_and_no_interpolation_across_missing_data():
    keys = [PositionKey(t=t, position=(x, 0, 0)) for t, x in [(0, 0), (1, 2), (2, 6)]]
    m = motion(keys, step=0.5)
    assert m["max_segment_speed"] == 4 and m["max_acceleration"] == 4
    assert m["displacement"] == 6
    metadata, lines = independent_source()
    s = ingest(metadata, lines, source_url="unit", revision="unit", start=10, end=10.3)
    r = imported_report(s)
    assert r["players"]["1"][0]["duration"] == 0.1
    assert "2" not in r["players"]  # Never bridge its missing point.


@pytest.mark.skipif(
    not os.getenv("SKILLCORNER_DIR"),
    reason="Run documented download then set SKILLCORNER_DIR for genuine-source integration",
)
def test_genuine_skillcorner_segment_independent_measurements():
    folder = Path(os.environ["SKILLCORNER_DIR"])
    segment = load(folder)
    assert segment.match_id == "1925299"
    assert segment.time_offset == 10 and len(segment.frames) == 201
    assert (
        segment.quality["players"] == 22
        and segment.quality["ball_available_frames"] == 201
    )
    assert (
        segment.quality["observed"] == 2722
        and segment.quality["provider_extrapolated"] == 1901
    )
    assert segment.quality["gaps"] == [] and segment.attack_directions["1802"] == -1
    raw = [
        json.loads(line)
        for line in (folder / "tracking.jsonl").read_bytes().splitlines()
    ]
    get = lambda frame, id: next(
        p for p in frame["player_data"] if p["player_id"] == id
    )
    a, b = get(raw[0], 560986), get(raw[0], 560987)
    # Independently calculable source pair: delta X=.85, delta Y=-.13 -> .859883713m.
    expected = math.hypot(0.85, 0.13)
    assert math.hypot(a["x"] - b["x"], a["y"] - b["y"]) == pytest.approx(expected)
    r = imported_report(segment)
    assert r["nearest_opponents_at_start"]["distance"] == pytest.approx(expected)
    assert r["nearest_opponents_at_start"]["players"] == ("560986", "560987")
    first, last = get(raw[0], 51050), get(raw[-1], 51050)
    expected_displacement = math.hypot(18, 32.34)
    assert math.hypot(last["x"] - first["x"], last["y"] - first["y"]) == pytest.approx(
        expected_displacement
    )
    assert r["players"]["51050"][0]["displacement"] == pytest.approx(
        expected_displacement
    )
    independent_max = max(
        math.hypot(
            get(b, 560987)["x"] - get(a, 560987)["x"],
            get(b, 560987)["y"] - get(a, 560987)["y"],
        )
        / 0.1
        for a, b in itertools.pairwise(raw)
    )
    assert r["players"]["560987"][0]["max_segment_speed"] == pytest.approx(
        independent_max
    )
    assert independent_max == pytest.approx(8.220097323)


def test_absent_ball_field_retains_player_frame_and_explicit_gap():
    metadata, lines = independent_source()
    row = json.loads(lines[0])
    del row["ball_data"]
    del row["possession"]
    lines[0] = json.dumps(row).encode()
    segment = ingest(
        metadata, lines, source_url="unit", revision="unit", start=10, end=10.3
    )
    assert len(segment.frames) == 3
    assert segment.frames[0].ball.position is None
    assert segment.frames[0].ball.provenance is None
    assert segment.quality["missing_ball_frames"] == 1


def test_secondary_provider_normalized_coordinates_have_explicit_different_sign():
    from tracking.metrica import normalized_position

    assert normalized_position(0.5, 0.5) == (0, 0, 0)
    assert normalized_position(0, 0) == (-52.5, 0, -34)
    assert normalized_position(1, 1) == (52.5, 0, 34)
    assert normalized_position(0.25, 0.75) == (-26.25, 0, 17)


def test_compactness_is_descriptive_geometry_with_independent_centroid_radius():
    from tracking.diagnostics import compactness

    result = compactness([(0, 0, 0), (3, 0, 4)])
    assert result == {"width": 4, "depth": 3, "mean_centroid_radius": 2.5, "players": 2}
