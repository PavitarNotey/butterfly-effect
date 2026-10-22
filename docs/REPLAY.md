# Butterfly Effect — deterministic replays

The studio contains two original, handcrafted 20-second synthetic sequences: The Invisible Run (goal) and The Missed Chance (wide shot). AI, physics and deployment remain deferred. Phase 3B.2 renders all 22 players in both scenarios with independent imported CC0 skeletal characters; loading/error fallback mannequins and the environment remain procedural. See [character animation and asset licenses](CHARACTER_ANIMATION.md).

## Run and demonstrate

Run the API and frontend using the root README. Open http://localhost:5173.

1. Press Play and watch Aurora FC attack the right goal.
2. Pause or drag the timeline to any instant. Speed supports 0.5×, 1× and 2×.
3. Choose Tactical to inspect active play, or Full pitch for the complete shape. Overhead views support wheel zoom and drag-to-pan. Click a player or use the roster to select a player. Enable Movement trail to see that player's preceding six seconds.
4. Seek to **Defender shifts** (6 seconds), select **Dane Mercer**, then press **View from Dane's eyes**. Camera changes preserve replay time and playback state.
5. Switch back to Broadcast and seek **The finish** (14 seconds). Play through the goal (14.67 seconds). Seeking backwards restores score, ball position, possession and event text.

The API connection indicator and refresh control continue to work independently of the local replay. Both replays load without API or Azure credentials; measured tactical evidence requires the API.

## Canonical data

`frontend/src/replay/invisible-run.json` and `missed-chance.json` are the canonical sources for their respective scenarios. The original goal fixture is unchanged by 3A. `types.ts` aliases the generated version-1 Pydantic/OpenAPI contracts for the replay. See [tactical analysis architecture](TACTICAL_ANALYSIS.md).

Coordinates are metres in a right-handed world: X is pitch length, Y is height, Z is width. Origin is the pitch centre; length is 105 m, width 68 m. Aurora attacks +X. Player yaw is radians: 0 faces +Z, π/2 faces +X. Match time begins at 73:00, scenario time at 0 seconds. The fixture has a fixed seed identifier of 27 and uses no runtime randomness.

Each player has separate position and heading keyframes. Ball positions include height; possession changes and football events have their own timestamps. Loading validates the roster, IDs, timestamps, tracks and references. Position and ball tracks use linear interpolation; headings interpolate along the shortest angular arc. Outside the replay interval, sampling clamps to the endpoints. Displayed moment descriptions are authored scenario metadata, not computed tactical evidence or AI explanations.

| Time | Authored sequence |
| --- | --- |
| 0–3 s | Linden carries forward; Rowan begins in the inside-right channel. |
| 3–9 s | Rowan runs diagonally wide; Mercer shifts 5 m laterally, North drops to take the runner, and Pike narrows in central cover. |
| 9 s | Linden passes diagonally into the inside-right channel vacated by Mercer, before Pike can close it. |
| 10.4 s | Voss receives at (33, 0, 4.5), then carries toward the box with Pike and Mercer recovering goal-side. |
| 14 s | Voss shoots across the two recovering centre backs toward the far corner. |
| 14.67 s | The entire ball crosses X=52.5 inside the posts and below the crossbar. |
| 14.76–20 s | Ball settles in the net; players run out the sequence. |

Python fixture tests check that Mercer vacates the eventual passing lane, defenders clear the actual corridor at release, Voss is onside, touches occur within one metre of the relevant player, player speeds remain below 6 m/s, and the goal event matches the crossing. These are authoring checks, not a runtime tactical engine or proof of a player's intent.

## Clock and camera architecture

`store.ts` owns an anchor replay time, monotonic wall-time anchor, playing flag and speed. Time is computed as `anchorTime + elapsedWallSeconds * speed`, clamped to the duration. Pause, seek and speed changes rebase the anchors. Rendering never adds frame deltas to world positions.

One early R3F frame callback samples the clock once. Every player, the ball, trails and the camera consume that same sample. The UI samples the same clock on requestAnimationFrame for display only. The timer, native range value and elapsed-track fill all use that one display sample. End-of-replay playback stops; Play at the endpoint begins again. Restart returns to zero while preserving the playing/paused state. Pointer scrubbing freezes the anchored clock until release, then resumes only if it was playing before the drag. Releasing, cancelling, losing pointer capture or blurring ends the scrub idempotently and rebases wall time, so held time cannot turn into a jump. Keyboard/programmatic range inputs preserve playing/paused state. Moment buttons pause at their requested timestamp.

