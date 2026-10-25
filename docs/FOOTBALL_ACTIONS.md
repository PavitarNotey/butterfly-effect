# Phase 3B.3 — event-synchronized skeletal football actions

Current action blending and the separate non-contact dummy pose are documented in the Phase 3D section below and the [engineering report](PHASE_3D_UNTOUCHED_PASS.md). Earlier contact tables and benchmark results remain historical.

This document records the **Phase 3B.3 implementation and its historical measurements**. Its license/source audit, actor assignments, contact clearances, benchmark, screenshots and test counts refer to that checkout. Current Phase 3C/3C.1 presentation also adds goalkeeper, defender and outcome reactions, guided replay, simulated POV gaze and an explicit player-selection card; see [the current experience report](PHASE_3C_EXPERIENCE.md). The six pass/receive/shot actions described below remain distinct from those later reactions.

[Phase 3C.2](PHASE_3C_2_GOAL_REVISION.md) intentionally retimes the goal contacts to pass 4.4 s, receive 5.6 s and shot 6.8 s. Adjacent same-player action windows are now bounded at their contact midpoint to blend the quick reception/shot. The historical six-contact table and measurements below remain Phase 3B.3 findings.

## Baseline and scope

Started on `main` at the expected **`fb4518a`**, with no tracked modifications. The untracked `.agents/` skill installation and `skills-lock.json` were preserved. No commit/push, cloud resources, AI integration, dependency additions, camera redesign or backend changes were made.

The two 22-player scenarios keep their original positions, facing, ball tracks, event/possession timestamps, outcomes and tactical evidence. Existing camera modes, manual tactical controls, selection, labels, POV hiding, fallback, kit pooling, independent skeletons and replay-clock architecture remain intact.

Available tools: Context7 MCP and existing local Playwright/agent-browser tooling. Chrome DevTools MCP and Playwright MCP endpoints were **not exposed** in this session; installed headless Chrome via the existing Playwright harness completed captures/tests/benchmarking. No duplicate browser installation was made. The Microsoft Foundry skill is available but was not invoked for deployment or AI integration.

## Action source and license decision

Actions are **original procedural skeletal poses** over the existing licensed locomotion clips. No new GLB, texture or clip was added. The runtime asset remains `frontend/public/characters/football-player.glb`, 877,424 bytes, 14,318 triangles, 65 bones, one skinned primitive; SHA-256 **`55780a107e0f257a4f2f88eef2923c945923ebe62a39f9d6a0380568953bf7a5`**. The standing bind height remains 1.819586515 m at unit scale.

The original animation archive was accessible at `/tmp/butterfly-quaternius-animation.zip`. Its SHA-256 **`cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`** matches the previously reviewed release. Its own `License.txt` and `README.txt` explicitly state **CC0 1.0** and distinguish the in-place file from `_RM` root motion. Existing exact notices remain in [animation license](assets/quaternius-animation-license.txt) and [base license](assets/quaternius-base-license.txt); see [asset provenance](CHARACTER_ANIMATION.md).

Inspected the in-place GLB's 43-clip inventory and the compatible named hierarchy. It contains idle/walk/jog/sprint, jumps, crouching, social/interaction, punching, pistol/sword/spell, swimming and other general actions, **no football pass/control/kick**. Jump_Land and crouching do not encode the required planted support/ball-contact phases. No vaguely named weapon/shooting clip was relabeled as football, and no uninspected clip suitability is claimed. The existing compatible idle/walk/jog clips are retained; custom poses provide the football mechanics. All incorporated source assets retain their prior public-repository redistribution rights; no licensing assumption about newer packs was needed.

## Canonical event/actor audit and action windows

`footballActions.ts` resolves pass/shot actors from possession immediately before an event and receives from the possession transition at contact, then verifies event membership. Participant order is deliberately irrelevant: the contextual defenders in `playerIds` never become actors. `goal` and `miss` are outcomes, not another kick. **In Phase 3B.3**, this action layer assigned no goalkeeper save/dive actions. The current reaction layer gives Holt a grounded partial lunge/reach and Moss a restrained tracking/reach response; neither changes the ball or claims a save, block or deflection. There is still no full airborne dive or physical contact model.

