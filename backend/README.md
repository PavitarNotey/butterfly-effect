# Butterfly Effect API

FastAPI application with a typed `GET /health` endpoint and local Vite CORS support. See the [root README](../README.md) for development and verification commands.

For the backend-only Azure App Service workflow, locked production dependency export, bundled canonical data and manual cloud settings, see [Azure App Service setup](../docs/AZURE_APP_SERVICE.md). Existing frontend deployments continue to use Render.

`CORS_ALLOWED_ORIGINS` adds comma-separated exact browser origins to the two local Vite origins. Set it to `https://butterfly-effect-football.netlify.app` on Render. No wildcard origins are accepted. See [the Netlify/Render guide](../docs/NETLIFY_RENDER.md) for required environment values and verification; no live settings/deployment are changed by editing these files.

The backend owns all Foundry credentials and AI calls. Keep `.env` ignored; use
`.env.example` as the variable reference. `AI_PROVIDER=auto` uses the configured
Foundry deployment, or disables AI when no connection is supplied. Select
`AI_PROVIDER=mock` explicitly for deterministic offline fixtures and CI.

Paid generation defaults to **paused**, even with valid credentials. Enabling it
requires `AI_PAID_GENERATION_ENABLED=true` and positive, deployment-specific
`AI_INPUT_USD_PER_MILLION` / `AI_OUTPUT_USD_PER_MILLION` rates. Defaults allow at
most 12 attempts per process lifetime, 40 per hour and $0.25 estimated accounted
plus reserved cost. Each retry needs a new allowance; uncertain failures retain
their full estimate. Zero prices mean unconfigured. These are single-process
demo protections, not a subscription billing cap: restarts reset counters and
workers multiply them. See [Phase 4C](../docs/PHASE_4C_PRODUCT_HARDENING.md).

Run with `uv run python -m uvicorn main:app --reload`. Read-only AI configuration
status is at `/api/ai/status`; interactive typed API docs are at `/docs`.
Generation only occurs on an explicit explanation, commentary or recap request.
The application does not connect to Azure at startup.

An optional paid smoke test is `uv run python -m ai.smoke casual` (also `analyst`
or `recap`/`commentary`). It sends exactly one bounded request with retries disabled and
prints only provenance, headline and returned token usage. Normal tests never
need Azure. See [the technical report](../docs/PHASE_4_AI_INTELLIGENCE.md) for
architecture, safeguards and their limitations.

Do not run a paid smoke test without explicit user approval. The Phase 4C report
defines a separately approved two-request procedure for the current prompt.
`uv run python -m ai.estimate` is entirely offline and prints request-size
comparisons. `request.app.state.intelligence.diagnostics()` provides internal
same-process counters; no administrative HTTP endpoint is exposed. A fresh
Python process cannot inspect an existing server's counters.

Mode changes and **Check saved analysis** use `cache_only=true` (POST body for
moments, query parameter for recap/commentary). A missing saved result returns
409 and cannot create a model task. Only explicit Analyze, Explain, Enable or
Request commentary actions may generate; cache hits and shared in-flight work
still take precedence. Playback, evidence viewing and navigation never generate.

Test recap styles explicitly with `uv run python -m ai.smoke recap --mode casual`
or `--mode analyst`; the positional `analyst` command tests a moment, not a recap.
Storytelling instructions are in `ai/prompts.py`, and citation requirements shared
with the validator are in `ai/citations.py`. Technical evidence stays in the
initially closed **Explore the evidence** disclosure for both viewer modes, using
human-readable labels. Raw IDs and validation diagnostics remain outside the
ordinary interface. See [Phase 4.1](../docs/PHASE_4_1_AI_MATCH_CENTER.md) for the
current Match Center layout and prompt verification status.
