# Butterfly Effect

**Every Moment Has a Story.**

An interactive 3D football storytelling experience that reveals the hidden off-ball movements and decisions behind decisive moments.

## Vision

Explore football moments from multiple player perspectives, trace the movements that shaped an outcome, and understand the tactical story behind the action.

## Tech Stack

- React + TypeScript
- Three.js / React Three Fiber
- Python + FastAPI
- Azure AI

## Status

Early development — Premier League Inside the Game hackathon.

## Local development

Prerequisites: Node.js 22.12+ (or a newer supported LTS), pnpm 10, Python 3.12+, and uv.

Start the API in terminal 1, from the repository root:

```sh
cd backend
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in terminal 2, from the repository root:

```sh
cd frontend
pnpm install
pnpm dev
```

Open **http://localhost:5173**. The small header indicator should show **API connected** after a successful cross-origin `GET http://127.0.0.1:8000/health`. Use its refresh button to check again after restarting the API. Requests time out after five seconds and show **API offline** on failure.

Vite uses port 5173 with `strictPort` so it will report a conflict rather than silently switch to an origin the API does not allow. FastAPI allows `http://localhost:5173` and `http://127.0.0.1:5173`. API docs: **http://127.0.0.1:8000/docs**.

The frontend defaults to `http://127.0.0.1:8000`. To override it, copy `frontend/.env.example` to `frontend/.env.local`, edit `VITE_API_URL`, and restart Vite. `VITE_` variables are public browser configuration; never place secrets there. A different frontend origin also requires updating FastAPI's CORS allowlist.

## Verification

From `backend/`:

```sh
uv run pytest
uv run ruff check .
```

From `frontend/`:

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

Browser tests use Playwright with installed Google Chrome. If Chrome is unavailable, install it with `pnpm exec playwright install chrome`. Tests start both development servers automatically when the ports are free; `uv` must be on PATH. Vitest tests cover replay interpolation, clock controls and camera state. Browser tests check the real browser-to-API request, CORS, offline/retry behavior, mobile layout, player selection, seeking, playback and POV switching.

The Pydantic health response is the API contract. After changing a backend schema, regenerate and commit the OpenAPI snapshot and TypeScript definitions:

```sh
cd backend
uv run python export_openapi.py
cd ../frontend
pnpm generate:api
```

## Foundation scope

The studio offers **The Invisible Run — Goal** and **The Missed Chance — Missed opportunity**, two original 20-second deterministic replays with distinct 22-player rosters, kits and tactical stories. Switch scenarios using the selector above the replay; switching pauses and resets time, camera, selection and evidence. Both use the same rendering, clock and Python geometry engine. The health API and generated contract remain intact. Deterministic Python tactical evidence and optional 3D analytical layers are available through **Analyze this moment**. Azure AI, physics simulation and deployment remain deferred. See the [tactical analysis guide](docs/TACTICAL_ANALYSIS.md). See [replay architecture and demo guide](docs/REPLAY.md) for the coordinate system, authored sequence, verification and limitations.

## Real tracking demonstration (Milestone 3A)

From the repository root, download only 00:10–00:30 of the official SkillCorner match 1925299 into an external directory:

```sh
cd backend
uv run python -m tracking --download --directory /tmp/butterfly-skillcorner-1925299 --start 10 --end 30
uv run python -m tracking --directory /tmp/butterfly-skillcorner-1925299
SKILLCORNER_DIR=/tmp/butterfly-skillcorner-1925299 uv run pytest
```

The first command requires network access. It pins the source revision, retains provider metadata, license, original JSONL and a download manifest, then writes validated `canonical.json` and deterministic `report.json`. The second command reruns ingestion/diagnostics offline. The environment variable enables the genuine-source integration test; ordinary pytest runs explicitly skip it if the external segment is absent. No provider data or animation assets are committed. The real segment is an offline diagnostic demonstration, separate from the fictional replay selector.

`GET /api/scenarios` discovers both showcases and their hashes/outcomes. See [football realism, source terms, measured results and 3B preparation](docs/FOOTBALL_REALISM.md), [replay](docs/REPLAY.md), and [tactical evidence](docs/TACTICAL_ANALYSIS.md).
