# Phase 4.2 — The Missed Chance realism

## Approved canonical revision

The baseline `frontend/src/replay/missed-chance.json` had SHA-256 `edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9`. The user approved the documented 12-second proposal before canonical edits. The applied source hash is `0d9214e800ed9053d40ff4f8fa94272a930d3bc9453af3f082fe8913bb3f9bee`. The previous eight-second opening moved Marr at 0.79 m/s and Finch at 0.5 m/s. The ball followed Marr at that same slow speed. The replay clock runs at ordinary 1×; the shared locomotion sampler already advances by distance and cannot make those roots move faster. Later goal/dummy authoring recipes already bake smooth routes into linear keys; the old miss had sparse four-second keys.

Applied a scenario-specific **12-second** authored revision. It retains all original spatial control points, identities, event IDs/types, teams, pitch, and the shot's exact ball positions and 0.72-second release-to-miss flight. It reuses the existing shape-preserving authoring helper to bake player routes at 0.1-second intervals, including every control/event time. The ball follows the existing 0.65m carrier offset between contacts; pass flight shortens from 1.7 to 1.2 seconds. Headings are retimed, not replaced with inferred attention. This is an offline source revision, not runtime smoothing or a faster clock.

| Event      | Before, seconds | Approved, seconds |
| ---------- | --------------: | ----------------: |
| build      |               0 |                 0 |
| run        |               4 |               1.3 |
| shift      |               8 |               3.2 |
| pass       |             8.5 |              3.55 |
| receive    |            10.2 |              4.75 |
| recovery   |              12 |              5.85 |
| shot       |              15 |              7.65 |
| miss       |           15.72 |              8.37 |
| replay end |              20 |                12 |

Other ball/player anchors map 14→7, 15.4→8.05, 16→8.65, 17→9.65. The candidate is available at `output/phase4-2/missed-chance-proposed.json`, with the complete movement report at `output/phase4-2/proposed-diagnostics.json`. These are ignored proposal artifacts, not active scenario data. The pre-approval candidate passed Pydantic validation and the existing authoring diagnostics with no warnings: closest continuous player spacing 1.980m, maximum sampled segment speed 6.509m/s, finite-window acceleration 4.844m/s², deceleration 3.453m/s², and no touch warnings. The brief fastest segment is Quinn's wide run; the default authoring speed warning remains 9m/s. These are synthetic authoring diagnostics, not measured athletic claims.

### Approved effects

- Update only this canonical source and a reproducible versioned authoring recipe. Schema version remains 1; the new source hash identifies the revision. Other scenarios stay byte-identical.
- Keep the league score 0–1, the miss's match clock **3675.72s**, its minute/player/event ID and every result/ledger fact unchanged. To retain that clock after retiming, change this replay's `matchStartSeconds` from 3660 to **3667.35**. Change only its catalog replay entry `startTime` from 8 to **3.2** so navigation still opens before the pass. No goal/save/block is added.
- Regenerate tactical evidence from the new source. Semantic evidence IDs remain stable under the existing v1 contract, but their source hash, intervals, speed measurements and affected intermediate geometry change. The backend already keys evidence by exact source text; AI packets/cache keys include source/evidence hashes, so old generated content cannot attach to the revision.
- Commentary/event-stream times move with the canonical events; match-relative times derive from the new start offset. Test both modes, full cue sets, recap references and clock synchronization with the mock provider only. No paid Foundry call.
- Replace historical source-hash/time expectations with explicit approved-revision checks, including retained anchor geometry, contact identity, whole-ball wide crossing, no collision, and both other sources unchanged. Do not relax factual or causal screening. Document any intentional authoring speed-bound change against the measured candidate rather than hiding it in a broad assertion update.

The user’s Phase 4.2 request explicitly said **“Request approval before changing canonical scenario data.”** The recorded answer was **“Approve the documented 12-second revision.”** The candidate and its diagnostics were prepared before that approval; final source/evidence artifacts are `output/phase4-2/final-diagnostics.json` and `final-evidence.json`.

## Presentation changes

