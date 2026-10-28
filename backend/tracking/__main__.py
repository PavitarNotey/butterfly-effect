"""Reproducible small real segment download; raw third-party files stay outside Git."""

import argparse
import json
from pathlib import Path
from urllib.request import urlopen

from tactics.guides import GUIDES
from tactics.service import load_scenario

from .diagnostics import imported_report, synthetic_report
from .skillcorner import load, seconds

# Pin the official tree used for format/terms verification; overridden explicitly when needed.
REVISION = "4340d274572876239c154c90bc507a9b3250a656"


def download(directory, match, revision, start, end, period):
    """Write official source metadata and stream only the requested tracking interval to directory."""
    directory.mkdir(parents=True, exist_ok=True)
    root = f"https://raw.githubusercontent.com/SkillCorner/opendata/{revision}"
    tracking = f"https://media.githubusercontent.com/media/SkillCorner/opendata/{revision}/data/matches/{match}/{match}_tracking_extrapolated.jsonl"
    for name, url in [
        ("LICENSE", f"{root}/LICENSE"),
        ("README.source.md", f"{root}/README.md"),
        ("match.json", f"{root}/data/matches/{match}/{match}_match.json"),
    ]:
        with urlopen(url, timeout=30) as response:
            (directory / name).write_bytes(response.read())
    # Stream only up to requested interval; avoid fetching/storing the full ~300MB match.
    count = 0
    with (
        urlopen(tracking, timeout=60) as response,
        (directory / "tracking.jsonl").open("wb") as out,
    ):
        for line in response:
            row = json.loads(line)
            if row.get("period") is not None and row["period"] > period:
                break
            if row.get("period") != period or row.get("timestamp") is None:
                continue
            t = seconds(row["timestamp"])
            if t > end:
                break
            if t >= start:
                out.write(line)
                count += 1
    if count < 2:
        raise ValueError("Download has fewer than two observations")
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "provider": "SkillCorner",
                "match": match,
                "revision": revision,
                "start": start,
                "end": end,
                "period": period,
                "tracking_url": tracking,
                "credit": "SkillCorner Open Data; see LICENSE and README.source.md",
            },
            indent=2,
        )
        + "\n"
    )


def main():
    """Run the offline tracking import/diagnostic CLI; keep imported IR separate from replay."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--match", default="1925299")
    parser.add_argument("--revision", default=REVISION)
    parser.add_argument("--start", type=float, default=10)
    parser.add_argument("--end", type=float, default=30)
    parser.add_argument("--period", type=int, default=1)
    args = parser.parse_args()
    if args.download:
        if not 0 <= args.start < args.end or args.end - args.start > 60:
            parser.error("Select an ordered segment no longer than 60 seconds")
        download(
            args.directory, args.match, args.revision, args.start, args.end, args.period
        )
    segment = load(args.directory)
    (args.directory / "canonical.json").write_text(
        segment.model_dump_json(indent=2) + "\n"
    )
    report = {
        "origin": {
            "provider": segment.provider,
            "match_id": segment.match_id,
            "url": segment.source_url,
            "revision": segment.source_revision,
            "sha256": segment.source_sha256,
            "input_seconds": [segment.time_offset, segment.frames[-1].source_seconds],
            "teams": segment.teams,
            "directions": segment.attack_directions,
        },
        "tracking": imported_report(segment),
        "synthetic": {
            id: synthetic_report(load_scenario(id), guide)
            for id, guide in GUIDES.items()
        },
    }
    (args.directory / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "source": report["origin"],
                "player_ids": sorted(report["tracking"]["players"]),
                "example_player_motion": next(
                    iter(report["tracking"]["players"].items())
                ),
                "quality": segment.quality,
                "nearest_opponents": report["tracking"]["nearest_opponents_at_start"],
                "synthetic": {
                    id: {
                        "warnings": r["warnings"],
                        "closest": r["closest_players"],
                        "touch_warnings": r["touch_warnings"],
                    }
                    for id, r in report["synthetic"].items()
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
