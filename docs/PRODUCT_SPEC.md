# Build Butterfly Effect — AI-Powered 3D Football Intelligence Studio

You are a senior full-stack engineer, 3D graphics engineer, football analytics engineer, and AI systems architect.

Your task is to build **Butterfly Effect**, a polished, browser-based football intelligence application for the Microsoft/Premier League synthetic match insights hackathon.

The submission deadline is October 27, 2026. Prioritize a complete, working, demonstrable product over unnecessary features.

## 1. Product vision

**Tagline:** Every Moment Has a Story.

Butterfly Effect is an AI-powered football broadcast analysis studio that reveals the hidden chains of movements, decisions, and spatial relationships behind important match moments.

A viewer should be able to:

1. Open a professional broadcast-style match interface.
2. View synthetic match events and key moments.
3. Select a goal, missed chance, or defensive recovery.
4. Watch a smooth 3D replay of the preceding sequence.
5. Pause, rewind, scrub, and change playback speed.
6. Switch between broadcast, tactical overhead, and relevant players' first-person perspectives.
7. Select players and inspect their positioning, runs, and passing options.
8. Toggle Tactical Vision to reveal passing lanes, defensive movements, spatial opportunities, and line-of-sight information.
9. Explore an evidence-backed chain explaining how the moment developed.
10. Read or optionally hear a personalized AI explanation in casual or analyst mode.

The experience must be visually compelling, technically credible, and consistent.

**Critical requirement:** The replay and tactical explanation must agree. Never describe a movement, defensive reaction, passing lane, or visibility condition that is not supported by the simulation data.

## 2. Existing prototype

The repository may contain an earlier standalone Three.js proof of concept.

Inspect the repository before making changes.

Preserve useful working functionality where practical, but refactor or replace the architecture if necessary.

Known prototype shortcomings:

- Player movements are overly scripted and sometimes do not match the explanation.
- Tactical insights are mostly hardcoded.
- Player animations and ball movement need improvement.
- The replay needs a proper shared data model.
- The UI needs to become a cohesive broadcast studio.

Do not simply add more hardcoded text to the existing animation.

## 3. Technology stack

Frontend:

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- @react-three/drei
- Zustand for shared playback/UI state
- Tailwind CSS or equivalent cohesive styling

Backend:

- Python 3.11+
- FastAPI
- Pydantic
- NumPy
- WebSockets

AI:

- Azure AI Foundry / Azure-hosted model endpoint
- Server-side integration only
- Configurable environment variables
- Structured JSON responses validated with Pydantic
- Deterministic fallback when AI is unavailable

Testing:

- Vitest for frontend logic
- pytest for backend logic
- Playwright for browser smoke tests where feasible

Deployment:

- Azure Static Web Apps or equivalent for frontend
- Azure Container Apps for backend
- Docker configuration
- Environment-variable-based configuration

Avoid adding a database, authentication system, or complex infrastructure unless absolutely necessary.

## 4. Visual direction

Build a premium, modern sports broadcast studio.

Visual identity:

- Dark navy / charcoal background
- Vibrant pitch greens
- Restrained teal/cyan highlights
- Clear typography
- Professional scoreboards and event timelines
- Subtle animations and polished transitions
- High-quality information hierarchy

The 3D replay is the centerpiece of the interface.

The football scene should contain:

- Regulation-proportioned pitch
- Correct markings and goals
- Simple but convincing stadium surroundings
- Lighting and shadows
- 22 human-shaped mannequin players
- Two visually distinct teams
- Shirt numbers or identifiers
- A visible football
- Smooth player movement and turning
- Basic running/idle animation
- Plausible ball passing, carrying, and shooting

Players should look like stylized 3D mannequins rather than cylinders or flat discs. Do not spend excessive time on faces, clothing simulation, or crowds.

Use procedural geometry or appropriately licensed assets. Document third-party asset licenses.

Maintain smooth performance on a typical desktop browser.

