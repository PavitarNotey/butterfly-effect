# Phase 3B.2 visual refinement — camera framing and scale

Implemented on `main`, starting from clean `8fadbc4` (full-team skeletal animation). No commit or push was made. Both Phase 3A scenarios, all 44 roster identities, the shared replay clock, canonical JSON, ball trajectories, backend and tactical evidence remain unchanged. No assets or dependencies were added; the existing CC0 rig and clips are documented in [CHARACTER_ANIMATION.md](CHARACTER_ANIMATION.md).

This is the **Phase 3B.2 framing audit**. Its before/after measurements, screenshots, commands and milestone-scope statements are historical results, not measurements of the current Phase 3C/3C.1 build. The camera geometry remains the basis of the current replay; later POV gaze, player-follow, guided framing and presentation transitions are summarized below and detailed in [the Phase 3C experience report](PHASE_3C_EXPERIENCE.md).

[Phase 3C.2](PHASE_3C_2_GOAL_REVISION.md) later reauthors the goal scenario to 13.2 s. Automatic focus samples those revised tracks without a new camera rig or zoom setting; the framing and scale measurements below still describe the original Phase 3B.2 source.

## Player-scale audit

`frontend/scripts/audit-framing.mjs` reads the actual GLB and evaluates every skinned vertex in world space, then repeats precise live-scene bounds for all 22 players in each scenario at 0, 9 and 14 seconds.

- Bind-pose height: **1.819586515 m** on the **105 × 68 m** pitch. This meets the requested 1.75–1.90 m range. All characters retain unit world scale (floating-point tolerance).
- Imported bind sole Y: **−0.009509850 m**. The existing **+0.010 m** visual-child offset places the standing sole **0.000490150 m** above the Y=0 grass. There is no scale/origin correction to make.
- Maximum canonical player-root error across all 132 sampled player frames: **0 m**. The camera changes introduce no animation or world-transform changes.
- Posed mesh heights range **1.4673–1.8205 m**, because articulated running poses bend knees and lower the body. These are posed bounding boxes, not differing player scales.
- Existing locomotion sole minima range **−0.0412 to +0.2595 m** relative to canonical ground. The upper values occur during moving/airborne poses; the lower values expose up to 4.1 cm of sole penetration. Standing origin is correct, but precise planted-foot contact is an existing animation limitation. This camera refinement does not add IK or change the gait.

Audit JSON is saved under `output/framing/{before,after}/scale-audit.json` and produces identical height/contact/root measurements before and after.

## Camera behavior and implementation

| Mode | Before Phase 3B.2 | Phase 3B.2 automatic framing (desktop) |
| --- | --- | --- |
| Broadcast | Y=38 m, Z offset=53 m, FOV=49°; restrained X-only ball focus | Y=24 m, Z offset=32 m, X offset=−7 m, FOV=44°; active-play focus in both X and Z |
| Tactical | Fixed overhead Y=96 m, FOV=68° | Focused overhead Y=48 m, FOV=48° |
| Full pitch | Previously the Tactical button | Original fixed overhead Y=96 m, FOV=68°; viewport compensation keeps all pitch corners visible on narrow screens |
| Player POV | Recorded root/heading, eye=1.68 m, FOV=84° | Root/heading framing preserved at this milestone, including hidden POV player and suppressed name labels; Phase 3C later added simulated gaze |

At Phase 3B.2, the camera bar added **Full pitch** and a small overhead help/reset row. **Tactical** and **Full pitch** accept mouse-wheel zoom toward the cursor and left-drag pan. A five-pixel drag threshold preserves ordinary mesh clicks; completed pans suppress selection clicks. Manual height is bounded to **16–110 m**, center X to **±49.5 m**, center Z to **±31 m**. These are center limits; a wide manual view can still show the surroundings. In the current UI, a six-pixel R3F click threshold and pan's captured-gesture suppression keep direct player selection separate from dragging.

**Follow play** restores automatic tactical framing; **Reset view** restores the overview. Choosing a camera mode or scenario clears the manual override. Seeking, pausing, playback-speed changes and restart preserve an explicit manual view, without touching time anchors. Manual controls only apply over the canvas in overhead modes; playback and other page controls retain their behavior. Touch-specific pan gestures and keyboard camera navigation are not added.

`camera.ts` builds a small immutable scenario-derived focus track: a spatial envelope of authored relevant actors and the ball, biased toward the ball and softly weighted nearby players. This retains wide decoys and their markers without selection-dependent cuts. A symmetric one-second temporal filter is sampled on a 0.25 s grid, then cubic interpolation smooths velocity through keyframes. Both supplied scenarios have positive 20 s durations. The scenario-object WeakMap stores only derived focus samples, never playback history.

Automatic pose is **scenario + mode + absolute replay time + viewport aspect → camera pose**. There is no delta accumulation, damping state, physics or asynchronous camera target selection. Narrow-screen compensation increases distance to preserve horizontal context. **At Phase 3B.2**, explicit camera switches were immediate cuts and automatic playback motion was continuous. Current user-triggered switches **between non-POV modes** use a 280 ms wall-time presentation blend; settled poses still equal the pure sampled pose. POV switches anchor immediately, and resuming paused POV free-look blends orientation back over 220 ms. Reduced-motion mode skips these transitions. None retimes players or the ball.

`CameraRig` evaluates at frame priority −50, after the shared clock (−100) and before projected labels/normal scene callbacks. Overlays retain their original world geometry and evidence. Selected labels cap their scale at 1 and hide when their projected anchor is outside the viewport, keeping them usable with closer cameras.

