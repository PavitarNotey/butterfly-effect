# Source documentation guide

Documentation review: October 28, 2026. This pass adds comments and function documentation without changing executable logic, contracts, model instructions, canonical data, deployment settings or dependencies. Existing local changes were preserved; verification compares against the working tree captured at the start of this task, rather than treating every difference from HEAD as part of this review.

## Where to start

| Area | Main source entry points | Decisions explained in the source |
| --- | --- | --- |
| Canonical football and geometry | [models](../backend/tactics/models.py), [engine](../backend/tactics/engine.py), [evidence service](../backend/tactics/service.py) | Coordinates/units, validated identities, linear interpolation, full path length, goal-side definition, coverage counts, static/swept/simultaneous clearance, source-bound caching. |
| Narrative intelligence | [evidence packets](../backend/ai/evidence.py), [providers](../backend/ai/providers.py), [service](../backend/ai/service.py) | Trusted excerpts, exact IDs, constrained structured output, one generation per content set, labeled demo/fallback, shared in-flight work and bounded process-local caches. |
| AI factual and cost protections | [validation](../backend/ai/validation.py), [reasoning](../backend/ai/reasoning.py), [citations](../backend/ai/citations.py), [budget](../backend/ai/budget.py) | Focus-linked citation minimums, narrow reasoning licenses, conservative screening limits, atomic pre-submission reservations and uncertain-usage accounting. |
| Replay state and rendering | [clock/store](../frontend/src/replay/store.ts), [sampling](../frontend/src/replay/sample.ts), [scene](../frontend/src/replay/ReplayScene.tsx) | Absolute-time anchors, one early frame sample, scrub lifecycle, selection versus camera ownership, scene cleanup and canonical ball motion. |
| Camera and animation presentation | [camera poses](../frontend/src/replay/camera.ts), [paused POV](../frontend/src/replay/PovControls.tsx), [character ownership](../frontend/src/replay/animation/characterAssets.ts), [pose layer](../frontend/src/replay/animation/footballPose.ts) | Pure settled poses versus bounded view transitions, simulated gaze, independent rigs with shared resources, distance-indexed gait and bone-only contact/reaction layers. |
| Tactical viewing | [API boundary](../frontend/src/tactics/data.ts), [guided replay](../frontend/src/tactics/guided.ts), [overlays](../frontend/src/tactics/TacticalOverlays.tsx), [trajectory writer](../frontend/src/tactics/trajectory.ts) | Exact raw-source hash verification, whole sequence versus detail intervals, original-context restoration, reusable buffers and render interpolation without invented measurements. |
| Frontend AI lifecycle | [request hook](../frontend/src/ai/useIntelligenceRequest.ts), [response boundary](../frontend/src/ai/client.ts), [evidence replay bridge](../frontend/src/ai/useEvidenceReplay.ts) | Explicit generation, cache-only effects, canceled stale responses, retained same-target content, real-response reveals and exact-citation replay actions. |
| League and API ownership | [catalog validation](../backend/league/service.py), [route session](../frontend/src/league/ReplaySession.tsx), [replay mapping](../frontend/src/league/replayReference.ts) | Finished-result standings, metadata-only events, full-match versus passage time/score, route disposal and validated replay entry points. |
| Offline scenario/tracking tools | [authoring helpers](../backend/authoring/routes.py), [tracking adapter](../backend/tracking/skillcorner.py), [diagnostics](../backend/tracking/diagnostics.py) | Smooth routes baked into authoritative linear keys, imported observations kept separate from complete synthetic replays, preserved missing/extrapolated provenance and sample-aware warning metrics. |

See [Replay](REPLAY.md), [Tactical analysis](TACTICAL_ANALYSIS.md), [Tactical sequences](TACTICAL_SEQUENCES.md) and [AI tactical insight](AI_TACTICAL_INSIGHT.md) for the wider implementation history and limitations. This source review does not supersede approved canonical timing or scenario revisions.

## Documentation conventions

