# Phase 3C.2 — The Invisible Run authored goal revision

Implemented October 23, 2026 (America/Toronto), starting from clean `main` at `5c7a4d6`. This is an **intentional revision of the synthetic goal scenario**, explicitly authorized to improve the football itself. The Missed Chance remains byte-identical. This supersedes the original 20-second goal timeline in older milestone reports; those reports retain their historical measurements, licenses and findings.

## Revised sequence

| Event | Original | Revised | Authored football |
| --- | ---: | ---: | --- |
| Buildup | 0–3 s | 0–1 s | Linden advances at a purposeful jog; supporting attackers move immediately. |
| Wide run | 3 s | 1 s | Rowan accelerates out of the inside channel. |
| Defensive shift | 6 s | 2.8 s | Mercer shifts with the run, North drops outside, Pike narrows. |
| Pass | 9 s | 4.4 s | Linden releases the diagonal ball from (18.15, 0.16, 0). |
| Reception | 10.4 s | 5.6 s | Voss controls on the move at root (34, 0, 4.5). |
| Shot | 14 s | 6.8 s | One settling touch, then a shot from root (37.2, 0, 4.5) with two defenders closing. |
| Goal | 14.67 s | 7.65 s | Whole ball beyond the line, inside the posts and below the crossbar. |
| Replay end | 20 s | 13.2 s | Voss and teammates are still running toward the attacking corner. |

Reception-to-shot is **1.2 seconds**, replacing 3.6 seconds of carrying. The recorded pass travels about 17.1 m in 1.2 s. The shot travels across goal in 0.85 s. Playback remains ordinary 1×; no camera cut, speed multiplier or presentation root offset creates the new pace.

`backend/authoring/invisible_run.py` holds explicit time/position control routes. Shape-preserving cubic routes are baked into finite canonical keys at a 0.2 s grid plus authored knots/events; production interpolation remains linear. Facing follows the authored running direction with bounded turns. The generator preserves fictional identities, kits, seed, match start, scenario ID and **contract version 1**. Content revision identity is the raw-source hash, not a new API field.

Reproduce/check from `backend/`:

```sh
uv run python -m authoring.invisible_run
uv run python -m authoring.invisible_run --check
```

## Pressure, spacing and finish validation

The existing Python engine and diagnostic thresholds are unchanged. Independent fixture checks retain the original 6 m/s speed, 6 m/s² finite-window acceleration/deceleration, 2 rad/s heading and 1.2 m player-spacing limits. The back line remains compact before release, then breaks its line to close the receiver. Tests check onside release, wide-run handoff, possession proximity, all player pairs continuously between keys, shot clearance and whole-ball crossing.

| Measurement | Revised result |
| --- | ---: |
| Maximum player segment speed | 5.4908 m/s |
| Maximum 0.5 s-window acceleration / deceleration | 4.6357 / 4.2121 m/s² |
| Maximum heading rate | 1.8000 rad/s |
| Maximum running turn between adjacent keys | 0.6589 rad |
| Minimum player-centre separation, whole replay | 1.2597 m (Ash / Flint, 8.7424 s) |
| Pike–Voss gap, pass → receive → shot | 5.0961 → 3.8910 → 1.7000 m |
| Mercer–Voss gap, receive → shot | 5.1740 → 2.4413 m |
| Minimum defender–shot planar tracking-centre gap | 1.2833 m (Pike) |

The closing defenders face within 0.5 rad of travel whenever moving above 3 m/s. They accelerate through the pass/reception rather than sliding sideways. The measured shot clearance is a centre-distance calculation, not a calibrated limb/contact model; skinned keeper surface/ground checks remain separate.

The goal event has ball centre (52.7, 0.62, −2.4), with radius 0.16 m. The whole-ball line crossing occurs just before the 7.65 s event; at 7.63 s it has not yet crossed. No save, block or deflection is authored.

Voss turns toward +Z after the goal and finishes at (49.4, 0, 23.5), still short of the corner. Rowan’s distance to him narrows **15.16 → 2.25 m**, Linden’s **12.87 → 5.61 m**, and Sol’s **10.11 → 7.85 m**. All four are moving at the endpoint. Early draft celebration routes crossed opponents; the final routes were separated and revalidated rather than accepting overlaps.

Full measurements and protected-file hashes: [goal audit](benchmarks/phase-3c2-goal-audit.json).

## Evidence and integrity

The same Python calculations recompute all six moments, 42 evidence observations and 114 overlay frames. Receiving coverage and recovery distances use the revised roots. The actual passing corridor remains **clear**, now with **2.0369 m** simultaneous moving-defender clearance (previously 2.7043 m), under the same **0.9 m half-width / 0.6 m contested margin / 6 m coverage radius**. Authored guide and editorial copy describe the quick control/shot; they remain interpretations, separate from measurements. Simulated gaze/gestures do not establish player awareness or intent.

The source hash changes from `cf9c02a7ae8638c89d1f88a19e7df34621e72ffa110c835b865e5a5315eb4e73` to `8d2667ffaf9b1475ef40acfc8aa2f5319011abb14e22c2a80208139f3f9b7e30`. Browser evidence validation uses the new exact raw text. Semantic evidence IDs remain scenario/version scoped; cached evidence is keyed by source text/configuration and cannot reuse the old values over this source. API responses and frontend source-hash validation are exercised by browser regressions.

The Missed Chance hash remains `edfebf37d73b207d6264a599887c570f4710f0d587b7d6a41130b5d1ea30b7a9`. Python geometry, Pydantic models, exported OpenAPI and generated TypeScript contracts are byte-identical to baseline. The live OpenAPI object equals the existing export. No contract regeneration or threshold adjustment was needed.

## Animation and cameras

