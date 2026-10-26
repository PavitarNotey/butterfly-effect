# Phase 3C — Watch the movement, understand the moment

The approved [Phase 4.2 Missed Chance revision](PHASE_4_2_MISSED_CHANCE.md) supersedes this report’s historical 20-second miss timing and measurements. The current miss lasts 12 seconds with a driven shot at 7.65s and wide outcome at 8.37s; other scenario data is unchanged by that revision.

Implementation date: October 22, 2026 (America/Toronto). Baseline: `main` at `4120d51`, whose parent is the requested `691f601` Phase 3B.3 baseline. The initial working tree was clean. No commits or pushes are part of this milestone. Local Foundry skill files and `skills-lock.json` are preserved and ignored.

This report preserves the Phase 3C/3C.1 implementation, measurements and original goal timeline. The later [Phase 3C.2 authored goal revision](PHASE_3C_2_GOAL_REVISION.md) deliberately replaces the goal tracks/timestamps and adds teammate convergence/reactions. Its 13.2 s timeline supersedes the 20 s goal timing below; the missed-chance source and historical benchmarks remain unchanged.

## Audit and design

The baseline was inspected in Chrome in both scenarios, at normal 1× speed, in broadcast, tactical, full-pitch and player POV. Full-page desktop/mobile screenshots and normal-speed recordings are in `output/playwright/phase3c/before/`. The existing reveal action only enabled a diagram layer and left the viewer in the analysis section. POV used fixed body heading. Player inspection and POV used separate native selects with ungrouped 22-player lists. Keepers remained in locomotion through shots, and scorers had no outcome-specific gesture.

The identity remains a football broadcast studio: charcoal `#0b1112`, navy `#101e27`, deep green `#152321`, lime `#c8ed8d`, readable white `#eff5ea`, and secondary text `#b6c6bc`. Existing Inter/Arial typography and stadium assets are retained. The distinctive element is the replay itself, not decorative dashboard chrome. Larger editorial headlines and a single lime replay action establish hierarchy; supporting insights stay quieter.

The reading order is **watch → explanation → highlighted movement → exact evidence**. The analysis pairs one main finding with up to four insight cards, then an optional “How we measured this” disclosure. The default answers what happened, why the next event matters, who is involved and where to watch it. The precise evidence remains accessible.

Frontend Design informed hierarchy and restraint; React Best Practices informed selective store subscriptions and mutable render-frame refs. Web Design Guidelines informed focus, touch targets, disclosure semantics, reduced motion and responsive caption placement. Context7 supplied current R3F render-loop, Three.js skinned-mesh bounds and Playwright capture documentation. No Foundry workflows or Phase 4 agents were run.

## Evidence presentation

`presentation.ts` maps movement, relationships, passing corridors, receiving-space coverage and finishes into plain English. Comparison words such as “narrower”, “closer” or “farther” require corresponding backend metrics. There are no derived probabilities, new tactical calculations or causal claims. Exact observations, definitions, signed values, units, thresholds, IDs, limitations, source hash and authored interpretation remain in the technical disclosure. The API schema is unchanged.

Editorial copy follows the existing authored guide and is explicitly distinguished from measured geometry. Synthetic gaze and body language are illustrations. Neither establishes awareness, motivation or intent. A recorded pass is distinguished from a hypothetical static corridor. A receiving-region ring is a measurement boundary, not a possession or success estimate.

## Guided replay

`GuidedReplay` lives in the replay store as one encapsulated interaction. It includes scenario/hash identity, evidence/moment IDs, padded interval, focus time, players, category/layer, camera, caption, speed, status and restoration context. Only the current validated bundle can start a sequence. Scenarios clear the sequence and loaded evidence.

A watch action scrolls the replay DOM ref into view, focuses the caption heading without another scroll, selects a useful view, seeks 0.65 seconds before the evidence interval, isolates its diagram and plays the canonical clock. Movement and relationships play at 1×; recorded passes and finishes at an explicitly displayed 0.5×. Padding after evidence is 0.65 seconds, or 1.1 seconds for a finish so the outcome has context. Intervals are bounded to scenario duration.

