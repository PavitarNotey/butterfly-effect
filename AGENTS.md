# Butterfly Effect — Codex Engineering Instructions

## 1. Project mission

Butterfly Effect is an interactive 3D football storytelling platform.

Its purpose is to help users understand how decisive football moments develop through player movement, tactical geometry, guided replay and multiple perspectives.

The product should feel like a professional broadcast studio: visually polished, immersive, technically credible and understandable to casual football viewers.

Prioritize **correctness, user experience, evidence integrity, performance and maintainability**.

Do not sacrifice architectural quality or validation merely to complete a milestone faster.

## 2. Current implementation

The repository currently contains:

- Three original synthetic football scenarios: The Invisible Run (13.2 seconds, Phase 3C.2), The Missed Chance (12 seconds, approved Phase 4.2 revision), and The Pass That Wasn't Touched (13.6 seconds, Phase 3D).
- 22 independently animated skeletal players per scenario.
- Deterministic player and ball interpolation.
- Event-synchronized passing, receiving, shooting and an explicitly non-contact dummy.
- Broadcast, tactical, overview, player-follow and simulated POV cameras.
- Mouse/touch/keyboard free-look while paused in POV.
- Direct pitch player selection and a searchable roster picker.
- A shared Zustand replay clock and player-selection state.
- Python tactical geometry and validated evidence.
- Five guided evidence-replay categories.
- Goalkeeper reactions, defensive body language and goal/miss gestures.
- The Missed Chance's driven shot, distance-indexed running/shuffle, illustrative head/shoulder tracking and closer broadcast finish framing.
- A fictional Meridian League with fixtures/results, standings, Match Centers, replay-linked event routes and a shared global fixture strip.
- Microsoft Foundry `gpt-5-mini` integration for structured Casual Fan/Analyst explanations, replay-synchronized text commentary and finished-match recaps.
- An AI-first Match Center with a responsive left-hand intelligence panel, request-driven reveals, optional evidence and labeled demo/fallback states.
- Deterministic synthetic event ingestion, source-grounded AI validation, bounded caching/deduplication and request/concurrency limits.
- Automated frontend, backend and browser tests.

**Not yet implemented:** independent multi-agent narrative workflows, speech commentary, a professional live tracking feed, public cloud deployment or production authentication/distributed AI budgeting. Current AI orchestration uses one narrative model with deterministic evidence construction and validation.

Never present a planned feature as an existing implementation.

## 3. Technology and project structure

### Frontend

- React 19.
- TypeScript in strict mode.
- Vite.
- Three.js / React Three Fiber / Drei.
- Zustand.
- Vitest and Playwright.

Important paths:

- `frontend/src/App.tsx` — application routes and lazy scenario-library entry.
- `frontend/src/ReplayStudio.tsx` — replay studio composition.
- `frontend/src/pages/` — league shell, Match Center, fixtures and standings.
- `frontend/src/league/` — typed catalog client, global fixture strip, replay references and session lifecycle.
- `frontend/src/ai/` — AI requests, modes, narratives, recap panel, provenance and response-driven presentation.
- `frontend/src/replay/` — scenario data, clock, cameras, selection, gaze, POV and rendering.
- `frontend/src/replay/animation/` — skeletal assets, locomotion, football actions and reactions.
- `frontend/src/tactics/` — tactical presentation, overlays, guided replay and evidence handling.
- `frontend/src/api/` — API integration and generated types.
- `frontend/tests/` — browser tests.

### Backend

- Python 3.12+.
- FastAPI.
- Pydantic.
- NumPy.
- Official asynchronous OpenAI Python SDK for the existing Microsoft Foundry deployment.
- pytest and Ruff.

Important paths:

- `backend/main.py` — API entry point.
- `backend/tactics/models.py` — canonical scenario and evidence contracts.
- `backend/tactics/engine.py` — deterministic geometry calculations.
- `backend/tactics/service.py` — scenario registry, evidence generation and caching.
- `backend/tactics/guides.py` — authored tactical interpretations.
- `backend/tactics/routes.py` — read-only tactical API endpoints.
- `backend/authoring/` — reproducible offline scenario recipes; never runtime motion generators.
- `backend/league/` — validated fictional catalog, result ledger, standings and replay mappings.
- `backend/ai/evidence.py` — trusted evidence packets, citation allowlists and synthetic event envelopes.
- `backend/ai/prompts.py`, `citations.py`, `validation.py` — versioned storytelling instructions, shared citation policy and deterministic claim/reference screening.
- `backend/ai/models.py`, `providers.py`, `service.py`, `routes.py` — structured contracts, Foundry/mock providers, bounded generation lifecycle and typed API.

Consult the existing documentation and actual source files before making architectural changes.

## 4. Non-negotiable invariants

### Canonical data is authoritative

The scenario JSON files define:

- Player identities and teams.
- Player root positions and headings.
- Ball trajectories.
- Possession.
- Event timestamps.
- Goal and miss outcomes.
- Scenario duration.

Never silently alter canonical data to improve camera framing, animation aesthetics or a tactical explanation.

Any intended scenario-data change requires explicit justification, versioning, validation and updated evidence.

Before changing canonical timing or geometry, document the concrete proposal and its effects on evidence, commentary, league mappings and tests, and obtain approval unless the current instructions already explicitly authorize that specific revision. Earlier approval does not authorize unrelated future revisions.

Reuse the offline recipes in `backend/authoring/`; bake smooth routes into authoritative linear keys instead of adding runtime interpolation that disagrees with Python. Preserve event/player identities and outcomes unless a change is explicitly authorized. Source hashes identify content revisions; schema version 1 is a contract version, not a guarantee of unchanged data. Stable semantic evidence IDs must still be checked against the current source/evidence hashes.

The approved Missed Chance baseline has pass 3.55s, reception 4.75s, shot 7.65s, miss 8.37s and duration 12s. Its `matchStartSeconds=3667.35` preserves the league miss at match time 3675.72s; its catalog replay entry is 3.2s. The fixture remains Solstice 0–1 Cinder. Do not restore obsolete 20-second timings or change the global replay speed to compensate for authored tempo. See `docs/PHASE_4_2_MISSED_CHANCE.md` and verify the current source before further revisions.

### One authoritative replay clock

All football world-state sampling must derive from the existing replay clock.

- Do not introduce an independent player or ball timeline.
- Do not integrate frame delta into canonical positions.
- Pause, seek, restart, speed changes and backward scrubbing must remain correct.
- At a fixed scenario and timestamp, the rendered football state must be reproducible.
- Guided evidence replay must use the same clock.

Wall-clock presentation transitions may be used for UI/camera smoothing, but must not modify football world state.

### Animation is presentation-only

Skeletal reactions, goalkeeper reaches, celebrations, head movement, simulated gaze and cosmetic offsets may improve legibility.

They must not alter canonical player roots, the ball path, tactical geometry or outcomes.

Animation must:

- Be deterministic under direct seeking.
- Blend smoothly across action boundaries.
- Remain finite and bounded.
- Preserve ground/contact integrity where practical.
- Clean up resources properly.
- Support independent poses for all 22 players.

### Tactical evidence comes from validated data

Geometric analysis belongs in the deterministic Python engine.

The frontend displays validated observations; it must not invent tactical measurements.

Respect:

- Scenario source hashes.
- Evidence IDs.
- Event and player references.
- Explicit thresholds and units.
- Distinctions between recorded and hypothetical geometry.
- The separation of authored interpretations from measurements.

Do not turn geometric clearance into an invented success probability.

### Never invent player intent or causation

Recorded positions do not prove:

- Where players were looking.
- What they were thinking.
- Why they chose an action.
- That one movement necessarily caused an outcome.
- What would have happened in an alternative play.

Use careful explanatory language.

Simulated POV and body language are illustrative, not observed human attention.

AI-generated narratives must remain grounded in validated evidence and clearly distinguish inference from fact. Illustrative scans, body reactions and a non-contact dummy do not establish deception, attention or causation.

## 5. Frontend experience standards

