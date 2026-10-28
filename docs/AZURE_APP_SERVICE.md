# Azure App Service API

App: `butterfly-effect-api`, Linux, Python 3.12. Workflow: [main_butterfly-effect-api.yml](../.github/workflows/main_butterfly-effect-api.yml).

## Reproducible build and deployment

The build job runs inside `backend/` with Python 3.12 and pinned uv 0.13.5. `uv sync --locked` checks the existing `pyproject.toml` against `uv.lock` and installs the test tools as well as runtime dependencies. Ruff and the full backend test suite run with mock AI and paid generation disabled.

`backend/deployment.py package` stages an explicit runtime allowlist under ignored `output/app-service/`: `main.py`, `config.py`, the `ai`, `league` and `tactics` Python modules, the league catalog and three scenario JSON files. The scenarios are copied byte-for-byte from their canonical source files; no tracking data, outcome or source hash is changed. The deployed loader uses bundled `scenarios/`; repository development and the existing Render checkout continue to use `frontend/src/replay/`.

The artifact contains no frontend application, tests, `.env`, local virtual environment, Git metadata or credentials. It also omits the development project metadata so App Service unambiguously uses the production requirements export rather than attempting to install the local project. The API's modules are imported directly from the artifact root.

The workflow generates `requirements.txt` in the artifact using:

```bash
# backend/
uv export --locked --no-dev --no-emit-project --format requirements.txt \
  --output-file ../output/app-service/requirements.txt
```

This export retains exact locked versions, platform markers and package hashes. It is generated on every build, rather than maintained as a second dependency source. No dependency or lockfile changes are required. A separate Python 3.12 environment installs the exported file with `--require-hashes`, then starts the artifact using the production command and checks health, fixtures, standings, all three scenario evidence routes and mock AI configuration. That environment stays outside the uploaded artifact.

Only the staged directory is uploaded/downloaded; `azure/webapps-deploy@v3` deploys that directory to the existing Production slot. `azure/login@v2`, its three existing federated-identity secret references and `id-token: write` are preserved. Pushes to `main` trigger this workflow when backend code, this workflow or any of the three canonical data inputs change. Manual **Run workflow** remains available. Azure Static Web Apps, Netlify and Render configuration are unchanged; the Azure frontend now targets this App Service, while Netlify continues to target Render as a fallback.

## App Service settings to check manually

In the **butterfly-effect-api** App Service only:

| Setting                                      | Required value                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Operating system/runtime                     | Linux, Python 3.12                                                                                                               |
| App setting `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true`, so Oryx installs `requirements.txt` during deployment                                                                    |
| App setting `WEBSITE_RUN_FROM_PACKAGE`       | Remove if present; Python uses deployment build automation instead                                                               |
| Startup Command                              | Set by the deploy action to `python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`                                     |
| `CORS_ALLOWED_ORIGINS`                       | Exact browser origins, e.g. `https://proud-meadow-001c0b310.2.azurestaticapps.net,https://butterfly-effect-football.netlify.app` |
| `AI_PROVIDER`                                | `mock` for this deployment verification                                                                                          |
| `AI_PAID_GENERATION_ENABLED`                 | `false`                                                                                                                          |
| `WEB_CONCURRENCY`                            | `1`; keep one process/instance for the current process-local demo allowances                                                     |

App settings are under **Settings → Environment variables**; runtime and startup are under **Configuration**. Save settings and rerun the workflow if deployment build automation was previously disabled. The workflow does not read or rewrite cloud settings or existing Foundry credentials. Keep all existing AI cost limits unchanged. Do not add Foundry credentials to the artifact or frontend variables.

`PORT` can be supplied by the platform; otherwise startup binds to 8000. The Azure frontend sets its build-time `VITE_API_URL` to this API in the separate Static Web Apps workflow. Netlify retains its Render URL; see [Azure frontend setup](AZURE_STATIC_WEB_APPS.md). The App Service's default hostname is visible in its Overview or the deployment action output; use that exact hostname for verification rather than assuming a legacy hostname format.

Keep the existing GitHub federated identity secrets and its trust for this repository's `main` branch. No publish-profile secret is introduced. The deployment identity needs the existing App Service deployment/configuration permissions; authentication or authorization errors require checking that identity in Azure rather than replacing its secrets.

## Verification

Local backend: **215 passed, 1 optional skip**, Ruff passed. The test suite covers the runtime allowlist, bundled source identity, packaged imports/catalog/evidence and unchanged repository source paths. The production-only export installed all 41 applicable packages with hash verification into a fresh Python 3.12 environment, and the actual Uvicorn startup plus health, league, all three evidence routes and mock AI status passed. AI tests use mock providers; no paid requests are made.

After deployment, request `/health`, `/api/fixtures`, `/api/standings` and `/api/scenarios/the-missed-chance/evidence` on the App Service hostname. `GET /api/ai/status` checks configuration without invoking a model. Send the Azure frontend `Origin` header to `/health` and verify the exact `Access-Control-Allow-Origin` after configuring CORS. Health alone does not prove the scenario files or browser CORS work; the workflow's isolated startup check covers the bundled data routes.

References: [App Service Python deployment build automation](https://learn.microsoft.com/en-us/azure/app-service/configure-language-python#customize-build-automation), [Python startup commands](https://learn.microsoft.com/en-us/azure/app-service/configure-language-python#customize-startup-command), [Python and run-from-package](https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package), [uv lockfile exports](https://docs.astral.sh/uv/concepts/projects/export/).
