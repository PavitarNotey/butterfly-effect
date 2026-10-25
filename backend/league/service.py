"""Small immutable catalog, verified once before it can be served.

History is a backend-only first round-robin ledger. The current round's finished
fixtures are added exactly once; upcoming matches never enter the computation.
"""

from collections import Counter
from functools import lru_cache
from itertools import combinations
from pathlib import Path

from tactics.service import load_scenario

from .models import LeagueCatalog, StandingsRow


def compute_standings(catalog: LeagueCatalog) -> tuple[StandingsRow, ...]:
    totals = {
        c.id: {
            "played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "goalsFor": 0,
            "goalsAgainst": 0,
        }
        for c in catalog.league.clubs
    }
    results = [(r.homeId, r.awayId, r.score) for r in catalog.history]
    results.extend(
        (m.homeId, m.awayId, m.score) for m in catalog.matches if m.status == "finished"
    )
    for home, away, score in results:
        for club, gf, ga in (
            (home, score.home, score.away),
            (away, score.away, score.home),
        ):
            row = totals[club]
            row["played"] += 1
            row["goalsFor"] += gf
            row["goalsAgainst"] += ga
            row["wins" if gf > ga else "draws" if gf == ga else "losses"] += 1
    ordered = sorted(
        totals.items(),
        key=lambda item: (
            -(3 * item[1]["wins"] + item[1]["draws"]),
            -(item[1]["goalsFor"] - item[1]["goalsAgainst"]),
            -item[1]["goalsFor"],
            item[0],
        ),
    )
    return tuple(
        StandingsRow(
            position=position,
            clubId=club,
            **row,
            goalDifference=row["goalsFor"] - row["goalsAgainst"],
            points=3 * row["wins"] + row["draws"],
        )
        for position, (club, row) in enumerate(ordered, 1)
    )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate_catalog(catalog: LeagueCatalog) -> LeagueCatalog:
    league, matches, history = catalog.league, catalog.matches, catalog.history
    clubs = {c.id: c for c in league.clubs}
    require(len(clubs) == len(league.clubs) == 10, "Expected ten unique clubs")
    require(len({c.shortName for c in clubs.values()}) == 10, "Duplicate short name")
    require(len({c.name for c in clubs.values()}) == 10, "Duplicate club name")
    for club in clubs.values():
        require(
            len({p.id for p in club.players}) == len(club.players), "Duplicate player"
        )
    require(
        len(matches) == len({m.id for m in matches}) == 5,
        "Expected five unique fixtures",
    )
    require(
        Counter(id for m in matches for id in (m.homeId, m.awayId))
        == Counter({id: 1 for id in clubs}),
        "Every club must appear exactly once in the featured matchweek",
    )
    all_events = [e.id for m in matches for e in m.events]
    require(len(all_events) == len(set(all_events)), "Duplicate event ID")
    require(
        sum(m.status == "finished" for m in matches) == 3,
        "Expected three finished matches",
    )
    referenced_scenarios = []
    for match in matches:
        require(
            match.leagueId == league.id and match.matchweek == league.matchweek,
            "Wrong competition or matchweek",
        )
        require(
            list(match.events) == sorted(match.events, key=lambda e: e.matchSeconds),
            "Unordered match events",
        )
        require(
            match.status == "finished" or not match.events,
            "Upcoming matches cannot contain events",
        )
        replay_events = [e for e in match.events if e.replay]
        require(
            len(replay_events) == (1 if match.status == "finished" else 0),
            "Each finished match needs exactly one replay",
        )
        if match.score:
            require(
                Counter(e.teamId for e in match.events if e.type == "goal")
                == +Counter(
                    {match.homeId: match.score.home, match.awayId: match.score.away}
                ),
                "Goal-event totals disagree with final score",
            )
        for event in match.events:
            require(
                event.matchId == match.id
                and event.teamId in (match.homeId, match.awayId),
                "Wrong event match or team",
            )
            players = {p.id: p.name for p in clubs[event.teamId].players}
            require(
                players.get(event.playerId) == event.playerName,
                "Invalid player/team membership or name",
            )
            if not event.replay:
                continue
            ref = event.replay
            try:
                scenario = load_scenario(ref.scenarioId)
            except KeyError as error:
                raise ValueError("Unknown replay scenario") from error
            referenced_scenarios.append(scenario.id)
            anchor = next((e for e in scenario.events if e.id == ref.eventId), None)
            require(anchor is not None, "Unknown replay anchor")
            require(
                anchor.type
                == {"goal": "goal", "major_miss": "miss", "save": "block"}[event.type],
                "Replay event type disagrees",
            )
            # Current canonical scenarios contain goals and a miss, never a save.
            require(event.type != "save", "No recorded save scenario is available")
            actor = next(p for p in scenario.players if p.id == anchor.playerIds[0])
            require(
                (actor.id, actor.name, actor.teamId)
                == (event.playerId, event.playerName, event.teamId),
                "Replay actor disagrees",
            )
            require(
                {t.id for t in scenario.teams} == {match.homeId, match.awayId},
                "Replay clubs disagree with fixture",
            )
            for team in scenario.teams:
                club = clubs[team.id]
                require(
                    (club.name, club.shortName, club.color)
                    == (team.name, team.shortName, team.color),
                    "Canonical club identity differs",
                )
                require(
                    {p.id: p.name for p in club.players}
                    == {p.id: p.name for p in scenario.players if p.teamId == team.id},
                    "Canonical roster differs",
                )
            require(
                abs(event.matchSeconds - scenario.matchStartSeconds - anchor.t) < 1e-6,
                "Replay match clock disagrees",
            )
            require(
                0 <= ref.startTime <= anchor.t <= scenario.duration,
                "Invalid replay entry time",
            )
    require(
        set(referenced_scenarios)
        == {"the-invisible-run", "the-missed-chance", "the-untouched-pass"},
        "Expected all three distinct scenarios",
    )
    featured = next((m for m in matches if m.id == league.featured.matchId), None)
    require(featured is not None, "Unknown featured match")
    event = next((e for e in featured.events if e.id == league.featured.eventId), None)
    require(
        event is not None
        and event.replay is not None
        and event.replay.scenarioId == "the-untouched-pass",
        "Featured match must contain the untouched pass",
    )

    result_ids = [r.id for r in history] + [m.id for m in matches]
    require(
        len(result_ids) == len(set(result_ids)),
        "Duplicate historical/current result ID",
    )
    require(len(history) == 5 * (league.matchweek - 1), "Incomplete historical ledger")
    for week in range(1, league.matchweek):
        games = [r for r in history if r.matchweek == week]
        require(
            Counter(id for r in games for id in (r.homeId, r.awayId))
            == Counter({id: 1 for id in clubs}),
            "Invalid historical round",
        )
    for result in history:
        require(
            result.homeId in clubs
            and result.awayId in clubs
            and result.homeId != result.awayId,
            "Unknown or duplicate historical club",
        )
        require(
            result.matchweek < league.matchweek, "History overlaps featured matchweek"
        )
    # This catalog's first nine rounds are exactly one complete round robin.
    require(league.matchweek == 10, "Historical basis requires Matchweek 10")
    require(
        Counter(tuple(sorted((r.homeId, r.awayId))) for r in history)
        == Counter(combinations(sorted(clubs), 2)),
        "History is not a complete first round robin",
    )
    for match in matches:
        previous = next(
            r for r in history if {r.homeId, r.awayId} == {match.homeId, match.awayId}
        )
        require(previous.homeId == match.awayId, "Return fixture must reverse venue")
    rows = compute_standings(catalog)
    require(
        sum(r.goalsFor for r in rows) == sum(r.goalsAgainst for r in rows),
        "Unbalanced league goals",
    )
    require(
        sum(r.wins for r in rows) == sum(r.losses for r in rows),
        "Unbalanced wins/losses",
    )
    for row in rows:
        require(
            row.played
            == league.matchweek
            - 1
            + sum(
                m.status == "finished" and row.clubId in (m.homeId, m.awayId)
                for m in matches
            ),
            "Invalid matches played",
        )
        require(
            row.played == row.wins + row.draws + row.losses
            and row.points == 3 * row.wins + row.draws
            and row.goalDifference == row.goalsFor - row.goalsAgainst,
            "Invalid standings arithmetic",
        )
    return catalog


@lru_cache(maxsize=1)
def get_catalog() -> LeagueCatalog:
    return validate_catalog(
        LeagueCatalog.model_validate_json(
            Path(__file__).with_name("catalog.json").read_text()
        )
    )
