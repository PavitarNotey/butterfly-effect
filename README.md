# Butterfly Effect

### Every Moment Has a Story.

**An interactive 3D football storytelling experience that reveals the movements, decisions, and tactical patterns behind decisive moments.**

Football highlights show us what happened. Butterfly Effect helps us explore how the moment developed.

Watch the play unfold in a 3D stadium, follow individual players, switch perspectives, inspect movement and passing lanes, and replay the evidence behind each tactical insight.

Built as part of the **Premier League Inside the Game Hackathon**.

## What You Can Do

### Experience the match from every angle

- **Interactive 3D replay** — Watch 22 animated footballers and a ball follow deterministic, timestamped trajectories.
- **Multiple camera perspectives** — Switch between broadcast, tactical, full-pitch, third-person player-follow and first-person player views.
- **Player POV** — Experience the action through simulated player gaze, including ball tracking and field scanning.
- **Interactive player selection** — Click players directly on the pitch or find them using a searchable, team-grouped roster.
- **Free-look** — Pause in player POV and look around with mouse, touch or keyboard controls.
- **Replay controls** — Pause, seek, restart and adjust playback speed without changing the underlying match events.

### Understand the movement behind the moment

- **Tactical intelligence** — Explore player movement, defensive relationships, passing corridors, available space and shot trajectories.
- **Evidence-guided replays** — Select a tactical insight and watch the relevant movement highlighted directly in the 3D scene.
- **Plain-English explanations** — Understand the play without needing to interpret raw tracking metrics.
- **Detailed evidence** — Expand technical measurements, geometric definitions and limitations when deeper analysis is needed.

### Watch footballers react

- Skeletal animations for all 22 players.
- Event-synchronized passing, receiving and shooting.
- Goalkeeper lunges and reactions.
- Defensive body language and ball tracking.
- Goal celebrations and missed-chance reactions.

All presentation animations are derived from the replay timeline. Canonical player positions, ball trajectories and outcomes remain unchanged.

## Current Showcase Scenarios

| Scenario              | Story                                                                                                    | Outcome |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| **The Invisible Run** | An off-ball run contributes to a defensive shift, creating a passing opportunity that leads to a finish. | Goal    |
| **The Missed Chance** | Attacking movement and defensive recovery shape a promising opportunity that ultimately goes wide.       | Miss    |

Both are original, handcrafted 20-second synthetic scenarios featuring 22 players, fictional teams, validated events and tactical evidence.

The scenarios use a shared replay, animation and analysis architecture rather than separate hardcoded demos.

## How It Works

Butterfly Effect separates **what happened**, **what can be measured**, and **how the moment is explained**.

**1. Canonical match data**

Timestamped player tracks, facing directions, ball trajectories, possession and events define each synthetic scenario.

**2. Deterministic replay engine**

React Three Fiber and Three.js render the stadium and animated players using a shared authoritative replay clock. Pausing, seeking or changing cameras does not change the recorded play.

**3. Tactical geometry engine**

Python analyzes movement, player relationships, passing corridors, receiving-space coverage and shot trajectories.

**4. Evidence-grounded presentation**

Validated observations are translated into accessible tactical insights and linked to guided 3D replays.

**5. Future AI storytelling**

The planned AI layer will use validated tactical evidence to generate different styles of explanation. It is not yet implemented.

### Technology

| Layer                  | Technology                        |
| ---------------------- | --------------------------------- |
| Frontend               | React, TypeScript, Vite           |
| 3D rendering           | Three.js, React Three Fiber, Drei |
| State management       | Zustand                           |
| Backend API            | Python, FastAPI, Pydantic         |
| Tactical analysis      | Python, NumPy                     |
| Testing                | Vitest, Playwright, pytest, Ruff  |
| Planned AI integration | Microsoft Foundry / Azure OpenAI  |

## Getting Started

### Prerequisites

- Node.js 22.12+ or a newer supported LTS release
- pnpm 10
- Python 3.12+
- uv
- Google Chrome for browser tests

### Start the backend

From the repository root:

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API: http://127.0.0.1:8000

Interactive API documentation: http://127.0.0.1:8000/docs

### Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
pnpm install
pnpm dev
```

Open **http://localhost:5173**.

Vite uses port 5173 with `strictPort` enabled.

### Environment configuration

The frontend defaults to `http://127.0.0.1:8000`.