The render clock samples the same absolute replay time for players, ball, overlays and camera. It clamps guided playback to the exact boundary and then marks completion. There is no second football timeline, timeout-controlled football motion, or accumulated-delta player animation.

Selected movement paths reveal along recorded samples; links follow the measured pair; corridor shading retains backend classifications and the recorded-pass centre trace advances with the ball; coverage follows the receiving region and nearest defender; finish lines reveal the canonical shot path. Relevant actors receive rings. Other analytical layers are suppressed during the guide. The selected moment remains pinned for overlay interpretation even when the padded interval crosses another moment.

The caption offers replay, pause/resume, close and back to analysis. Close/back restores the prior paused time, camera, selection, speed and analytical layers. Manual scrubbing, speed/camera changes, panning or selecting another player interrupt the guide at the current time, restore prior diagram/speed settings and pause. Starting another insight replaces the active guide while retaining the original restoration context. Scenario switches reset everything. No delayed callbacks can revive an old sequence.

On narrow screens, captions sit **below** the canvas rather than hiding football action. Desktop captions occupy a compact lower-left area. Focus returns to the analysis region on closing; there is no focus trap. Scrolling respects reduced-motion preferences.

## Simulated player gaze and free-look

The automatic camera anchor comes from the selected player’s canonical position and body-facing track. Pure `sampleGaze` adds bounded attention toward canonical ball position, possession and event-relative action windows. Imminent reception/pass/shot increases tracking; small deterministic teammate/field scans fill quieter phases. A symmetric replay-time sampling window softens gaze changes. There is no render-time randomness or accumulated attention state.

Eye height is 1.68 m with at most 0.013 m of distance-indexed bob. Reduced camera motion disables bob and nonessential scanning. Ball-tracking pitch and neck yaw are restrained. The UI says “Simulated player gaze based on recorded movement and ball position” and explains that attention is inferred for presentation, not observed.

Paused POV has a dedicated pointer surface, separate from tactical pan/zoom. Mouse/touch drag changes only explicit yaw/pitch offsets. Yaw is bounded to ±π and pitch to ±1.05 radians, with a final camera pitch constraint to avoid inversion. Pointer capture, cancellation, loss and unmount cleanup are handled. Arrow keys look around; Home/Escape reset. Reset view removes the offset. Follow player resets and resumes playback. Seeking while paused retains the offset; switching player, camera or scenario clears it. Resuming removes the manual offset and returns to automatic gaze through a short 220 ms orientation-only presentation transition; the camera anchor continues to follow the canonical position. Reduced motion returns immediately. The selected mesh is hidden in POV to prevent self-clipping.

## Camera and opening

Automatic `sampleCamera` stays a pure scenario/time/mode function. User-triggered non-POV camera changes interpolate from the current pose for 280 ms using presentation wall time. Settled frames copy the canonical target exactly. Paused POV resumes use a 220 ms orientation-only return, with no root or camera-anchor displacement. POV switches anchor immediately rather than flying through the scene. Reduced motion skips interpolation. Tactical manual framing remains an explicit override.

The opening is authored slow buildup, not a clock defect. Linden and the ball move approximately 2 m in 3 s (about 0.67 m/s) in The Invisible Run. Existing distance-indexed walking cadence is retained. A restrained “The buildup” card explains the patient carry and offers “Jump to key moment”, using the real run-event timestamp (3 s / 4 s). Nothing silently accelerates canonical time.

The stadium lighting, floodlights, pitch and goal were reviewed and retained: there was no demonstrated need for extra GPU effects or replacement assets.

## Interactive player selection

All 22 rendered player groups use React Three Fiber’s existing raycast event path. Events from a visible body, limb or selection marker bubble to the owning player group. A click/tap with at most 6 CSS pixels of pointer travel selects that player; larger tactical drags are captured and their following click is swallowed. Desktop hover adds one subtle ring and a pointer cursor. The selected player receives the persistent lime ring and world label already used by the replay, now driven by the same nullable `selectedId` as the player card, tactical HUD and roster picker.

