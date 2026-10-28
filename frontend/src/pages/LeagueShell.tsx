import { useLayoutEffect, useRef } from "react";
import { Link, NavLink, Outlet, useMatch } from "react-router";
import { getLeague } from "../league/client";
import { DataState } from "../league/components";
import { LeagueContext } from "../league/LeagueContext";
import { useResource } from "../league/useResource";
import { GlobalFixtureStrip } from "../league/GlobalFixtureStrip";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand" to="/" aria-label="Butterfly Effect home">
        <svg className="site-logo" viewBox="0 0 40 32" aria-hidden="true">
          <path
            d="M20 16 3 3v26l34-26v26L20 16Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </svg>
        <span>
          BUTTERFLY <b>EFFECT</b>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/fixtures">Fixtures & results</NavLink>
        <NavLink to="/standings">Standings</NavLink>
      </nav>
      <span className="fiction-label">
        <i /> A FICTIONAL FOOTBALL WORLD
      </span>
    </header>
  );
}

/**
 * Provide validated league data and the single global navigation/fixture strip to child routes.
 */
export default function LeagueShell() {
  const { resource, retry } = useResource("league", getLeague);
  const isLibrary = useMatch("/studio") !== null;
  const chrome = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = chrome.current;
    if (!element) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--site-chrome-height");
    const measure = () =>
      root.style.setProperty(
        "--site-chrome-height",
        `${element.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (previous) root.style.setProperty("--site-chrome-height", previous);
      else root.style.removeProperty("--site-chrome-height");
    };
  }, []);

  return (
    <div className="football-site">
      <a className="skip-link" href="#page-main">
        Skip to content
      </a>
      <div className="site-chrome" ref={chrome} data-testid="site-chrome">
        <SiteHeader />
        <GlobalFixtureStrip leagueResource={resource} retryLeague={retry} />
      </div>
      <LeagueContext value={resource.status === "ready" ? resource.data : null}>
        {isLibrary || resource.status === "ready" ? (
          <Outlet />
        ) : (
          <main id="page-main" tabIndex={-1}>
            <DataState
              error={resource.status === "error" ? resource.error : undefined}
              retry={retry}
            />
          </main>
        )}
      </LeagueContext>
      <footer className="site-footer">
        <div>
          <Link className="footer-wordmark" to="/">
            BUTTERFLY EFFECT <span>⋈</span>
          </Link>
          <p>A different perspective on the beautiful game.</p>
        </div>
        <div>
          <p>
            Original fictional clubs. Authored match stories.
            <br />
            Synthetic tracking. Evidence-grounded analysis.
          </p>
          <Link to="/studio">Scenario library ↗</Link>
        </div>
        <span>2026 / AN INDEPENDENT FOOTBALL EXPERIENCE</span>
      </footer>
    </div>
  );
}
