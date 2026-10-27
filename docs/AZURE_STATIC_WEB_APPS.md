# Azure Static Web Apps frontend

- Site: <https://proud-meadow-001c0b310.2.azurestaticapps.net>
- API: <https://butterfly-effect-api-b7e5eyewbkh5ewcs.westus3-01.azurewebsites.net>
- Workflow: [Azure Static Web Apps CI/CD](../.github/workflows/azure-static-web-apps-proud-meadow-001c0b310.yml)

## Build and upload

The generated Oryx build ran `npm install`, which failed on the TypeScript 6 / openapi-typescript peer dependency resolution. The frontend uses its committed pnpm lockfile instead: GitHub Actions sets up Node 22 and pnpm 10.10.0, then runs `pnpm install --frozen-lockfile` and `pnpm build` inside `frontend/`. No dependency versions or peer checks are changed.

The build step explicitly sets the public `VITE_API_URL=https://butterfly-effect-api-b7e5eyewbkh5ewcs.westus3-01.azurewebsites.net`. Vite embeds this value at build time; Azure runtime application settings do not update an existing JavaScript bundle. Changes to the API URL require another frontend build.

`Azure/static-web-apps-deploy@v1` uploads `frontend/dist` using `skip_app_build: true` and an empty `output_location`, so Oryx does not install or build the frontend. The existing `AZURE_STATIC_WEB_APPS_API_TOKEN_PROUD_MEADOW_001C0B310` repository secret, push/PR triggers and PR close job remain intact. Keep that secret configured; no new Azure secret or integrated Functions API is needed.

## Client-side routing

Vite copies `frontend/public/staticwebapp.config.json` to the root of `frontend/dist`. Azure rewrites unmatched navigation paths such as `/fixtures`, `/standings`, `/matches/vesper-tidal` and `/studio` to `/index.html`. Asset directories and static file extensions are excluded, so missing JS, CSS, images and character models retain normal 404 behavior rather than returning HTML. Existing files are served normally. The Netlify `_redirects` file remains unchanged.

## External API access

The Azure App Service API must allow the exact Azure frontend origin in its existing comma-separated `CORS_ALLOWED_ORIGINS` variable. Preserve the Netlify origin and any other approved entries, for example:

```dotenv
CORS_ALLOWED_ORIGINS=https://butterfly-effect-football.netlify.app,https://proud-meadow-001c0b310.2.azurestaticapps.net
```

Localhost origins remain built in. Additional Azure preview/custom origins need explicit entries; do not allow wildcard origins. Configure CORS on Azure App Service if the exact Azure frontend origin is not already allowed. This frontend change does not modify the App Service workflow or its settings, Foundry credentials, AI cost limits or canonical scenarios. Netlify keeps its existing Render API URL in `netlify.toml`; the Render and Netlify deployments remain available as fallbacks.

## Verification

From `frontend/`, using Node 22 and pnpm 10.10.0:

```bash
pnpm install --frozen-lockfile
VITE_API_URL=https://butterfly-effect-api-b7e5eyewbkh5ewcs.westus3-01.azurewebsites.net pnpm build
```

Confirm `dist/staticwebapp.config.json` exists and API-bearing JavaScript contains the Azure App Service URL without localhost API fallbacks. After deployment, directly load/refresh `/fixtures` and `/studio`, check an actual asset and a nonexistent `/assets/missing.js` (404), then check App Service CORS without invoking AI:

```bash
curl -i https://butterfly-effect-api-b7e5eyewbkh5ewcs.westus3-01.azurewebsites.net/health \
  -H 'Origin: https://proud-meadow-001c0b310.2.azurestaticapps.net'
```

Expect `Access-Control-Allow-Origin` to match the Azure origin once that App Service setting has been applied. No paid Foundry calls are needed.

The App Service URL switch passed frontend typechecking, all 209 unit tests and the Node 22 production build. A read-only live health check returned 200 with the exact Azure frontend CORS origin. The compiled JavaScript contains the App Service URL with no Render or localhost API URL; the App Service workflow, Netlify configuration and both SPA fallback files remain unchanged.

Local verification: frozen install and production build passed with Node 22/pnpm 10.10.0; all 209 frontend unit tests and lint passed. Workflow YAML checks confirmed unchanged triggers, deployment secret references and PR-close behavior. The built routing config matches the public source, the Netlify fallback is still copied unchanged, and production chunks contain the Azure App Service API origin and no Render origin without localhost API fallbacks. Existing large WebGL/data chunk warnings remain visible. No dependency or lockfile changes were needed.

References: [Azure prebuilt uploads](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration#skip-building-front-end-app), [navigation fallback](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration#fallback-routes).
