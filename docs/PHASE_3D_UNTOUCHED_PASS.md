# Phase 3D — The Pass That Wasn't Touched

Implemented October 24, 2026 (America/Toronto), from clean local `main` at `c751dcac5b55f36de9be121a374ca3fb495eda2c`. The verified checkout is `/Users/pavitar/Desktop/projects/Developer/butterfly-effect`; the session's original Developer path no longer exists. No commit, push, cloud integration, AI narrative layer, new asset or dependency is part of this work.

The third showcase follows progression → defensive adjustment → low diagonal → non-contact dummy → arriving midfielder → quick control and finish. It is original fictional tracking inspired only by a described football movement pattern, with no claim of real match measurement.

## Scenario and timeline

Vesper Athletic attack +X in amber; Tidal Rovers defend in cyan. Their keepers wear purple and light green respectively. The replay lasts **13.6 seconds**, beginning at fictional match time 66:00. Ordinary playback remains **1×** on the existing clock.

| Replay time | Event | Canonical action |
| --- | --- | --- |
| 0.00 | `build` / carry | Tobin Wren progresses with supporting players already moving. |
| 1.20 | `run` | Kian Merrick advances from midfield; Felix Arden follows the inside route. |
| 2.60 | `shift` | The back line adjusts, with Cassian Reid near Soren Ellery. |
| 3.20 | `layoff` / pass | Wren finds Asa Bellamy wide. |
| 3.80 | `collect` / receive | Bellamy controls on the move. |
| 5.60 | `pass` | Bellamy releases the low diagonal from ball centre `(32.65, 0.16, -14)`. |
| 6.12–7.02 | Dummy action interval | Ellery anticipates, opens the stance, balances and recovers. |
| 6.65 | `dummy` / passage | The unchanged pass travels through Ellery's tracking position `(39.2125, 0, -4.8125)`, between his animated legs. |
| 7.20 | `receive` | Merrick receives at root `(42, 0, 0)`, ball `(42.65, 0.16, 0)`. |
| 7.42 | `shot` | After a **0.22 s** settling touch, Merrick shoots from root `(42.7, 0, 0)`, ball `(43.35, 0.16, 0)`. |
| 8.02 | `goal` | Ball centre `(52.7, 0.60, -2.4)`, with the whole sphere beyond the line and inside the goal. |
| 8.02–13.60 | Reaction | Lorne completes his grounded reaction; Merrick turns as teammates converge and defenders slow. |

The goal event follows the actual whole-ball crossing by less than 3 ms. The pass has **no ball key at the dummy**: its centre velocity remains `(6.25, 0, 8.75)` m/s throughout the linked flight, about **10.75 m/s**. It neither pauses nor changes direction for the pose.

| Number | Vesper Athletic | Tidal Rovers |
| --- | --- | --- |
| 1 | Milo Bracken — goalkeeper | Otis Lorne — goalkeeper |
| 2 | Ivo Fenwick | Bram Keene |
| 3 | Luca Orrell | Ewan Rusk |
| 4 | Nico Dacre | Dorian Hale |
| 5 | Elian Croft | Cassian Reid |
| 6 | Rian Vale | Felix Arden |
| 7 | Asa Bellamy — diagonal passer | Remy Talbot |
| 8 | Tobin Wren — progression | Hugo Stroud |
| 9 | Soren Ellery — dummy | Ansel Beck |
| 10 | Kian Merrick — arrival and finish | Oren Sayer |
| 11 | Joss Alder | Kit Hollis |

All 22 have complete position and heading tracks. Numbers stay within 1–11, so the existing shared 1–12 jersey atlas suffices; AUD-04's broader atlas support remains deferred.

## Architecture and reproducible authoring

The existing scenario registry, Pydantic contracts, raw-source hashes, Python evidence engine, Zustand clock, replay renderer, skeletal rig, tactical overlays, player picker and camera ownership remain shared. There is no separate third-scenario replay or analysis engine.

`backend/authoring/routes.py` extracts the existing pure shape-preserving route sampler and compact canonical serializer. Both the goal revision and new recipe use those exact utilities. The original goal's reproduction check still returns byte-identical output. The new recipe explicitly authors every player's football assignment and bakes linear keys at 0.1 s plus route/event knots; runtime interpolation remains linear. Ball flight is authored independently from the dummy pose. No general route language or football physics engine was introduced.

From `backend/`:

```sh
uv run python -m authoring.invisible_run --check
uv run python -m authoring.untouched_pass
uv run python -m authoring.untouched_pass --check
```

The new fixture is **283,385 bytes**, SHA-256 `877de5ba96de6b8c50d7c4c05725665b87119927c4280cf1640c5fda98fad439`. Both existing fixtures remain byte-identical:

- The Invisible Run: `8d2667ffaf9b1475ef40acfc8aa2f5319011abb14e22c2a80208139f3f9b7e30`.
- The Missed Chance: `edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9`.

The [authoring audit](benchmarks/phase-3d-authoring.json) retains per-player diagnostics, touch checks, event synchronization, defensive shape samples, pressure measurements and source hashes. Minimum exact tracking-centre spacing across all pairs and linear segments is **1.3713 m**. Maximum player speed is **5.8910 m/s**; maximum 0.5 s-window acceleration/deceleration is **4.3687 / 5.9992 m/s²**. Maximum heading rate is **1.8 rad/s**, and maximum running turn between adjacent keys is **0.4169 rad**. These are authoring diagnostics, not calibrated biomechanical measurements.

## Exact dummy contract

`Scenario.events` is a Pydantic discriminated union of ordinary `MatchEvent` and `DummyEvent`, selected by `type`. The latter retains all common event fields and requires:

```json
{
  "id": "dummy",
  "t": 6.65,
  "type": "dummy",
  "actorId": "v9",
  "start": 6.12,
  "end": 7.02,
  "passEventId": "pass",
  "receiveEventId": "receive",
  "nonContact": true,
  "possessionTransfer": false
}
```

The example shows the identifying/semantic fields; the fixture also carries the ordinary label, detail, participants and key-moment flag. `t` means ball passage, **not contact**. Start/end bound the body presentation. The actor must exist, belong to the participants and be distinct from the real passer and receiver, on their team. The linked events must be pass/reception, with `pass.t < start < t < end < receive.t`. Pass release explicitly clears possession; no intervening owner or contact event is accepted. The real reception must identify its owner. Backend and frontend reject invalid flags, references, times and possession. The dummy never becomes a `FootballAction` with a kicking foot or contact target.

This is an **additive version-1 extension**: every legacy scenario still validates unchanged, coordinates and replay/evidence semantics are retained, and the repository's generated consumers are upgraded together. It is not a claim that older compiled clients with a closed event enum can render a new dummy without updating their generated types. Pydantic remains authoritative; OpenAPI and TypeScript were regenerated through `export_openapi.py` and `pnpm generate:api`.

## Skeletal animation and clearance

`dummy.ts` derives a separate typed pose sample from the authored event and absolute replay time. The existing pose layer opens the legs, lowers the pelvis by 0.16 m, shifts weight by a bounded 0.025 m during anticipation, flexes the knees, sets balanced arms and smoothly returns to locomotion. Both ankles use fixed stance targets; neither leg targets the ball. The actor's canonical root and yaw remain untouched.

The [animation audit](benchmarks/phase-3d-animation.json) retains these measurements and the short-contact samples. The authoritative ball radius is **0.16 m**. The clearance test skins **every mesh vertex** and measures the sphere against **every body triangle**, plus separately classified leg/boot triangles, over the **complete 6.12–7.02 s interval** on a **5 ms grid** with event/key endpoints (182 evaluated times). Local ball coordinates account for the actual canonical root, heading and renderer's 0.01 m visual height. It samples between authored keys, not just at passage.

| Measurement | Final measured result |
| --- | ---: |
| Minimum ball-sphere / complete body surface gap | **133.73 mm** |
| Left / right leg surface gap | **133.73 / 134.04 mm** |
| Left / right boot surface gap | **176.17 / 175.64 mm** |
| Minimum boot height during complete action | **−1.59 mm**, during a blend |
| Maximum planted sole-anchor XZ drift, 6.4–6.8 s | **0.21 mm** |
| Maximum ankle stance width | **0.7206 m** |
| Maximum deformed vertex distance from culling centre | **1.0615 m** |
| Existing culling sphere radius | **2.35 m**, unchanged |

No ball/body overlap occurs in those samples. The ball visibly travels through the opening in the actual mounted mesh. The positive margin is much larger than the ball's approximately 54 mm travel between 5 ms samples. These are dense sampled surface checks, not an all-time theorem or a collision-response simulation.

