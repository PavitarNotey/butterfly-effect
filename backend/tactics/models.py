from itertools import pairwise
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

Vec3 = tuple[FiniteFloat, FiniteFloat, FiniteFloat]
Time = Annotated[FiniteFloat, Field(ge=0)]


# Canonical/evidence payloads reject unknown fields; Python models drive the generated frontend types.
class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


# Absolute scenario seconds and world X/Y/Z metres; Y is height, never the tactical distance axis.
class PositionKey(Contract):
    t: Time
    position: Vec3


# Absolute scenario seconds and authored yaw in radians; yaw zero faces +Z.
class FacingKey(Contract):
    t: Time
    yaw: FiniteFloat


# Independent canonical root/facing tracks; skeletal animation must never alter these coordinates.
class Player(Contract):
    id: str = Field(min_length=1)
    teamId: str
    name: str
    number: int = Field(ge=1, le=99)
    role: str
    positions: list[PositionKey] = Field(min_length=2)
    facing: list[FacingKey] = Field(min_length=2)


# attackDirection defines longitudinal goal-side comparisons independently of world-X sign.
class Team(Contract):
    id: str
    name: str
    shortName: str
    color: str
    goalkeeperColor: str
    attackDirection: Literal[-1, 1]


class Pitch(Contract):
    length: FiniteFloat = Field(gt=0)
    width: FiniteFloat = Field(gt=0)


class EventFields(Contract):
    id: str
    t: Time
    label: str
    detail: str
    playerIds: list[str]
    keyMoment: bool


class MatchEvent(EventFields):
    type: Literal[
        "carry", "run", "shift", "pass", "receive", "shot", "goal", "miss", "block"
    ]


class DummyEvent(EventFields):
    """Authored action: t is ball passage, start/end bound the body action.

    Neither field grants a touch or possession. The linked receive is the real
    receiver's contact, even though the ball passes the actor along the way.
    """

    type: Literal["dummy"]
    actorId: str
    start: Time
    end: Time
    passEventId: str
    receiveEventId: str
    nonContact: Literal[True]
    possessionTransfer: Literal[False]


ReplayEvent = Annotated[MatchEvent | DummyEvent, Field(discriminator="type")]


class Possession(Contract):
    t: Time
    playerId: str | None