- `footballActions.ts` selects a reusable **driven** shot profile only for this scenario: preparation starts at 7.10s, contact stays at 7.65s, and recovery ends at 8.43s. The existing analytic foot solver and world-space support lock remain authoritative for presentation contact. `footballPose.ts` adds greater backswing, hip rotation and raised follow-through, then a balance-recovery knot. Pass and receive mechanics remain distinct.
- `attention.ts` adds bounded illustrative head/shoulder tracking and periodic carrier scans. Rook’s target blends the ball with Quinn; Stone/Hart/Ward blend toward Finch. These are deterministic presentation cues over existing paths, not newly inferred awareness, player decisions or tactical facts. Action/reaction weights suppress competing head layers. No player root, heading or ball track is written by the animation.
- `locomotionPhase.ts` caches absolute distance-derived phase. This scenario lengthens the fast-run stride from the prior 2.2m maximum to 2.85m, preventing the faster wide run from spinning the existing jog clip too rapidly. Tests bound cadence and preserve phase continuity. Other scenarios retain their original stride profile. The shipped model has idle/walk/jog clips; this is a stylized faster-running blend with lean, not newly acquired sprint motion capture.
- `reactions.ts`/`footballPose.ts` give Moss a distance-indexed shuffle, a set stance and bounded lean/reach toward the actual wide flight. He remains grounded, recovers after the ball goes out, and never performs a goal-style dive. Finch’s head/arm disappointment remains outcome-gated and restrained; he never celebrates.
- `camera.ts` establishes the attack, then smoothly closes toward the fixed shot/goal area after reception. Finch, Stone, Moss, the ball and both posts remain framed across tested aspects. Broadcast can leave the distant wide runner out during the finish; tactical retains all authored key actors. POV/free-look, zoom/pan and the existing camera controller remain intact.

The original sparse timing, rather than pauses in the clock or a second interpolation timeline, caused the slow opening. The shared clock, linear runtime sampler, 22 independent rigs, pooling, deterministic seek evaluation and source-validated evidence remain in place. There are no new assets, dependencies, physics engines, services or paid AI calls.

## Evidence, contracts and regression changes

The reproducible recipe is `backend/authoring/missed_chance.py` (`python -m authoring.missed_chance --check`; writing requires explicit `--write`). All original player position anchors and retimed heading anchors remain present. The ball’s controlled portions follow the same carrier offset; shot flight coordinates and duration remain exact. Source-text caching rebuilds the 47 evidence observations automatically. The revised actual-pass closest moving gap is 2.429m; retained reception/recovery/shot anchor separations are 5.00m, 3.61m and 2.06m. Intermediate measures are regenerated, not copied from the old report.

Tests explicitly update approved times and source hashes. The missed-scenario authoring speed bound becomes 6.6m/s around its measured 6.509m/s wide run; both unchanged goal sequences retain their 6m/s bound, and the global diagnostic warning remains 9m/s. The fixture-navigation inspection helper now imports the exact loaded Vite store URL, avoiding a duplicate store when the development server has HMR timestamps. It retains every cleanup assertion. The camera regression now checks all actors in tactical/opening views and the relevant finish actors in the closer broadcast view; a new dense projection test checks shooter, cover, keeper and both posts. Contact, ground, culling, causal/quantity screening and collision assertions retain their existing tolerances. The dense action scan measured the revised shot’s nearest boot-vertex/sphere gap at 3.57mm and its minimum sole Y at +1.96mm; these sampled visual bounds are not a physical collision guarantee. The support-ankle lock also passes the new ±0.06s world-space drift check.

The tactical engine, Pydantic/public API contracts, event IDs, semantic evidence IDs, match score/ledger, and both other canonical JSON sources are unchanged. Existing generated API changes in the working tree belong to the earlier Phase 4 work; Phase 4.2 did not regenerate or modify those files. `app.openapi()` still equals the stored snapshot. Both mock modes and recap references use the new hash/time packet; no old cached narrative can attach to the revised source.

## Verification and performance