Active contact/dummy actions now check exact skinned boot vertices for ground correction; ordinary locomotion keeps the cheaper joint probes. Both the correction method and its cap enter smoothly with pose weight. Maximum pelvis lift remains bounded at 0.09 m for actions, 0.06 m for ordinary motion and 0.14 m for keepers. A strengthened boundary test found a 3.59 mm jump when the cap changed abruptly at dummy recovery; blending the cap resolved it without loosening continuity assertions.

Lorne's existing grounded keeper reaction clears the ball surface by **0.3423 m** at its closest sampled instant (7.76 s), with minimum mesh ground height **+0.15 mm** and maximum culling radius **1.4399 m**. No airborne save, block or deflection is added. Contact poses retain small stylized mesh offsets: the third scenario's nearest boot-vertex gaps are approximately −4.12 mm (Wren pass), −9.51 mm (Bellamy receive), +7.56 mm (Bellamy pass), +2.92 mm (Merrick receive) and +3.57 mm (shot). Negative values here mean small contact-pose overlap; they do not affect the separate non-contact dummy result.

Exact bone snapshots reproduce under arbitrary forward/backward seeking, repeated sampling, parent transform changes, direct passage jumps, remounts, camera changes and scenario return. Angular/positional continuity uses actual quaternion angle, since `q` and `−q` represent the same rotation; exact seek equality still compares all bone values without tolerance.

## AUD-03: short action intervals

Midpoint-bounded same-player windows remain disjoint, but fixed fades no longer suppress close contact peaks. Fade-in is `min(0.18, contact-start)`; fade-out is `min(0.25, end-contact)`. Presentation trajectory time is compressed to the available interval so the intended contact target remains at elapsed time zero. Canonical events and ball tracks are never retimed by animation.

Contacts within **10 microseconds** are treated as coincident: shot > pass > receive; equal kinds use lexicographic event ID. The same-time receiving owner can identify a resulting strike. This deterministic presentation policy resolves contradictory poses; it does not invent an extra touch.

| Receive → shot separation | Both contact weights | Receive triangle-surface gap | Shot triangle-surface gap |
| --- | ---: | ---: | ---: |
| 0.1 s | 1.0 | +2.92 mm | +6.45 mm |
| 0.2 s | 1.0 | +2.92 mm | +9.42 mm |
| 0.4 s | 1.0 | +2.92 mm | +6.45 mm |
| 1.2 s | 1.0 | +2.92 mm | +3.57 mm |

All four cases pass exact direct-seek equality, actual contact-frame boot triangle geometry, ground checks and smooth boundary tests. The six original contacts retain their types, possession-backed actors and canonical times; the third showcase adds five contacts. Angled delivery targets account for boot orientation. There is still a brief zero-weight locomotion handover at the midpoint rather than a new contact-transition framework.

## Tactical evidence and guided replay

The same Python engine computes **7 moments, 50 observations, 172 frames and 6 temporal links**. The dummy reuses the existing **corridor** category. Its observation links `pass`, `dummy`, `receive`; it records exact simultaneous tracking-centre closest approach (**0 m at 6.65 s**) and real receiver arrival **0.55 s later**. Tracking-centre proximity does not establish physical clearance. The event records non-contact semantics; skeletal triangle clearance remains simulated-presentation verification, outside the tactical metrics.

The actual pass has **1.6786 m** minimum moving-defender clearance and **2.1448 m** static release clearance, classified clear under unchanged 0.9 m half-width / 0.6 m contested-margin thresholds. This is not a completion probability. At the shot, Arden is **1.6553 m** from Merrick and Reid **2.1840 m**, both closing from larger separations. Pressure, defensive movement, cover and arrival are canonical tracks, not cosmetic root offsets or inferred thoughts.

The authored dummy moment has its own scenario/moment-scoped copy. **Show me in the replay** resolves the current source-validated corridor evidence, uses 6.0–7.85 s at visibly declared **0.5×**, and highlights Ellery, Merrick, Bellamy, Reid and Arden. An incoming oblique pose in the existing broadcast camera sampler exposes the leg opening and runner behind it. The actual pass trace remains visible. Replay, pause/resume, close, back to analysis, manual seeking, camera changes and scenario switching use the existing interruption/restoration lifecycle. No second store or camera-control system exists.

Broadcast, tactical, Ellery POV, Merrick POV and Reid POV were exercised. Simulated gaze does not establish observed attention. The full frontend nested evidence-validation boundary and the two older showcases' authored wording remain intact and regression-tested.

## Verification and visual artifacts

Final automated results:

- Backend: **81 passed, 1 skipped**; Ruff passes; both authoring comparison checks pass. The skip is the existing optional external SkillCorner dataset. The existing Starlette/httpx deprecation warning remains.
- Frontend: **172 Vitest tests across 11 files**, typecheck, ESLint and production build pass.
- Chrome: **43 Playwright tests pass** across all three showcases, including ordinary 1× playback, exact rendered bones, POV, mobile emulation, guided replay interruptions/restoration, source/evidence rejection and resource cleanup. The final complete Chrome run passed all 43 tests in 3.9 minutes after the last functional pose change.

The relocated virtual environment retained entry-point shebangs pointing to the old folder. Validation used `uv run python -m pytest`, `python -m ruff` and `python -m uvicorn` with the existing installed environment. The stale local Vite/API processes were restarted against the verified checkout. No dependency/version change was needed.

Reproduce captures from `frontend/`, against the ordinary API/Vite servers:

```sh
node scripts/capture-untouched-pass.mjs
```

Artifacts remain in ignored `output/phase3d/`:

- [Continuous broadcast at 1×](../output/phase3d/broadcast-continuous-1x.webm), [tactical at 1×](../output/phase3d/tactical-continuous-1x.webm), and [Merrick follow at 1×](../output/phase3d/follow-continuous-1x.webm).
- [Guided dummy recording at declared 0.5×](../output/phase3d/guided-dummy-half-speed.webm).
- [Guided dummy framing](../output/phase3d/guided-dummy.png), [actual ball between the legs](../output/phase3d/dummy-close-6.65.png), and [shot with closing defenders](../output/phase3d/broadcast-7.42.png).
- [Ellery POV](../output/phase3d/pov-v9.png), [Merrick POV](../output/phase3d/pov-v10.png), [Reid POV](../output/phase3d/pov-t5.png), and [mobile guidance](../output/phase3d/mobile-guided.png).
- `dummy-clearance.json`, `short-contacts.json`, `visual-review.json`, `baseline.json`, `after-benchmark.json` and frame-review sheets.

The recordings use the real advancing clock, with setup footage before playback; they are not seek-based substitutes or artificially accelerated clips. Whole-sequence frame reviews and dense passage/finish frame reviews were inspected. The opening progresses purposefully, the dummy opens before arrival, the ball continues visibly, Merrick's short control/shot follows its path, and defenders recover while Lorne reacts. Ordinary broadcast bodies remain relatively small; the guided and inspection views expose the mechanics. The final recordings and whole-sequence sheets were refreshed after the final pose changes. Dense guided-passage and player-follow finish sheets expose the opening, quick contact, closing defenders and keeper response. No browser/shader errors were recorded.

## Performance and bundle review

A fresh pre-animation baseline and final comparison use installed headless Chrome **155.0.8059.85**, a 1440×1100 CSS-pixel viewport, DPR **1.5**, 22 rigs, **3 s active warmup and 15 s live playback** per case. Other capture/test browsers were closed during profiling. Each sequence loops once; the new clip has a different phase distribution from the old fixture. The baseline is specifically Invisible Run/broadcast; other after rows compare scenario/view cost rather than a matched pre-change camera baseline. Raw and bundle results are retained in [phase-3d-performance.json](benchmarks/phase-3d-performance.json).

| Case | Mean frame ms | Median / p95 ms | Frames >25 ms | Mean draw calls | Geometries / textures before → after switches |
| --- | ---: | ---: | ---: | ---: | --- |
| Invisible / broadcast, baseline | 16.7404 | 16.7 / 16.7 | 2 | 92.009 | 58 / 27 → 58 / 27 |
| Invisible / broadcast, final | 16.6661 | 16.7 / 16.8 | 0 | 92.014 | 58 / 27 → 58 / 27 |
| Invisible / tactical, final | 16.6660 | 16.7 / 16.7 | 0 | 92.052 | 60 / 27 → 59 / 27 |
| Untouched / broadcast, final | 16.6660 | 16.7 / 16.7 | 0 | 88.073 | 57 / 27 → 57 / 27 |
| Untouched / tactical, final | 16.6659 | 16.7 / 16.7 | 0 | 91.502 | 59 / 27 → 58 / 27 |

