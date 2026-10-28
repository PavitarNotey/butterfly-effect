from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

Identifier = Annotated[str, Field(min_length=1, pattern=r"^[a-z0-9-]+$")]
Count = Annotated[int, Field(ge=0)]


class LeagueContract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class ClubPlayer(LeagueContract):
    id: Identifier
    name: str = Field(min_length=1)


class Club(LeagueContract):
    id: Identifier
    name: str = Field(min_length=1)
    shortName: str = Field(min_length=3, max_length=3)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    players: tuple[ClubPlayer, ...]


# Verified link from a league event to a canonical scenario/event and replay entry time.
class ReplayReference(LeagueContract):
    scenarioId: Identifier
    eventId: Identifier
    startTime: FiniteFloat = Field(ge=0)


# Full-match event metadata; only an explicit replay reference claims reconstructed geometry.
class MatchKeyEvent(LeagueContract):
    id: Identifier
    matchId: Identifier
    type: Literal["goal", "major_miss", "save"]
    minute: int = Field(ge=1, le=90)
    stoppageTime: int | None = Field(default=None, ge=1, le=15)
    matchSeconds: FiniteFloat = Field(ge=0, le=6300)
    playerId: Identifier
    playerName: str = Field(min_length=1)
    teamId: Identifier
    headline: str = Field(min_length=1)
    description: str = Field(min_length=1)
    replay: ReplayReference | None = None
    highlighted: bool = False

    @model_validator(mode="after")
    def valid_clock(self) -> Self:
        """Check that the event minute agrees with its recorded match seconds."""
        if self.stoppageTime is None:
            valid = self.minute == int(self.matchSeconds // 60) + 1
        else:
            valid = self.minute in (45, 90) and (
                self.minute + self.stoppageTime == int(self.matchSeconds // 60) + 1
            )
        if not valid:
            raise ValueError("Match minute disagrees with matchSeconds")
        return self


class Score(LeagueContract):
    home: Count
    away: Count


# Upcoming and finished fixture states keep unknown scores distinct from zero goals.
class Fixture(LeagueContract):
    id: Identifier
    leagueId: Identifier
    matchweek: int = Field(ge=1, le=18)
    homeId: Identifier
    awayId: Identifier
    kickoff: datetime
    status: Literal["finished", "upcoming"]
    score: Score | None
    venue: str = Field(min_length=1)

    @model_validator(mode="after")
    def valid_fixture(self) -> Self:
        """Validate distinct clubs, score availability and an explicit kickoff timezone."""
        if self.homeId == self.awayId:
            raise ValueError("Fixture clubs must be distinct")
        if (self.status == "finished") != (self.score is not None):
            raise ValueError("Only finished fixtures have a final score")
        if self.kickoff.tzinfo is None:
            raise ValueError("Kickoff requires an explicit timezone")
        return self


# Fixture plus ordered event ledger; full-match score may differ from the reconstructed passage.
class MatchDetail(Fixture):
    summary: str = Field(min_length=1)
    editorial: tuple[str, ...] = ()
    events: tuple[MatchKeyEvent, ...] = ()


class FixtureSummary(Fixture):
    """Matchday discovery: one analyzed event, never canonical tracking data."""

    analyzedEvent: MatchKeyEvent | None


# Backend ledger entry used once in standings, separate from featured matchweek fixtures.
class HistoricalResult(LeagueContract):
    id: Identifier
    matchweek: int = Field(ge=1, le=18)
    homeId: Identifier
    awayId: Identifier
    score: Score


class StandingsRow(LeagueContract):
    position: int = Field(ge=1, le=10)
    clubId: Identifier
    played: Count
    wins: Count
    draws: Count
    losses: Count
    goalsFor: Count
    goalsAgainst: Count
    goalDifference: int
    points: Count


class FeaturedMatch(LeagueContract):
    matchId: Identifier
    eventId: Identifier
    headline: str
    introduction: str


class League(LeagueContract):
    id: Identifier
    name: str
    season: str
    matchweek: int = Field(ge=1, le=18)
    totalMatchweeks: Literal[18] = 18
    fictional: Literal[True] = True
    disclosure: str
    clubs: tuple[Club, ...]
    featured: FeaturedMatch


# Immutable synthetic roster, featured fixtures and historical results validated together.
class LeagueCatalog(LeagueContract):
    league: League
    matches: tuple[MatchDetail, ...]
    history: tuple[HistoricalResult, ...]