- Backend: **162 tests passed, one existing optional skip**. Ruff and authoring-format/check commands passed. Independent new checks cover exact contact/flight anchors, route spacing/acceleration, miss/league-clock preservation and reproducibility.
- Frontend: **207 unit tests passed**, plus typecheck, ESLint and production build. Skeletal safety tests cover support-foot planting, deformed boot contact, ground/culling bounds, continuity, independent/remounted poses, source-asset immutability and both other scenarios.
- **All 74 Playwright tests passed in the final full run (5.9 minutes)**, including normal-speed completion, contact/camera/seek determinism, both mock AI modes, commentary, fixture navigation, evidence validation, resource cleanup and both unchanged goal scenarios. Earlier runs identified the development-store inspection issue and one outdated replay-entry expectation; both were corrected without removing cleanup assertions.
- The existing benchmark ran each 22-player scenario for 12s after a 2s warmup, headless Chrome 156, 1440×1100 viewport, DPR 1, 1064×604 drawing buffer, broadcast, 1× speed. One character asset request per context; no renderer errors. These local results are not a physical-device or universal frame-rate guarantee.

| Scenario       | Mean / p95 frame ms | Mean / max draw calls | Geometries before / after switches | Textures |
| -------------- | ------------------- | --------------------- | ---------------------------------- | -------- |
| Missed Chance  | 16.67 / 16.8        | 88.99 / 95            | 57 / 56                            | 27       |
| Invisible Run  | 16.67 / 16.8        | 91.80 / 95            | 58 / 57                            | 27       |
| Untouched Pass | 16.67 / 16.8        | 87.85 / 89            | 57 / 56                            | 27       |

All three measured about 60 FPS with no frame over 25ms in this short run. Raw benchmark: `output/phase4-2/benchmark.json`. Source densification increases the lazy data chunk from 492.67kB to 608.04kB (102.89→130.01kB gzip). The main bundle remains 293.49kB. Lazy WebGL is approximately 1019.39kB (275.37kB gzip). Build warnings remain visible; no check was weakened to hide the larger lazy data/WebGL chunks.

## Visual evidence

The browser tests run the complete miss at 1×, exercise tactical/overview/POV, restart, reverse seeks and both other scenarios, and check revised commentary cues in both mock modes. Captures use normal broadcast framing; close-ups temporarily inspect the actual mounted rig and then restore the product camera. Mobile is browser emulation.

- [Opening at 0.6s](../output/playwright/phase4-2/opening-broadcast.png)
- [Shot preparation at 7.4s](../output/playwright/phase4-2/shot-preparation-broadcast.png)
- [Ball flight at 8.05s](../output/playwright/phase4-2/ball-flight-broadcast.png)
- [Post-miss at 9.25s](../output/playwright/phase4-2/post-miss-broadcast.png)
- [Backswing close-up](../output/playwright/phase4-2/backswing-closeup.png), [contact](../output/playwright/phase4-2/contact-closeup.png), [follow-through](../output/playwright/phase4-2/follow-through-closeup.png), [disappointment](../output/playwright/phase4-2/disappointment-closeup.png)
- [Mobile shooter POV](../output/playwright/phase4-2/mobile-shooter-pov.png)

Visually reviewed the opening, preparation, contact, flight, follow-through and post-miss views. The keeper tracks rather than inventing a save. The retained generic athlete/kit asset and procedural kicks remain stylized; this is not full football motion capture or a physical contact solver. Head/shoulder behavior is illustrative. The 0–0 overlay is the passage-relative score; the Match Center’s unchanged 0–1 ledger result remains separate.

## Changed files and review status

Canonical/catalog: `frontend/src/replay/missed-chance.json`, `backend/league/catalog.json` (only replay entry time), plus new `backend/authoring/missed_chance.py`. Presentation: `attention.ts`, `animationSampler.ts`, `characterAssets.ts`, `footballActions.ts`, `footballPose.ts`, `locomotionPhase.ts`, `reactions.ts`, `camera.ts`. Tests: new `test_missed_revision.py`, `missedRealism.test.ts`, `missed-realism.spec.ts`; revised source/time/camera expectations in the existing backend, action, replay, scenario and reaction journeys. Documentation: this report, README, replay/animation/realism documentation. Earlier unrelated working-tree changes are preserved. No commit or push.

Final status: ready for review. All required checks passed; screenshots were visually inspected. No paid Foundry call, new dependency, service, commit or push. No required implementation work remains; the stylized animation and local benchmark limits above still apply.