To override the API URL:

```bash
cp frontend/.env.example frontend/.env.local
```

Set `VITE_API_URL` in the copied file and restart Vite.

Do not put secrets into `VITE_` environment variables; they are exposed to the browser.

The original replay scenes can run without the API. Server-provided tactical analysis requires the backend.

## Try the Demo

1. Open **The Invisible Run**.
2. Watch the buildup, then seek to the movement around 6 seconds.
3. Click a footballer on the pitch and choose **View POV**.
4. Pause and look around the field.
5. Return to broadcast or follow the selected player.
6. Open **Analyze this moment**.
7. Select a tactical insight and choose **Show me in the replay**.
8. Watch the corresponding movement and geometry highlighted in the 3D replay.
9. Expand **How we measured this** to inspect the underlying evidence.
10. Switch to **The Missed Chance** and compare the outcome.

## Testing

### Frontend

From `frontend/`:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The browser suite uses Google Chrome and can start the development servers automatically when their ports are available. The `uv` executable must be on `PATH`.

### Backend

From `backend/`:

```bash
uv run pytest
uv run ruff check .
```

The optional external SkillCorner integration test is skipped when its local tracking segment is unavailable.

### API contract generation

Pydantic models define the backend API contract. After a deliberate schema change:

```bash
cd backend
uv run python export_openapi.py

cd ../frontend
pnpm generate:api
```

Commit the generated contract files alongside any intended schema changes.

## Tracking Data and Evidence Integrity

The default demo uses synthetic, authored tracking data.

- Player positions and ball movements are not generated by an LLM.
- Replay geometry uses consistent metric coordinates and the authoritative timeline.
- Tactical observations are computed deterministically in Python.
- Evidence is validated against the active scenario's source hash.
- A passing-lane classification is a geometric measurement, not a pass-completion probability.
- Simulated gaze, gestures and animation do not establish actual player awareness or intent.
- Authored interpretations remain distinct from measured facts.

The repository also includes an optional **SkillCorner tracking ingestion demonstration**, separate from the fictional showcase scenes.

See [Football Realism](docs/FOOTBALL_REALISM.md) for provider terms, ingestion, diagnostics and validation.

## Character Assets

The animated characters use specifically reviewed, CC0-licensed Quaternius base-character and animation-library assets.

The exact source archives, license notices, asset hashes, rig architecture and optimization workflow are documented in [Character Animation](docs/CHARACTER_ANIMATION.md).

## Project Status

**Completed:**

- Two deterministic 22-player scenarios.
- Full-team skeletal animation and football actions.
- Python tactical geometry and validated evidence.
- Interactive tactical overlays and guided evidence replays.
- Player selection, searchable roster and immersive POV.
- Goalkeeper, defender and outcome-specific presentation reactions.
- Automated unit, integration and browser tests.

**Planned:**

- Additional original showcase scenarios, including a dummy-led attacking combination.
- Evidence-grounded AI narrative generation.
- Further cinematic and animation improvements.
- Deployment and public demo hosting.

## Documentation

| Document                                           | Description                                                  |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [Replay Architecture](docs/REPLAY.md)              | Canonical tracks, coordinate system, clock and cameras       |
| [Tactical Analysis](docs/TACTICAL_ANALYSIS.md)     | Python geometry engine, evidence schemas and limitations     |
| [Character Animation](docs/CHARACTER_ANIMATION.md) | Skeletal rigs, resource management and licensing             |
| [Football Actions](docs/FOOTBALL_ACTIONS.md)       | Deterministic passes, receiving and shots                    |
| [Phase 3C Experience](docs/PHASE_3C_EXPERIENCE.md) | Guided replay, POV, player picker, reactions and performance |
| [Camera Framing](docs/CAMERA_FRAMING.md)           | Camera design and framing validation                         |
| [Football Realism](docs/FOOTBALL_REALISM.md)       | Tracking-data ingestion and validation                       |

## The Idea

**A single football moment can tell multiple stories.**

The player on the ball, the runner creating space, the defender recovering position and the goalkeeper reacting all contribute to the same sequence.

Butterfly Effect makes those different perspectives visible, explorable and understandable.