# Authoritative synthetic passage: complete tracks, possession, events, identities and duration.
class Scenario(Contract):
    version: Literal[1]
    id: str
    title: str
    description: str
    seed: int
    duration: FiniteFloat = Field(gt=0)
    matchStartSeconds: Time
    pitch: Pitch
    teams: list[Team] = Field(min_length=2, max_length=2)
    players: list[Player] = Field(min_length=2)
    ball: list[PositionKey] = Field(min_length=2)
    possession: list[Possession] = Field(min_length=1)
    events: list[ReplayEvent]
    relevantPlayerIds: list[str]

    @model_validator(mode="after")
    def validate_replay(self) -> Self:
        """Validate canonical identities, track bounds and linked dummy/contact semantics.

        Returns this scenario unchanged on success; invalid references or temporal
        relationships fail before geometry, evidence or rendering can consume it.
        """
        ids = {p.id for p in self.players}
        teams = {t.id for t in self.teams}
        if len(ids) != len(self.players) or len(teams) != 2:
            raise ValueError("Player and team IDs must be unique")
        if {t.attackDirection for t in self.teams} != {-1, 1}:
            raise ValueError("Teams must attack opposite goals")
        if {p.teamId for p in self.players} != teams:
            raise ValueError(
                "Each player must reference a known team; both teams need players"
            )

        def timeline(keys, complete=True):
            if keys[0].t != 0 or (complete and keys[-1].t != self.duration):
                raise ValueError("Tracks must span 0 through scenario duration")
            if any(b.t <= a.t for a, b in pairwise(keys)) or keys[-1].t > self.duration:
                raise ValueError(
                    "Timestamps must be strictly increasing within the scenario"
                )

        timeline(self.ball)
        for p in self.players:
            timeline(p.positions)
            timeline(p.facing)
            if any(
                abs(k.position[0]) > self.pitch.length / 2
                or abs(k.position[2]) > self.pitch.width / 2
                or k.position[1] != 0
                for k in p.positions
            ):
                raise ValueError(f"Player {p.id} has out-of-bounds pitch coordinates")
        # The ball may enter a goal or leave the touchline; bound the run-off, too.
        if any(
            abs(k.position[0]) > self.pitch.length / 2 + 5
            or abs(k.position[2]) > self.pitch.width / 2 + 5
            or not 0 <= k.position[1] <= 20
            for k in self.ball
        ):
            raise ValueError("Ball coordinates outside pitch/goal run-off envelope")
        timeline(self.possession, complete=False)
        if any(
            p.playerId is not None and p.playerId not in ids for p in self.possession
        ):
            raise ValueError("Possession references unknown player")
        if len({e.id for e in self.events}) != len(self.events):
            raise ValueError("Event IDs must be unique")
        if any(
            e.t > self.duration or any(id not in ids for id in e.playerIds)
            for e in self.events
        ):
            raise ValueError("Event has invalid time or player reference")
        if any(b.t < a.t for a, b in pairwise(self.events)):
            raise ValueError("Events must be ordered")
        if any(id not in ids for id in self.relevantPlayerIds):
            raise ValueError("Unknown relevant player")
        events = {e.id: e for e in self.events}
        players = {p.id: p for p in self.players}
        for e in self.events:
            if not isinstance(e, DummyEvent):
                continue
            passing, receiving = events.get(e.passEventId), events.get(e.receiveEventId)
            if (
                e.actorId not in e.playerIds
                or e.actorId not in ids
                or passing is None
                or passing.type != "pass"
                or receiving is None
                or receiving.type != "receive"
                or not passing.t < e.start < e.t < e.end < receiving.t
            ):
                raise ValueError(
                    "Dummy requires a valid actor, bounded passage and linked pass/receive"
                )
            passer = next(
                (p.playerId for p in reversed(self.possession) if p.t < passing.t), None
            )
            receiver = next(
                (p.playerId for p in self.possession if p.t == receiving.t), None
            )
            if (
                passer not in passing.playerIds
                or receiver not in receiving.playerIds
                or passer == receiver
                or e.actorId in (passer, receiver)
                or any(
                    p is None or players[p].teamId != players[e.actorId].teamId
                    for p in (passer, receiver)
                )
                or not any(
                    p.t == passing.t and p.playerId is None for p in self.possession
                )
                or any(
                    passing.t <= p.t < receiving.t and p.playerId is not None
                    for p in self.possession
                )
                or any(
                    passing.t < contact.t < receiving.t
                    and contact.type in ("pass", "receive", "shot", "block")
                    for contact in self.events
                )
            ):
                raise ValueError(
                    "Dummy is non-contact: pass flight must have no owner or intervening touch"
                )
        return self


# Explicit centre-distance geometry thresholds, not calibrated reach or completion probabilities.
class Thresholds(Contract):
    corridorHalfWidth: FiniteFloat = Field(default=0.9, gt=0, le=5)
    contestedMargin: FiniteFloat = Field(default=0.6, ge=0, le=5)
    coverageRadius: FiniteFloat = Field(default=6, gt=0, le=20)


# Measured cropped route distinguishes net displacement from total planar path length.
class Movement(Contract):
    playerId: str
    startTime: float
    endTime: float
    path: list[PositionKey]
    start: Vec3
    end: Vec3
    vector: Vec3
    longitudinal: float
    lateral: float
    distance: float
    pathLength: float
    meanSpeed: float


# Tracking-centre separation and longitudinal goal-side status; no inferred marking or attention.
class Relationship(Contract):
    aId: str
    bId: str
    a: Vec3
    b: Vec3
    distance: float
    defenderGoalSide: bool


# Defender count and nearest opposing centre around a point at a declared measurement radius.
class Space(Contract):
    center: Vec3
    radius: float
    nearestDefenderId: str
    nearestDefenderPosition: Vec3
    nearestDistance: float
    defendersWithinRadius: int


class ClosestApproach(Contract):
    playerId: str
    distance: float
    t: float
    playerPosition: Vec3
    ballPosition: Vec3


