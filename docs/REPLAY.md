# Butterfly Effect — deterministic replays

The studio contains three original synthetic sequences: The Invisible Run (13.2 seconds, goal), The Missed Chance (12 seconds, wide shot; approved Phase 4.2 revision), and The Pass That Wasn't Touched (13.6 seconds, goal after a non-contact dummy). Foundry intelligence is documented in [Phase 4](PHASE_4_AI_INTELLIGENCE.md); physics and public deployment remain deferred. All 22 players in each scenario use independent imported CC0 skeletal characters; loading/error fallback mannequins and the environment remain procedural. See [character animation and asset licenses](CHARACTER_ANIMATION.md). The clock and canonical-data sections below remain current; the explicitly named 3A and early-replay findings record their implementation history. Phase 3C/3C.1 presentation behavior is described here and in [the experience report](PHASE_3C_EXPERIENCE.md).

## Run and demonstrate

Run the API and frontend using the root README. The football homepage is at http://localhost:5173; the independent scenario library used by the steps below is at http://localhost:5173/studio. Phase 3E adds Match Centers and event-linked studio routes, documented in [the league report](PHASE_3E_LEAGUE_MATCH_CENTER.md).

1. Press Play and watch Aurora FC attack the right goal.
2. Pause or drag the timeline to any instant. Speed supports 0.5×, 1× and 2×.
3. Choose Tactical to inspect active play, or Full pitch for the complete shape. Overhead views support wheel zoom and drag-to-pan. Click a player or use the roster to select a player. Enable Movement trail to see that player's preceding six seconds.
4. Seek to **Defender shifts** (2.8 seconds), click **Dane Mercer** on the pitch or find him in the team-grouped player picker, then choose **View POV** on his player card. Selection alone does not change the camera. Camera changes preserve replay time and playback state.
5. Switch back to Broadcast and seek **The finish** (6.8 seconds). Play through the goal (7.65 seconds). Seeking backwards restores score, ball position, possession and event text.

The API connection indicator and refresh control continue to work independently of the local replay. All three replays load without API or Azure credentials; measured tactical evidence requires the API.

## Canonical data

`frontend/src/replay/invisible-run.json`, `missed-chance.json` and `untouched-pass.json` are the canonical sources for their respective scenarios. The original goal fixture was unchanged by 3A; Phase 3C.2 deliberately revises its tracks/timestamps while retaining schema version 1 and fictional identities. See [the revision and validation record](PHASE_3C_2_GOAL_REVISION.md). `types.ts` aliases the generated version-1 Pydantic/OpenAPI contracts for the replay. See [tactical analysis architecture](TACTICAL_ANALYSIS.md).

Coordinates are metres in a right-handed world: X is pitch length, Y is height, Z is width. Origin is the pitch centre; length is 105 m, width 68 m. Aurora attacks +X. Player yaw is radians: 0 faces +Z, π/2 faces +X. Match time begins at 73:00, scenario time at 0 seconds. The fixture has a fixed seed identifier of 27 and uses no runtime randomness.

Each player has separate position and heading keyframes. Ball positions include height; possession changes and football events have their own timestamps. Loading validates the roster, IDs, timestamps, tracks and references. Position and ball tracks use linear interpolation; headings interpolate along the shortest angular arc. Outside the replay interval, sampling clamps to the endpoints. Displayed moment descriptions are authored scenario metadata, not computed tactical evidence or AI explanations.

| Time | Authored sequence |
| --- | --- |
| 0–1 s | Linden advances at a purposeful jog; Rowan and Voss are already moving. |
| 1–4.4 s | Rowan accelerates diagonally wide; Mercer shifts, North drops to take the runner, and Pike narrows. |
| 4.4 s | Linden releases the diagonal pass from (18.15, 0.16, 0) toward Voss. |
| 5.6 s | Voss receives at root (34, 0, 4.5), with the ball 0.65 m ahead. Pike is 3.89 m from Voss. |
| 6.8 s | Voss shoots after one settling touch, from root (37.2, 0, 4.5). Pike is 1.70 m away, Mercer 2.44 m away; both are closing. |
| 7.65 s | The whole ball crosses X=52.5 inside the posts and below the crossbar. |
| 7.65–13.2 s | Voss turns toward the attacking corner; Rowan, Linden and Sol react and converge while the defence slows. The replay ends during those runs. |