The main replay is the centerpiece of the product.

Maintain the existing football broadcast design:

- Dark charcoal and navy surfaces.
- Restrained lime accents.
- Clear typography.
- High visual contrast.
- Compact, useful controls.
- Responsive layouts.
- Purposeful animation rather than decorative noise.

### Primary experience hierarchy

**Watch → Understand → Explore evidence → Inspect measurements.**

Show plain-English insights before raw technical detail.

Every major tactical finding should be understandable without requiring the viewer to interpret vectors, thresholds or evidence IDs.

Keep technical detail accessible for advanced users.

### Match Center and league navigation

- Keep AI intelligence immediately discoverable: approximately 30–33% on the left on desktop, with a usable replay minimum width and stacked/compact layouts on tablet/mobile.
- Preserve height-aware sticky positioning beneath the measured navigation/fixture strip, keyboard collapse/expand, and clear access to Replay Studio.
- Maintain one shared global fixture strip, URL-based active state, verified final scores and honest upcoming-fixture labels.
- Keep full-match results distinct from the reconstructed passage's score. Metadata-only goals/saves have no implied 3D sequence; upcoming fixtures have no generated recap.
- Scenario-library switches retain the canvas while resetting incompatible state. Fixture/route switches dispose the old replay and clear playback, selection, POV, guided evidence, trails and pending UI requests.
- Keep AI narratives concise, with human-readable evidence closed by default. Do not expose raw internal IDs, validation diagnostics, repeated score/event inventories or redundant highlight blocks in the ordinary AI interface. Preserve provenance and technical contracts on the backend.

### AI interaction and motion

Preserve idle, loading, ready, authored fallback and retryable error states, the Casual Fan/Analyst selector, Microsoft Foundry attribution and the explicit analysis action. Keep the previous successful content when a same-target refresh fails; never show content from a stale match, scenario, event or mode.

Start the headline/sentence/takeaway reveal only after the actual response arrives. Cached results may reveal faster. Use bounded CSS opacity/transforms, honor reduced motion and cancel stale requests/reveals on navigation or mode changes. Do not invent processing stages, impose a fake response delay or add an animation dependency without a demonstrated need.

### Player interactions

Maintain one coherent player-selection state.

- Clicking a rendered player selects them.
- Selecting a player does not automatically enter POV.
- View POV and Follow Player are explicit actions.
- Player selection is synchronized across the pitch, picker and action card.
- Selection persists across ordinary playback and seeking.
- Scenario switching clears incompatible selection.
- Clicking a player must not interfere with camera dragging.
- Paused POV free-look must not conflict with tactical camera controls.

Avoid adding redundant pickers or parallel selection stores.

### Guided evidence replay

Every “Show me in the replay” action should demonstrate the selected evidence.

Preserve:

- Validated evidence identity.
- Relevant timestamps and players.
- Evidence-specific overlays.
- Camera and playback coordination.
- Captions and clear controls.
- Proper interruption and restoration.
- Cleanup during scenario changes.

Do not replace guided replay with a static overlay toggle.

### Accessibility

All new interactions must support:

- Semantic controls.
- Keyboard access.
- Visible focus states.
- Screen-reader labels where appropriate.
- Practical touch targets.
- Reduced-motion preferences.
- Mobile and narrow viewport layouts.
- Text explanations for non-text visual evidence.

## 6. Rendering and performance standards

The application renders up to 22 skeletal characters in one scene.

Preserve shared geometry, animation clips, material pooling and independent rig instances.

Avoid:

- Allocations inside hot frame loops.
- React state updates every frame for every player.
- Duplicate clocks.
- Per-player asset downloads.
- Unnecessary geometry recreation.
- Unbounded visual effects.
- Camera controllers competing for ownership.

Measure performance rather than relying on assumptions.

Use the Phase 3C and Phase 4.2 benchmarks as scoped references, not universal guaranteed FPS targets. Record viewport, DPR, camera, sampling duration and actual clock advancement when reporting performance.

Investigate significant regressions in:

