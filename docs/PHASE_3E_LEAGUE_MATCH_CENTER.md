# Phase 3E — Meridian League & Match Center

Implementation: October 25, 2026 (America/Toronto). Baseline: `3393f70797380d018d96875ddd8faaae3aca4c74`, clean working tree. No commits, pushes, pull requests or remote GitHub changes.

## Product and architecture

The primary journey is **Home → Match Center → analyzed event → Replay Studio → tactical evidence → Match Center**. The platform is Butterfly Effect; the independent fictional competition is the **Meridian League**, season 2026/27, Matchweek 10 of 18. The homepage features **The Pass That Wasn't Touched**, alongside five score-strip fixtures, three results with their analyzed-event headlines, two upcoming previews and a compact standings table.

Matches and short replay scenarios remain distinct domains. `backend/league/` owns a small validated, immutable catalog; it does not expand the tactical service into a general application service. `catalog.json` contains clubs, authored match events and a backend-only historical results ledger. It never embeds scenario tracking. Canonical scenarios and the deterministic Python tactical engine remain authoritative for reconstructed passages and measurements. Other goals and saves are explicitly authored fictional match metadata without replay availability.

Backend Pydantic contracts use strict types, forbid unknown fields, and freeze model instances; nested collections use tuples. Catalog validation runs during FastAPI lifespan startup and in the deterministic cached catalog accessor. Invalid catalog data raises a validation error before it can be served. The existing scenario API and health endpoint remain compatible.

Frontend league state is separate from replay state. `league/client.ts` consumes generated OpenAPI types, validates response shape and cross-references, enforces match scores, club membership and standings arithmetic, and reports HTTP/network/timeout/data-integrity failures. Requests have an eight-second timeout. Route cleanup aborts abandoned requests, and resource keys prevent an older response from appearing in a newer match. There are no fabricated offline results. The standalone scenario library can still run without league data.

## Domain model and API

- `League`: identity, season, matchweek, disclosure, clubs and `FeaturedMatch`.
- `Club`: exact canonical name, abbreviation and color for the six existing clubs, plus a compact player-identity registry. The four new clubs have no authored player rosters because this phase has no completed games or replay events for them.
- `Fixture`: stable ID, competition, matchweek, distinct clubs, timezone-aware kickoff, status, nullable final score and venue.
- `FixtureSummary`: fixture plus the single `analyzedEvent`, or null for an upcoming match. This exposes a real event headline on the homepage without returning a tracking document or the full event timeline.
- `MatchDetail`: fixture, summary, editorial paragraphs and ordered key events.
- `MatchKeyEvent`: separate stable match-event ID, match and team IDs, player identity, type (`goal`, `major_miss`, `save`), football minute, optional stoppage time, exact match seconds, headline, description and optional `ReplayReference`.
- `ReplayReference`: canonical scenario ID, canonical event ID, and authored entry time in replay-local seconds.
- `HistoricalResult`: backend-only fixture identity, round, clubs and score.
- `StandingsRow`: rank, games, W/D/L, GF/GA/GD and points.

| Endpoint | Response | Behavior |
| --- | --- | --- |
| `GET /api/league` | `League` | Ten clubs, disclosure and featured match/event identity |
| `GET /api/fixtures` | `FixtureSummary[]` | Five featured-round fixtures, one genuine analyzed event per finished match |
| `GET /api/standings` | `StandingsRow[]` | Computed midseason table |
| `GET /api/matches/{match_id}` | `MatchDetail` | Summary and complete key-event timeline; unknown match is HTTP 404 |

Pydantic remains the source of truth. `backend/openapi.json` and `frontend/src/api/schema.d.ts` are regenerated using `export_openapi.py` and `pnpm generate:api`. The frontend's base fixture type is an `Omit` of the generated fixture-summary contract, not a handwritten duplicate. The previous scenario contracts are unchanged.

## Fictional clubs and fixtures

Canonical clubs are reused exactly: Vesper Athletic / VES / `#e7b454`; Tidal Rovers / TID / `#52b5d1`; Aurora FC / AUR / `#f4b860`; Boreal Athletic / BOR / `#60d9e5`; Solstice United / SOL / `#ccafff`; Cinder Rovers / CIN / `#f29778`.

The four new clubs are Ashcombe City / ASH / `#e1e9e7`; Redhaven FC / RED / `#e76b78`; Kingswell Town / KIN / `#77b2f0`; Larkspur Athletic / LAR / `#8fc8a4`. Original SVG shields use club colors and abbreviations; no third-party logos, photographs or broadcasts are used.