| Scenario | Actor | Kind | Start | Contact | Recovery end | Foot |
| --- | --- | --- | --- | --- | --- | --- |
| Invisible Run | Theo Linden `a8` | pass | 8.45 | 9.00 | 9.70 | left |
| Invisible Run | Leon Voss `a9` | receive | 10.00 | 10.40 | 11.05 | left |
| Invisible Run | Leon Voss `a9` | shot | 13.20 | 14.00 | 14.95 | right |
| Missed Chance | Silas Marr `s8` | pass | 7.95 | 8.50 | 9.20 | left |
| Missed Chance | Arlo Finch `s9` | receive | 9.80 | 10.20 | 10.85 | left |
| Missed Chance | Arlo Finch `s9` | shot | 14.20 | 15.00 | 15.95 | left |

All six ball centres at contact are **0.65 m ahead of the recorded player root in world X**, at Y=0.16 m and the actor's Z. These are the actual local targets after inverse authored yaw, not invented touches. Outgoing direction is sampled over the first 0.1 s after pass/shot; incoming direction over the last 0.1 s before reception. Side selection uses which side of the recorded heading contains the ball.

Preparation windows are 0.55 s pass, 0.40 s receive and 0.80 s shot; post-contact windows are 0.70, 0.65 and 0.95 s respectively. Canonical goal at 14.67 and miss at 15.72 remain unchanged and may occur during recovery from the existing shot.

## Pose mechanics and blending

`footballPose.ts` modifies the existing pelvis/spine/neck, arms and named thigh/calf/foot/toe chains. No presentation-layer scene root position/yaw or scale is changed.

- **Pass:** modest 0.23 m backward foot target, lower foot lift, inside-foot orientation, balanced arms and short follow-through. It is deliberately less forceful than a shot.
- **Receive:** lift/brace before contact, a foot path already moving toward cushioning at contact, then about 0.13 m withdrawal and lowering. No second forward kick or additional ball is introduced.
- **Shot:** 0.43 m backward target with ankle up to 0.42 m during wind-up, pelvis/shoulder counter-rotation, grounded support foot, then an extended follow-through target around 0.51 m ankle height. Both shooters share the same mechanics; outcome remains solely the authored ball track.

The existing leg segments measure roughly **0.4288 + 0.4588 = 0.8876 m**. Direct angular kicks cannot reliably plant and reach a ball 0.65 m from the root at the original hip height. A small, asset-specific analytic two-segment placement function therefore bends knees toward a forward pole and clamps reach below full extension. It is limited to action legs, with no solver iteration, framework, runtime retargeting, physics or extra dependencies. Hip lowering is bounded to 0.10 m for passes, 0.14 m for receptions and 0.12 m for shots. The canonical player root remains authoritative. Body/foot yaw cues are limited to 0.45 rad.

The support ankle is defined in contact-world coordinates during a short lock around contact (fully locked from −0.12 to +0.12 s), then smoothly released. Desired reach is clamped if necessary. The action trajectory uses smooth interpolation between preparation/contact/follow/recovery poses. Quaternion slerp and position lerp blend over locomotion with smooth weight ramps: 0→1 over the first 0.18 s, 1→0 over the final 0.25 s. At window endpoints the action is null. Fingers retain their compatible locomotion pose. Only small bone-level offsets are added.

## Deterministic evaluation and lifecycle

`scenario + player + absolute replay time → AnimationSample.action → bones` remains the authority. The typed sample includes kind, event/actor IDs, contact/window times, elapsed/normalized phase, weight, chosen foot, local ball/direction and support target. Scenario WeakMaps cache only immutable derived event definitions. There is no delta, speed, wall-clock, camera or previous-frame input.

The three paused Three.js actions still receive explicit times and weights and **`mixer.update(0)`**. All 65 raw pre-procedural bone positions/quaternions are restored before mixer evaluation and saved afterwards. This is necessary because the mixer can skip writing an unchanged binding; restoring only pelvis/spine would leak action offsets into subsequent samples. The procedural layer is always rebuilt from that raw pose and fixed bind references.

An initial browser regression exposed use of world-space helpers that climbed the replay parent and depended on the preceding rendered transform/decomposition. The final solver instead builds temporary **character-local matrices**, reads matrices directly, and never consumes the replay parent's prior world matrix. Normal rendering rebuilds actual world matrices after frame callbacks. Existing exact browser bone equality tests were preserved, not loosened; they pass across seeks, repeat contact, restart, speeds and scenario remounts. New tests explicitly vary parent position/yaw and require identical local bone transforms.

Skeleton/mixer ownership, shared geometry/clips/materials/atlas, reference-counted kit cleanup and idempotent disposal are unchanged. `validateCharacter` now also checks every action-chain bone needed by the layer, so an incompatible model retains the procedural fallback.

