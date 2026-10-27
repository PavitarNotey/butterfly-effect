# Four connected analytical sequences

Every showcase exposes four viewer sequences, with a contract maximum of five and minimum of three. The same definitions supply the Studio's side cards, tactical panel, compact selector, timeline bookmarks and Casual Fan/Analyst selector. Canonical events remain available to synchronized commentary and technical evidence; they are not additional analysis choices.

## The Pass That Wasn't Touched

| Sequence | Start | Focus | End | What to watch |
| --- | ---: | ---: | ---: | --- |
| The Run Begins | 0.00 | 1.20 | 7.20 | Merrick's complete recorded approach through reception; follow camera, player highlight and full recorded route |
| The Dummy | 3.80 | 6.65 | 7.20 | Bellamy collecting, playing the diagonal, Ellery's non-contact dummy and Merrick continuing to reception |
| The Arrival | 5.60 | 7.20 | 7.42 | Pass release through Merrick's reception and preparation to shoot, with nearby defenders and measured receiving space |
| The Finish | 6.65 | 7.42 | 9.02 | Dummy, reception, shot, goal and one second to register the outcome |

Times are scenario seconds. Windows deliberately overlap so a viewer sees the context leading into each focal event. The run lasts the full 7.2 seconds; the brief 0.22-second reception-to-shot gap is never presented as a standalone snapshot.

**Data limitation:** Merrick's first recorded key is at 0.0s, position `(22, 0, 8)` metres. He is already in the attacking half of the 105m pitch. His keys continuously cover the recorded approach into the box and reception, but do not show an earlier run from deep midfield. No earlier motion is fabricated. The run caption and authored interpretation state that limit. The dummy's non-contact semantics are recorded; the presentation does not claim observed attention, deception or causal necessity.

## The other showcases

| Scenario | Sequence | Start | Focus | End |
| --- | --- | ---: | ---: | ---: |
| The Invisible Run | The Run and the Shift | 0.00 | 1.00 | 4.40 |
| | The Passing Window | 2.80 | 4.40 | 5.60 |
| | The Arrival | 4.40 | 5.60 | 6.80 |
| | The Finish | 5.60 | 6.80 | 8.65 |
| The Missed Chance | The Run and the Cover | 0.00 | 1.30 | 3.55 |
| | The Forward Pass | 1.30 | 3.55 | 4.75 |
| | Reception and Recovery | 3.55 | 5.85 | 7.65 |
| | The Finish | 5.85 | 7.65 | 9.37 |

## Playback and presentation

Selecting a tactical option or timeline bookmark previews its recorded focus event. **Show me in the replay** plays its exact start-to-end window. The side card's **Watch** buttons start that same sequence directly. AI's primary **Show me why** also plays the full sequence owning the exact cited observation; **Watch this detail** retains the fact-specific interval. Each uses the existing authoritative replay clock, completion boundary, pause/resume, replay and restoration lifecycle. Manual seeking, camera changes, speed changes or player inspection interrupt guidance at the current time; the regular controls remain available. Scenario changes clear guidance and incompatible evidence/selection.

The run uses the existing `follow:<player>` camera mode with sequence-specific framing that includes the full route in landscape and narrow views. Its target follows canonical player positions. A faint line shows the complete recorded route for the selected interval; a bright line advances along every canonical bend with playback. The line retains the opening keys after six seconds, unlike the separate optional rolling inspection trail. Guidance highlights the runner and relevant actors. The dummy sequence keeps the full attack in broadcast context; its optional measured detail retains the closer oblique dummy view. Arrival shows measured space and relationships; finish shows the recorded shot.

Movement lines use bounded, reusable geometry buffers with deterministic draw ranges. No extra clock, position integration, physics, player trajectory or per-frame React state was added. Camera and overlays remain presentation-only. Technical measurements and raw IDs remain inside closed disclosures.

## Evidence, AI and contracts

`guides.py` separates internal measurement **phases** from the four viewer **sequences**. All 139 existing observations across the showcases retain their IDs, exact text, values and event references. Their ownership is regrouped into sequences. One new deterministic full-approach movement observation per scenario measures the complete highlighted run interval. Python's unchanged geometry engine computes its path length and mean speed; the frontend does not invent measurements.

`TacticalMoment` adds required `focusTime`, `focusEventId` and `primaryEvidenceId`, plus nullable `followPlayerId`; `focus` also accepts `movement`. `start` and `end` now mean the full playback window. Pydantic validates positive finite intervals, focus bounds and primary/follow membership; the bundle accepts 3–5 moments. The frontend additionally checks the focus against its canonical event, timeline bounds, source hash, references and full movement-path intervals. OpenAPI and generated TypeScript contracts are regenerated together.