| Fixture ID | Match | Result/status | Kickoff (UTC) | Venue |
| --- | --- | --- | --- | --- |
| `aurora-boreal` | Aurora FC – Boreal Athletic | **2–1 FT** | 24 Oct 2026, 12:00 | Aurora Park |
| `vesper-tidal` | Vesper Athletic – Tidal Rovers | **2–1 FT**, Match of the Week | 24 Oct 2026, 14:00 | The Lantern Ground |
| `solstice-cinder` | Solstice United – Cinder Rovers | **0–1 FT** | 24 Oct 2026, 16:30 | Solstice Field |
| `ashcombe-redhaven` | Ashcombe City – Redhaven FC | Upcoming, no score | 25 Oct 2026, 14:00 | The Foundry |
| `kingswell-larkspur` | Kingswell Town – Larkspur Athletic | Upcoming, no score | 25 Oct 2026, 16:30 | Crown Meadow |

All ten clubs appear exactly once. Results are a fixed authored fictional matchweek snapshot; upcoming status does not advance from the wall clock, and no live polling or live-score claim exists. Kickoffs display UTC consistently across device timezones.

Goal events: Aurora's Rafi Sol 20′ and Leon Voss 74′; Boreal's Axel Brook 39′. Vesper's Tobin Wren 24′ and Kian Merrick 67′; Tidal's Ansel Beck 42′. Cinder's Finn Shore 33′; Solstice score no goals. Additional informational saves belong to Milo Bracken 53′ and Anton Moss 86′. Player names and team memberships are verified against canonical rosters.

## Standings derivation

The 45 historical results form nine complete five-game rounds: every club meets every other club exactly once. A circle schedule was used for authoring; final scores are stored explicitly in the catalog. Matchweek 10 reverses the venues of the corresponding first-round fixtures. Validation checks round completeness, known distinct clubs, unique historical/current IDs, the complete round robin, and return-fixture orientation.

The table is recomputed from **45 historical results + 3 completed current fixtures = 48 results**, each included once. Upcoming games contribute nothing. Ties use points, goal difference, goals for, then ascending stable club ID. There are no disconnected manually authored table totals.

| # | Club | P | W | D | L | GF | GA | GD | Pts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Redhaven FC | 9 | 7 | 2 | 0 | 18 | 5 | +13 | 23 |
| 2 | Kingswell Town | 9 | 5 | 1 | 3 | 12 | 10 | +2 | 16 |
| 3 | Larkspur Athletic | 9 | 4 | 2 | 3 | 10 | 9 | +1 | 14 |
| 4 | Tidal Rovers | 10 | 4 | 1 | 5 | 17 | 15 | +2 | 13 |
| 5 | Boreal Athletic | 10 | 4 | 1 | 5 | 14 | 13 | +1 | 13 |
| 6 | Ashcombe City | 9 | 4 | 1 | 4 | 13 | 15 | −2 | 13 |
| 7 | Solstice United | 10 | 3 | 3 | 4 | 14 | 16 | −2 | 12 |
| 8 | Vesper Athletic | 10 | 3 | 3 | 4 | 13 | 15 | −2 | 12 |
| 9 | Aurora FC | 10 | 4 | 0 | 6 | 11 | 16 | −5 | 12 |
| 10 | Cinder Rovers | 10 | 3 | 0 | 7 | 10 | 18 | −8 | 9 |

Checked: total games played **96**, total GF = GA = **132**, wins = losses = **41**, drawn matches **7**, total points **137**. Every row satisfies P=W+D+L, GD=GF−GA and Pts=3W+D. Clubs awaiting their tenth fixture honestly show nine played.

## Event-to-replay mapping

Match-event IDs and canonical event IDs are intentionally different. Football minutes use the conventional ordinal minute: `floor(matchSeconds / 60) + 1`. Thus 66:08.02 is in the 67th minute. Exact match seconds are checked against `scenario.matchStartSeconds + anchor.t`; they never drive a second replay clock.