Pass/receive/shot contacts derive from events and possession. Default same-player action windows now split at a contact midpoint when necessary: Voss’s reception is 5.2–6.2 s and shot is 6.2–7.75 s. Both fade through zero at the boundary, so reception recovery cannot mask or abruptly switch to a fully weighted shot. Contact foot targets still use canonical ball/root/facing geometry.

Runs above 3.2 m/s use the existing jog clip with a restrained torso lean and smoothly increasing distance-indexed stride length (1.8–2.2 m), without importing a new animation. The missed-chance roster stays below that speed gate, so its locomotion phase/lean are unchanged. Goal-linked upper-body celebration now includes nearby teammates while their legs follow the canonical convergence routes. Nearby conceding defenders finish their brace, then blend into a restrained disappointment gesture. Holt retains a grounded partial lunge/reach, timed from the new shot at 6.8 s, with reaction beginning after 6.98 s. No airborne dive is claimed.

Broadcast/tactical framing reuse the existing pure replay-time focus sampler. North and Pike are included among relevant actors; no new camera rig or artificial zoom was added. Guided intervals derive from the retimed evidence, share the canonical clock, and retain interruption/restoration. POV gaze, paused free-look, selection and scenario switching retain their architecture.

## Visual review, verification and limits

Before and revised **continuous 1× Chrome recordings** cover the whole replay. Broadcast and tactical recordings, quarter-second contact sheets across the full videos, and close-up preparation/contact/follow-through captures were inspected. The opening progresses immediately, the wide run and marking shift remain legible, Voss’s short touch/finish is bracketed by closing defenders, and the scorer/teammates turn and run out toward the corner. Both settled cameras retain the ball and active attack without a fly-through. Capture scripts sample the real advancing replay, not a seek-based substitute for continuous playback.

Artifacts under ignored `output/`:

- `playwright/phase3c2/before/broadcast-continuous-1x.webm`: original 20 s goal baseline.
- `playwright/phase3c2/after/{broadcast,tactical}-continuous-1x.webm`: revised full playback.
- `playwright/phase3c2/{first-pass,after}/*review*.jpg`: continuous-recording frame reviews.
- `actions/phase3c2/`: retimed preparation/contact/follow screenshots and `contacts.json` mesh measurements.

The videos are also exported as `after/broadcast-1x.mp4` and `after/tactical-1x.mp4`, trimmed only to the recorded playback (no retiming). Scripts: `frontend/scripts/capture-goal-revision.mjs`, event-derived `capture-actions.mjs` / `capture-experience.mjs`, and the existing character benchmark.

Actual contact mesh measurements at the revised goal contacts are **−0.98 mm** pass clearance, **−7.11 mm** reception clearance and **+3.57 mm** shot clearance; negative means a small sphere/boot overlap. The sampled contact sole is about **+3.99 mm** above ground and canonical root error is zero. Keeper sampling through the shot/reaction has minimum mesh Y **+1.95 mm**, maximum vertex radius **1.4444 m** within the existing 2.35 m culling sphere, and minimum ball/keeper surface separation **0.2924 m**. These are sampled visual checks, not proofs of physical collision response.

### Performance

[Matched benchmark results](benchmarks/phase-3c2-performance.json): installed headless Chrome, 1440×1100 CSS pixels, DPR 1.5, 22 skeletal players, 2 s active warmup and 20 s playback per camera. Tests/captures were closed during measurement. The revised 13.2 s replay loops once, so phase distribution differs from the old 20 s source.

| Camera | Mean frame ms before → after | p95 ms before → after | Mean draws before → after | Frames >25 ms before → after |
| --- | ---: | ---: | ---: | ---: |
| Broadcast | 16.666 → 16.666 | 16.8 → 16.7 | 91.96 → 92.28 | 0 → 0 |
| Tactical | 16.666 → 16.666 | 16.8 → 16.7 | 92.14 → 92.17 | 0 → 0 |

Both delivered about 60 rAF FPS, one GLB request, 22 rigs and no browser/shader errors. Textures remain 27; geometries remain bounded at 58 broadcast / 60 tactical before switching. Slight triangle changes (~567.7k→575.6k broadcast, 550.6k→553.8k tactical, including shadows) reflect revised positions/poses/framing, not added mesh assets. This refresh-limited result shows no observed frame-delivery regression, not spare GPU capacity or a cross-device guarantee.

The baked fixture is **139,864 bytes**, versus 40,788 originally. One compact line per position/heading key avoids a whitespace-heavy 316 kB draft. Final production main JS is **456.39 kB / 118.67 kB gzip** and the lazy replay chunk is **1,015.26 kB / 274.12 kB gzip**. The existing replay chunk-size warning remains visible.

### Checks

Python: **62 passed, 1 skipped**, Ruff passes; the skip is the existing optional external SkillCorner segment. Frontend: **74 Vitest tests**, typecheck, lint and production build pass. The final full installed-Chrome Playwright run passes **34 tests** (2.8 minutes), including actual 1× goal completion, new contact times, real bones after arbitrary seeking, current-source evidence, goalkeeper/outcome poses, guided interruption/restoration, picker/selection, touch free-look, scenario switching and resource cleanup. A mobile selection test exposed a model-readiness race; its projected tap now waits for the skeletal renderer and measures the settled canvas after scrolling. Five isolated repeats and the full suite pass.

Remaining realism limits: shared stylized avatar and jog source, finite-key linear replay, approximate planted-foot/contact presentation, and a partial keeper lunge rather than a calibrated save simulation. The control/shot midpoint is continuous but has a brief low-weight locomotion blend. Centre-spacing and shot-clearance checks do not prove full-body collision avoidance. Desktop Chrome and mobile emulation do not establish physical-device performance. No asset, dependency, AI agent, third scenario or cloud service was added. No commit or push was made.