Python fixture tests check that Mercer vacates the eventual passing lane, defenders clear the actual corridor at release, Voss is onside, touches occur within one metre of the relevant player, player speeds remain below 6 m/s, and the goal event matches the crossing. These are authoring checks, not a runtime tactical engine or proof of a player's intent.

## Clock and camera architecture

`store.ts` owns an anchor replay time, monotonic wall-time anchor, playing flag and speed. Time is computed as `anchorTime + elapsedWallSeconds * speed`, clamped to the duration. Pause, seek and speed changes rebase the anchors. Rendering never adds frame deltas to world positions.

One early R3F frame callback samples the clock once. Every player, the ball, trails and the camera consume that same sample. The UI samples the same clock on requestAnimationFrame for display only. The timer, native range value and elapsed-track fill all use that one display sample. End-of-replay playback stops; Play at the endpoint begins again. Restart returns to zero while preserving the playing/paused state. Pointer scrubbing freezes the anchored clock until release, then resumes only if it was playing before the drag. Releasing, cancelling, losing pointer capture or blurring ends the scrub idempotently and rebases wall time, so held time cannot turn into a jump. Keyboard/programmatic range inputs preserve playing/paused state. Moment buttons pause at their requested timestamp.

`camera.ts` computes settled poses from scenario, mode and absolute replay time. Broadcast follows a smoothed active-play focus, Tactical follows it overhead, Full pitch shows the overview, and third-person Follow Player tracks the chosen player's canonical root/facing. POV anchors to that player's recorded root at an approximately 1.68 m eye height and adds bounded, deterministic simulated gaze toward the ball and event context, with quiet field scans. This gaze is presentation, not observed attention or intent. The POV player's mannequin is hidden and name labels are suppressed. Paused POV supports mouse/touch/keyboard free-look; seeking retains its offset, while resuming playback or switching POV camera/player resets it. Overhead wheel zoom and left-drag pan create a bounded manual override; Follow play / Reset view clears it. Mode and scenario changes also clear it; seeking, restart and speed changes preserve an explicit manual view. Pure automatic camera poses remain reproducible at a timestamp. Deliberate changes between non-POV modes use a 280 ms presentation transition, POV changes anchor immediately, and returning from paused free-look uses a 220 ms orientation blend; reduced motion skips those blends. None changes the football clock or world positions. See [camera framing audit](CAMERA_FRAMING.md).

Player selection is a nullable `selectedId` in the replay store, shared by pitch raycasting, the roster picker, player card, labels and tactical HUD. Clicking or tapping any visible player selects that ID without entering POV; the card offers explicit **View POV** and **Follow Player** actions. Tactical drags suppress the subsequent selection click, and paused POV free-look owns its separate pointer surface. Selection persists across ordinary pause, playback, seeking and camera changes; changing scenarios clears it. Guided evidence replay may temporarily select its relevant actor and restores the prior selection when closed.

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

- Full-team skeletal locomotion, with the original procedural renderer available as fallback, plus event-synchronized pass/receive/shot poses and presentation-only goalkeeper/outcome reactions. Holt's response is a grounded partial lunge; Moss tracks/reaches more subtly. There is no full airborne dive, physical contact, save or deflection model. Ball tracks, rather than a physics engine, define every pass and shot.
- Piecewise linear tracks can change velocity at authored keyframes. No claim of motion-capture realism or full match simulation.
- Selected-player trails are separate from the optional tactical evidence overlays described in [TACTICAL_ANALYSIS.md](TACTICAL_ANALYSIS.md). Neither trails nor simulated gaze establish observed player awareness.
- Settled camera poses remain replay-time deterministic; short user-triggered presentation transitions depend on wall time. On narrow/mobile viewports the broadcast view crops more of the pitch; desktop is the primary demo target.
- The **Phase 3B.2** lazy-loaded 3D chunk was approximately 1,001 kB (269 kB gzip). Vite still reports a nonblocking chunk-size warning; that historical size is not a current bundle measurement. Cross-device frame rates remain unmeasured. See [the character benchmark](CHARACTER_ANIMATION.md).
- Pydantic/OpenAPI scenario contracts and deterministic Python tactical evidence are implemented. Event-synchronized touches and finishes are now animated, but visual contact and transitions remain stylized. Profile before adding more scenes.