Implementation files: `camera.ts`, `TacticalCameraControls.tsx`, small store fields/actions for the manual override, `ReplayScene.tsx`, and the camera bar/help in `App.tsx`/`App.css`. The replay time/store architecture and all character resources are preserved.

### Current Phase 3C/3C.1 camera interaction

POV still uses the canonical player root, but `sampleGaze` adds bounded ball/event-relative attention and small deterministic field scans to recorded facing. This is an illustrative camera choice, not proof of human gaze. Paused POV offers separate mouse/touch/keyboard free-look, retaining its offset while seeking; playback resume returns to simulated gaze. Third-person **Follow Player** is an explicit `follow:{playerId}` mode. Clicking a player selects them and opens an action card; only **View POV** or **Follow Player** changes camera. The searchable, team-grouped picker uses the same selection state. Guided evidence replay may temporarily choose tactical framing and relevant actors, then restores the prior camera/selection on close; deliberate camera, player, pan, speed or scrub actions interrupt it at the current time. Paused POV free-look owns a separate pointer surface, while tactical panning owns overhead drags. See [REPLAY.md](REPLAY.md) for current clock/selection behavior.

## Demo and screenshot evidence

Use the existing API on port 8000 and `cd frontend && pnpm dev`, then open http://localhost:5173. Try both scenarios at 0, 3, 9, 10.4 and 14 seconds. Compare Broadcast, Tactical and Full pitch; wheel/drag overhead, then restore Follow play. Select either team's mesh or choose a POV. Analyze this moment still shows the original passing corridors, movement, space and relationship evidence.

Matching screenshots at **9 and 14 s**, both scenarios and both original modes, are under `output/framing/before/` and `output/framing/after/`. After includes the retained Full pitch mode. Open **`output/framing/comparison.html`** for side-by-side before/after images. The capture viewport is 1440×1100 CSS pixels, DPR 1.5; the actual replay canvas is approximately 1064×605 CSS pixels.

Reproduce the scale audit/screenshots against a running development server:

```sh
cd frontend
node scripts/audit-framing.mjs after
```

The `before` capture was run on unmodified `8fadbc4` before runtime edits. Re-running `before` on the changed checkout would overwrite that evidence with the current cameras; use the original baseline checkout for a fresh comparison.

## Validation and performance

Passed: **44 unit tests and 20 full browser tests**, plus typecheck, lint and build. Frontend commands from `frontend/`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Unit tests cover ball visibility throughout both complete sequences and multiple viewport aspects, key-actor framing, full-pitch corners, continuous focus velocity, history/speed-independent camera poses, finite endpoints, bounded manual state and reset semantics. Browser tests cover both teams, actual mesh clicks, projected label alignment, wheel/pan, scroll suppression, seek/speed invariance, reset, both scenarios, POV and all existing tactical, timeline, fallback and resource regressions.

No backend/scenario code changed, so backend tests were not rerun. Build retains the existing large lazy 3D-chunk warning (~1 MB uncompressed).

Performance comparison uses the existing verified benchmark harness, installed headless Chrome, 1440×1100 CSS pixels, DPR 1.5, 22 skeletal players, five seconds active warmup and twenty seconds active replay per scenario/camera. Browser inspection and tests are closed during the isolated measurement. It asserts live ball movement and records draw calls/triangles including shadow passes, frame intervals, resource counts and errors. Frame intervals measure rAF delivery, not GPU execution time or portable device performance.

```sh
cd frontend
node scripts/benchmark-characters.mjs --modes=skeletal --dprs=1.5 --scenarios=the-invisible-run,the-missed-chance --output=../output/benchmarks/framing-after.json
```

Raw before/after results are in `output/benchmarks/framing-{before,after}.json`. Results on available desktop, Chrome 155.0.8059.85 (before → after):

| Scenario / view | rAF FPS | p95 frame ms | Mean draw calls | Mean triangles (incl. shadows) |
| --- | --- | --- | --- | --- |
| Invisible Run / broadcast | 60.00 → 60.00 | 16.7 → 16.7 | 107.0 → 92.9 | 614.5k → 567.6k |
| Invisible Run / tactical | 60.00 → 60.00 | 16.8 → 16.7 | 124.0 → 92.9 | 635.0k → 547.8k |
| Missed Chance / broadcast | 59.90 → 60.00 | 16.8 → 16.8 | 107.4 → 94.1 | 619.3k → 581.1k |
| Missed Chance / tactical | 60.00 → 60.00 | 16.8 → 16.7 | 124.0 → 94.6 | 635.0k → 574.7k |

All four after cases delivered 1,200 measured frames, zero frames above 25 ms, 22 rigs, one GLB request and zero browser errors. No frame-delivery regression was observed at this refresh ceiling. Texture counts stayed 27; geometry counts stayed stable across scenario switches (59 broadcast, 61 focused tactical). The old wider views rendered more environment objects (71/79 geometries). These are object counts, not GPU memory byte measurements. New automatic framing also reduces visible draw calls and triangles.


## Remaining scope

The **Phase 3B.2 change** did not include Phase 3B.3 football actions, scale inflation, tracking edits or tactical changes. Automatic framing was tuned and checked for these two authored scenarios; new scenarios need their own framing validation. Peripheral players may leave focused views; Full pitch and manual pan remain available. The scale audit does not establish perfect planted-foot contact, and the headless desktop timing does not establish performance on other hardware.
