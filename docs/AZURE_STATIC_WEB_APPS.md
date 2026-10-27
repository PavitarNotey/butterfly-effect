# Azure Static Web Apps frontend

- Site: <https://proud-meadow-001c0b310.2.azurestaticapps.net>
- API: <https://butterfly-effect-ltlq.onrender.com>
- Workflow: [Azure Static Web Apps CI/CD](../.github/workflows/azure-static-web-apps-proud-meadow-001c0b310.yml)

## Build and upload

The generated Oryx build ran `npm install`, which failed on the TypeScript 6 / openapi-typescript peer dependency resolution. The frontend uses its committed pnpm lockfile instead: GitHub Actions sets up Node 22 and pnpm 10.10.0, then runs `pnpm install --frozen-lockfile` and `pnpm build` inside `frontend/`. No dependency versions or peer checks are changed.

The build step explicitly sets the public `VITE_API_URL=https://butterfly-effect-ltlq.onrender.com`. Vite embeds this value at build time; Azure runtime application settings do not update an existing JavaScript bundle. Changes to the API URL require another frontend build.

`Azure/static-web-apps-deploy@v1` uploads `frontend/dist` using `skip_app_build: true` and an empty `output_location`, so Oryx does not install or build the frontend. The existing `AZURE_STATIC_WEB_APPS_API_TOKEN_PROUD_MEADOW_001C0B310` repository secret, push/PR triggers and PR close job remain intact. Keep that secret configured; no new Azure secret or integrated Functions API is needed.

## Client-side routing

Vite copies `frontend/public/staticwebapp.config.json` to the root of `frontend/dist`. Azure rewrites unmatched navigation paths such as `/fixtures`, `/standings`, `/matches/vesper-tidal` and `/studio` to `/index.html`. Asset directories and static file extensions are excluded, so missing JS, CSS, images and character models retain normal 404 behavior rather than returning HTML. Existing files are served normally. The Netlify `_redirects` file remains unchanged.

## External API access

The Render API must allow the exact Azure frontend origin in its existing comma-separated `CORS_ALLOWED_ORIGINS` variable. Preserve the Netlify origin and any other approved entries, for example:

```dotenv
CORS_ALLOWED_ORIGINS=https://butterfly-effect-football.netlify.app,https://proud-meadow-001c0b310.2.azurestaticapps.net
```

Localhost origins remain built in. Additional Azure preview/custom origins need explicit entries; do not allow wildcard origins. This is a separately applied Render environment change/restart, not an Azure frontend setting. This workflow fix does not change the Render service, Netlify deployment, Foundry credentials, AI cost limits or canonical scenarios.

## Verification

From `frontend/`, using Node 22 and pnpm 10.10.0:

```bash
pnpm install --frozen-lockfile
VITE_API_URL=https://butterfly-effect-ltlq.onrender.com pnpm build
```

Confirm `dist/staticwebapp.config.json` exists and API-bearing JavaScript contains the Render URL without localhost API fallbacks. After deployment, directly load/refresh `/fixtures` and `/studio`, check an actual asset and a nonexistent `/assets/missing.js` (404), then check Render CORS without invoking AI:

```bash
curl -i https://butterfly-effect-ltlq.onrender.com/health \
  -H 'Origin: https://proud-meadow-001c0b310.2.azurestaticapps.net'
```

Expect `Access-Control-Allow-Origin` to match the Azure origin once that Render setting has been applied. No paid Foundry calls are needed.

Local verification: frozen install and production build passed with Node 22/pnpm 10.10.0; all 209 frontend unit tests and lint passed. Workflow YAML checks confirmed unchanged triggers, deployment secret references and PR-close behavior. The built routing config matches the public source, the Netlify fallback is still copied unchanged, and production chunks contain the Render API origin without localhost API fallbacks. Existing large WebGL/data chunk warnings remain visible. No dependency or lockfile changes were needed.

References: [Azure prebuilt uploads](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration#skip-building-front-end-app), [navigation fallback](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration#fallback-routes).