- Python functions use concise docstrings, with Google-style `Args`, `Returns` and `Raises` sections where the contract needs explanation. Small helpers document their units, assumptions or failure behavior without repeating obvious statements.
- TypeScript/React uses JSDoc with parameter meaning, return values and ownership/cleanup notes where useful. Types stay in the existing signatures; comments do not duplicate handwritten API types.
- Inline comments explain non-obvious choices: why both tracks' key times are needed for closest approach, why a swept crossing differs from simultaneous interception geometry, why scrubbing rebases wall time, and why rig bones must not modify canonical roots.
- Consistent terminology separates **recorded synthetic actions**, **computed measurements**, **authored readings**, **simulated presentation** and **AI-generated interpretation**. Positional geometry does not establish attention, deception or causal necessity.
- Units are explicit: world X is pitch length, Y is height and Z is width; replay time is seconds and yaw is radians. Tactical distances are planar X/Z. Cosmetic ball-spin travel sums full X/Y/Z lengths, including height; it is not the tactical movement-distance definition.
- FastAPI handlers and schema-bearing Pydantic classes use adjacent comments when a new docstring would change generated descriptions. Their `__doc__` metadata can enter OpenAPI or structured model schemas. Generated `schema.d.ts` and `openapi.json` were not regenerated or edited by this pass.
- Existing useful explanations remain. Trivial JSX, standard formatting helpers, empty package markers and generated artifacts do not receive repetitive comments merely to increase documentation coverage. Model prompt literals are executable input and were left unchanged.

## Scope and verification

The source pass updates **34 Python files and 54 TypeScript/React files**, including 109 new Python function/class docstrings, additional JSDoc contracts, schema-safe model/endpoint comments and inline algorithm rationale. This guide is the only new tracked file. The detailed file list below is relative to the captured starting state, excluding the user's pre-existing formatting and deployment changes.

Documentation-only verification:

1. Python syntax trees match the baseline after excluding docstrings; all executable expressions and constants remain identical.
2. TypeScript parser token streams match with comments excluded. TypeScript-emitted JavaScript also matches with comment removal enabled, covering JSX and template literals correctly.
3. Live application OpenAPI, per-packet Foundry output schemas, Casual/Analyst prompt text, packet hashes and tactical bundle fingerprints match the task-start baseline.
4. All files outside the documented source set retain their captured hashes, including canonical JSON, existing generated schemas, configuration, dependencies, workflows and tests.

Frontend typechecking, ESLint, all **226 unit tests**, and an Azure-API-configured production build pass. Backend Ruff passes. Existing large WebGL/data chunk and Starlette/httpx deprecation warnings remain; no performance improvement is claimed for a documentation pass.

### Pre-existing backend failures

The baseline and final full backend suite both report **275 passed, six failed and one optional external-service skip**. The same failures were present before the first source documentation edit:

| Existing check | Cases | Reason |
| --- | --- | --- |
| `test_league.py::test_current_approved_canonical_hashes` | 3 | Exact raw-text hashes differ for all three scenario JSON files. |
| `test_missed_revision.py::test_approved_recipe_is_reproducible_and_preserves_contact_anchors_and_ledger` | 1 | Missed Chance source bytes no longer match the recipe's canonical serializer. |
| `test_multiscenario.py::test_approved_phase_4_2_missed_chance_source_hash` | 1 | Approved Missed Chance raw-text hash differs. |
| `test_untouched_pass.py::test_reproducible_dummy_recipe_and_current_approved_other_sources` | 1 | Untouched Pass source bytes no longer match the recipe's canonical serializer. |

All three source JSON values compare equal to HEAD after parsing, while their raw bytes differ. The formatting changes predate this task. The files, approved hash expectations and reproducibility assertions were preserved; no canonical write or test relaxation was performed to hide these failures.

Browser verification covered all **94 existing checks**: the full run passed 93, and its single missing-asset fallback playback failure passed unchanged in an isolated rerun. No application or test fix was applied. Coverage included actual rendered poses, playback/scrubbing, camera/POV controls, tactical overlays, guided restoration, AI provenance/cost protections, mobile layouts and resource cleanup. This is aggregate full-run plus rerun coverage, not a claim that the first full command was entirely green.