## 5. Match data model

Create a reusable, versioned synthetic match data schema.

A scenario must contain:

- Unique scenario ID
- Title and description
- Match clock and scenario-relative timestamps
- Team and player metadata
- Pitch dimensions
- Player positions over time
- Player orientations over time
- Ball positions over time, including height
- Ball possession and touch events
- Pass, carry, shot, interception, save, and other relevant events
- Key moments
- Relevant player IDs
- Tactical evidence references
- Optional scenario-specific narrative metadata

Use metres for pitch coordinates and seconds for time.

Document the coordinate system explicitly.

Prefer a right-handed Three.js world with:

- X = pitch length
- Z = pitch width
- Y = vertical height

Provide transformation helpers if the backend uses 2D pitch coordinates.

Use a canonical, deterministic simulation timeline.

The frontend must interpolate player positions, orientations, and ball positions from data. Do not use frame-dependent movement that changes the scenario depending on browser performance.

Seeking to any timestamp must reproduce the same scene state.

Ensure consistent handling of:

- Rotation interpolation
- Ball possession
- Pass trajectories
- Shot trajectories
- Player speed limits
- Event timestamps
- Playback boundaries

All cameras must observe the same simulation state.

## 6. Three handcrafted showcase scenarios

Build three polished, original synthetic football sequences.

### Scenario A: The Invisible Run — Goal

A winger makes a meaningful off-ball run, causing a defender to shift and creating space for a midfielder or striker.

The attacking team exploits the opening and scores.

Show:

- Initial defensive shape
- Off-ball movement
- Defender response
- Space opening
- Pass into the available channel
- Shot and goal

The tactical engine must verify whether the defender actually moves and whether the passing lane improves.

Do not claim the defender was distracted or fooled unless the data supports a defensible geometric interpretation.

### Scenario B: The Chance That Disappeared — Missed Chance

An attacker enters a promising position but fails to convert.

Demonstrate:

- The attacking buildup
- Defensive pressure
- Available passing or shooting options
- A narrowing angle or closing defensive space
- The shot and missed opportunity

Explain the outcome using measurable spatial and event evidence.

Do not present a made-up expected-goals value as a calibrated real-world probability.

### Scenario C: The Press That Changed Everything — Defensive Recovery

The defending team coordinates pressure and recovers possession.

Demonstrate:

- The initial buildup
- Pressing movement
- Reduced passing options
- Pressure on the ball carrier
- Forced or poorly executed action
- Defensive interception or recovery

Explain how positioning and pressure contributed to the recovery.

All three scenarios must be football-plausible and visually consistent.

## 7. Synthetic scenario generator

Create a reusable synthetic data generator separate from the handcrafted showcases.

The generator should support:

- Seeded deterministic output
- Configurable teams and formations
- Player trajectories
- Ball trajectories
- Event timestamps
- Scenario validation
- JSON export

It does not need to generate realistic full 90-minute matches.

Instead, demonstrate that the architecture can support additional short football sequences without rewriting the renderer.

Use handcrafted scenarios for the polished demo and generated scenarios to demonstrate extensibility.

## 8. Replay engine

Implement:

- Play/pause
- Restart
- Timeline scrubber
- Playback speed: 0.25x, 0.5x, 1x, 2x
- Jump to tactical event
- Switch scenario
- Highlight selected player
- Display player names and team affiliation
- Optional player movement trails

The simulation clock must be independent of the rendering frame rate.

Changing playback speed must not affect geometry calculations or event timing.

Seeking backward must correctly restore ball possession, player orientation, annotations, and event state.

## 9. Camera system

Support:

- Broadcast camera
- Tactical overhead camera
- First-person camera for key attacking players
- First-person camera for key defending players
- First-person camera for other players when selected

Show 3–6 contextually relevant players as the primary camera options.

Provide an expandable roster selector for all 22 players.

First-person cameras should:

- Follow the selected player's recorded position
- Sit at a realistic eye height
- Use recorded heading/orientation
- Smooth movement without excessive motion sickness
- Avoid clipping through the mannequin's head
- Preserve accurate world alignment

Provide a split-screen comparison mode if the core system is stable.

Both views must use the exact same playback timestamp.

If split-screen is too expensive or unstable, defer it without compromising single-camera replay.

## 10. Tactical Vision

Implement toggleable 3D overlays:

- Player movement trails
- Passing lanes
- Defender displacement
- Highlighted open space
- Defensive pressure
- Player field-of-view cones
- Key event markers

Overlays must be computed from actual positions and events.

Avoid displaying every annotation simultaneously.

Allow selecting an insight to show only the relevant players and geometry.

Use distinct styling for:

- Observed facts
- Computed spatial metrics
- Tactical interpretations

Player visibility must be treated as simulated geometric visibility, not proof of actual human perception.

A player-facing direction alone does not establish what a real player noticed.

## 11. Tactical analysis engine

Build a deterministic Python analysis module.

At minimum implement:

- Player-to-player distance
- Player speed and displacement
- Relative positioning
- Passing lane obstruction or clearance
- Defender proximity to a passing lane
- Pressure around the ball carrier
- Spatial separation changes
- Geometric field of view
- Event sequence linking

Use pitch-coordinate geometry rather than LLM reasoning for these calculations.

Make assumptions explicit and configurable.

For each detected tactical observation, produce:

- Evidence ID
- Scenario ID
- Timestamp or interval
- Involved players
- Evidence type
- Measured values
- Supporting source event/frame references
- Confidence or qualification where appropriate

Use deterministic algorithms with unit tests.

Avoid asserting player intentions, psychological states, or definitive causation.

## 12. Evidence graph / Butterfly Effect chain

This is the core differentiating feature.

For every showcase moment, build a chain of meaningful preceding observations.

Example:

Off-ball run → Defender shifts → Passing lane becomes clearer → Midfielder plays forward → Striker receives → Goal.

Each node should:

- Have a timestamp
- Reference actual evidence IDs
- Identify involved players
- Explain what was observed
- Link to a replay timestamp
- Have a visual highlight in the 3D scene

Distinguish temporal sequence from causal certainty.

The system may identify plausible tactical contributions but must not claim mathematical proof that a run caused a goal.

Clicking a chain node should:

- Seek to the relevant replay moment
- Highlight the involved players
- Display the supporting tactical annotation
- Show the corresponding explanation

The evidence graph must be data-driven, not a decorative hardcoded diagram.

## 13. Azure AI integration

Create a backend service that transforms validated tactical evidence into grounded natural-language explanations.

Support:

- Casual fan mode
- Analyst mode
- Optional multiple languages
- Scenario summaries
- Player-specific explanations
- Moment-specific explanations

Use structured outputs with:

- Summary
- Narrative steps
- Evidence references
- Relevant timestamps
- Involved players
- Uncertainty notes

Validate all returned evidence IDs against known evidence.

Reject or remove unsupported claims.

Never allow the model to invent player coordinates, events, scores, or tactical measurements.

Keep API keys on the backend.

Include timeouts, error handling, and a deterministic fallback.

When Azure AI is unavailable, the app must remain functional and clearly indicate that it is using a deterministic explanation rather than a generated one.

Optional voice:

- Use browser speech synthesis as an initial fallback.
- Integrate Azure Speech only after the core product works.

## 14. Studio interface

Build these main sections:

### Header

- Butterfly Effect branding
- Match information
- Score
- Scenario selector

### Central replay

- Large 3D viewport
- Camera selector
- Playback controls
- Tactical Vision toggle
- Player selection

### Key moments timeline

- Goal
- Missed chance
- Defensive recovery
- Event timestamps and labels

### Butterfly Effect panel

- Evidence chain
- Clickable tactical steps
- Highlighted player contributions
- Supporting measurements

### AI explanation panel