Final runs deliver about **60 rAF FPS**, one GLB request, 22 rigs and zero browser/shader errors. Textures remain **27**; geometry counts are bounded and can decrease when the new view culls unused resources. Mean triangles including shadow passes are approximately 575.6k / 556.2k for the old scene and 547.1k / 559.8k for the new scene. Scenario-switch probes are **69.1–100.1 ms** final, versus **65.1–90.7 ms** in the fresh broadcast baseline. Those short mount measurements include development/GC variability; they do not establish an isolated regression. Repeated guided replay resource equality and scenario cleanup also pass in Chrome.

The matched mean and draw counts show no observed rendering regression at this refresh ceiling. The slightly better average does not establish a causal performance improvement, and the 0.1 ms p95 change is reported rather than hidden. No remote-network or physical-device startup claim is made.

The production main chunk is **746.54 kB / 181.57 kB gzip**; lazy WebGL is **1,017.33 kB / 274.68 kB gzip**. The warning originates in the existing lazy Three.js/R3F/Drei replay dependency graph; the new baked raw fixture also increases the eagerly loaded registry data in the main chunk. The warning remains visible and its threshold is unchanged. A fresh untouched-HEAD build in `/tmp`, using the same installed dependencies, measures **460.14 kB / 119.98 kB gzip** main and **1,015.26 kB / 274.12 kB gzip** WebGL. Phase 3D therefore adds about **286.40 kB raw / 61.59 kB reported gzip** to main, almost entirely the baked canonical fixture, and **2.07 kB raw / 0.56 kB gzip** to the lazy renderer. These are Vite-reported gzip sizes, using the same build method. The extra eagerly loaded data is a real payload cost; remote-network impact was not measured. The existing synchronous registry is retained because no significant local frame/resource regression was measured and unrelated bundle restructuring was out of scope.

No unrelated bundle restructuring was performed. Geometry, rig, clips, textures and pooled-material architecture remain shared. Triangle comparisons reflect camera culling and player placement, not a new stadium or character mesh. Refresh-limited frame delivery does not establish GPU headroom or physical-device performance.

## Limits and review state

This is stylized synthetic reconstruction with piecewise linear runtime tracks and procedural skeletal poses over the shared jog asset. It is not motion capture, measured athlete intent, a physical ball solver, a full-body contact simulation, a calibrated goalkeeper model, a counterfactual or an AI explanation. Small boot/ground/contact offsets are disclosed above. Dense sampling and visual inspection support the authored dummy; they do not prove all possible future geometry. Extremely short but distinct contacts preserve exact poses, though their fast preparation is presentation rather than a biomechanical simulation. AUD-04 remains deferred because the new roster uses only numbers supported by the current atlas. Mobile checks are Chrome viewport/touch emulation, not physical-device testing.

The working tree contains the implementation, generated contracts, tests, measurements and documentation for review; no commit or push was made. Historical reports and benchmarks were retained. 

## Changed files

- `README.md`
- `backend/authoring/invisible_run.py`
- `backend/authoring/routes.py`
- `backend/authoring/untouched_pass.py`
- `backend/openapi.json`
- `backend/tactics/guides.py`
- `backend/tactics/models.py`
- `backend/tactics/service.py`
- `backend/tests/test_multiscenario.py`
- `backend/tests/test_untouched_pass.py`
- `docs/CHARACTER_ANIMATION.md`
- `docs/FOOTBALL_ACTIONS.md`
- `docs/PHASE_3D_UNTOUCHED_PASS.md`
- `docs/REPLAY.md`
- `docs/TACTICAL_ANALYSIS.md`
- `docs/benchmarks/phase-3d-animation.json`
- `docs/benchmarks/phase-3d-authoring.json`
- `docs/benchmarks/phase-3d-performance.json`
- `frontend/scripts/capture-untouched-pass.mjs`
- `frontend/src/api/schema.d.ts`
- `frontend/src/replay/ReplayScene.tsx`
- `frontend/src/replay/animation/animationSampler.ts`
- `frontend/src/replay/animation/characterAssets.ts`
- `frontend/src/replay/animation/dummy.test.ts`
- `frontend/src/replay/animation/dummy.ts`
- `frontend/src/replay/animation/footballActions.test.ts`
- `frontend/src/replay/animation/footballActions.ts`
- `frontend/src/replay/animation/footballPose.ts`
- `frontend/src/replay/camera.ts`
- `frontend/src/replay/scenario.ts`
- `frontend/src/replay/types.ts`
- `frontend/src/replay/untouched-pass.json`
- `frontend/src/tactics/guided.ts`
- `frontend/src/tactics/presentation.ts`
- `frontend/tests/untouched-pass.spec.ts`