The evidence envelope remains version 1 and canonical scenario hashes are unchanged. This is an intentional coordinated API/client change: older clients that reject the new `movement` focus, or newer clients receiving the old 6–7-moment bundles, must be upgraded together. No compatibility shim invents missing sequence bounds.

Casual Fan and Analyst selections resolve to the sequence's actual recorded focus event using the existing explanation API. Evidence packet selection prioritizes its real primary observation. Analyst's distinct-measurement requirements and all claim/reference protections remain unchanged. Existing evidence/packet hashes naturally invalidate cached narratives when these definitions change. Playback and evidence loading do not generate AI; only explicit generation actions do. Commentary still samples every canonical recorded event. No prompt, Foundry credential, paid budget or production deployment configuration changes are included.

## Verification

- An isolated comparison against the original backend confirmed all 42 / 47 / 50 existing observations, tactical frames, pass/shot geometry, thresholds and canonical source hashes are unchanged.
- Backend regression tests check 3–5 moments, exact four-sequence definitions, bounds/focus references, unique ownership of every observation, complete canonical run keys and both mock AI modes for every focus event.
- Frontend tests check source/reference rejection, full-window playback on the shared clock, restoration/interruption, deterministic full and partial trajectory rendering, and full-route camera projection in landscape and narrow views.
- Browser tests exercise all four playback windows in all three scenarios, the continuously rendered Merrick run, every selector and both offline AI modes, alongside existing replay, camera, player, evidence and league coverage.

### Final results

- Backend: **226 passed, 1 optional external-data skip**; Ruff passed.
- Frontend: **223 unit tests passed**; typecheck, lint and the App Service-targeted production build passed.
- Browser: **all 92 cases verified** across the full run and targeted reruns. The first full run passed 84; eight journeys needed their retired labels/bookmarks, selector scope or evidence-readiness wait updated and then all eight passed. The updated primary AI sequence playback was additionally rechecked in both desktop and mobile Match Centers, across all three scenarios.
- Desktop and narrow/mobile Chrome views were inspected, including the complete highlighted route, readable captions, focus indicators, the uninterrupted dummy pass and the finish. Mobile means browser viewport/touch emulation, not physical-device testing. Browser review reported no page, WebGL or shader errors; existing Three.js clock/shadow deprecation warnings remain.
- Existing large WebGL/data bundle warnings and the Starlette/httpx test warning remain visible. Dependencies, canonical files, the geometry engine, AI budgets/prompts and deployment workflows are unchanged. No paid Foundry calls, commit, push or deployment were performed.

The verification artifacts are local and ignored: [desktop view](../output/sequences/desktop-review.png), [mobile view](../output/sequences/mobile-review.png), the four `*-complete.png` sequence captures and [raw performance sample](../output/sequences/performance.json).

<details>
<summary>Performance and transport details</summary>

A scoped Headless Chrome 156 sample used a 1440×1100 viewport, 1050×605 canvas, DPR 1, all 22 players and the Merrick follow camera. After warming the sequence, 6.02 wall seconds advanced the authoritative replay from 0.5165s to 6.5333s. The sample averaged **60.0 FPS / 16.67ms**, with **24.8ms p95** and 15 frames over 25ms. The final sample showed 102 draw calls and 576,494 triangles. GPU resources stayed at **68 geometries / 27 textures** before and after; repeated-guide and route-transition resource tests also passed. This is one local sample, not a physical-device result or a before/after FPS claim.

The same compact JSON encoder compared evidence payloads at 230,690→229,906 bytes (Invisible Run), 304,479→309,034 (Missed Chance) and 334,255→340,612 (Untouched Pass). The added complete-run paths are bounded by the existing canonical keys. The frontend performs no per-tick network or AI request.

</details>

Implementation changes are concentrated in `backend/tactics/{guides,models,service}.py`, `backend/ai/evidence.py`, the generated OpenAPI/TypeScript contracts, Studio/timeline/AI selectors, guided replay/camera/overlay presentation and their regression tests. New files are `backend/tests/test_sequences.py`, `frontend/src/tactics/{trajectory,sequences.test}.ts`, `frontend/tests/sequences.spec.ts` and this guide. Existing unrelated local configuration is preserved. The working tree is ready for review.
