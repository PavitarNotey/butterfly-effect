import type {
  Fixture,
  FixtureSummary,
  League,
  MatchDetail,
  StandingsRow,
} from "./types";

const base = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
/** Safe transport/validation failure with HTTP status for the existing retry presentation. */
export class LeagueApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}
function assert(valid: unknown): asserts valid {
  if (!valid)
    throw new LeagueApiError(
      "The competition data could not be verified. Please retry.",
    );
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const count = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;
const unique = (values: string[]) => new Set(values).size === values.length;

/**
 * Check untrusted league identities, rosters and the featured-match reference before use.
 */
export function validateLeague(value: unknown): League {
  assert(
    record(value) &&
      string(value.id) &&
      string(value.name) &&
      string(value.season) &&
      count(value.matchweek) &&
      value.fictional === true &&
      string(value.disclosure) &&
      Array.isArray(value.clubs) &&
      value.clubs.length === 10 &&
      record(value.featured),
  );
  for (const club of value.clubs) {
    assert(
      record(club) &&
        string(club.id) &&
        string(club.name) &&
        string(club.shortName) &&
        typeof club.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(club.color) &&
        Array.isArray(club.players),
    );
    for (const player of club.players)
      assert(record(player) && string(player.id) && string(player.name));
  }
  assert(
    unique(value.clubs.map((c) => c.id)) &&
      ["matchId", "eventId", "headline", "introduction"].every((k) =>
        string((value.featured as Record<string, unknown>)[k]),
      ),
  );
  return value as League;
}

/**
 * Validate fixture clubs, dates and score/state consistency against the trusted league.
 */
export function validateFixture(value: unknown, league: League): Fixture {
  assert(
    record(value) &&
      string(value.id) &&
      value.leagueId === league.id &&
      value.matchweek === league.matchweek &&
      value.homeId !== value.awayId &&
      string(value.kickoff) &&
      Number.isFinite(Date.parse(value.kickoff)) &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(value.kickoff) &&
      string(value.venue),
  );
  assert(
    league.clubs.some((c) => c.id === value.homeId) &&
      league.clubs.some((c) => c.id === value.awayId),
  );
  assert(
    value.status === "upcoming"
      ? value.score === null
      : value.status === "finished" &&
          record(value.score) &&
          count(value.score.home) &&
          count(value.score.away),
  );
  return value as Fixture;
}

/**
 * Check event identity, actor membership, match time and any replay-reference envelope.
 */
function validateEvent(event: unknown, fixture: Fixture, league: League) {
  assert(
    record(event) &&
      string(event.id) &&
      event.matchId === fixture.id &&
      ["goal", "major_miss", "save"].includes(String(event.type)) &&
      Number.isInteger(event.minute) &&
      Number(event.minute) >= 1 &&
      Number(event.minute) <= 90 &&
      (event.stoppageTime === null ||
        event.stoppageTime === undefined ||
        (count(event.stoppageTime) &&
          event.stoppageTime >= 1 &&
          event.stoppageTime <= 15)) &&
      typeof event.matchSeconds === "number" &&
      Number.isFinite(event.matchSeconds) &&
      event.matchSeconds >= 0 &&
      string(event.headline) &&
      string(event.description),
  );
  const stop = Number(event.stoppageTime || 0);
  assert(
    Number(event.minute) + stop === Math.floor(event.matchSeconds / 60) + 1 &&
      (!stop || event.minute === 45 || event.minute === 90),
  );
  const club = league.clubs.find((c) => c.id === event.teamId);
  assert(
    club &&
      [fixture.homeId, fixture.awayId].includes(club.id) &&
      club.players.some(
        (p) => p.id === event.playerId && p.name === event.playerName,
      ),
  );
  assert(
    event.replay === null ||
      (record(event.replay) &&
        string(event.replay.scenarioId) &&
        string(event.replay.eventId) &&
        typeof event.replay.startTime === "number" &&
        Number.isFinite(event.replay.startTime) &&
        event.replay.startTime >= 0),
  );
}

/**
 * Validate a fixture and its complete event ledger without treating metadata as replay geometry.
 */
export function validateMatch(value: unknown, league: League): MatchDetail {
  const fixture = validateFixture(value, league);
  assert(
    record(value) &&
      string(value.summary) &&
      Array.isArray(value.editorial) &&
      value.editorial.every(string) &&
      Array.isArray(value.events),
  );
  let previous = -1;
  for (const event of value.events) {
    validateEvent(event, fixture, league);
    assert(
      record(event) &&
        typeof event.matchSeconds === "number" &&
        event.matchSeconds >= previous,
    );
    previous = event.matchSeconds;
  }
  const match = value as MatchDetail;
  assert(unique(match.events.map((e) => e.id)));
  if (fixture.score) {
    assert(
      match.events.filter(
        (e) => e.type === "goal" && e.teamId === fixture.homeId,
      ).length === fixture.score.home &&
        match.events.filter(
          (e) => e.type === "goal" && e.teamId === fixture.awayId,
        ).length === fixture.score.away,
    );
    assert(match.events.filter((e) => e.replay).length === 1);
  } else assert(match.events.length === 0);
  return match;
}

/**
 * Check table membership, ordering and arithmetic before displaying computed API totals.
 */
export function validateStandings(
  value: unknown,
  league: League,
): StandingsRow[] {
  assert(Array.isArray(value) && value.length === 10);
  value.forEach((row, index) => {
    assert(
      record(row) &&
        league.clubs.some((c) => c.id === row.clubId) &&
        row.position === index + 1 &&
        [
          "played",
          "wins",
          "draws",
          "losses",
          "goalsFor",
          "goalsAgainst",
          "points",
        ].every((k) => count(row[k])),
    );
    assert(
      row.played ===
        Number(row.wins) + Number(row.draws) + Number(row.losses) &&
        row.points === 3 * Number(row.wins) + Number(row.draws) &&
        row.goalDifference === Number(row.goalsFor) - Number(row.goalsAgainst),
    );
  });
  const rows = value as StandingsRow[];
  assert(unique(rows.map((r) => r.clubId)));
  assert(
    rows.reduce((n, r) => n + r.goalsFor - r.goalsAgainst, 0) === 0 &&
      rows.reduce((n, r) => n + r.wins - r.losses, 0) === 0,
  );
  const sorted = [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.clubId.localeCompare(b.clubId),
  );
  assert(rows.every((r, i) => sorted[i].clubId === r.clubId));
  return rows;
}

/**
 * Fetch league JSON with caller cancellation and a bounded timeout; return untrusted data for validation.
 */
async function request(path: string, signal: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(8000);
  try {
    const response = await fetch(`${base}/api${path}`, {
      signal: AbortSignal.any([signal, timeout]),
    });
    if (!response.ok)
      throw new LeagueApiError(
        response.status === 404
          ? "This match could not be found."
          : "Competition data is unavailable. Please retry.",
        response.status,
      );
    return await response.json();
  } catch (error) {
    if (error instanceof LeagueApiError) throw error;
    throw new LeagueApiError(
      "The competition could not be loaded. Check the API connection and retry.",
    );
  }
}

/**
 * Load and validate the league catalog used by fixture, roster and match boundaries.
 */
export const getLeague = async (signal: AbortSignal) =>
  validateLeague(await request("/league", signal));
/**
 * Load one match and verify its identity/events against the already validated league.
 */
export const getMatch = async (
  id: string,
  league: League,
  signal: AbortSignal,
) => {
  const match = validateMatch(
    await request(`/matches/${encodeURIComponent(id)}`, signal),
    league,
  );
  assert(match.id === id);
  return match;
};
/**
 * Load fixture summaries and validate their catalog references before navigation.
 */
export async function getFixtures(league: League, signal: AbortSignal) {
  const data = await request("/fixtures", signal);
  assert(Array.isArray(data) && data.length === 5);
  const fixtures = data.map((f) => {
    const fixture = validateFixture(f, league);
    assert(record(f));
    if (fixture.status === "finished") {
      validateEvent(f.analyzedEvent, fixture, league);
      assert(record(f.analyzedEvent) && record(f.analyzedEvent.replay));
    } else assert(f.analyzedEvent === null);
    return f as FixtureSummary;
  });
  assert(
    unique(fixtures.map((f) => f.id)) &&
      new Set(fixtures.flatMap((f) => [f.homeId, f.awayId])).size === 10 &&
      fixtures.filter((f) => f.status === "finished").length === 3 &&
      fixtures.some((f) => f.id === league.featured.matchId),
  );
  return fixtures;
}

/**
 * Load validated fixtures and standings for the shared matchday experience.
 */
export async function getOverview(league: League, signal: AbortSignal) {
  const [fixtures, table] = await Promise.all([
    getFixtures(league, signal),
    request("/standings", signal),
  ]);
  return { fixtures, standings: validateStandings(table, league) };
}