`camera.ts` computes poses directly from mode and time. Broadcast follows a closer smoothed active-play focus, Tactical follows that focus overhead, Full pitch preserves the original overview, and player POV uses recorded position and heading at a 1.68 m eye height. The POV player's mannequin is hidden, and name labels are suppressed in POV to prevent clipping. The automatic focus is sampled from scenario/time with no accumulated camera damping. Overhead wheel zoom and left-drag pan create a bounded manual override; Follow play / Reset view clears it. Mode and scenario changes also clear it; seeking, restart and speed changes preserve an explicit manual view. See [camera framing audit](CAMERA_FRAMING.md). There is no automatic ball-facing behaviour in player POV. A recorded heading does not establish awareness or intent.

## Verification

From `frontend/`:

```sh
pnpm typecheck
pnpm lint
pnpm test       # Vitest interpolation, clock and camera tests
pnpm test:e2e   # Chrome: health, mouse/touch timeline, mobile layout, mesh selection, playback and POV
pnpm build
```

From `backend/`:

```sh
uv run pytest
uv run ruff check .
```

Playwright starts missing development servers automatically and uses an installed Google Chrome. Existing servers are reused outside CI. WebGL is required. Browser tests fail on runtime or Three.js/WebGL errors in the main replay smoke flow.

## Current limits and next work

- Full-team skeletal idle/walk/jog locomotion, with the original procedural renderer available as fallback; no articulated kicks, goalkeeper dives or physics contacts. Ball tracks, rather than a physics engine, define every pass and shot.
- Piecewise linear tracks can change velocity at authored keyframes. No claim of motion-capture realism or full match simulation.
- Selected-player trails are separate from the optional tactical evidence overlays described in [TACTICAL_ANALYSIS.md](TACTICAL_ANALYSIS.md). No awareness inference is made.
- Camera cuts are immediate, preserving exact reproducibility. On narrow/mobile viewports the broadcast view crops more of the pitch; desktop is the primary demo target.
- The lazy-loaded 3D chunk is approximately 1,001 kB (269 kB gzip). Vite reports a nonblocking chunk-size warning. Rendered, inspected and benchmarked in local Chrome; cross-device frame rates remain unmeasured. See [the character benchmark](CHARACTER_ANIMATION.md).
- Pydantic/OpenAPI scenario contracts and deterministic Python tactical evidence are now implemented. A later milestone can improve touch/finish poses using authored event data. Profile before adding more scenes.

## Timeline and defensive-shape repair

The original clock advanced correctly in Chrome, but every range change called `pause()` and there was no scrub-release lifecycle. A mouse regression reproduced the replay remaining paused after dragging during playback. The native Chrome track also had no explicit elapsed fill. Earlier smoke tests used `fill()` and did not exercise pointer down/move/up. The range remains a real controlled input: its value and CSS fill derive from `readTime()`, with pointer capture and a store-owned scrub session. No independent progress animation or frame-delta simulation was added.

Defensive assignments are authored in position and orientation keys, rather than runtime reactions:

| Time | Rowan / Mercer | Cover and channel |
| --- | --- | --- |
| 0 s | Rowan (25, 4); Mercer (29, 3), goal-side and just inside. | Back four span X=29–30, Z=-17–16. Pike (30, -6) covers Voss; Frost screens in front. |
| 3 s | Rowan begins the diagonal run; Mercer stays goal-side. | North holds the outside lane; Pike starts narrowing; Beck presses Linden. |
| 6 s | Rowan (31, 9); Mercer (33, 6.5), inside and goal-side. | North (34, 15.5) drops toward the runner; Pike (32, -4) covers centrally. |
| 9 s | Rowan (35, 14); Mercer (36, 8.5). | North (37, 16.5) takes the wide runner. Pike (34.5, -1.5) narrows, but Linden's diagonal pass reaches Voss at (33, 4.5). |
| 10.4–14 s | Mercer recovers inside instead of chasing Rowan to the corner. | Pike closes goal-side, Frost recovers behind Voss, Ash tucks in on the weak side. Voss shoots through the gap before the centre backs can block. |