- Frame times.
- Draw calls.
- Triangles.
- GPU resource counts.
- Memory use.
- Scenario-switch cleanup.
- Repeated guided replay interactions.

The lazy WebGL and scenario-data bundle-size warnings are known; do not hide them by weakening build checks. Phase 4.2's denser source keys increase lazy data size. Keep the replay and scenario data out of the ordinary league shell's initial bundle where possible.

## 7. Backend and API standards

Use Pydantic as the source for backend API contracts.

When contracts intentionally change:

1. Update the Pydantic model.
2. Update backend validation and tests.
3. Regenerate `backend/openapi.json`.
4. Regenerate `frontend/src/api/schema.d.ts`.
5. Update relevant frontend usage.
6. Verify backward compatibility or document intentional breaks.

Commands:

```bash
cd backend
uv run python export_openapi.py

cd ../frontend
pnpm generate:api
```

Avoid handwritten duplicate API types when generated contracts are available.

Do not add databases, message brokers, physics engines, vector stores, multi-agent frameworks or major UI dependencies without a demonstrated requirement.

## 8. AI development rules

The existing pipeline is **validated synthetic events/evidence → bounded evidence packet → Foundry structured narrative → deterministic validator → presentation**. Preserve the official SDK integration, explicit mock provider and authored validation fallback.

- Ground all generated narratives in validated scenario events, source hashes and evidence; separate recorded actions, measurements, authored readings and AI interpretation.
- Require Pydantic-validated structured output and enum-constrained target/source IDs. Preserve target order, citation allowlists, event relevance and unknown/duplicate-reference checks.
- Use `backend/ai/citations.py` as the shared policy for prompt requirements and verification. Analyst needs at least two distinct relevant measurement sources when available; authored interpretations or metadata cannot replace measurements. Recaps require the match-event and final-score anchors.
- Keep generated headline, explanation and takeaway qualitative. Exact numbers, units, scores and measurements belong in immutable server-owned excerpts. Do not bypass quantity, markup, intent, causal, probability or counterfactual screening to accept more fluent prose. Existing quantity-bearing expressions such as “one-touch” and “half-space” are screened too.
- Write clear football storytelling about supplied movement, positioning and timing. Casual should be conversational; Analyst should add supported tactical depth. Avoid schema jargon and validation caveats in the main prose.
- When diagnosing rejection, align the prompt/schema/citation plan with the actual validator. The previous Analyst recap failure came from missing measured citations, followed by quantitative prose; retain the shared policy and explicit prose guidance that resolved those mismatches.
- Keep prompt text in `prompts.py`; bump `PROMPT_VERSION` in `providers.py` when instructions change. Cache identity must include source/evidence/packet hashes, mode, prompt version, provider and deployment.
- Label live output **AI-generated**, mock output **Authored demo**, and rejected output **Authored fallback**. Fallback must pass validation and must never look like a successful Foundry response. Connection/quota/configuration failures remain safe retryable errors, without silently switching to mock.
- Log safe structured rejection reasons and context, never credentials, settings values containing secrets or raw provider prose. Keep diagnostic details out of ordinary viewer UI.
- Preserve bounded payload/output sizes, timeouts, retry policy, concurrency, pending-task limits, deduplication and cache bounds. Process-local limits are demo safeguards, not a distributed quota or hard billing cap.
- Generate only after user action; startup/configuration status must not probe the model. Commentary is generated/cached as a cue set and sampled against the authoritative replay clock. Playback, pause, seek, speed and restart must not trigger per-tick AI calls.
- Mode switches, remounts and **Check saved analysis** may only read saved/in-flight results using `cache_only`; a cache miss must never create a generation task. Generate from explicit event handlers, not mount effects. Preserve rapid-click deduplication and stale-response cancellation.
- Paid generation defaults to paused and requires explicit positive deployment prices. Reserve hourly/lifetime attempts and conservative input-plus-maximum-output cost atomically before every Foundry submission, including retries. Unknown usage, failed submissions and cancellation retain their reservation; never treat zero prices as free calls. Keep `IntelligenceService.diagnostics()` internal to the running process, with no public spending endpoint.
- Keep `phase4-v3` instruction verification distinct from the `phase4c-compact-v1` transport/cache revision. Compact only redundant envelopes; retain source IDs, exact observations, allowlists and all factual protections. Use task-specific output limits and offline estimates; live prompt/output quality still needs separately approved verification.
- Match Center **Show me why** resolves exact cited measurements against the hash-validated evidence bundle and verified league replay mapping, then uses the existing guided controller. Never derive geometry from prose or add a second canvas/clock. Missing support keeps contextual Studio navigation available.
- Keep credentials in ignored backend environment configuration. Never expose service secrets through frontend variables, browser logs or generated artifacts.
- Use mock AI for automated tests. Browser AI journeys must use the isolated test-owned port-8001 mock server and verify mock provenance even if a live port-8000 development API is running.
- Before paid Foundry calls, explain the intended request count and obtain approval unless the current instructions already authorize those specific calls. Use a small bounded smoke set with retries disabled; never run it as ordinary CI. Read-only configuration status does not make a model call. Do not present historical v2 live results as verification of a newer prompt.

