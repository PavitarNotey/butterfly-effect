"""Current official SkillCorner JSONL adapter. No interpolation or smoothing at import."""

import hashlib
import itertools
import json
import math
from pathlib import Path

from .models import Identity, Observation, TrackingFrame, TrackingSegment


def seconds(timestamp):
    h, m, s = map(float, timestamp.split(":"))
    if (
        not all(math.isfinite(n) for n in (h, m, s))
        or h < 0
        or not 0 <= m < 60
        or not 0 <= s < 60
    ):
        raise ValueError("Invalid source timestamp")
    return h * 3600 + m * 60 + s


def coordinates(raw, length, width, ball=False):
    # Rotation from source (x,y,z-up) to app (X,Y-up,Z) has determinant +1.
    x, y = raw.get("x"), raw.get("y")
    z = raw.get("z") if ball else 0
    if x is None or y is None:
        return None
    if not all(
        isinstance(v, (float, int)) and not isinstance(v, bool) and math.isfinite(v)
        for v in [x, y]
    ):
        raise ValueError("Nonfinite coordinates")
    if z is not None and (not isinstance(z, (float, int)) or not math.isfinite(z)):
        raise ValueError("Nonfinite height")
    if (
        abs(x) > length / 2 + 10
        or abs(y) > width / 2 + 10
        or (z is not None and not -1 <= z <= 30)
    ):
        raise ValueError("Unreasonable source coordinates")
    return (x * 105 / length, 0 if z is None else z, -y * 68 / width)


