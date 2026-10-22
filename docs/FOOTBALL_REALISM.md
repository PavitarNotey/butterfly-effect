# Football realism and tracking integration — 3A

The subsequent [Phase 3B.2 skeletal character foundation](CHARACTER_ANIMATION.md) now covers both full 22-player rosters, extending the original Voss prototype. The account below describes the preserved Phase 3A baseline and its research; no tracking, scenario or tactical data was changed by the character milestone.

Verified locally on 22 October 2026. The two fictional replays remain authored football state, not reconstructions of real matches. The original `invisible-run.json` was preserved byte-for-byte. No AI, physics, rigged assets, new tactical probability model or third scenario was introduced.

## Implemented layers

Canonical synthetic JSON → validated Pydantic scenario → deterministic Python evidence → active-scenario replay store → existing R3F presentation. Separately: provider metadata/JSONL → `tracking/skillcorner.py` → validated tracking IR → shared geometry and offline movement diagnostics. The IR can represent incomplete observations; the synthetic replay contract requires complete tracks. No provider-specific objects enter the renderer.

`tracking/models.py` records source identity/revision/hash, original pitch, normalization, teams/directions, lineup identities, source and normalized time, finite observations, explicit missing positions and provenance. Original raw dictionaries remain alongside normalized positions. Supported provenance values are `observed`, `provider_extrapolated`, `derived`, `modeled`, `synthetic_authored`; this importer only emits the first two for available provider positions. Missing points have null position/provenance. No smoothing, hole filling, body heading or match events are fabricated.

## Reproduce the actual integration

From `backend/`, with installed dependencies:

```sh
uv run python -m tracking --download --directory /tmp/butterfly-skillcorner-1925299 --start 10 --end 30
uv run python -m tracking --directory /tmp/butterfly-skillcorner-1925299
SKILLCORNER_DIR=/tmp/butterfly-skillcorner-1925299 uv run pytest
uv run ruff check .
```

Network is needed only for the first command. The downloader streams through the requested interval and closes the response, retaining only the selected lines. The default source revision is `4340d274572876239c154c90bc507a9b3250a656`; `--revision`, `--match`, `--period`, `--start`, `--end` permit explicit alternatives, with a maximum 60-second retained interval. Times are seconds parsed from the provider's full match timestamp, not elapsed time since the beginning of a half. Use a separate external directory per segment.

Outputs are `match.json`, `tracking.jsonl`, `LICENSE`, `README.source.md`, `manifest.json`, `canonical.json` and `report.json`. The manifest and IR preserve source revision/origin; the report includes identities, provenance/quality, motion, collective shape and independent spatial measurements. Plain pytest skips the genuine-data integration test if `SKILLCORNER_DIR` is absent; the command above executed it successfully. Small hand-authored adapter unit fixtures are labeled as such and are not the integration demonstration. `.data/`, `tracking-data/` and `output/` are ignored; external data remains under `/tmp` in this run.

### Files actually read