## Historical timeline and defensive-shape repair (before Phase 3C.2)

The findings and coordinates in this section describe the original 20-second goal fixture (`cf9c02a7…`). The current 13.2-second authored revision above supersedes those tracks and event times; the clock repair remains in use.

The original clock advanced correctly in Chrome, but every range change called `pause()` and there was no scrub-release lifecycle. A mouse regression reproduced the replay remaining paused after dragging during playback. The native Chrome track also had no explicit elapsed fill. Earlier smoke tests used `fill()` and did not exercise pointer down/move/up. The range remains a real controlled input: its value and CSS fill derive from `readTime()`, with pointer capture and a store-owned scrub session. No independent progress animation or frame-delta simulation was added.

Defensive **movement assignments** are authored in position and orientation keys, rather than generated at runtime. Phase 3C later added presentation-only defensive head/torso/arm reactions without changing these tracks:

| Time | Rowan / Mercer | Cover and channel |
| --- | --- | --- |
| 0 s | Rowan (25, 4); Mercer (29, 3), goal-side and just inside. | Back four span X=29–30, Z=-17–16. Pike (30, -6) covers Voss; Frost screens in front. |
| 3 s | Rowan begins the diagonal run; Mercer stays goal-side. | North holds the outside lane; Pike starts narrowing; Beck presses Linden. |
| 6 s | Rowan (31, 9); Mercer (33, 6.5), inside and goal-side. | North (34, 15.5) drops toward the runner; Pike (32, -4) covers centrally. |
| 9 s | Rowan (35, 14); Mercer (36, 8.5). | North (37, 16.5) takes the wide runner. Pike (34.5, -1.5) narrows, but Linden's diagonal pass reaches Voss at (33, 4.5). |
| 10.4–14 s | Mercer recovers inside instead of chasing Rowan to the corner. | Pike closes goal-side, Frost recovers behind Voss, Ash tucks in on the weak side. Voss shoots through the gap before the centre backs can block. |

The final shot begins at 14 s; Holt holds his set position through 14.18 s and then makes a late lateral response. The whole ball crosses at 14.67 s. The sequence remains 20 seconds long. These assignments describe authored geometry, not player psychology or a claim of perfect defending.

Python validation checks continuous closest approach for every player pair (including between authored keys), speed and heading-rate bounds, changes of travel direction, compact defensive lines, goal-side cover, possession proximity, the moving defenders' clearance during the pass, shot clearance, and whole-ball goal crossing. Browser regressions cover real mouse dragging, trusted Chromium touch events, keyboard seeking, restart, camera changes, scene changes, speed, and browser errors. Key-frame screenshots are saved to `output/playwright/defence/` for broadcast, tactical, and Mercer POV at 0, 3, 6 and 9 seconds.

The selected-player name label keeps its existing visual treatment but is projected into the page’s existing DOM root. This removed the installed Drei Html component’s synchronous nested-root unmount error under StrictMode and player/camera changes. **At the time of that repair**, camera poses, lighting, pitch geometry and mannequin rendering were preserved; later camera behavior is described above.

## Tactical intelligence milestone

The optional tactical mode adds Python-calculated passing corridors, displacement arrows, coverage boundaries, linked players and a contextual evidence panel. The same JSON and replay clock remain authoritative. See [TACTICAL_ANALYSIS.md](TACTICAL_ANALYSIS.md) for definitions, API endpoints, synchronization, assumptions, demo steps and tests.

## Multi-scenario state (3A)

`scenario.ts` validates all registered JSON texts at the loading boundary and retains their exact raw bytes. `ReplayState.scenario` is the active source for the clock duration, timeline, App, roster, scene and cameras. The selector changes that state synchronously: pause, zero anchors, cancel scrub/resume, broadcast camera, **no selected player**, trails off, guided replay cleared, tactical mode/layers/bundle reset. Playback speed persists. Old player IDs are rejected. Releasing a previously active scrub cannot restore its time. The original 3A release used a valid default player; Phase 3C.1 changed this to nullable selection.