The documentation changes are ready for review. The six baseline backend failures remain unresolved under this documentation-only scope. No paid Foundry calls, commits, pushes or deployments were made.

<details>
<summary>Files documented in this pass</summary>

- [backend/ai/authored.py](../backend/ai/authored.py)
- [backend/ai/budget.py](../backend/ai/budget.py)
- [backend/ai/citations.py](../backend/ai/citations.py)
- [backend/ai/config.py](../backend/ai/config.py)
- [backend/ai/errors.py](../backend/ai/errors.py)
- [backend/ai/estimate.py](../backend/ai/estimate.py)
- [backend/ai/evidence.py](../backend/ai/evidence.py)
- [backend/ai/models.py](../backend/ai/models.py)
- [backend/ai/prompts.py](../backend/ai/prompts.py)
- [backend/ai/providers.py](../backend/ai/providers.py)
- [backend/ai/reasoning.py](../backend/ai/reasoning.py)
- [backend/ai/request.py](../backend/ai/request.py)
- [backend/ai/routes.py](../backend/ai/routes.py)
- [backend/ai/service.py](../backend/ai/service.py)
- [backend/ai/smoke.py](../backend/ai/smoke.py)
- [backend/ai/validation.py](../backend/ai/validation.py)
- [backend/authoring/invisible_run.py](../backend/authoring/invisible_run.py)
- [backend/authoring/missed_chance.py](../backend/authoring/missed_chance.py)
- [backend/authoring/routes.py](../backend/authoring/routes.py)
- [backend/authoring/untouched_pass.py](../backend/authoring/untouched_pass.py)
- [backend/config.py](../backend/config.py)
- [backend/league/models.py](../backend/league/models.py)
- [backend/league/routes.py](../backend/league/routes.py)
- [backend/league/service.py](../backend/league/service.py)
- [backend/main.py](../backend/main.py)
- [backend/tactics/engine.py](../backend/tactics/engine.py)
- [backend/tactics/guides.py](../backend/tactics/guides.py)
- [backend/tactics/models.py](../backend/tactics/models.py)
- [backend/tactics/routes.py](../backend/tactics/routes.py)
- [backend/tactics/service.py](../backend/tactics/service.py)
- [backend/tracking/__main__.py](../backend/tracking/__main__.py)
- [backend/tracking/diagnostics.py](../backend/tracking/diagnostics.py)
- [backend/tracking/models.py](../backend/tracking/models.py)
- [backend/tracking/skillcorner.py](../backend/tracking/skillcorner.py)
- [frontend/src/ApiConnection.tsx](../frontend/src/ApiConnection.tsx)
- [frontend/src/App.tsx](../frontend/src/App.tsx)
- [frontend/src/ReplayStudio.tsx](../frontend/src/ReplayStudio.tsx)
- [frontend/src/ai/AnalysisPresentation.tsx](../frontend/src/ai/AnalysisPresentation.tsx)
- [frontend/src/ai/IntelligencePanel.tsx](../frontend/src/ai/IntelligencePanel.tsx)
- [frontend/src/ai/MatchRecap.tsx](../frontend/src/ai/MatchRecap.tsx)
- [frontend/src/ai/client.ts](../frontend/src/ai/client.ts)
- [frontend/src/ai/presentation.ts](../frontend/src/ai/presentation.ts)
- [frontend/src/ai/useEvidenceReplay.ts](../frontend/src/ai/useEvidenceReplay.ts)
- [frontend/src/ai/useIntelligenceRequest.ts](../frontend/src/ai/useIntelligenceRequest.ts)
- [frontend/src/league/GlobalFixtureStrip.tsx](../frontend/src/league/GlobalFixtureStrip.tsx)
- [frontend/src/league/LeagueContext.tsx](../frontend/src/league/LeagueContext.tsx)
- [frontend/src/league/MatchViewer.tsx](../frontend/src/league/MatchViewer.tsx)
- [frontend/src/league/ReplaySession.tsx](../frontend/src/league/ReplaySession.tsx)
- [frontend/src/league/client.ts](../frontend/src/league/client.ts)
- [frontend/src/league/components.tsx](../frontend/src/league/components.tsx)
- [frontend/src/league/format.ts](../frontend/src/league/format.ts)
- [frontend/src/league/replayReference.ts](../frontend/src/league/replayReference.ts)
- [frontend/src/league/types.ts](../frontend/src/league/types.ts)
- [frontend/src/league/useResource.ts](../frontend/src/league/useResource.ts)
- [frontend/src/pages/LeagueShell.tsx](../frontend/src/pages/LeagueShell.tsx)
- [frontend/src/pages/MatchPage.tsx](../frontend/src/pages/MatchPage.tsx)
- [frontend/src/replay/Environment.tsx](../frontend/src/replay/Environment.tsx)
- [frontend/src/replay/PovControls.tsx](../frontend/src/replay/PovControls.tsx)
- [frontend/src/replay/ReplayScene.tsx](../frontend/src/replay/ReplayScene.tsx)
- [frontend/src/replay/TacticalCameraControls.tsx](../frontend/src/replay/TacticalCameraControls.tsx)
- [frontend/src/replay/Timeline.tsx](../frontend/src/replay/Timeline.tsx)
- [frontend/src/replay/animation/AnimatedPlayer.tsx](../frontend/src/replay/animation/AnimatedPlayer.tsx)
- [frontend/src/replay/animation/animationSampler.ts](../frontend/src/replay/animation/animationSampler.ts)
- [frontend/src/replay/animation/attention.ts](../frontend/src/replay/animation/attention.ts)
- [frontend/src/replay/animation/characterAssets.ts](../frontend/src/replay/animation/characterAssets.ts)
- [frontend/src/replay/animation/dummy.ts](../frontend/src/replay/animation/dummy.ts)
- [frontend/src/replay/animation/footballActions.ts](../frontend/src/replay/animation/footballActions.ts)
- [frontend/src/replay/animation/footballPose.ts](../frontend/src/replay/animation/footballPose.ts)
- [frontend/src/replay/animation/kitMaterial.ts](../frontend/src/replay/animation/kitMaterial.ts)
- [frontend/src/replay/animation/locomotionPhase.ts](../frontend/src/replay/animation/locomotionPhase.ts)
- [frontend/src/replay/animation/reactions.ts](../frontend/src/replay/animation/reactions.ts)
- [frontend/src/replay/animation/useCharacterAsset.ts](../frontend/src/replay/animation/useCharacterAsset.ts)
- [frontend/src/replay/camera.ts](../frontend/src/replay/camera.ts)
- [frontend/src/replay/gaze.ts](../frontend/src/replay/gaze.ts)
- [frontend/src/replay/playerFilter.ts](../frontend/src/replay/playerFilter.ts)
- [frontend/src/replay/sample.ts](../frontend/src/replay/sample.ts)
- [frontend/src/replay/scenario.ts](../frontend/src/replay/scenario.ts)
- [frontend/src/replay/store.ts](../frontend/src/replay/store.ts)
- [frontend/src/replay/types.ts](../frontend/src/replay/types.ts)
- [frontend/src/tactics/GuidedHUD.tsx](../frontend/src/tactics/GuidedHUD.tsx)
- [frontend/src/tactics/TacticalOverlays.tsx](../frontend/src/tactics/TacticalOverlays.tsx)
- [frontend/src/tactics/TacticalPanel.tsx](../frontend/src/tactics/TacticalPanel.tsx)
- [frontend/src/tactics/data.ts](../frontend/src/tactics/data.ts)
- [frontend/src/tactics/guided.ts](../frontend/src/tactics/guided.ts)
- [frontend/src/tactics/presentation.ts](../frontend/src/tactics/presentation.ts)
- [frontend/src/tactics/store.ts](../frontend/src/tactics/store.ts)
- [frontend/src/tactics/trajectory.ts](../frontend/src/tactics/trajectory.ts)
- [frontend/src/tactics/types.ts](../frontend/src/tactics/types.ts)

</details>