Selection is inspection state and never changes the camera implicitly. It persists while playing, pausing, seeking and changing cameras. Scenario changes clear it rather than carrying an invalid ID into another roster. Starting a validated guided replay can select its relevant actor; closing/back restores the prior nullable selection. A deliberate player click during a guide uses the existing manual-interruption path and restores the guide’s prior layers and speed.

The player card sits beside the replay. It shows the fictional team, shirt number, name and role, with explicit **View POV**, **Follow Player** and dismiss actions. View POV switches to `pov:{playerId}` without rebasing the clock or changing play/pause state, and reuses simulated gaze and paused free-look. Follow Player uses a pure replay-time third-person camera sampled from the player’s canonical position and facing. Neither action changes scenario data or player roots.

The two native player selects were removed. One `PlayerPicker` in the camera rail now serves inspection and camera workflows. Its labelled search matches name, number or role; players stay grouped beneath their two fictional team headings; each option shows shirt number, name and position. The popover uses a real trigger button, labelled search input, semantic headings/lists and option buttons. Arrow Up/Down, Home/End, Enter, Escape, click-outside dismissal and visible focus are supported. The list has a bounded scrolling region. It opens upward on desktop and becomes a safe-area-aware bottom sheet on narrow touch screens. Selecting a roster row updates the same store state and reveals the action card rather than entering POV automatically.

Pointer ownership is explicit. Paused POV free-look mounts a DOM surface above the canvas and owns its captured drag. Tactical pan uses a native capture-phase listener and wins once movement crosses 5 pixels. R3F player selection accepts only the subsequent no-drag click/tap. Guided replay controls the camera until any intentional manual player/camera action calls the existing interruption/restoration path. No second pointer controller or selection store was added.

A short “Click any player to inspect or view their POV” hint appears only while no player is selected, outside POV/guided replay, and removes itself after 6.5 seconds. The roster picker remains the permanent keyboard/touch alternative after the hint disappears.

## Football reactions

Reactions sample the actual shot and outcome events from absolute replay time. A weak cache holds immutable event assignments per scenario. The existing independent 65-bone rigs, shared clips, shared geometry and kit material pooling are retained. All procedural offsets apply to bones below the canonical player group; neither the player group nor the root bone is moved.

Holt’s response is a grounded partial lateral lunge and reach rather than a full airborne dive. His canonical tracking continues laterally and turns after the goal; a full-length dive would need substantially different tracking. The bounded pelvis presentation offset (at most 0.24 m lateral and approximately 0.58 m down before ground correction), lean and analytic leg placement give a ready stance, reaction, push-off/reach, low landing and recovery while preserving that track. No contact, save or deflection is added.

For a shot at time T, readiness blends in from T−0.9 to T−0.3. Reach begins at T+0.18, develops to T+0.76, and blends through landing/recovery from roughly T+0.65 to T+2.1. The action fades back into locomotion by T+3.0. Moss uses a restrained tracking/reach pose for the wide shot, with much less lean and offset.

Voss’s arms-up celebration begins only after the goal at 14.67 s: it starts blending at 14.85 s, reaches full expression at 15.42 s and fades by 19.27 s. Finch’s disappointment starts at 15.90 s after the 15.72 s miss, develops by 16.47 s and fades by 18.02 s. Locomotion beneath upper-body reactions remains distance-indexed.

Nearby defenders use bounded head/torso ball tracking and braced arm poses. Proximity gates the effect (full nearby influence inside 12 m, fading out by 25 m), and it fades after the outcome. Their recovery runs and held positions remain exactly as recorded. These gestures illustrate participation, not measured reactions or intent.

Pose tests verify independent skeletons, history-free seeking, continuous quaternion/position blends, unchanged canonical JSON, unchanged source rig/clips and finite transforms. Keeper vertices are sampled through the shot/recovery interval for ground, culling and ball separation. The conservative per-rig culling sphere is expanded for extended gestures; it is not recomputed from every vertex on every frame.

## Accessibility and responsiveness