| Match event | Type, player and minute | Scenario → canonical anchor | Exact match clock | Studio entry |
| --- | --- | --- | --- | --- |
| `aurora-boreal-voss` | Goal, Leon Voss (a9), Aurora, 74′ | `the-invisible-run` → `goal` at 7.65 s | 73:07.65 | 1.0 s |
| `solstice-cinder-finch` | Major miss, Arlo Finch (s9), Solstice, 62′ | `the-missed-chance` → `miss` at 15.72 s | 61:15.72 | 8.0 s |
| `vesper-tidal-merrick` | Goal, Kian Merrick (v10), Vesper, 67′ | `the-untouched-pass` → `goal` at 8.02 s | 66:08.02 | 3.8 s |

The featured passage remains Wren → Bellamy's diagonal → Ellery's non-contact dummy → Merrick's reception and quick finish. The entry starts with Bellamy collecting, giving the viewer context before the dummy. No intent, counterfactual, success probability or causation is invented. A goal anchor identifies the match event; the complete original scenario remains explorable.

Backend validation checks scenario existence, anchor existence/type, exact canonical player/team/name, both fixture clubs, full canonical identity/roster equality, exact clock alignment and bounded entry time. Frontend studio resolution repeats the critical checks against its local canonical source. Unknown, informational, cross-match or inconsistent event routes never substitute another scenario.

## Routing and rendering ownership

React Router provides history navigation, real links and direct URL resolution:

- `/`: matchday homepage.
- `/fixtures`: results and upcoming fixtures.
- `/matches/:matchId`: completed Match Center or upcoming preview.
- `/matches/:matchId/moments/:eventId`: full existing Replay Studio.
- `/standings`: complete table and derivation explanation.
- `/studio`: secondary scenario library within the shared website shell, preserving all three showcases and regression selectors; it remains usable independently of league API availability.
- Other paths: designed not-found state.

The previous `App.tsx` studio is extracted to `ReplayStudio.tsx` with an embedded mode. Match-linked studios replace the library selector with match context so the URL cannot silently refer to a different scenario. Development/library switching remains at `/studio`. Return links carry the selected event in query/hash context and highlight it in the Match Center. Hosting must rewrite SPA deep links to `index.html`; Vite dev and preview support direct-route refresh.

**One active canvas per route** was chosen instead of introducing multiple replay stores or a new animation system. `ReplaySession` verifies the reference, and `resetReplaySession` gives the active route exclusive ownership of the existing Zustand clock. Layout-effect setup resets before display; cleanup pauses, exits guided mode, clears tactics/evidence, selection, trails, free-look, scrubbing/resume flags, speed and camera. Re-entering even the same scenario resets predictably. OS reduced-motion preferences are reapplied by the viewer/studio.

The Match Center's simplified viewer uses `ReplayScene`, `Timeline` and `useReplayTime`. The scene is memoized, as in the original studio, so the DOM timer’s 20 Hz samples do not reconcile all 22 rigs. It supports play/pause, restart, scrubbing and broadcast/overview cameras, with a direct full-analysis link. Its range reuses existing pointer capture and scrub semantics. Dense event-marker buttons are omitted in the lightweight viewer; the complete timeline remains in the studio. The player-inspection panel and tactical/guided UI remain exclusive to the studio.

Replay code and the WebGL engine are lazy-loaded. Home uses a reproducible **134 kB PNG poster**, captured from the actual canonical dummy at 6.65 s with the existing guided camera. No canvas or replay registry loads on the homepage. Upcoming and standings pages have no WebGL canvas. The shared registry still loads all three scenario texts once a replay is needed; per-scenario data splitting is deferred. There is one reusable renderer, not three simultaneously mounted renderers.

R3F and existing explicit cleanup dispose canvas resources on unmount. Shared character geometry/clips/material pooling and independent rigs are preserved. A scene initialization failure shows the existing WebGL fallback; a route-level boundary also keeps the match story accessible when a lazy replay chunk fails to load.

## Design and accessibility

Charcoal/navy surfaces, warm white type and restrained lime connect the new editorial pages with the studio. The hero pairs strong sans-serif headlines with a restrained serif emphasis and a real synthetic replay image. Thin rules, compact scoreboard typography and club identity colors organize football information without a dashboard of decorative cards. Featured match editorial copy follows the canonical sequence; raw measurements remain in the full studio.

At 1440 and 1024 px, the timeline sits beside the large viewer. At 390 px, the viewer and event list stack. The global score strip scrolls horizontally on tablet and mobile when the five cards exceed the available width. The full table scrolls within its own region on narrow displays, keeping names and all columns intact. Preview controls have 44 px targets and the scrub input has a 44 px interaction height. No tested route overflows the document viewport.