Lexical screening is conservative, not a semantic proof of every sentence. Valid citations do not establish that all generated prose is true. Preserve this limitation in technical documentation and use evaluation fixtures before accepting changes.

Do not modify the tactical engine merely to make generated commentary sound better.

A multi-agent architecture must justify its complexity and be evaluated against simpler alternatives.

## 9. Adding new football scenarios

New showcases should use the existing scenario and evidence architecture.

Before implementation:

1. Define the sequence and expected outcome.
2. Create original fictional identities and assets.
3. Author or generate timestamped canonical tracking.
4. Validate player, ball and event consistency.
5. Verify possession and ball-contact semantics.
6. Run deterministic geometry analysis.
7. Add any new action types through reusable typed systems.
8. Add scenario-specific validation and regression tests.
9. Visually inspect the full sequence from multiple cameras.
10. Document reconstruction assumptions and limitations.

When a scene is inspired by real football, distinguish the synthetic reconstruction from actual measured tracking.

Do not copy protected footage, broadcast graphics, commentary, trademarks or third-party assets without appropriate permission or licensing.

## 10. Required engineering workflow

For substantial changes:

**Inspect → Design → Implement → Test → Visually validate → Refine → Document.**

Before editing:

- Read relevant implementation and documentation.
- Inspect the git working tree.
- Understand dependencies and invariants.
- Establish how the existing feature behaves.
- Identify relevant automated tests.

During implementation:

- Prefer minimal, well-scoped, reusable changes.
- Keep code strongly typed.
- Preserve the existing architectural boundaries.
- Avoid changing unrelated files.
- Reuse the existing frontend styling and state systems.
- Check current library documentation for unfamiliar APIs.

After implementation:

- Run appropriate verification.
- Exercise the actual feature in a browser.
- Inspect screenshots or recordings where visual behavior matters.
- Check interactions at multiple timestamps and camera angles.
- Test interruption, reset, scenario switching and cleanup.
- Document decisions and remaining limitations.

A successful build is not proof of a successful 3D user experience.

## 11. Required verification

### Frontend

From `frontend/`:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

### Backend

From `backend/`:

```bash
uv run pytest
uv run ruff check .
```

Run the complete relevant suite for major milestones.

For small changes, run targeted tests during development and the appropriate full checks before delivery.

Do not weaken assertions or silently update expected results to conceal regressions.

After an approved scenario revision, update explicit timing/hash expectations with documented reasons and retain independent outcome, contact, collision, evidence and other-scenario regression checks. Verify the Missed Chance recipe from `backend/` with `uv run python -m authoring.missed_chance --check`; `--write` modifies authoritative data and is only for an authorized revision.

For AI changes, exercise both modes, moments, full commentary cue sets and recaps with mock data. Cover rejection/fallback labeling, limits/cache invalidation, stale-response cancellation, retained content after failed refresh, hidden evidence and reduced motion. Test commentary against pause, backward seek, restart and speed without new generation calls.