Native buttons, labelled form controls, semantic lists/sections and native details/summary disclosures support keyboard interaction. The custom roster uses semantic controls rather than clickable `div` elements, includes a live result count, and does not autofocus the search field on coarse pointers. A skip-to-replay link, visible focus rings, focusable caption heading and a completion status support navigation. Camera, picker and guided actions have practical touch targets. Diagram meaning is also explained in words. Reduced-motion media preference initializes a visible camera-motion option; CSS also suppresses nonessential transitions and smooth scrolling. Desktop, mobile touch and reduced-motion paths are browser-tested.

## Dependencies and licensing

No runtime dependencies, UI framework, animation framework, physics engine, asset or backend contract was added. Existing CC0 character resources retain their attribution/license documentation. StadiView code and assets were not copied; no PolyForm-licensed material is introduced. No Foundry agent or cloud resource is created.

## Verification and artifacts

Final checks, performance comparison and remaining limitations are recorded below after the final validation pass. Artifacts are deliberately under ignored `output/`; small benchmark reports are also retained in `docs/benchmarks/` for review.

### Performance comparison

Chrome 155, 1440×1100 viewport, DPR 1.5, all 22 skeletal players; 2 s warmup then a 6 s sample from replay start, with equivalent public controls in each run. These short refresh-limited samples are not a long-duration GPU stress test. Raw results: [phase-3c.json](benchmarks/phase-3c.json).

| Scenario / camera | FPS before → after | Mean ms before → after | p95 ms before → after | Frames >25 ms before → after | Mean calls before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Invisible / broadcast | 59.00 → 60.00 | 16.95 → 16.67 | 16.80 → 16.80 | 4 → 0 | 95.92 → 95.91 |
| Invisible / tactical | 60.00 → 60.00 | 16.67 → 16.67 | 16.80 → 16.80 | 0 → 0 | 94.39 → 94.80 |
| Missed / broadcast | 59.84 → 59.84 | 16.71 → 16.71 | 16.70 → 16.80 | 1 → 1 | 95.54 → 95.92 |
| Missed / tactical | 59.00 → 60.00 | 16.95 → 16.67 | 16.70 → 16.80 | 4 → 0 | 95.58 → 96.31 |

Mean triangles were approximately 576k → 576k, 541k → 547k, 576k → 581k and 565k → 575k respectively. The slightly larger conservative pose envelope can retain an extra edge-of-frame player. Peak final calls were 96/95/96/97. Textures stayed at 27; geometries stayed at 58 in broadcast and changed from 61 to 60 after tactical scenario switches (a reduction, not growth). One GLB request per browser context and 22 rigs were retained. No renderer errors were recorded.

The first guided overlay use uploads geometry that was previously unrendered; this is finite lazy GPU allocation. The browser resource test warms that path before comparing repeated replay/close cycles. Player hover reuses one shared ring geometry and 2 shared materials. A browser test warms the ring once, moves across every visible player, verifies unchanged GPU geometry/texture counts and permits at most one additional draw call while the ring is visible. Raycasting remains R3F’s existing pointer-event pass; no frame-loop hit test was added. The UI clock/captions now update at 20 Hz while the shared WebGL clock, skeletal poses, ball and geometry continue at render frequency. No per-player React animation state was introduced. Scenario-switch timings remain subject to dev/HMR/GC noise; see the raw report rather than interpreting one cold mount as a regression.

### Canonical and defensive audit

[Integrity hashes](benchmarks/phase-3c-integrity.json) verify byte-identical scenario JSON, Python geometry engine, Pydantic models, OpenAPI and TypeScript API definitions against the original checkout. [The defender audit](benchmarks/phase-3c-defender-audit.json) lists every opposing player’s actual opening and 3–9 s path length and displacement.

In The Invisible Run, Mercer travels 7.89 m, North 6.72 m, Pike 5.66 m and Ash 5.16 m during 3–9 s. In The Missed Chance, Rook travels 7.35 m, Ward 5.20 m, Stone 4.22 m and Hart 4.83 m over the same inspection window. Both keepers hold their initial position during 0–3 s. The outfield defence is therefore not literally stationary; the overview and understated body language made movement less legible. Guided paths and restrained bracing/head turns make the actual movement easier to see without adding runs. The authored guide identifies wide cover, handoff and recovery roles; those are not inferred motivations.