- Casual/analyst toggle
- Explanation text
- Evidence references
- Optional voice playback

The UI should feel like a coherent broadcast analysis application, not several unrelated dashboards.

## 15. API design

Create typed, documented endpoints such as:

GET /api/health

GET /api/scenarios

GET /api/scenarios/{id}

GET /api/scenarios/{id}/events

GET /api/scenarios/{id}/evidence

GET /api/scenarios/{id}/insights

POST /api/explanations

WebSocket /ws/match/{id}

Adapt the exact routes if a better architecture emerges.

The WebSocket should demonstrate synthetic event streaming with replayable, timestamped messages.

Ensure event streaming and the replay timeline share the same canonical event data.

## 16. Quality requirements

The application must:

- Start reliably using documented commands
- Work without Azure credentials in fallback mode
- Avoid hardcoded API secrets
- Handle missing or invalid data
- Avoid rendering crashes when changing cameras
- Keep player and ball positions synchronized
- Preserve deterministic seeking
- Validate evidence references
- Support all three scenarios
- Be usable on a desktop browser
- Include clear loading and error states

Tests should cover:

- Scenario schema validation
- Trajectory interpolation
- Playback seeking
- Ball possession transitions
- Passing lane calculations
- Pressure calculations
- Evidence graph integrity
- AI response validation
- Scenario switching
- Camera switching

## 17. Implementation priorities

### P0 — Must work first

1. Clean project structure
2. Shared typed match data schema
3. Three handcrafted scenarios
4. Deterministic 3D replay
5. Correct ball/player synchronization
6. Broadcast and player POV cameras
7. Replay controls
8. Functional broadcast studio UI

### P1 — Core differentiation

1. Spatial analysis engine
2. Evidence graph
3. Clickable causal-chain-style exploration
4. Tactical Vision
5. Grounded AI explanations
6. Azure integration
7. Simulated event streaming

### P2 — Polish

1. Split-screen POV
2. Voice commentary
3. Additional languages
4. Enhanced mannequin animations
5. Additional procedural scenarios
6. Improved visual effects

Never sacrifice a working P0/P1 system to implement P2 features.

## 18. Development workflow

Before coding:

1. Inspect the existing repository.
2. Summarize reusable components and limitations.
3. Produce a concise implementation plan.
4. Identify technical risks.
5. Begin implementation without waiting for unnecessary approvals.

During implementation:

- Work in small, testable increments.
- Keep the application runnable.
- Run relevant tests.
- Fix actual failures rather than bypassing them.
- Do not leave fake buttons or nonfunctional controls.
- Do not substitute static screenshots for working 3D.
- Do not claim functionality is complete unless verified.

After implementation:

- Run build and tests.
- Perform browser smoke tests if browser tooling is available.
- Report remaining limitations honestly.
- Provide exact local setup commands.
- Document required Azure configuration.
- Prepare a concise demo walkthrough.

## 19. Deliverables

Create:

- Complete source code
- Frontend application
- Backend API
- Three playable showcase scenarios
- Synthetic data generator
- Tactical analysis module
- Evidence graph system
- Azure AI integration with fallback
- Automated tests
- Docker configuration
- .env.example
- README with setup instructions
- Architecture documentation
- Deployment instructions
- Hackathon demo script

## 20. Definition of done

A reviewer should be able to open Butterfly Effect, select a goal, watch a realistic 3D buildup, switch to the relevant defender's first-person perspective, inspect the movement that opened the passing lane, and read an explanation supported by actual simulation evidence.

They should then be able to explore a missed chance and a defensive recovery using the same system.

The application must demonstrate a genuine pipeline:

**Synthetic data → Match events → Spatial analysis → Evidence graph → Grounded explanation → Interactive 3D visualization → Personalization.**

The final product should make someone say:

"I've seen football replays before, but I've never been able to understand a moment from the perspectives of the players who created it."

Build this as a real, working engineering project suitable for both a hackathon submission and a software engineering portfolio.