### Visual verification

Use Playwright and available browser/computer-use tools to test actual interactions.

For 3D or UI changes, inspect:

- Desktop and narrow/mobile layouts.
- Playback and scrubbing.
- Different camera modes.
- Player selection and POV.
- Tactical overlays.
- Guided replay.
- Event boundaries and animations.
- Browser console and WebGL errors.
- Resource cleanup and relevant performance.

Do not claim physical-device testing when only browser emulation was used.

Browser helpers inspecting application stores must import the exact loaded module URL from resource entries. Bare Vite imports can create a second store after HMR and produce false navigation/cleanup results. Preserve checks against the actual mounted scene, clock and bones.

## 12. Codex skills and documentation

Use available tools when relevant:

- `frontend-design` for visual hierarchy and UI quality.
- `web-design-guidelines` for accessibility and interaction quality.
- `vercel-react-best-practices` for React performance.
- Context7 for current library documentation.
- Playwright/browser tools for actual visual testing.
- Microsoft Learn for Azure documentation.
- Microsoft Foundry skill for relevant AI integration, evaluation and Azure work.

Skills or MCP servers may differ by session. Inspect the available capabilities rather than assuming a particular tool is present.

Do not install dependencies or additional frameworks just because a skill recommends them.

## 13. Git and file safety

- Do not commit or push unless the user explicitly requests it.
- Do not overwrite unrelated work.
- Inspect `git status` before and after major changes.
- Preserve locally installed skills and project configuration.
- Do not commit secrets, local environment files or generated browser artifacts.
- Store temporary screenshots and recordings in ignored `output/` paths.
- Keep valuable benchmark summaries and architectural decisions in tracked documentation when appropriate.
- Do not change canonical scenario JSON or generated schemas incidentally.
- Avoid destructive git operations without explicit authorization.

At completion, report:

- What changed.
- Why it changed.
- Files added or modified.
- Tests and browser checks performed.
- Performance effects, when applicable.
- Known limitations.
- Remaining work.
- Whether the working tree is ready for review.

## 14. Relevant documentation

- `README.md` — public project introduction and setup.
- `docs/REPLAY.md` — canonical tracks, clock and cameras.
- `docs/TACTICAL_ANALYSIS.md` — geometry, evidence and limitations.
- `docs/CHARACTER_ANIMATION.md` — rigs, assets and licenses.
- `docs/FOOTBALL_ACTIONS.md` — passing, receiving and shooting.
- `docs/PHASE_3C_EXPERIENCE.md` — current guided-replay, POV and interaction architecture.
- `docs/FOOTBALL_REALISM.md` — tracking-data ingestion and validation.
- `docs/PHASE_3D_UNTOUCHED_PASS.md` — typed non-contact dummy, action blending and third showcase.
- `docs/PHASE_3E_LEAGUE_MATCH_CENTER.md` — fictional league, event ledger, replay routes and global fixture navigation.
- `docs/PHASE_4_AI_INTELLIGENCE.md` — Foundry architecture, citation/claim protections, cost controls, Analyst rejection diagnosis and historical live verification.
- `docs/PHASE_4_1_AI_MATCH_CENTER.md` — current AI panel layout, states, reveal behavior and prompt verification status.
- `docs/PHASE_4_2_MISSED_CHANCE.md` — approved canonical revision, shot/reaction/framing changes, evidence effects and latest validation/benchmark record.
- `docs/PHASE_4C_PRODUCT_HARDENING.md` — explicit generation, process-local paid budgets, compact transport, evidence playback, UX verification and deployment limitations.

Consult existing documentation before creating a new subsystem.

If implementation and older milestone documentation disagree, verify current code and tests, then update or annotate the outdated documentation rather than carrying old assumptions forward.

## 15. Overall engineering goal

Build Butterfly Effect as a credible, polished and extensible football storytelling platform.

Prefer reusable systems over scenario-specific hacks.

Preserve the difference between **recorded events, measured evidence, simulated presentation and AI-generated interpretation**.

Make the football understandable, not merely technically impressive.
