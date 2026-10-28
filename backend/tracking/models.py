"""Tracking IR deliberately distinct from complete synthetic Replay tracks."""

from typing import Literal

from pydantic import Field, FiniteFloat, model_validator

from tactics.models import Contract, Pitch, Time, Vec3

Provenance = Literal[
    "observed", "provider_extrapolated", "derived", "modeled", "synthetic_authored"
]


class Identity(Contract):
    id: str
    team_id: str
    name: str
    number: int
    role: str


# Missing positions retain unknown provenance; provider extrapolation is not measured body attention.
class Observation(Contract):
    id: str
    position: Vec3 | None
    provenance: Provenance | None
    raw: dict | None
    height_known: bool = True
    # Headings cannot be inferred from a velocity vector as measured body orientation.
    yaw: FiniteFloat | None = None


# Provider frame identity and source clock alongside normalized segment-relative time.
class TrackingFrame(Contract):
    t: Time
    source_seconds: Time
    source_frame: int = Field(ge=0)
    period: int = Field(ge=1, le=5)
    players: list[Observation]
    ball: Observation
    possession: dict


# Provenance-preserving imported IR; incomplete observations are not complete synthetic replay tracks.
class TrackingSegment(Contract):
    version: Literal[1] = 1
    provider: str
    match_id: str
    source_url: str
    source_revision: str
    source_sha256: str
    time_offset: Time
    source_pitch: Pitch
    pitch: Pitch
    transform: str
    teams: dict[str, str]
    attack_directions: dict[str, int | None]
    roster: list[Identity]
    frames: list[TrackingFrame] = Field(min_length=2)
    quality: dict

    @model_validator(mode="after")
    def references(self):
        """Check roster identity, normalized times and missing-point provenance consistency."""
        ids = {p.id for p in self.roster}
        if len(ids) != len(self.roster) or any(
            p.team_id not in self.teams for p in self.roster
        ):
            raise ValueError("Invalid roster references")
        previous = -1
        for f in self.frames:
            if (
                f.t <= previous
                or abs(f.t - (f.source_seconds - self.time_offset)) > 1e-7
            ):
                raise ValueError("Invalid normalized timeline")
            previous = f.t
            if len({p.id for p in f.players}) != len(f.players) or any(
                p.id not in ids for p in f.players
            ):
                raise ValueError("Invalid observation identity")
            for o in [*f.players, f.ball]:
                if (o.position is None) != (o.provenance is None):
                    raise ValueError("Missing observations cannot claim provenance")
        return self