The final shot begins at 14 s; Holt holds his set position through 14.18 s and then makes a late lateral response. The whole ball crosses at 14.67 s. The sequence remains 20 seconds long. These assignments describe authored geometry, not player psychology or a claim of perfect defending.

Python validation checks continuous closest approach for every player pair (including between authored keys), speed and heading-rate bounds, changes of travel direction, compact defensive lines, goal-side cover, possession proximity, the moving defenders' clearance during the pass, shot clearance, and whole-ball goal crossing. Browser regressions cover real mouse dragging, trusted Chromium touch events, keyboard seeking, restart, camera changes, scene changes, speed, and browser errors. Key-frame screenshots are saved to `output/playwright/defence/` for broadcast, tactical, and Mercer POV at 0, 3, 6 and 9 seconds.

The selected-player name label keeps its existing visual treatment but is now projected into the page’s existing DOM root. This removes the installed Drei Html component’s synchronous nested-root unmount error under StrictMode and player/camera changes. Camera poses, lighting, pitch geometry and mannequin rendering were preserved.

## Tactical intelligence milestone

The optional tactical mode adds Python-calculated passing corridors, displacement arrows, coverage boundaries, linked players and a contextual evidence panel. The same JSON and replay clock remain authoritative. See [TACTICAL_ANALYSIS.md](TACTICAL_ANALYSIS.md) for definitions, API endpoints, synchronization, assumptions, demo steps and tests.

## Multi-scenario state (3A)

`scenario.ts` validates both JSON texts at the loading boundary and retains their exact raw bytes. `ReplayState.scenario` is the active source for the clock duration, timeline, App, roster, scene and cameras. The selector changes that state synchronously: pause, zero anchors, cancel scrub/resume, broadcast camera, valid default player, trails off, tactical mode/layers/bundle reset. Playback speed persists. Old player IDs are rejected. Releasing a previously active scrub cannot restore its time.

The canvas, pitch, camera rig and frame clock remain mounted. Team materials and mannequins update; replaced kit materials, number textures/materials and tactical resources are disposed. The ball, trails, labels and POV sample the active source. Evidence fetch cleanup aborts requests and uses both an effect-local ignore flag and a scenario/attempt guard, including when switching away and back before an old request completes. Raw JSON SHA-256 checks remain mandatory.

### The Missed Chance

Solstice United (purple, +X) attacks Cinder Rovers (coral, −X), starting at 61:00. Stable seed identifier 43; no runtime randomness. Different width and collective defensive coverage distinguish this play from the original decoy-goal sequence.

| Replay time | Authored football state |
| --- | --- |
| 0–4 s | Silas Marr carries forward. Cinder's back four have 1 m depth and a midfield screen roughly 10.4 m ahead. |
| 4–8 s | Ivo Quinn runs diagonally outside. Jasper Rook drops with him while Bram Ward protects the inside lane. |
| 8.5–10.2 s | Marr passes to Arlo Finch at (33, 0, −1). The measured moving-ball clearance is 2.448 m. |
| 10.2–12 s | Callum Stone remains goal-side and narrows from 5.00 m to 3.61 m from Finch; Ellis Hart recovers behind. |
| 12–15 s | Stone closes to 2.06 m while Ward balances and the far fullback tucks inside. |
| 15–15.72 s | Finch shoots. The ball crosses the end line at (52.8, 0.7, 5.35), outside the post. Anton Moss adjusts laterally; no save or block is claimed. |
| 16–20 s | The ball settles outside the goal while player movements slow. Rewinding restores the chance. |

Try **Analyze this moment → Stone closes the gap**, select **Callum Stone** in Player POV, then scrub 10.2–15 s. Compare with the overhead view. The measured narrowing supports nearby defensive pressure; it does not prove Stone caused the miss. There are seven analytical moments and six key timeline markers.

Browser regressions exercise switching during playback and delayed evidence responses, pointer dragging in the new scenario, full missed-chance playback, repeat switches without canvas replacement, original goal restoration, and mobile selection. Screenshots at 0/run/recovery/finish for both showcases and three cameras are written under `output/playwright/3a/`. See [FOOTBALL_REALISM.md](FOOTBALL_REALISM.md) for source/diagnostic details and limitations.