Replay events are semantic links. Other events are ordinary informational content, with no links, click handlers or play buttons. Native range inputs support keyboard seeking. Navigation has current-page states, focus outlines, a working skip link and semantic landmarks. A pre-existing `visibility:hidden` rule prevented keyboard focus of skip links; removing it retains offscreen positioning and restores keyboard operation. Club names/initials supplement colors. Reduced motion disables presentation transitions and does not change tracking or playback speed. No physical-device testing is claimed.

## Verification and review artifacts

Baseline checks passed before integration: backend **81 passed, 1 skipped**; frontend **172 passed**. The skip is the existing optional external SkillCorner dataset. One exploratory frontend rerun while multiple browser/capture jobs competed for CPU hit existing animation-test timeouts; the unchanged assertions passed in the later full run. No timeout or assertion was weakened.

Verified commands/results:

- `uv run python -m pytest -q`: **104 passed, 1 skipped**. The skip remains the optional external SkillCorner fixture. Existing Starlette/httpx deprecation warning is unchanged.
- `uv run python -m ruff check .`: **passes**.
- `uv run python -m authoring.invisible_run --check`: **passes**.
- `uv run python -m authoring.untouched_pass --check`: **passes**, including the non-contact recipe.
- OpenAPI export and `pnpm generate:api`: **regenerated successfully**. Backend tests compare the exported JSON with `app.openapi()`; generated TypeScript is never hand-edited.
- `pnpm typecheck`: **passes**.
- `pnpm lint`: **passes**.
- `pnpm test`: **185 passed across 12 files**.
- `pnpm build`: **passes**, with the existing large lazy-WebGL-chunk warning retained.
- `pnpm test:e2e`: **52 passed** in the complete Chrome run (4.5 minutes), including all 43 existing regressions and nine new league cases. A subsequent targeted Chrome run after the preview-only memoization refinement passed all **nine league cases** (17.3 seconds).
- `git diff --check`: **passes**. Canonical hashes and authoring comparisons remain unchanged.

Vitest now discovers TSX component tests and serializes test files with `fileParallelism: false`. The existing dense imported-rig surface checks occasionally exceeded unchanged timeouts when CPU-heavy files competed across workers. Sequential execution passed all 185 tests in 18.85 seconds; assertions, geometry sampling and individual timeouts were not relaxed.

New backend coverage includes every catalog invariant, fixture-summary identity, rejection of mutated catalogs, independent per-club reconstruction of table arithmetic, unknown-match 404, generated schemas, stoppage-clock validation and all three exact canonical SHA-256 values. New frontend unit coverage includes formatting, semantic event rendering, route-to-replay integrity, complete playback/tactical resets, standings, API validation and failure responses.

The nine new browser cases cover the full featured-match journey and guided dummy, the other two analyzed matches, return context, upcoming fixtures, standings, history navigation, deep-link refresh, keyboard controls and viewport checks at 1440/1024/390 px, delayed API response races, retryable outages, malformed match data, inconsistent canonical references, and WebGL initialization failure. The existing 43 browser tests retain their behavioral assertions at `/studio`.

Canonical SHA-256 values:

- Invisible Run: `8d2667ffaf9b1475ef40acfc8aa2f5319011abb14e22c2a80208139f3f9b7e30`.
- Missed Chance: `edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9`.
- Untouched Pass: `877de5ba96de6b8c50d7c4c05725665b87119927c4280cf1640c5fda98fad439`.

## Performance observations

After the scene-memoization refinement, the retained [performance capture](benchmarks/phase-3e-performance.json) uses local headless Chrome **155.0.8059.85**, 1440×1100 CSS pixels, DPR 1.5, the complete 22-rig untouched-pass scene, three seconds of active warmup and eight seconds of advancing-clock sampling per view. Both views restart at zero for comparison. One character GLB is requested; no browser/shader errors were recorded.

| View | Mean frame ms | Median / p95 ms | Frames >25 ms | Mean draws | Mean triangles | Geometries / textures |
| --- | --- | --- | --- | --- | --- | --- |
| Match Center, broadcast | 16.653 | 16.7 / 16.7 | 0 of 481 | 88.64 | 545,913 | 57 / 27 |
| Full studio, broadcast | 16.653 | 16.7 / 16.7 | 0 of 481 | 87.31 | 545,793 | 55 / 27 |

Both final route samples deliver about 60 fps; no sampled frame exceeds 25 ms. A single local run cannot establish GPU headroom or a universal performance guarantee. The slight draw/geometry differences reflect canvas framing, culling and view state. This is a comparison of the two current routes, not a controlled pre-Phase-3E GPU benchmark.

