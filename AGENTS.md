# Butterfly Effect — Codex Engineering Instructions

## 1. Project mission

Butterfly Effect is an interactive 3D football storytelling platform.

Its purpose is to help users understand how decisive football moments develop through player movement, tactical geometry, guided replay and multiple perspectives.

The product should feel like a professional broadcast studio: visually polished, immersive, technically credible and understandable to casual football viewers.

Prioritize **correctness, user experience, evidence integrity, performance and maintainability**.

Do not sacrifice architectural quality or validation merely to complete a milestone faster.

## 2. Current implementation

The repository currently contains:

- Two original, 20-second synthetic football scenarios.
- 22 independently animated skeletal players per scenario.
- Deterministic player and ball interpolation.
- Event-synchronized passing, receiving and shooting.
- Broadcast, tactical, overview, player-follow and simulated POV cameras.
- Mouse/touch/keyboard free-look while paused in POV.
- Direct pitch player selection and a searchable roster picker.
- A shared Zustand replay clock and player-selection state.
- Python tactical geometry and validated evidence.
- Five guided evidence-replay categories.
- Goalkeeper reactions, defensive body language and goal/miss gestures.
- Automated frontend, backend and browser tests.

**Not yet implemented:** production AI-generated tactical commentary, multi-agent narrative workflows or public cloud deployment.

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

- `frontend/src/App.tsx` — studio composition.
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
- pytest and Ruff.

Important paths:

- `backend/main.py` — API entry point.
- `backend/tactics/models.py` — canonical scenario and evidence contracts.
- `backend/tactics/engine.py` — deterministic geometry calculations.
- `backend/tactics/service.py` — scenario registry, evidence generation and caching.
- `backend/tactics/guides.py` — authored tactical interpretations.
- `backend/tactics/routes.py` — read-only tactical API endpoints.

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

Future AI-generated narratives must remain grounded in validated evidence and clearly distinguish inference from fact.

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

Use the existing Phase 3C benchmark as a reference, not as a universal guaranteed FPS target.

Investigate significant regressions in:

- Frame times.
- Draw calls.
- Triangles.
- GPU resource counts.
- Memory use.
- Scenario-switch cleanup.
- Repeated guided replay interactions.

The existing lazy WebGL bundle-size warning is known; do not hide it by weakening build checks.

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

Microsoft Foundry / Azure OpenAI integration is planned for a future phase.

When implementing it:

- Ground all generated narratives in validated scenario events and evidence.
- Require structured, schema-validated outputs.
- Validate evidence, player and timestamp references.
- Do not accept hallucinated geometric facts.
- Separate observation, tactical interpretation and storytelling.
- Provide useful fallback behavior when the AI service is unavailable.
- Keep credentials and service secrets on the backend.
- Use evaluation fixtures and automated tests before accepting generated explanations.

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

## 12. Codex skills and documentation

Use available tools when relevant:

- `frontend-design` for visual hierarchy and UI quality.
- `web-design-guidelines` for accessibility and interaction quality.
- `vercel-react-best-practices` for React performance.
- Context7 for current library documentation.
- Playwright/browser tools for actual visual testing.
- Microsoft Learn for Azure documentation.
- Microsoft Foundry skill for future AI integration.

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

Consult existing documentation before creating a new subsystem.

If implementation and older milestone documentation disagree, verify current code and tests, then update or annotate the outdated documentation rather than carrying old assumptions forward.

## 15. Overall engineering goal

Build Butterfly Effect as a credible, polished and extensible football storytelling platform.

Prefer reusable systems over scenario-specific hacks.

Preserve the difference between **recorded events, measured evidence, simulated presentation and AI-generated interpretation**.

Make the football understandable, not merely technically impressive.