### Visual review and artifact index

Artifacts remain in ignored `output/playwright/phase3c/`, including earlier refinement captures. Use **final/** for the final general views and reaction close-ups. Capture commands, from `frontend/` against the existing servers:

```sh
node scripts/capture-experience.mjs before
node scripts/capture-experience.mjs final
node scripts/capture-experience.mjs final --reactions
node scripts/capture-experience.mjs final --reaction-video
node scripts/capture-experience.mjs final --tour
node scripts/capture-experience.mjs final --performance
node scripts/capture-experience.mjs final --selection
```

The `before` command must be run against the baseline if recreating historical comparisons. It is not a way to restore baseline code. Reaction close-ups temporarily use an inspection camera on the actual mounted rig and restore the product rig afterward. Live close-up recordings use a temporary late camera callback and release it; the football clock, root/ball tracks and player pose sampling remain untouched.

| Review | Before | After |
| --- | --- | --- |
| Main studio | [start](../output/playwright/phase3c/before/the-invisible-run-studio.png) | [start](../output/playwright/phase3c/final/the-invisible-run-studio.png) |
| Three-second opening | [3 s](../output/playwright/phase3c/before/the-invisible-run-3.png) | [3 s](../output/playwright/phase3c/final/the-invisible-run-3.png) |
| Defender shift | [6 s](../output/playwright/phase3c/before/the-invisible-run-6.png) | [6 s](../output/playwright/phase3c/final/the-invisible-run-6.png) |
| Evidence hierarchy | [panel](../output/playwright/phase3c/before/the-invisible-run-evidence.png) | [panel](../output/playwright/phase3c/final/the-invisible-run-evidence.png) |
| Receiving POV | [fixed heading](../output/playwright/phase3c/before/the-invisible-run-pov.png) | [simulated gaze](../output/playwright/phase3c/final/the-invisible-run-pov.png) |
| Mobile analysis | [panel](../output/playwright/phase3c/before/the-invisible-run-mobile.png) | [panel](../output/playwright/phase3c/final/the-invisible-run-mobile.png) |
| Player selection | [two native selects](../output/playwright/phase3c/before/the-invisible-run-studio.png) | [grouped searchable picker](../output/playwright/phase3c/final/player-picker-after.png) |
| Player inspection | [always-selected panel](../output/playwright/phase3c/before/the-invisible-run-studio.png) | [selected player card](../output/playwright/phase3c/final/player-card-after.png) |
| Mobile player picker | — | [bottom-sheet picker](../output/playwright/phase3c/final/player-picker-mobile-after.png) |

Guided replay captures: [movement](../output/playwright/phase3c/guided-movement.png), [relationship](../output/playwright/phase3c/guided-relationships.png), [passing corridor](../output/playwright/phase3c/guided-corridor.png), [space](../output/playwright/phase3c/guided-space.png), [finish](../output/playwright/phase3c/guided-finish.png), [mobile caption layout](../output/playwright/phase3c/mobile-guided.png), [paused free-look](../output/playwright/phase3c/paused-free-look.png).

Reaction phases: [Holt ready](../output/playwright/phase3c/final/the-invisible-run-d1-13.65-closeup.png), [reach](../output/playwright/phase3c/final/the-invisible-run-d1-14.55-closeup.png), [low recovery](../output/playwright/phase3c/final/the-invisible-run-d1-15.15-closeup.png), [standing recovery](../output/playwright/phase3c/final/the-invisible-run-d1-17-closeup.png), [Voss celebration](../output/playwright/phase3c/final/the-invisible-run-a9-16.5-closeup.png), [Moss tracking](../output/playwright/phase3c/final/the-missed-chance-c1-15.4-closeup.png), [Finch disappointment](../output/playwright/phase3c/final/the-missed-chance-s9-16.6-closeup.png).

Normal-speed full-studio recordings are under `before/video/` and `final/video/` (one per scenario). Named close-up recordings are `final/the-invisible-run-reactions.webm` and `final/the-missed-chance-reactions.webm`. Video-derived contact sheets retain the movement sequence rather than only selected stills. Close-up review prompted a refinement from two arms held across the head to one leading arm and a bracing trailing arm, plus a slightly later full extension to preserve clear separation from the ball.

### Known limits and Phase 4 readiness

- Holt performs a grounded partial lunge, not a full airborne save animation. His canonical lateral path and subsequent turn still limit naturalism. A different dive trajectory requires a separate versioned scenario-data decision; no such change was made here.
- Defenders holding shape retain those positions. Their cosmetic gestures are synthetic presentation, not tracked reactions. Scorer gestures use procedural arms/torso over the existing gait, not motion capture.
- Gaze is bounded and inferred. It cannot follow a ball completely behind the body automatically; paused free-look can inspect that area. No eye tracking, measured attention or human intent is claimed.
- The product remains a stylized stadium. No crowds, postprocessing stack or full animation retargeting system was introduced.
- Performance comparisons use short local desktop windows; lower-end mobile GPU performance and long sessions still warrant device testing. Browser coverage is Chrome, including emulated mobile touch, rather than physical iOS/Safari.
- Existing production WebGL chunk size and optional external tracking-test requirements remain. No tests were disabled to conceal regressions.

The UI is prepared to display future evidence-grounded narratives: insights carry validated evidence IDs, source identity, supporting geometry and explicit interpretation boundaries, with a concrete watch action. An Observer → Tactical Analyst → Storyteller system still needs server-side output validation, source/hash consistency and evaluation before generated prose is trusted. This milestone implements none of those agents or Phase 4 services.


### Final validation results

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` | 71 passed across 9 files |
| `pnpm build` | Pass; existing nonblocking lazy WebGL chunk-size warning remains (~1,014 kB / 274 kB gzip, versus ~1,009 kB / 272 kB in Phase 3B.3) |
| `pnpm test:e2e` | 30 passed, single Chrome worker, approximately 2.7 min |
| Backend pytest | 59 passed, 1 skipped (optional external SkillCorner segment absent) |
| Backend Ruff | Pass |
| Canonical integrity / `git diff --check` | Pass |

The pre-existing Starlette/httpx TestClient deprecation warning remains. There are no remaining test failures. Early development failures exposed a boot-ground correction, camera interpolation rounding, asynchronous camera-settle assumptions and one-time lazy GPU allocation; these were resolved rather than hidden. The obsolete fixed-heading POV assertion was replaced by anchor, bounded gaze and reproducibility checks. Existing exact settled-camera and skeletal equality assertions remain exact. Browser projection/click tests wait for the deliberately introduced camera transition to settle.

New browser coverage includes all five evidence categories, exact guide identities/intervals/boundaries, scroll-to-viewport, progress/captions, replay/back/close, interruption and hash/scenario cleanup, repeated resource use, mouse/touch/keyboard free-look, reset/seek/resume/player switches, reduced-motion mobile caption layout and actual mounted keeper/finisher bones. Player-selection coverage projects and clicks actual player meshes, preserves selection through seeking, verifies explicit POV/follow timestamps, clears cross-scenario selection, suppresses selection after tactical drag, searches by roster metadata, counts all 22 players across both teams, exercises keyboard/Escape/click-outside and trusted mobile touch, and checks warmed hover resource/draw-call bounds. Desktop and mobile layout were visually reviewed; existing responsive/camera suites remain green. Emulation is not a physical-device performance certification.

Keeper safety sampling found a minimum ball-surface gap of approximately **0.183 m** for Holt and **1.356 m** for Moss during their shot intervals, using deformed mesh triangles, not just tracking centres. Sampled keeper ground minima stayed above the pitch, and extended poses fit the conservative culling envelope. These are sampled presentation checks, not a new collision or physics system. Raw measurements: `output/playwright/phase3c/reaction-safety.json`.

### Web Design Guidelines review

Reviewed the touched interface against the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Native disclosures, labelled controls, keyboard free-look, visible focus, reduced motion, readable contrast, progress/status semantics, hover feedback and mobile caption separation are implemented. Application state is local to the session; shareable scenario/evidence deep links remain future work rather than a new routing dependency.

Current implementation references: [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls), [R3F events](https://r3f.docs.pmnd.rs/api/events), [Three.js SkinnedMesh](https://threejs.org/docs/#api/en/objects/SkinnedMesh), and [Playwright videos](https://playwright.dev/docs/videos). No third-party project source or assets were copied.

### Added and modified files

- `README.md`
- `docs/CHARACTER_ANIMATION.md`
- `docs/PHASE_3C_EXPERIENCE.md`
- `docs/TACTICAL_ANALYSIS.md`
- `docs/benchmarks/phase-3c-defender-audit.json`
- `docs/benchmarks/phase-3c-integrity.json`
- `docs/benchmarks/phase-3c.json`
- `frontend/scripts/capture-experience.mjs`
- `frontend/scripts/capture-actions.mjs`
- `frontend/src/App.css`
- `frontend/src/App.tsx`
- `frontend/src/replay/PovControls.tsx`
- `frontend/src/replay/PlayerPicker.test.ts`
- `frontend/src/replay/PlayerPicker.tsx`
- `frontend/src/replay/ReplayScene.tsx`
- `frontend/src/replay/animation/animationSampler.ts`
- `frontend/src/replay/animation/characterAssets.ts`
- `frontend/src/replay/animation/footballPose.ts`
- `frontend/src/replay/animation/reactions.test.ts`
- `frontend/src/replay/animation/reactions.ts`
- `frontend/src/replay/camera.ts`
- `frontend/src/replay/gaze.test.ts`
- `frontend/src/replay/gaze.ts`
- `frontend/src/replay/playerFilter.ts`
- `frontend/src/replay/replay.test.ts`
- `frontend/src/replay/store.ts`
- `frontend/src/replay/useReplayTime.ts`
- `frontend/src/tactics/GuidedHUD.tsx`
- `frontend/src/tactics/TacticalHUD.tsx`
- `frontend/src/tactics/TacticalOverlays.tsx`
- `frontend/src/tactics/TacticalPanel.tsx`
- `frontend/src/tactics/data.ts`
- `frontend/src/tactics/guided.test.ts`
- `frontend/src/tactics/guided.ts`
- `frontend/src/tactics/presentation.ts`
- `frontend/src/tactics/tactics.test.ts`
- `frontend/tests/actions.spec.ts`
- `frontend/tests/animation.spec.ts`
- `frontend/tests/camera.spec.ts`
- `frontend/tests/experience.spec.ts`
- `frontend/tests/player-picker.ts`
- `frontend/tests/player-selection.spec.ts`
- `frontend/tests/replay.spec.ts`
- `frontend/tests/scenarios.spec.ts`
- `frontend/tests/tactics.spec.ts`
- `frontend/tests/timeline.spec.ts`

Runtime dependencies: **none added or changed**. Generated screenshots/recordings and transient browser output remain under ignored `output/`. The initial Playwright CLI snapshots were moved there as well. Local `.agents/skills/` and `skills-lock.json` are untouched. No commit or push was made.


Additional final-only 3 s samples (350 ms settle) cover actual shot reactions, receiving POV and each guided overlay in both scenarios. FPS ranged **59.34–60.00**, p95 frame interval **16.7–16.8 ms**. Guided recorded-pass corridors reached **102 draw calls**; POV averaged about **71**, and other guided views approximately **77–98**. These are separate final interaction samples, not before/after claims. Full records, including triangles, geometry/texture counts and active guide identity, are appended to `benchmarks/phase-3c.json` as `interactionPerformance`.

Named interaction recordings: `final/the-invisible-run-guided-pov-tour.webm` and `final/the-missed-chance-guided-pov-tour.webm`. They show real watch actions for all five evidence categories, scrolling/captions, returning to analysis, paused look-around, reset and following the player again. Reaction motion review sheets are [keeper and celebration](../output/playwright/phase3c/final/keeper-celebration-motion.png) and [missed-chance reactions](../output/playwright/phase3c/final/missed-reactions-motion.png).

The guided interaction recording was also reviewed as a video-derived [sequence sheet](../output/playwright/phase3c/final/guided-pov-motion.png).