# Discriminates proposed static geometry from observed travel with simultaneous moving-ball clearance.
class Corridor(Contract):
    kind: Literal["proposed_static", "observed_travel"]
    passerId: str
    receiverId: str
    releaseTime: float
    arrivalTime: float
    start: Vec3
    end: Vec3
    staticDistance: float
    staticDefenderId: str
    sweptCorridorDistance: float
    movingClosest: ClosestApproach
    state: Literal["clear", "contested", "obstructed"]
    thresholds: Thresholds
    path: list[PositionKey]


class PlayerSample(Contract):
    playerId: str
    position: Vec3
    yaw: float
    speed: float
    nearestDefenderId: str
    nearestDefenderDistance: float


class Spatial(Contract):
    t: float
    players: list[PlayerSample]
    pairwise: list[Relationship]
    teamCentroidDistance: float
    nearestOpponentDistance: float


# Read-only instantaneous and interval measurements requested through the tactical query API.
class Analysis(Contract):
    scenarioId: str
    t: float
    start: float
    end: float
    spatial: Spatial
    movements: list[Movement]
    space: Space | None = None
    corridor: Corridor | None = None


# Server-owned measurement value with units and a definition for advanced evidence inspection.
class Metric(Contract):
    name: str
    value: float
    unit: str
    definition: str


# Stable semantic observation ID plus original event/player associations and exact quantitative excerpts.
class Evidence(Contract):
    id: str
    category: Literal["movement", "relationships", "corridor", "space", "finish"]
    status: Literal["observation"] = "observation"
    title: str
    start: float
    end: float
    playerIds: list[str]
    eventIds: list[str]
    observation: str
    metrics: list[Metric]
    limitations: list[str]


# Viewer sequence bounds and primary evidence identity; sequences may overlap within a passage.
class TacticalMoment(Contract):
    focus: Literal["movement", "corridor", "space", "relationships", "finish"] = (
        "corridor"
    )
    id: str
    title: str
    start: FiniteFloat = Field(ge=0)
    focusTime: FiniteFloat = Field(ge=0)
    end: FiniteFloat = Field(gt=0)
    focusEventId: str
    primaryEvidenceId: str
    followPlayerId: str | None = None
    playerIds: list[str]
    evidenceIds: list[str]
    interpretation: str
    interpretationStatus: Literal["authored_interpretation"] = "authored_interpretation"
    movements: list[Movement]

    @model_validator(mode="after")
    def valid_sequence(self):
        """Require a positive start/focus/end window and owned primary/follow references."""
        if not self.start <= self.focusTime <= self.end or self.start >= self.end:
            raise ValueError(
                "Moment requires start <= focus <= end and a positive interval"
            )
        if self.primaryEvidenceId not in self.evidenceIds:
            raise ValueError("Primary evidence must belong to the moment")
        if (
            self.followPlayerId is not None
            and self.followPlayerId not in self.playerIds
        ):
            raise ValueError("Follow player must belong to the moment")
        return self


# Time-indexed overlay samples; canonical key times preserve geometric interpolation parity.
class TacticalFrame(Contract):
    t: float
    relationships: list[Relationship]
    corridor: Corridor
    space: Space


# Temporal ordering between sequences is explicitly not proof of causal necessity.
class ChainLink(Contract):
    fromMomentId: str
    toMomentId: str
    evidenceIds: list[str]
    relation: Literal["precedes_not_proven_cause"] = "precedes_not_proven_cause"


# Source-hashed evidence, thresholds and frame data accepted together by the browser boundary.
class EvidenceBundle(Contract):
    version: Literal[1] = 1
    scenarioId: str
    sourceHash: str
    thresholds: Thresholds
    sampleStep: float
    moments: list[TacticalMoment] = Field(min_length=3, max_length=5)
    evidence: list[Evidence]
    chain: list[ChainLink]
    frames: list[TacticalFrame]
    shotPath: list[PositionKey]
    actualPass: Corridor
    assumptions: list[str]


class ScenarioSummary(Contract):
    id: str
    title: str
    description: str
    duration: float
    outcome: Literal["goal", "miss", "block"]
    sourceHash: str
    teams: list[Team]