The canvas, pitch, camera rig and frame clock remain mounted. Team materials and mannequins update; replaced kit materials, number textures/materials and tactical resources are disposed. The ball, trails, labels and POV sample the active source. Evidence fetch cleanup aborts requests and uses both an effect-local ignore flag and a scenario/attempt guard, including when switching away and back before an old request completes. Raw JSON SHA-256 checks remain mandatory.

### The Missed Chance

Solstice United (purple, +X) attacks Cinder Rovers (coral, −X), starting at 61:07.35 after the approved [Phase 4.2 revision](PHASE_4_2_MISSED_CHANCE.md), preserving the ledger’s miss at 61:15.72. Stable seed identifier 43; no runtime randomness. Different width and collective defensive coverage distinguish this play from the original decoy-goal sequence.

| Replay time | Authored football state |
| --- | --- |
| 0–1.3 s | Silas Marr carries forward. Cinder's back four have 1 m depth and a midfield screen roughly 10.4 m ahead. |
| 1.3–3.2 s | Ivo Quinn runs diagonally outside. Jasper Rook drops with him while Bram Ward protects the inside lane. |
| 3.55–4.75 s | Marr passes to Arlo Finch at (33, 0, −1). The measured moving-ball clearance is 2.429 m. |
| 4.75–5.85 s | Callum Stone remains goal-side and narrows from 5.00 m to 3.61 m from Finch; Ellis Hart recovers behind. |
| 5.85–7.65 s | Stone closes to 2.06 m while Ward balances and the far fullback tucks inside. |
| 7.65–8.37 s | Finch shoots. The ball crosses the end line at (52.8, 0.7, 5.35), outside the post. Anton Moss adjusts laterally; no save or block is claimed. |
| 8.65–12 s | The ball settles outside the goal while player movements slow. Rewinding restores the chance. |

Try **Analyze this moment → Stone closes the gap**, select **Callum Stone** in Player POV, then scrub 4.75–7.65 s. Compare with the overhead view. The measured narrowing supports nearby defensive pressure; it does not prove Stone caused the miss. There are seven analytical moments and six key timeline markers.

Browser regressions exercise switching during playback and delayed evidence responses, pointer dragging in the new scenario, full missed-chance playback, repeat switches without canvas replacement, original goal restoration, and mobile selection. Screenshots at 0/run/recovery/finish for both showcases and three cameras are written under `output/playwright/3a/`. See [FOOTBALL_REALISM.md](FOOTBALL_REALISM.md) for source/diagnostic details and limitations.

## Phase 3D: non-contact passage

The third showcase is authored by `backend/authoring/untouched_pass.py`, using the same pure route sampler as the goal revision. It bakes complete player tracks at 0.1 s plus route/event knots. Vesper Athletic and Tidal Rovers are fictional; no real match tracking is claimed. Bellamy releases at 5.6 s, Ellery dummies at 6.65 s, Merrick receives at 7.2 s and shoots at 7.42 s; the whole ball crosses before the 8.02 s goal event. Duration is 13.6 s at ordinary 1× clock speed. The older fixtures remain byte-identical.

`Scenario.events` now discriminates ordinary `MatchEvent` and `DummyEvent` by `type`. The dummy supplies its actor, bounded action interval, passage time and linked pass/reception IDs, with required `nonContact: true` and `possessionTransfer: false`. Validation requires an ownerless, uninterrupted linked flight and an actor distinct from the passer and receiver. The ball has no key at the dummy timestamp, so it cannot be retimed or diverted by its pose. This is an additive version-1 contract extension; regenerate consumers to recognize the new event.

The existing guided replay stores the dummy event identity and uses an oblique broadcast pose in the existing camera sampler. The ordinary broadcast/tactical/POV cameras remain available. Manual changes use the same interruption/restoration path. Body opening and gaze remain simulated presentation. See [the engineering report](PHASE_3D_UNTOUCHED_PASS.md) for mesh measurements, recordings and limits.
