import { useCallback, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router";
import { getFixtures } from "./client";
import { clubFor, kickoffText, scoreText } from "./format";
import type { FixtureSummary, League } from "./types";
import { useResource } from "./useResource";
import type { Resource } from "./useResource";

function FixtureStripNotice({
  error,
  retry,
}: {
  error?: Error;
  retry?: () => void;
}) {
  return (
    <nav
      className="fixture-ribbon fixture-strip-notice"
      aria-label="Match navigation"
      aria-busy={!error}
    >
      <span className="section-kicker">THE MATCHDAY</span>
      {error ? (
        <>
          <p role="alert">Match navigation is unavailable. {error.message}</p>
          <button className="site-button compact" onClick={retry}>
            Retry match navigation
          </button>
        </>
      ) : (
        <p>Loading fixtures…</p>
      )}
    </nav>
  );
}

/**
 * Render one URL-aware matchweek strip with verified scores and honest upcoming labels.
 */
export function GlobalFixtureStripView({
  league,
  fixtures,
}: {
  league: League;
  fixtures: FixtureSummary[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const rail = scroller.current;
    if (!rail) return;
    function revealActive() {
      const active = rail!.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      const card = active.getBoundingClientRect(),
        bounds = rail!.getBoundingClientRect();
      // Only move the horizontal rail; preserve the page's vertical scroll.
      if (card.left < bounds.left) rail!.scrollLeft += card.left - bounds.left;
      else if (card.right > bounds.right)
        rail!.scrollLeft += card.right - bounds.right;
    }
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <nav
      className="fixture-ribbon"
      aria-label={`Matchweek ${league.matchweek} fixtures`}
      data-testid="global-fixture-strip"
    >
      <div className="ribbon-label">
        <span>THE MATCHDAY</span>
        <strong>MW {league.matchweek}</strong>
        <small>{league.name}</small>
      </div>
      <div className="fixture-scroll" ref={scroller}>
        {fixtures.map((fixture) => {
          const home = clubFor(league, fixture.homeId),
            away = clubFor(league, fixture.awayId);
          const featured = fixture.id === league.featured.matchId;
          const date = new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          })
            .format(new Date(fixture.kickoff))
            .toUpperCase();
          return (
            <NavLink
              key={fixture.id}
              to={`/matches/${fixture.id}`}
              end={false}
              className={({ isActive }) =>
                `strip-fixture${featured ? " featured" : ""}${isActive ? " is-current" : ""}`
              }
              data-testid="strip-fixture"
              aria-label={`${home.name} versus ${away.name}, ${scoreText(fixture)}${fixture.status === "upcoming" ? `, ${kickoffText(fixture.kickoff)}` : ", full time"}${featured ? ", Match of the Week" : ""}`}
            >
              {({ isActive }) => (
                <>
                  <div className="strip-status">
                    <span>
                      {fixture.status === "finished" ? "FT" : "UPCOMING"}
                    </span>
                    <span className="strip-labels">
                      {featured ? (
                        <b>MATCH OF THE WEEK</b>
                      ) : (
                        !isActive && <span>{date}</span>
                      )}
                      {isActive && <b className="strip-current">VIEWING</b>}
                    </span>
                  </div>
                  {[home, away].map((club, index) => (
                    <div className="strip-team" key={club.id}>
                      <i style={{ background: club.color }} />
                      <span>{club.shortName}</span>
                      <strong>
                        {fixture.score
                          ? index === 0
                            ? fixture.score.home
                            : fixture.score.away
                          : "–"}
                      </strong>
                    </div>
                  ))}
                  {fixture.status === "upcoming" && (
                    <time className="strip-kickoff" dateTime={fixture.kickoff}>
                      {kickoffText(fixture.kickoff)}
                    </time>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function LoadedFixtureStrip({ league }: { league: League }) {
  const load = useCallback(
    (signal: AbortSignal) => getFixtures(league, signal),
    [league],
  );
  const { resource, retry } = useResource(`global-fixtures-${league.id}`, load);
  if (resource.status !== "ready")
    return (
      <FixtureStripNotice
        error={resource.status === "error" ? resource.error : undefined}
        retry={retry}
      />
    );
  return <GlobalFixtureStripView league={league} fixtures={resource.data} />;
}

/**
 * Load the shared fixture strip without mounting another replay or duplicating match state.
 */
export function GlobalFixtureStrip({
  leagueResource,
  retryLeague,
}: {
  leagueResource: Resource<League>;
  retryLeague: () => void;
}) {
  return leagueResource.status === "ready" ? (
    <LoadedFixtureStrip league={leagueResource.data} />
  ) : (
    <FixtureStripNotice
      error={
        leagueResource.status === "error" ? leagueResource.error : undefined
      }
      retry={retryLeague}
    />
  );
}