Three complete preview → studio cycles retain **57 geometries / 27 textures** in each settled preview and **52 / 27** in each settled studio at its entry time. Every previous context reports lost after asynchronous R3F disposal; each current route has one mounted canvas. Returning home leaves zero canvases and releases the final context. Counts remain bounded across repeated routes. Different counts from the playback sample reflect different timestamps/framing; they are not monotonic resource growth. Benchmark instrumentation explicitly waits for the new route and inspects R3F in the page's main JavaScript world, rather than racing canvas replacement.

The final Vite production output is **290.27 kB / 90.92 kB gzip** for main, **492.66 / 103.59 kB** for shared lazy replay data, **33.73 / 10.00 kB** for replay integration/studio, **2.46 / 1.01 kB** for preview controls, and **1,017.36 / 274.65 kB** for the WebGL engine. CSS is **60.92 / 13.27 kB**. Home does not fetch the replay-data/WebGL chunks. Phase 3D's reported main chunk was 746.54 kB / 181.57 kB gzip; the new route boundary moves replay dependencies out of initial website loading. This is payload partitioning, not evidence of faster remote-network startup. The warning threshold remains unchanged.

Reproduce browser captures from `frontend/` with the ordinary API/Vite servers running:

```sh
node scripts/capture-phase3e.mjs
node scripts/benchmark-phase3e.mjs
```

Screenshots and raw browser reports remain in ignored `output/phase3e/`:

- Desktop: [Replay Studio](../output/phase3e/studio-1440.png), [homepage](../output/phase3e/home-1440.png), [featured Match Center](../output/phase3e/match-1440.png), [standings](../output/phase3e/standings-1440.png), [upcoming preview](../output/phase3e/upcoming-1440.png).
- Tablet: [homepage](../output/phase3e/home-1024.png), [Match Center](../output/phase3e/match-1024.png), [standings](../output/phase3e/standings-1024.png).
- Mobile emulation: [Replay Studio](../output/phase3e/studio-390.png), [homepage](../output/phase3e/home-390.png), [Match Center](../output/phase3e/match-390.png), [standings](../output/phase3e/standings-390.png), [upcoming preview](../output/phase3e/upcoming-390.png).
- `visual-review.json` records viewport widths, canvas counts and browser errors. `performance.json` records frame samples and renderer disposal probes.

The poster is an application asset under `frontend/public/images/`; all temporary screenshots, test reports and profiling output are ignored.

## Limitations and follow-up

The catalog is one fixed fictional matchweek, not a live competition service. Historical games exist only to derive a valid table; there is no public archive, team-profile system, database, authentication or external football integration. New-club player rosters are deliberately absent until events require them. Additional fictional goals and saves have no tracking or replay.

The simplified viewer reuses the full 22-rig scene; “lightweight” describes its UI, loading policy and single-canvas ownership, not a newly reduced mesh budget. The full WebGL chunk remains large and Vite's existing warning is retained. Remote-network startup, GPU headroom and physical-device performance are unmeasured. The shared lazy scenario registry is the main follow-up opportunity for payload reduction.

Recorded movement cannot prove intent or why an outcome occurred. Simulated gaze, skeletal poses and dummy/goalkeeper body language remain illustrative presentation. No AI commentary, narrative agents or deployment were added.

Follow-up priorities: verify target mobile hardware and slower networks, evaluate per-scenario data splitting, and configure the eventual host's SPA fallback before deployment. Future new analyzed matches should go through canonical scenario authoring and evidence validation, never a fabricated replay link.

## Changed files and review state

- Backend: `backend/league/{__init__.py,models.py,catalog.json,service.py,routes.py}`, `backend/main.py`, `backend/tests/test_league.py`, generated `backend/openapi.json`.
- Frontend application: `App.tsx`, extracted `ReplayStudio.tsx`, `Website.css`, `league/` API/types/formatting/resources/context/components/replay integration modules, and `pages/` home/fixtures/match/standings/shell/not-found pages; full club names remain visible in studio breadcrumbs.
- Replay integration: `replay/session.ts`, optional marker visibility in `replay/Timeline.tsx`, the passage-goal label in embedded studios, and the skip-link accessibility fix in `App.css`.
- Contracts/dependency: generated `api/schema.d.ts`, `package.json` and `pnpm-lock.yaml` (React Router).
- Tests: `league/league.test.tsx`, `tests/league.spec.ts`, Vitest TSX discovery and serialized CPU-heavy test files; all existing browser tests retain their behavioral assertions and point to `/studio`.
- Scripts: new Phase 3E capture/benchmark scripts; existing replay capture/benchmark scripts point to `/studio`.
- Assets/docs: canonical-replay poster, this report, tracked performance JSON, README and the replay architecture entry point.