[SkillCorner official repository](https://github.com/SkillCorner/opendata), revision above:

- `README.md`, `LICENSE`, `assets/field.jpg`.
- `data/matches/1925299/1925299_match.json`.
- A streamed extract of `data/matches/1925299/1925299_tracking_extrapolated.jsonl`, period 1, 00:00:10.00–00:00:30.00 inclusive.
- `data/bodypose/README.md` and only the small `sample_1925299_phase406.jsonl.gz` for future animation evaluation.

Match: Brisbane Roar FC (team 1802) versus Perth Glory Football Club (871), 21 December 2024. Actual retained tracking SHA-256: `ab3cff1c8b49374e490e1adc0f28dbcf7efb7bcf6aa42d54d40ecf48f5bb19c9`. Player IDs in the report are provider `player_id`/metadata `id`, not the distinct legacy `trackable_object` field.

### Coordinates and direction

The provider's [coordinate diagram](https://github.com/SkillCorner/opendata/blob/master/assets/field.jpg) uses metric X along length, Y across width, centre origin and positive Y toward the top of the diagram. The tested right-handed conversion is:

```text
app.X = source.x × 105 / source_pitch_length
app.Y = source.z for a known ball height; players have ground Y=0
app.Z = −source.y × 68 / source_pitch_width
```

This is a proper rotation of the horizontal/vertical axes before any pitch scaling. Unknown ball height has a flagged planar placeholder (`height_known=false`), not a claim of ground contact. This match is actually 105 × 68, so distances are unscaled. Source positions remain available when dimensions differ. Team directions come from `home_team_side[period−1]`: home −X and away +X in the imported first half. There is no team-relative mirroring. Provider yaw is absent and stays unknown; travel direction is not substituted for body facing.

Source time 10 seconds maps to local t=0, source 30 to t=20; source frame numbers 110–310 are retained independently. The adapter reports malformed/out-of-order frames, invalid or unknown identities, unreasonable/nonfinite coordinates, missing points, unknown detection flags and >0.151 s frame gaps. Roster participation intervals determine expected missing players per frame, including substitutions.

### Actual observations and independently verified calculations

| Measurement | Result |
| --- | --- |
| Frames / players / teams | 201 / 22 / 2 |
| Ball coordinate availability | 201 of 201 frames |
| Detected / provider-extrapolated points, including ball | 2,722 / 1,901 |
| Missing player / ball observations; malformed frames | 0 / 0; 0 |
| Unknown identities / invalid observations / temporal gaps | 0 / 0 / 0 |
| Player 51050 displacement | 37.0118 m over 20 s |
| Player 51050 path length / maximum segment speed | 56.7793 m / 4.8094 m/s |
| Largest imported segment speed | 8.2201 m/s (player 560987) |
| Nearest opposing pair at local t=0 | 560986 / 560987: 0.859883713 m |

The existing `tactics.engine.distance` performs the opposing-pair calculation. The integration test independently checks raw deltas 0.85 m and 0.13 m using `hypot`, displacement from (−3.16, 7.48) to (14.84, −24.86) in source XY, and a raw successive-frame speed calculation. It verifies IDs/directions, exact counts, normalization and provenance. The real diagnostics also expose 34 sampled pair separations below 0.8 m (minimum 0.304 m) and one >3 rad/s finite-window turn warning. These are inspection flags; neither collision nor implausible athlete behaviour can be concluded from noisy, partly extrapolated tracking centres.

## Diagnostics and comparison

`tracking/diagnostics.py` runs on both synthetic scenarios and imported observations. Defaults are configurable via the Python report functions: 0.5 s derivative window, 9 m/s speed warning, 8 m/s² scalar acceleration/deceleration warning, 3 rad/s running-turn/heading-rate warning, 1.5 rad running key-turn warning, 0.8 m spacing warning and 1.5 m touch-proximity warning. These are authoring thresholds, not physiological facts or calibrated interception parameters.

Window velocity comes from position differences; scalar acceleration/deceleration is the change in window speed divided by the interval between window centres. Turning measures velocity direction changes only above 1 m/s; heading rate separately uses authored body yaw. Exact key turns are reported, distinguishing running transitions from changes at low speed. Piecewise-linear velocity has discontinuities: their mathematical instantaneous acceleration is not an athlete measurement. Imported windows split at missing points and frame gaps; no derivative bridges a hole. Original points remain unsmoothed. The two synthetic tracks additionally receive exact continuous closest-approach checks between every player pair and event/possession touch checks, including between keys.

| Maximum across players | Invisible Run | Missed Chance | Genuine segment (unsmoothed) |
| --- | ---: | ---: | ---: |
| Segment speed, m/s | 3.34 | 2.83 | 8.22 |
| 0.5 s scalar acceleration, m/s² | 3.14 | 3.95 | 4.28 |
| 0.5 s scalar deceleration, m/s² | 2.90 | 2.93 | 4.16 |
| Running turn rate, rad/s | 1.42 | 2.06 | 3.23 |
| Body heading rate, rad/s | 1.44 | 0.16 | Unknown |

The fictional sequences are deliberately slower and cleaner than this sample; these figures establish no universal realism calibration. Neither synthetic play has touch/threshold warnings; their continuous minimum player gaps are 1.80 m and 2.00 m. A slow synthetic play can still lack elite physical realism.

Outfield compactness additionally reports X/Z spans and mean distance to the team centroid. At every authored event, reports separate pressure/cover/balance assignments from measured nearest defensive player, line width/depth, midfield-to-back-line centroid X gap, central-cover count, goal-side cover, cover separation and line lateral shift. In the missed chance, back-four width narrows 41 → 34 m, depth stays 1–4 m, and unit gap narrows 10.42 → 8.04 m before the shot. Stone–Finch separation falls 5.00 m at reception → 3.61 m at 12 s → 2.06 m at 15 s. The actual pass has 2.448 m moving-ball clearance. Finch is onside at release and the finish crosses outside the post. No block, save, xG, awareness or causal proof is asserted.

The imported report groups defenders/midfielders by source lineup role, explicitly not inferred responsibilities. For away team 871 at source 10 s, defender width/depth are 22.16/1.14 m with a 6.45 m unit gap; at source 20 s they are 25.82/0.62 m with a 10.42 m gap. Other sampled phases have much greater depth. This supports evaluating changing, connected units rather than enforcing one fixed shape. Camera extrapolation and lineup roles prevent treating the values as tactical ground truth. No real event annotations were imported; provider possession alone cannot validate pass/shot touches.

## Coaching and source evaluation

The new play applies pressure/cover/balance without blindly following every runner: Rook handles Quinn outside, Ward retains the inside lane, Stone closes goal-side, Hart recovers behind and Fern narrows weak-side coverage. These are authored roles whose geometry is measurable. The original goal's authored handover remains unchanged.

| Primary source | Findings, terms and use in 3A |
| --- | --- |
| [SkillCorner](https://github.com/SkillCorner/opendata) / [license](https://github.com/SkillCorner/opendata/blob/master/LICENSE) | Tracking JSONL and metadata used above. Repository has an MIT notice phrased for software/documentation; README asks for credit. Notice retained externally. Do not infer unrestricted rights to other provider products; no raw data redistributed here. Dynamic-event/phases CSVs exist but were not imported; their derived labels are not our measured observations. |
| [Metrica](https://github.com/metrica-sports/sample-data) | Synchronized anonymized tracking/events, normalized top-left (0,0) to bottom-right (1,1), plus Game 3 FIFA EPTS files. README requests responsible use and public acknowledgement; no broad standalone dataset license was verified. No raw data copied. `metrica.py` is only an independently tested coordinate helper: X=(u−.5)105, Z=(v−.5)68. Full importer deferred. |
| [Kloppy](https://github.com/PySport/kloppy) / [SkillCorner loader](https://kloppy.pysport.org/reference/providers/skillcorner/) | BSD-3-Clause code; supports tracking normalization and provider loaders. Context7 discovery did not return Kloppy, so its official docs were read directly. A custom small streaming adapter avoids another dependency and explicitly retains raw provenance/missing states. Reconsider Kloppy for multiple full provider loaders; keep our IR boundary either way. |
| [LaurieOnTracking](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking) / [velocity](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking/blob/master/Metrica_Velocities.py) / [pitch control](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking/blob/master/Metrica_PitchControl.py) | MIT code, distinct from Metrica data rights. Reviewed finite differences, outlier rejection, Savitzky–Golay/moving-average smoothing and interception assumptions. Our raw data stays intact; no pitch-control probability/reaction/reach model added. Sample parameters are model choices. |
| [Last Row](https://github.com/Friends-of-Tracking-Data-FoTD/Last-Row) | Educational/recreational, credit requested; explicitly incomplete/manual and not research-accurate. Inspected a small external CSV excerpt from `datasets/positional_data/liverpool_2019.csv` qualitatively. Supporting movement and ball progression are useful presentation references; no precise thresholds or recognizable sequence copied. |
| [Hudl/StatsBomb](https://github.com/hudl/open-data) | Reviewed event/360 semantics and README attribution/logo requirements for published research. Events and freeze frames do not provide continuous trajectories. No data copied or implicit commercial redistribution permission assumed. Our pass/receive/shot/miss are explicit original event semantics. |
| [FIFA zonal principles](https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/zonal-defending/from-principles-to-practice-using-a-progressive-methodology.php) | Connected lines, dynamic ball-relative positioning, pressure, cover and balance inform the authored group shape. Text/video are reference material, not copied assets or quantitative calibration. |
| [FIFA small-group coordination](https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/zonal-defending/developing-defensive-coordination-in-small-groups.php) | Inside/behind cover, screening, runner handover and recovery informed Ward/Stone/Hart roles. No claim to infer communication from trajectories. |
| [FA roles](https://www.thefa.com/bootroom/resources/coaching/how-to-defend-like-england-roles-and-responsibilities) / [pressing](https://www.thefa.com/bootroom/resources/coaching/spotlight-on-pressing) | Coordinated support behind the first press and weak-side balance; avoid isolated chasing. Coaching references only; no imagery/text assets reused. |

## Body pose and Milestone 3B preparation

[SkillCorner body-pose dataset](https://huggingface.co/datasets/SkillCorner/opendata-bodypose) declares MIT on its card; the repository notice/credit is retained with external material. The small sample was parsed: 309 frames at 25 Hz, source 01:17:34.48–01:17:46.80, 4,953 player-pose observations containing 29 joints, and 4,935 player-frame entries without pose. Each joint has `xyz` and `p90_mae_cm`; first parsed left shoulder has predicted error 5.46 cm. That is error metadata, not a certainty flag. Pose/tracking frame numbers differ by 2.5×; align timestamps/periods. Provider documents separate pose/XY estimation, missing detections, centroid alignment differences and unreliable absolute vertical alignment. No large full-match download or pose retargeting was done.

Future resources evaluated:

- [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html): permits royalty-free incorporated characters/animations in personal/commercial projects. Use one compatible rig for evaluation; verify per-use terms before distributing raw assets. No download made.
- [CMU mocap](https://mocap.cs.cmu.edu/): primary site/FAQ retrieval returned errors/timeouts during this run; current usage terms could not be verified. Do not select or redistribute assets until verified. Potential motion reference only.
- [Rokoko Motion Library](https://support.rokoko.com/hc/en-us/articles/4410021327121-Getting-Started-Rokoko-Studio-Motion-Library): free and paid clips, previewable in Studio. That help page is not a universal redistribution license; per-asset terms need verification. No asset acquired.
- [Three animation system](https://threejs.org/manual/pages/animation-system.html) and [r186 AnimationMixer](https://threejs.org/docs/#AnimationMixer): official documentation/Context7 checked. For future seeking, use absolute mixer time with controlled timeScale and deterministic action weights; replay speed must not be applied twice. Code license does not license unrelated character assets.

3B should consume world state rather than change it. Add small authored phase intervals tied to player/event IDs for `idle`, `walk`, `jog`, `sprint`, `accelerate`, `decelerate`, `turn`, `jockey`, `receive`, `pass`, `shoot`, `block`, `stand_tackle`, `slide_tackle`, `goalkeeper_set`, `dive`, `recover`. Select a phase by absolute replay time; derive clip-local time and blend weights deterministically, including backward seeks. Root motion must be disabled/removed or confined to a local pose offset, leaving canonical positions and headings authoritative. Character replacement must not alter tactical measurements or POV origin rules.

Priority: (1) verify one rig/asset license and footprint, (2) demonstrate locomotion, receive/pass/shot and goalkeeper set/recovery on the existing coordinates, (3) add deterministic transition/seek tests, (4) profile 22 characters before adding detail. Avoid an asset framework, animation state machine or speculative contract until the small rig experiment establishes requirements. Main blockers are verified distributable football actions, retargeting and foot/ball contact at authored event times.

## Verification and remaining limits

Verified results: **60 pytest tests**, including the genuine-source integration, **24 Vitest tests**, and **15 Playwright tests** passed. Ruff, ESLint, TypeScript and production build passed.

Frontend: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Backend: `SKILLCORNER_DIR=... uv run pytest`, `uv run ruff check .`. OpenAPI and TypeScript were regenerated with the existing export workflow. Tests include both scenario bundles, invalid guide references, deterministic hash/clock/camera switching, genuine-source measurements, missing/invalid tracking, coordinate signs and finite-window derivatives.

Playwright covers mouse/touch/keyboard timeline input, paused/backward seek/resume, speed, restart, original endpoint/goal, new full playback/miss, scenario switching during playback/delayed evidence, repeated switches preserving the canvas, tactical mode, POV and mobile layout. Screenshots under `output/playwright/3a/` capture both scenes at start/run/recovery/finish from broadcast, overhead and defender POV; inspected overhead and POV images support the authored coverage. A discovered mobile selector hiding rule was fixed. Successful flows assert no browser console/runtime errors.

Remaining limits: procedural mannequins and simple gait, immediate camera cuts, piecewise-linear world movement, no reach/reaction model, no causal miss attribution, no real-data viewer, no full Metrica loader or cross-device performance benchmark. One 20-second camera-derived sample cannot calibrate elite football movement. Vite still warns about the ~948 kB lazy 3D chunk; Starlette warns about its existing httpx TestClient integration. Neither prevents the passing checks.

## Change inventory

Modified existing files:

- `.gitignore`
- `README.md`
- `backend/openapi.json`
- `backend/tactics/models.py`
- `backend/tactics/routes.py`
- `backend/tactics/service.py`
- `docs/REPLAY.md`
- `docs/TACTICAL_ANALYSIS.md`
- `frontend/src/App.css`
- `frontend/src/App.tsx`
- `frontend/src/api/schema.d.ts`
- `frontend/src/replay/ReplayScene.tsx`
- `frontend/src/replay/Timeline.tsx`
- `frontend/src/replay/replay.test.ts`
- `frontend/src/replay/scenario.ts`
- `frontend/src/replay/store.ts`
- `frontend/src/tactics/TacticalHUD.tsx`
- `frontend/src/tactics/TacticalOverlays.tsx`
- `frontend/src/tactics/TacticalPanel.tsx`
- `frontend/src/tactics/data.ts`
- `frontend/src/tactics/store.ts`
- `frontend/src/tactics/tactics.test.ts`
- `frontend/tests/replay.spec.ts`

Created files:

- `backend/tactics/guides.py`
- `backend/tests/test_multiscenario.py`
- `backend/tests/test_tracking.py`
- `backend/tracking/__init__.py`
- `backend/tracking/__main__.py`
- `backend/tracking/diagnostics.py`
- `backend/tracking/metrica.py`
- `backend/tracking/models.py`
- `backend/tracking/skillcorner.py`
- `docs/FOOTBALL_REALISM.md`
- `frontend/src/replay/missed-chance.json`
- `frontend/tests/scenarios.spec.ts`