## Measured contact and ground behavior

The browser capture script measures the **actual deformed boot mesh**. Boot vertices are selected using the same bind-space Y<0.115 m region used for boots by the kit shader. Ground clearance uses its lowest deformed vertex. Ball clearance is the minimum distance from the canonical ball centre to deformed boot vertices **and fully boot-region triangles**, minus the actual 0.16 m ball radius. Negative clearance means sphere/boot overlap; positive means separation. This is a mesh-surface measurement, not a claim of physical ball contact or exact collision response.

| Scenario | Actor / action | Contact s | Boot–ball clearance mm | Support sole above ground mm |
| --- | --- | --- | --- | --- |
| the-invisible-run | `a8` / pass | 9.00 | -0.98 | 3.99 |
| the-invisible-run | `a9` / receive | 10.40 | -5.53 | 3.99 |
| the-invisible-run | `a9` / shot | 14.00 | +3.57 | 3.99 |
| the-missed-chance | `s8` / pass | 8.50 | -0.98 | 3.99 |
| the-missed-chance | `s9` / receive | 10.20 | -6.17 | 3.99 |
| the-missed-chance | `s9` / shot | 15.00 | +3.57 | 3.99 |

These small overlaps/separations remain visible at extreme close-up; do not describe them as mathematically exact contact. First-touch is the largest remaining overlap (~6.2 mm). The canonical ball keeps moving through the recorded contact frame and cannot be parked under a foot or retimed without falsifying the source.

Support-ankle XZ drift over contact ±0.08 s is below 0.001 mm in these samples (numerical noise). This measures ankle translation, not entire-sole sticking; a small rotational pivot is permitted. Stable heel/toe mesh anchors are also recorded: maximum measured support-sole XZ anchor drift over the same interval is **9.93 mm**, including the permitted rotational pivot. The short lock is not a guarantee of zero slide through the entire preparation/recovery window.

Ordinary locomotion uses cheap bind-derived boot probes on dominant foot/toe joints, applying only an upward pelvis correction capped at 0.06 m when the estimated sole penetrates the Y=0 pitch. Airborne feet are not pulled down. Exact skinned-vertex tests validate the result: **396 sampled player frames** (both rosters, nine times) have worst sole Y **−0.000228 m** (0.23 mm penetration), compared with the previous audit's 41 mm. Denser action-window sampling finds worst Y **−0.002117 m** (2.12 mm) during blends. These are sampled bounds, not an all-time mathematical guarantee; dominant-joint probes approximate blended skinning. Root/scale checks remain exact.

## Culling safety

Retained the original local sphere centred `(0, .95, 0)`, radius **1.65 m**, with `frustumCulled=true`. Tests examine every deformed vertex throughout all six action windows on a **0.025 s grid**, plus contacts/pose knots/endpoints. Maximum measured distance from the sphere centre is **1.13151 m**. Extended kicking limbs remain well inside the conservative envelope; no blanket culling disable or larger bound was needed. Existing idle/walk/jog vertex-envelope tests also pass. The sampler's finite values, normalized locomotion weights and continuity tests remain in place.

## Visual evidence and reproducibility

Against the ordinary API/frontend development servers:

```sh
cd frontend
node scripts/capture-actions.mjs after
```

`output/actions/after/` contains preparation (contact−0.25), contact and follow/recovery (contact+0.20) **broadcast and actual-player close-up** screenshots for each of the six events, plus ground/contact measurements at ±0.08 s in `contacts.json`. Both scenarios share the same capture conventions. Temporary close-up cameras use the established test-only inspection approach and restore the ordinary camera rig; the **Phase 3B.3 change** made no product camera changes. `before/` contains matching original-locomotion screenshots captured on unchanged `fb4518a`; `first-pass/` records the initial refinement pass. Re-running `before` on a changed checkout does not recreate the baseline.

Open **`output/actions/gallery.html`** for multi-frame, before/after comparisons. The capture viewport is 1440×1100 CSS pixels, DPR 1.5. Unit measurements are written to `output/actions/safety.json` and `ground.json`. Generated evidence stays under ignored `output/`. Optional live recordings use `node scripts/capture-actions.mjs after --video`: both broadcast sequences run from 7.8 to 16.3 s at half speed, including their canonical outcome, and save `the-invisible-run-live-half-speed.webm` / `the-missed-chance-live-half-speed.webm`. Playwright’s optional 1.4 MiB FFmpeg helper was installed into its external cache for recording (`pnpm exec playwright install ffmpeg`); no browser or application dependency was added.