All three canonical JSON source files are unchanged. All Phase 3E implementation and relevant validation work is complete. The working tree is ready for independent review and is left uncommitted. No known blocking issue remains; the payload and device/network limitations above remain explicit.

## Global fixture navigation — 26 October 2026

`league/GlobalFixtureStrip.tsx` replaces the homepage-only strip. `LeagueShell` owns the strip and main header together, so the same navigation remains mounted across home, fixtures, Match Center, match-linked Replay Studio, standings, scenario-library and not-found routes. The library uses a compact connection toolbar beneath the shared navigation instead of duplicating the brand header.

The strip loads five validated fixture summaries through the existing `/api/fixtures` endpoint, independently of standings. It shows club abbreviations and identity colors, scores and FT labels, or authored upcoming kickoffs in UTC. Every card is a semantic React Router `NavLink`; the matching fixture is highlighted and exposes `aria-current="page"` on both Match Center and nested moment URLs. The editorial Match of the Week marker remains separate from the active-match state. Loading and retryable error states never substitute invented results. The library remains usable when league navigation is offline, and recovering it preserves the existing canvas and replay clock.

The header and strip form one sticky element in normal document flow. Its measured height supplies document scroll padding so keyboard-focused controls and anchors can clear the navigation. All five fixtures fit across the tested 1440 px desktop view; the 1024 px tablet and 390 px mobile views use a horizontal rail. Route changes and viewport resizing reveal the active card horizontally without moving the page vertically. Keyboard focus has a visible inset outline, and ordinary link activation works with Enter.

Fixture navigation reuses the existing route-owned replay cleanup. Browser coverage switches away from playing previews, selected-player POV with custom speed/trails, guided tactical replay and the scenario library. It verifies removal of the previous canvas, release of its WebGL context, and reset of playback, camera, selection, scrubbing, speed, trails, guided evidence and tactical state, with one current canvas or none for upcoming fixtures. No replay clock, scene, canonical tracking, API contract or backend behavior was added or changed.

New coverage lives in `league/league.test.tsx` and `tests/global-fixture-strip.spec.ts`. The existing API-error test now scopes its alert to the main content because the persistent navigation has its own error message. The existing camera projection test measures the canvas after click-induced page scrolling; its original one-pixel label-alignment requirement is retained.

Desktop, tablet and mobile browser-emulation captures are retained under ignored `output/global-fixture-strip/`, including `standings-scrolled-{1440,1024,390}.png` and `match-controls-{1440,1024,390}.png`. These are browser checks, not physical-device testing.

The production main bundle is **292.86 kB / 91.60 kB gzip**, versus **290.27 / 90.92 kB** in the preceding Phase 3E capture; CSS is **63.05 / 13.70 kB**. The lazy WebGL bundle is unchanged at **1,017.36 / 274.65 kB** and its existing build warning remains visible. The strip has no replay-clock subscription or per-frame work. Frame-rate performance was not rebenchmarked for this DOM-only change.

Files added: `frontend/src/league/GlobalFixtureStrip.tsx` and `frontend/tests/global-fixture-strip.spec.ts`. Files updated: `frontend/src/App.tsx`, `frontend/src/ReplayStudio.tsx`, `frontend/src/Website.css`, `frontend/src/league/ReplaySession.tsx`, `frontend/src/league/client.ts`, `frontend/src/league/components.tsx`, `frontend/src/league/league.test.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/LeagueShell.tsx`, `frontend/tests/camera.spec.ts`, `frontend/tests/league.spec.ts`, and this document.

Final frontend verification: `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check` pass; `pnpm test` reports **193 passed across 12 files**; the complete `pnpm test:e2e` run reports **59 passed** in 4.8 minutes. The focused camera/navigation run also passes all eight cases. Desktop, tablet and mobile captures were visually inspected, including the library's shared header. Backend checks were not rerun because backend source and contracts are unchanged. No known issue blocks this change, and no requested implementation work remains. The working tree is ready for review, with no commit or push performed.