def ingest(
    metadata: dict,
    lines: list[bytes],
    *,
    source_url: str,
    revision: str,
    start: float,
    end: float,
    period: int = 1,
):
    if not 0 <= start < end or not all(math.isfinite(v) for v in (start, end)):
        raise ValueError("Invalid segment interval")
    length, width = metadata["pitch_length"], metadata["pitch_width"]
    if not 0 < length <= 150 or not 0 < width <= 100:
        raise ValueError("Invalid source pitch dimensions")
    roster = [
        Identity(
            id=str(p["id"]),
            team_id=str(p["team_id"]),
            name=p["short_name"],
            number=p["number"],
            role=p["player_role"]["name"],
        )
        for p in metadata["players"]
    ]
    by_id = {p.id: p for p in roster}
    quality = {
        "malformed_frames": 0,
        "unknown_player_ids": 0,
        "invalid_observations": 0,
        "missing_player_observations": 0,
        "missing_ball_frames": 0,
        "observed": 0,
        "provider_extrapolated": 0,
        "unknown_detection_flags": 0,
        "gaps": [],
        "warnings": [],
    }
    frames = []
    active_intervals = {
        str(p["id"]): (
            seconds(p["start_time"]),
            seconds(p["end_time"]) if p["end_time"] else math.inf,
        )
        for p in metadata["players"]
        if p["start_time"] is not None
    }

    def observation(id, raw, ball=False):
        try:
            pos = coordinates(raw, length, width, ball) if raw else None
        except (ValueError, TypeError):
            quality["invalid_observations"] += 1
            pos = None
        detected = raw.get("is_detected") if raw else None
        if pos is not None and type(detected) is not bool:
            quality["unknown_detection_flags"] += 1
            pos = None  # Do not call an unclassified provider point observed.
        provenance = (
            ("observed" if detected else "provider_extrapolated")
            if pos is not None
            else None
        )
        if provenance:
            quality[provenance] += 1
        return Observation(
            id=id,
            position=pos,
            provenance=provenance,
            raw=raw,
            height_known=not ball or (raw or {}).get("z") is not None,
        )

    for line in lines:
        try:
            row = json.loads(line)
            if row.get("period") != period or row.get("timestamp") is None:
                continue
            t = seconds(row["timestamp"])
            if not start <= t <= end:
                continue
            if frames and t <= frames[-1].source_seconds:
                raise ValueError("Duplicate or unordered frame")
            observations = {}
            for raw in row.get("player_data") or []:
                id = str(raw["player_id"])
                if id not in by_id:
                    quality["unknown_player_ids"] += 1
                    continue
                if id in observations:
                    raise ValueError("Duplicate player in frame")
                observations[id] = observation(id, raw)
            for id, (entered, exited) in active_intervals.items():
                if not entered <= t <= exited:
                    continue
                if id not in observations:
                    observations[id] = observation(id, None)
            quality["missing_player_observations"] += sum(
                o.position is None for o in observations.values()
            )
            ball = observation("ball", row.get("ball_data"), True)
            quality["missing_ball_frames"] += int(ball.position is None)
            possession = row.get("possession") or {"player_id": None, "group": None}
            if (
                possession.get("player_id") is not None
                and str(possession["player_id"]) not in by_id
            ):
                raise ValueError("Unknown possession player")
            frames.append(
                TrackingFrame(
                    t=round(t - start, 6),
                    source_seconds=t,
                    source_frame=row["frame"],
                    period=period,
                    players=sorted(observations.values(), key=lambda p: p.id),
                    ball=ball,
                    possession=possession,
                )
            )
        except (ValueError, KeyError, TypeError):
            quality["malformed_frames"] += 1
    if len(frames) < 2:
        raise ValueError("Need at least two valid tracking frames")
    if frames[0].source_seconds > start + 0.051:
        quality["gaps"].append([start, frames[0].source_seconds])
    for a, b in itertools.pairwise(frames):
        if b.source_seconds - a.source_seconds > 0.151:
            quality["gaps"].append([a.source_seconds, b.source_seconds])
    if frames[-1].source_seconds < end - 0.051:
        quality["gaps"].append([frames[-1].source_seconds, end])
    quality.update(
        frames=len(frames),
        players=len(
            {o.id for f in frames for o in f.players if o.position is not None}
        ),
        teams=len(
            {
                by_id[o.id].team_id
                for f in frames
                for o in f.players
                if o.position is not None
            }
        ),
        observed=sum(
            o.provenance == "observed" for f in frames for o in [*f.players, f.ball]
        ),
        provider_extrapolated=sum(
            o.provenance == "provider_extrapolated"
            for f in frames
            for o in [*f.players, f.ball]
        ),
        missing_player_observations=sum(
            o.position is None for f in frames for o in f.players
        ),
        missing_ball_frames=sum(f.ball.position is None for f in frames),
        ball_available_frames=sum(f.ball.position is not None for f in frames),
        expected_frames=round((end - start) * 10) + 1,
    )
    quality["warnings"] = [
        "Broadcast camera tracking includes extrapolation and identity/noise errors; unsmoothed derivatives are not physical ground truth.",
        "Ball height may be unknown; height_known=False means Y=0 is a planar placeholder, not an observed ground ball.",
        "Source metrics are retained in raw observations; normalized X/Z distances scale if source pitch differs from 105×68.",
    ]
    side = metadata.get("home_team_side", [])
    direction = (
        {"left_to_right": 1, "right_to_left": -1}.get(side[period - 1])
        if len(side) >= period
        else None
    )
    home, away = str(metadata["home_team"]["id"]), str(metadata["away_team"]["id"])
    return TrackingSegment(
        provider="SkillCorner",
        match_id=str(metadata["id"]),
        source_url=source_url,
        source_revision=revision,
        source_sha256=hashlib.sha256(b"".join(lines)).hexdigest(),
        time_offset=start,
        source_pitch={"length": length, "width": width},
        pitch={"length": 105, "width": 68},
        transform="X=source.x*105/L; Y=source.z (ball; 0 if unknown); Z=-source.y*68/W. No team-relative mirroring.",
        teams={
            home: metadata["home_team"]["name"],
            away: metadata["away_team"]["name"],
        },
        attack_directions={home: direction, away: -direction if direction else None},
        roster=roster,
        frames=frames,
        quality=quality,
    )


def load(directory: Path):
    manifest = json.loads((directory / "manifest.json").read_text())
    metadata = json.loads((directory / "match.json").read_text())
    return ingest(
        metadata,
        (directory / "tracking.jsonl").read_bytes().splitlines(keepends=True),
        source_url=manifest["tracking_url"],
        revision=manifest["revision"],
        start=manifest["start"],
        end=manifest["end"],
        period=manifest["period"],
    )