Visually inspected preparation/contact/follow in broadcast and close-up for both sequences, prioritizing Voss's shot. The first pass exposed excessive boot overlap and a backward upper-body brace. Refined target clearance, torso flexion, downward neck cue and shot arm balance, then recaptured. Passing has a shorter/lower arc; reception withdraws the foot; shooting shows a larger backswing and raised follow-through. The broadcast remains an analysis framing rather than a cinematic close-up, so these small bodies reveal more mechanics when viewed in slow motion or the inspection captures. No detached limbs or action-specific culling failures were observed. After captures select the action actor in the ordinary UI. Close-up captures temporarily freeze the frame loop, so their DOM name label is suppressed to avoid a stale broadcast projection. Historical before captures retain the original default selection; camera framing is selection-independent. Product camera label alignment is tested in all ordinary modes. Style remains a generic shared athletic avatar, not motion capture. The existing peach kit can resemble skin tone in close-up because the original sculpted shirt is tight; kit colors/materials were preserved.

## Validation

From `frontend/`:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

**At Phase 3B.3, 49 unit tests and 21 full browser tests passed**, including six actor assignments, shuffled contextual participants, null actions outside windows, source-clip immutability, unchanged root/scale, independent/remounted skeleton poses, parent-transform independence, finite joint transforms, continuous boundaries, exact contact samples, boot-ground correction and action culling bounds. Browser checks included live-clock-to-direct-seek pose comparisons at 0.5×/1×/2×, actual bones at nearby action frames, restart/scenario return, canonical ball/roots, all cameras, selection/labels, manual tactical controls, evidence overlays, resources, missing/invalid asset fallback and one GLB/no external requests. The initial two exact-pose failures were fixed by isolated local evaluation; no tests were skipped or tolerances loosened to conceal them.

Build/typecheck/lint passed in that milestone. The lazy 3D chunk warning measured then was ~1,009 kB / 272 kB gzip. No runtime dependency was added.

Backend checks, despite no backend modifications:

```sh
cd backend
UV_CACHE_DIR=/tmp/butterfly-uv-cache /Users/pavitar/.local/bin/uv run --no-sync pytest
UV_CACHE_DIR=/tmp/butterfly-uv-cache /Users/pavitar/.local/bin/uv run --no-sync ruff check .
```

**59 passed, 1 skipped**, Ruff passes. The skip is the existing opt-in external SkillCorner data integration; the Starlette/httpx deprecation warning is unchanged.

## Performance

Fresh baseline was collected **before changing runtime animation code** using the existing benchmark script. The matching after run uses installed headless Chrome, 1440×1100 CSS pixels, DPR 1.5, 22 skeletons, 5 s active warmup and 20 s active replay for both scenarios and broadcast/focused tactical. Tests/capture browsers are closed during profiling. Each sample verifies live canonical ball movement through the complete sequence, including all action intervals, and records frame delivery, draws/triangles, resource objects and switch latency.

```sh
cd frontend
node scripts/benchmark-characters.mjs --modes=skeletal --dprs=1.5 --scenarios=the-invisible-run,the-missed-chance --output=../output/benchmarks/actions-after.json
```

Raw files: `output/benchmarks/actions-before.json`, `actions-after.json`. Measured on available desktop, Chrome 155.0.8059.85 (before → after):

| Scenario / view | Mean ms | Median / p95 ms | rAF FPS | Frames >25 ms | Mean draw calls |
| --- | --- | --- | --- | --- | --- |
| Invisible Run / broadcast | 16.666 → 16.750 | 16.7 / 16.7 → 16.7 / 16.8 | 60.00 → 59.70 | 0 → 5 | 92.94 → 92.97 |
| Invisible Run / tactical | 16.666 → 16.666 | 16.7 / 16.7 → 16.7 / 16.7 | 60.00 → 60.00 | 0 → 0 | 92.94 → 92.94 |
| Missed Chance / broadcast | 16.666 → 16.778 | 16.7 / 16.8 → 16.7 / 16.7 | 60.00 → 59.60 | 0 → 4 | 94.12 → 94.14 |
| Missed Chance / tactical | 16.666 → 16.666 | 16.7 / 16.8 → 16.7 / 16.8 | 60.00 → 60.00 | 0 → 0 | 94.64 → 94.64 |

