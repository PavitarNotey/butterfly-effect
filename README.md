# Butterfly Effect

### Every Moment Has a Story.

**An interactive 3D football storytelling experience that reveals the movements and tactical patterns behind decisive moments.**

Football highlights show us what happened. Butterfly Effect helps us explore how the moment developed.

Watch the play unfold in a 3D stadium, follow individual players, switch perspectives, inspect movement and passing lanes, and replay the evidence behind each tactical insight.

The homepage introduces the **Meridian League**, an original fictional ten-club competition. Explore Matchweek 10’s results, upcoming fixtures and computed midseason standings, then open a Match Center and step into its analyzed 3D passage. Vesper Athletic–Tidal Rovers is the featured Match of the Week. These are authored fictional matches and synthetic tracking, not real-world football data.

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
- Non-contact dummy poses with a visible ball passage between the legs.
- A grounded partial goalkeeper lunge and a restrained tracking/reach reaction.
- Defensive body language and ball tracking.
- Goal celebrations and missed-chance reactions.

All presentation animations are derived from the replay timeline. Canonical player positions, ball trajectories and outcomes remain unchanged.

## Current Showcase Scenarios

| Scenario              | Story                                                                                                    | Outcome |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| **The Invisible Run** | An authored off-ball run develops alongside a defensive shift and a passing opportunity that leads to a finish. | Goal    |
| **The Missed Chance** | Attacking movement and defensive recovery frame a promising opportunity that ultimately goes wide.            | Miss    |
| **The Pass That Wasn't Touched** | A low diagonal passes between a central attacker’s legs without contact and reaches an arriving midfielder for a quick finish. | Goal |

All three are original synthetic scenarios featuring 22 players, fictional teams, validated events and tactical evidence. The Invisible Run lasts **13.2 seconds** after the intentional [Phase 3C.2 goal revision](docs/PHASE_3C_2_GOAL_REVISION.md); The Missed Chance lasts **12 seconds** after the approved [Phase 4.2 realism revision](docs/PHASE_4_2_MISSED_CHANCE.md). The Pass That Wasn't Touched lasts **13.6 seconds**; its typed dummy event explicitly records no contact or possession transfer. See the [Phase 3D engineering report](docs/PHASE_3D_UNTOUCHED_PASS.md).

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

**5. Microsoft Foundry storytelling**

Microsoft Foundry generates structured Casual Fan and Analyst explanations, replay-synchronized text commentary, and finished-match recaps from trusted synthetic events and tactical evidence. Backend reference checks and conservative claim screening precede display. Explicit offline fixtures and rejected-output fallbacks are labeled separately. Paid generation defaults to paused, with per-attempt reservations and bounded application allowances when enabled. Mode changes only check saved analysis; generation requires an explicit action. **Show me why** connects cited measurements to the existing guided replay directly in Match Center. See [Phase 4C](docs/PHASE_4C_PRODUCT_HARDENING.md) for current setup, cost safeguards and their limitations, and [Phase 4](docs/PHASE_4_AI_INTELLIGENCE.md) for the grounding architecture.

### Technology

| Layer                  | Technology                        |
| ---------------------- | --------------------------------- |
| Frontend               | React, TypeScript, Vite           |
| 3D rendering           | Three.js, React Three Fiber, Drei |
| State management       | Zustand                           |
| Backend API            | Python, FastAPI, Pydantic         |
| Tactical analysis      | Python, NumPy                     |
| Testing                | Vitest, Playwright, pytest, Ruff  |
| AI generation          | Microsoft Foundry / Azure OpenAI Responses API |

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
uv run python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
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

For the existing Netlify frontend and Render API, see [Netlify/Render setup](docs/NETLIFY_RENDER.md). The prepared configuration sets the production API URL, adds the SPA fallback, and permits the exact Netlify origin through backend `CORS_ALLOWED_ORIGINS` while retaining localhost. Applying it to the live services requires a separately approved deployment.

The website’s league data and tactical evidence require the backend. The original replay scenes remain independently available at **http://localhost:5173/studio**, including when the API is unavailable.

## Try the Demo

Start on the homepage: select **Vesper Athletic–Tidal Rovers**, try the Match Center’s play, scrub and overview controls, then choose **Explore in 3D** on Merrick’s goal. Return to the match, explore the two other results, upcoming previews and standings. Each finished match has one reconstructed passage; unmarked events are informational.

For the complete scenario library, open **/studio**:

1. Open **The Invisible Run**.
2. Watch the buildup, then seek to the defensive shift around 2.8 seconds.
3. Click a footballer on the pitch and choose **View POV**.
4. Pause and look around the field.
5. Return to broadcast or follow the selected player.
6. Open **Analyze this moment**.
7. Select a tactical insight and choose **Show me in the replay**.
8. Watch the corresponding movement and geometry highlighted in the 3D replay.
9. Expand **How we measured this** to inspect the underlying evidence.
10. Switch to **The Missed Chance** and compare the outcome.
11. Choose **The Pass That Wasn't Touched**, analyze the **dummy** moment, then choose **Show me in the replay** for the oblique slow-motion view.

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

- Three deterministic 22-player scenarios, including a validated non-contact dummy.
- Full-team skeletal animation and football actions.
- Python tactical geometry and validated evidence.
- Interactive tactical overlays and guided evidence replays.
- Player selection, searchable roster and immersive POV.
- Goalkeeper, defender and outcome-specific presentation reactions.
- Automated unit, integration and browser tests.
- Foundry moment explanations, Casual/Analyst modes, synchronized commentary and finished-match recaps with explicit mock mode.

**Planned:**

- Additional original showcase scenarios.
- Further cinematic and animation improvements.
- Deployment and public demo hosting.

## Documentation

| Document                                           | Description                                                  |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [Phase 4 AI Intelligence](docs/PHASE_4_AI_INTELLIGENCE.md) | Foundry integration, evidence boundaries, synthetic ingestion, recaps, cost controls and verification |
| [Phase 4.1 AI Match Center](docs/PHASE_4_1_AI_MATCH_CENTER.md) | Prominent AI panel, responsive layouts, response-driven reveal, storytelling and verification |
| [Phase 4.2 Missed Chance](docs/PHASE_4_2_MISSED_CHANCE.md) | Approved tempo revision, driven shot, tracking reactions, framing and evidence integrity |
| [Phase 3E League & Match Center](docs/PHASE_3E_LEAGUE_MATCH_CENTER.md) | Fictional competition, standings, routing, viewer lifecycle and verification |
| [Phase 3D Engineering](docs/PHASE_3D_UNTOUCHED_PASS.md) | Non-contact dummy, quick actions, mesh clearance and verification |
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
