# Butterfly Effect API

FastAPI application with a typed `GET /health` endpoint and local Vite CORS support. See the [root README](../README.md) for development and verification commands.

The backend owns all Foundry credentials and AI calls. Keep `.env` ignored; use
`.env.example` as the variable reference. `AI_PROVIDER=auto` uses the configured
Foundry deployment, or disables AI when no connection is supplied. Select
`AI_PROVIDER=mock` explicitly for deterministic offline fixtures and CI.

Run with `uv run python -m uvicorn main:app --reload`. Read-only AI configuration
status is at `/api/ai/status`; interactive typed API docs are at `/docs`.
Generation only occurs on an explicit explanation, commentary or recap request.
The application does not connect to Azure at startup.

An optional paid smoke test is `uv run python -m ai.smoke casual` (also `analyst`
or `recap`/`commentary`). It sends exactly one bounded request with retries disabled and
prints only provenance, headline and returned token usage. Normal tests never
need Azure. See [the technical report](../docs/PHASE_4_AI_INTELLIGENCE.md) for
architecture, safeguards and their limitations.

Test recap styles explicitly with `uv run python -m ai.smoke recap --mode casual`
or `--mode analyst`; the positional `analyst` command tests a moment, not a recap.
Storytelling instructions are in `ai/prompts.py`, and citation requirements shared
with the validator are in `ai/citations.py`. Technical evidence stays in the
initially closed **Explore the evidence** disclosure for both viewer modes, using
human-readable labels. Raw IDs and validation diagnostics remain outside the
ordinary interface. See [Phase 4.1](../docs/PHASE_4_1_AI_MATCH_CENTER.md) for the
current Match Center layout and prompt verification status.