Texture objects remain **27**, geometries **59 broadcast / 61 tactical**, and resources stay bounded after switching. Every case has 22 rigs, one GLB request and zero browser/shader errors. Triangles including shadow passes remain essentially the same: broadcast ~567.6k / 581.1k for Invisible/Missed, tactical ~547.8k / 574.7k. Slight broadcast averages differ with sampled frame distribution, not added geometry.

The two broadcast runs have a small mean-frame increase (~0.084 / 0.112 ms, under 0.7%); the tactical means and all median/p95 values remain at the refresh ceiling. Broadcast has five/four >25 ms intervals (longest streak three/two), versus none in baseline. The new bone/probe work adds CPU cost; these samples alone do not isolate whether those particular stalls are JS/GC, driver or OS scheduling. No causal GPU-headroom claim is made. Scenario-switch probes are **71.5–101.7 ms** after versus **57.8–115.9 ms** before: bounded but variable; extra controller/probe construction is additional CPU work. Treat the small mean regression and occasional stalls as a limitation, not a perfect uninterrupted-60-FPS claim.
 Refresh-limited rAF FPS is not GPU timing, unused GPU headroom or a cross-device guarantee. Geometry/texture counts are objects, not GPU byte measurements.

## Canonical integrity

Verified byte-for-byte unchanged against `fb4518a`: both JSON files, public character assets, replay store/camera/scene, all frontend tactical code and all backend files. Source SHA-256 values remain:

- Invisible Run: `cf9c02a7ae8638c89d1f88a19e7df34621e72ffa110c835b865e5a5315eb4e73`.
- Missed Chance: `edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9`.

No new tactical facts, evidence IDs or save/block/deflection claims are generated by animation. Recorded heading still does not establish awareness or intent.

## Files and next milestone

Modified: `frontend/src/replay/animation/animationSampler.ts`, `characterAssets.ts`, `docs/CHARACTER_ANIMATION.md`, `README.md`. Added: `footballActions.ts`, `footballPose.ts`, `footballActions.test.ts`, `frontend/tests/actions.spec.ts`, `frontend/scripts/capture-actions.mjs`, `docs/benchmarks/phase-3b3.json`, and this document. New assets: **none**. The benchmark comparison and safety measurements are also retained in `docs/benchmarks/phase-3b3.json`.

At the close of **Phase 3B.3**, the six synchronized skeletal actions were ready for visual acceptance, subject to the stylized contact/transition limitations above. First-touch posture/clearance and full-window support-foot transitions remained polish priorities without changing canonical tracks. Later Phase 3C reaction poses do not resolve those contact limitations.

The smallest later Observer → Tactical Analyst → Storyteller integration is a **sequential typed workflow**: Observer reads the selected canonical frame/event and existing validated evidence snapshot; Analyst selects/calculates only from existing deterministic evidence IDs; Storyteller verbalizes the validated result with source IDs and explicit uncertainty. Use Microsoft Agent Framework for orchestration and a Foundry-hosted model only in that separately authorized milestone. Validate every output reference against the selected scenario/source hash; reject unsupported location, awareness or causality claims. No Phase 4 implementation or cloud resource was created here.

## Phase 3D: close actions and a separate dummy pose

AUD-03 is resolved in the shared action sampler. Adjacent same-player windows still meet at their contact midpoint; fade-in is bounded by `min(0.18, contact-start)` and fade-out by `min(0.25, end-contact)`. Presentation trajectory time is compressed to the available preparation/recovery window, leaving canonical event time unchanged. Each distinct contact peaks at weight 1, with a smooth zero-weight handover. Contacts within 10 microseconds are treated as coincident: shot takes priority over pass, then receive; equal kinds use lexicographic event ID. Input order cannot select the winner. This is a presentation conflict policy, not an added physical touch.

The original six actions retain their types, actors and canonical contacts. The third scenario adds five contacts, including Merrick's 0.22 s receive/shot combination. Tests additionally cover 0.1, 0.2, 0.4 and 1.2 s separations, exact contact geometry, angular/positional continuity and exact direct-seek poses. Boot targets now account for boot orientation on angled deliveries. Exact active-action sole probes preserve ground contact during compressed blends.

The typed non-contact dummy has its own sampler and pose input, with no kicking foot or contact target. The ball follows the original pass continuously. The stance is 0.72 m across the ankles, with anticipation, modest weight transfer, knee bend, balanced arms and recovery; mesh triangle clearance, plant stability and culling are independently tested. See [the Phase 3D engineering report](PHASE_3D_UNTOUCHED_PASS.md) for current measurements and limits.
