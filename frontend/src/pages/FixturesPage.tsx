import { useCallback } from "react";
import { Link } from "react-router";
import { getOverview } from "../league/client";
import { ClubMark, DataState, ResultRow } from "../league/components";
import { clubFor, kickoffText } from "../league/format";
import { useLeague } from "../league/LeagueContext";
import { useResource } from "../league/useResource";

export default function FixturesPage() {
  const league = useLeague();
  const load = useCallback(
    (signal: AbortSignal) => getOverview(league, signal),
    [league],
  );
  const { resource, retry } = useResource("fixtures", load);
  return (
    <main className="site-container listing-page" id="page-main" tabIndex={-1}>
      <p className="section-kicker">{league.name.toUpperCase()} / 2026–27</p>
      <h1>
        Fixtures & results<span>.</span>
      </h1>
      <p className="page-intro">
        Matchweek {league.matchweek} · 24–25 October 2026 · All kickoff times in
        UTC.
      </p>
      {resource.status !== "ready" ? (
        <DataState
          error={resource.status === "error" ? resource.error : undefined}
          retry={retry}
        />
      ) : (
        <>
          <div className="section-heading">
            <h2>Saturday 24 October</h2>
            <span>THREE COMPLETED MATCHES</span>
          </div>
          <div className="results-list">
            {resource.data.fixtures
              .filter((f) => f.status === "finished")
              .map((f) => (
                <ResultRow key={f.id} league={league} fixture={f} />
              ))}
          </div>
          <div className="section-heading fixtures-next">
            <h2>Sunday 25 October</h2>
            <span>UPCOMING</span>
          </div>
          <div className="upcoming-grid">
            {resource.data.fixtures
              .filter((f) => f.status === "upcoming")
              .map((f) => (
                <Link
                  className="fixture-preview"
                  key={f.id}
                  to={`/matches/${f.id}`}
                >
                  <time>{kickoffText(f.kickoff)}</time>
                  <div>
                    <ClubMark club={clubFor(league, f.homeId)} />
                    <h3>
                      {clubFor(league, f.homeId).name}
                      <span>vs {clubFor(league, f.awayId).name}</span>
                    </h3>
                    <ClubMark club={clubFor(league, f.awayId)} />
                  </div>
                  <p>
                    {f.venue}
                    <span aria-hidden="true">↗</span>
                  </p>
                </Link>
              ))}
          </div>
        </>
      )}
    </main>
  );
}
