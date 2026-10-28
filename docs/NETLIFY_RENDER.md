# Netlify frontend ↔ Render API

Prepared for the existing services; no deployment, cloud configuration write, commit or push was performed.

- Frontend: <https://butterfly-effect-football.netlify.app>
- Backend: <https://butterfly-effect-ltlq.onrender.com>

## Required service environment

| Service                  | Variable                     | Value                                              |
| ------------------------ | ---------------------------- | -------------------------------------------------- |
| Render                   | `CORS_ALLOWED_ORIGINS`       | `https://butterfly-effect-football.netlify.app`    |
| Render                   | `AI_PROVIDER`                | `mock`                                             |
| Render                   | `AI_PAID_GENERATION_ENABLED` | `false`                                            |
| Render                   | `WEB_CONCURRENCY`            | `1` for the existing process-local demo allowances |
| Netlify production build | `VITE_API_URL`               | `https://butterfly-effect-ltlq.onrender.com`       |

These are the intended values, not changes already applied to either dashboard. Render currently reports `AI_PROVIDER=mock`. Keep it explicit; do not enable paid Foundry for connectivity testing. Preserve all other AI limits, pricing requirements, retry settings and backend-only secret handling. Do not put Azure credentials in any `VITE_` variable.

`CORS_ALLOWED_ORIGINS` is a comma-separated string of **exact HTTP(S) origins**, not a JSON array. Both `http://localhost:5173` and `http://127.0.0.1:5173` remain allowed automatically. Duplicate origins and trailing slashes are normalized. Wildcards, paths, credentials, query strings and fragments are rejected at startup. Only GET/POST and the existing permitted headers remain enabled; credentials are not enabled. Additional preview/custom domains need their own explicit origin entries. There is no blanket `*.netlify.app` allowance.

The settings read process environment or the backend's existing ignored `.env`; deployed process variables take precedence. Backend settings are loaded when the application is created. Applying Render settings/code requires an approved restart/redeploy. None was triggered here.

## Netlify repository configuration

The root [`netlify.toml`](../netlify.toml) defines:

- Base directory: `frontend`
- Build command: `pnpm build`
- Publish directory: `dist`, relative to that base (`frontend/dist` in the repository)
- Node 22; pnpm is pinned to the locally verified `10.10.0` through `frontend/package.json`'s `packageManager` field, which Netlify/Corepack reads
- Production `VITE_API_URL` set to the existing Render origin

Ensure the existing project's configuration file/base-directory settings use this repository config. Any separately configured production environment value should match the value above. Vite embeds `VITE_` values into JavaScript **at build time**; changing the variable cannot repair an already-built bundle without an approved new build/deploy. Other deploy contexts need an explicit API URL if used; development keeps its localhost default.

[`frontend/public/_redirects`](../frontend/public/_redirects) is copied unchanged to `dist/_redirects`:

```text
/* /index.html 200
```

This is a non-forced SPA rewrite: existing JS/CSS/images/GLB assets are served normally, while direct requests and refreshes of `/fixtures`, `/standings`, `/matches/vesper-tidal`, `/matches/vesper-tidal/moments/vesper-tidal-merrick` and `/studio` reach React Router. Do not use `200!`, which would shadow real assets. API calls go directly to Render, not through this rewrite.

## Render repository layout

Keep the existing working service configuration unless a change is needed. The backend reads canonical scenario files from `frontend/src/replay/` relative to the repository root. They must remain available in the Render checkout/runtime; do not deploy a backend-only copy or exclude that directory.

For a repository-root service, equivalent commands are:

```bash
# Build (repository root)
uv sync --directory backend --frozen --no-dev

# Start (repository root; Render supplies PORT)
uv run --directory backend --no-sync python -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
```

These commands are documentation, not changes made to the live service. Do not add multiple workers to bypass exhausted process-local AI allowances. Existing free-service cold starts can exceed the UI's bounded request timeouts; warm the health endpoint and use the existing retry controls. No unbounded retries or new background generation were added.

## Findings on the existing deployments

Direct checks returned:

- Render health, league, five fixtures, ten standings rows, three scenarios, match metadata and all three evidence bundles: HTTP 200.
- All remote evidence source hashes match the current canonical files in this repository.
- Both Casual and Analyst recap requests returned `provider=mock`. Status was checked before those requests; no paid Foundry call was made.
- Those responses **lack** `Access-Control-Allow-Origin` for the exact Netlify origin. The current Netlify browser therefore cannot consume them until the backend code/environment is applied.
- The deployed frontend bundle already contains the correct Render API origin and no localhost API fallback. The API URL itself is not the current live blocker.
- Netlify `/` returns 200; a direct `/fixtures` request returns 404. The SPA rewrite must be included in the next approved frontend deployment.

The live services remain in this state until separately approved changes are applied. Passing local verification does not mean these pending changes are deployed.

## Verification

Production build from `frontend/`:

```bash
VITE_API_URL=https://butterfly-effect-ltlq.onrender.com pnpm build
```

The built league/health, AI and tactical-data chunks contain the Render origin, with no `http://127.0.0.1:8000` or `http://localhost:8000` fallback. `dist/_redirects` contains the exact SPA rule. Existing WebGL/data bundle-size warnings remain visible.

The production browser review serves the compiled files locally at the already-allowed `http://localhost:5173` origin and makes **real requests directly to Render**. Only local static files/history fallback are supplied by the review harness; Render API responses are not mocked or proxied. This separates actual API/data compatibility from the known, unapplied Netlify CORS/fallback changes. To reproduce manually, stop any existing Vite dev server on that port, then run:

```bash
# frontend/; serves built artifacts, does not deploy
pnpm preview --host localhost --port 5173 --strictPort
```

Open fixtures/standings and each finished Match Center, refresh a deep link, open Replay Studio, request only verified mock explanations, and use supporting guided replay. CORS tests separately run the prepared backend with the **exact Netlify origin**, verifying every data route, JSON POST preflight, both mock modes, localhost coexistence, unknown-origin rejection and disallowed methods/headers.

After an approved rollout, check the real Netlify origin with:

```bash
curl -i https://butterfly-effect-ltlq.onrender.com/health \
  -H 'Origin: https://butterfly-effect-football.netlify.app'

curl -i -X OPTIONS https://butterfly-effect-ltlq.onrender.com/api/ai/moments/explain \
  -H 'Origin: https://butterfly-effect-football.netlify.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'

curl -I https://butterfly-effect-football.netlify.app/fixtures
```

Expect the exact `Access-Control-Allow-Origin`, successful preflight and HTTP 200 for the deep link. These commands do not invoke Foundry.

Sources: [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/), [Vite environment variables](https://vite.dev/guide/env-and-mode), [Netlify SPA rewrite behavior](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/), [Netlify build dependencies](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

### Recorded check results

- Backend: **212 passed, 1 optional skip**, including 28 new CORS/configuration cases; Ruff and formatting passed.
- Frontend: **209 unit tests passed**; typecheck, lint and the Render-targeted production build passed.
- Existing league/AI browser regression: **13 passed** with the isolated mock API.
- Compiled production browser review against the real Render API: fixtures direct-load/refresh, standings, all three finished matches, both mock recap modes, Match Center guided replay and Studio evidence/guided replay for all three scenarios passed, with no page errors.
- All three remote evidence hashes match repository sources. No canonical scenario or AI implementation file changed. OpenAPI is byte-structure equivalent, so generated contracts needed no changes.
- Build artifacts contain the Render origin in all API-bearing chunks and the SPA rewrite in `dist/_redirects`; no localhost API literal remains in the production chunks.
- Read-only live observations and production browser traces/screenshots are saved locally under ignored `output/hosting/`. These are not deployments or public artifacts.

Files prepared: `backend/config.py`, `backend/main.py`, `backend/tests/test_cors.py`, backend/frontend `.env.example`, `netlify.toml`, `frontend/public/_redirects`, `frontend/package.json`, README/backend README, this guide and the hosting-status note in AGENTS.md. The pnpm pin changes metadata only, with no dependency/version or lockfile upgrade. Existing AI code, secret files, canonical tracks and outcomes are untouched. The working tree is ready for review.
