# Phase 3B.2 — full-team skeletal animation

Implemented from clean `main` at Phase 3B.1 commit `cfd7f67ccb6f016d3f96be6c61776cf32c17e3f8`. Both existing scenarios now support 22 independent skeletal players. No canonical JSON, backend contract, replay clock, camera implementation, ball trajectory, tactical calculation or evidence hash was changed. No new character pack or animation dependency was acquired. Changes are uncommitted and unpushed.

## Demo and rendering modes

Run the API and frontend as described in [README](../README.md): `cd frontend && pnpm dev`, then open http://localhost:5173. All 22 players in **The Invisible Run** and **The Missed Chance** use the existing licensed character with their own canonical positions, headings, kits, numbers and gait phases. Goalkeepers use the scenario's distinct goalkeeper colors and longer sleeves.

Inspect 0, 3, 9, 10.4 and 14 seconds; pause, seek backwards, change speed, restart and switch scenarios. Selection, rings, labels, hover, trails, tactical evidence and POV retain their existing behavior. The complete POV player's root is hidden. Phase 3B.3 now adds deterministic skeletal passing, first-touch receiving and shooting; see [football actions, measurements and validation](FOOTBALL_ACTIONS.md). Unsupported goalkeeper dives remain deferred.

Controlled comparison modes remain available without adding studio UI:

- `/?characters=procedural`: original procedural players; no GLB request.
- `/?characters=single`: Voss only in The Invisible Run; procedural Missed Chance.
- `/?characters=skeletal`: all 22 in either scenario (also the default after acceptance).

Browser evidence is generated under `output/playwright/3b2/`: both scenarios in broadcast at 9/14 seconds, both overhead views, opposing kits and a goalkeeper close-up. Close-ups temporarily frame the **actual mounted players in tests**, then restore the existing camera rig; no product camera mode was added.

## Asset decision and exact license evidence

Source: Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), official [download listing](https://quaternius.itch.io/universal-base-characters), and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), official [download listing](https://quaternius.itch.io/universal-animation-library). Downloaded directly from those listings, using their free Standard downloads. No mirror, account or paid asset was used.

These Standard archives have no reliable version number in their filenames; their hashes identify the exact reviewed releases:

| Official archive | SHA-256 |
| --- | --- |
| `Universal Base Characters[Standard].zip` | `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` |
| `Universal Animation Library[Standard].zip` | `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` |

The character archive's **`License_Standard.txt`** and animation archive's **`License.txt`** each explicitly dedicate that content under **CC0 1.0**. Original notices are preserved in [base license](assets/quaternius-base-license.txt) and [animation license](assets/quaternius-animation-license.txt), and alongside the public GLB so they ship with builds. [CC0](https://creativecommons.org/publicdomain/zero/1.0/) permits copying, modifying and distributing the covered content, including in a public source repository, without required attribution. Credit is retained voluntarily; no endorsement is implied.

The current [general Quaternius QAL v1.0](https://quaternius.com/license.html), updated August 28, 2026, restricts standalone redistribution. We did **not** infer CC0 from that general page or from historical labels: both **downloaded archives themselves** carry their own CC0 dedication, consistent with their official pack listings. Only these specifically identified CC0 releases are incorporated. An asset released only under QAL would require a fresh distribution review.

| Candidate actually evaluated | Inspection and decision |
| --- | --- |
| Quaternius Base Characters Standard | Acquired official archive and exact included CC0 notice. Free archive supplies Superhero male/female rather than all advertised body types. Male full-body glTF has a real 65-joint humanoid skin, fingers, knees, ankles and elbows, roughly 1.81m bind height, Y-up scene and +Z-facing face. Selected athletic male, with simple kit material regions replacing the skin textures. Broad shoulders/tight sculpted shirt are visible style limitations. |
| Quaternius Animation Library Standard | Acquired official archive and included CC0 notice. Inspected in-place `UAL1_Standard.glb` and root-motion `_RM` alternative; README explicitly distinguishes them. In-place file has 43 clips using the same named 65-joint hierarchy. Selected `Idle_Loop` (2.5s), `Walk_Loop` (1.333s), `Jog_Fwd_Loop` (0.933s). No `_RM` file, sprint or football clip included. Bone lengths differ slightly: preserve character bind lengths, use compatible rotations and relative vertical pelvis offset. This is a fixed compatible-rig adaptation, not a general retargeter. |
| Kenney [Mini Characters 1.0](https://kenney.nl/assets/mini-characters) | Downloaded official `kenney_mini-characters.zip`; included `License.txt` explicitly CC0, optional credit. Inspected `character-male-a.glb`: 723 triangles, 7-joint skin, 32 named clips including idle/walk/sprint; external `Textures/colormap.png`. Very inexpensive for 22 players, but small proportions and no articulated knees/elbows make it a weaker football realism upgrade. Not incorporated. |
| Kenney [Animated Characters Protagonists 1.0](https://kenney.nl/assets/animated-characters-protagonists) | Official page screened; declares CC0. Archive not acquired or inspected, so no assertion about exact skeleton, clip compatibility, scale or rendering complexity. Older FBX-based collection was not needed once the compatible Quaternius pair was verified. |
| Mixamo | Not acquired. [Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) discusses use in incorporated projects; that alone was insufficient evidence for distributing raw assets in this public repository. Not selected. |

## Prepared assets and reproduction

The unchanged 3B.1 source is `frontend/public/characters/voss/player.glb`: 745,052 bytes, 14,318 triangles, 65 bones, 8 primitives; SHA-256 `4fd5b79211ca0b659f8a84fb1013949fe1ffc6d4c2ec4c802d4fe11d4fce303c`. Its original CC0 notices remain alongside it.

The runtime uses `frontend/public/characters/football-player.glb`: **877,424 bytes**, **14,318 triangles**, **65 bones**, **one skinned primitive**, no external buffers/textures; SHA-256 `55780a107e0f257a4f2f88eef2923c945923ebe62a39f9d6a0380568953bf7a5`. The modest file-size increase adds surface color markers and unifies skin attribute formats; the substantial saving is draw calls and skeleton GPU textures rather than triangle count. The original GLB remains available as the pinned reproducible input, but is not downloaded by the new renderer.

Rebuild without a network request, Blender or extra Python package:

```sh
python3 frontend/scripts/optimize_character.py
```

To reconstruct the preceding 3B.1 input from the exact reviewed official archives:

```sh
cd frontend
python3 scripts/prepare_character.py /tmp/butterfly-quaternius-base.zip /tmp/butterfly-quaternius-animation.zip
python3 scripts/optimize_character.py
```

The optimization script pins the original GLB hash, combines its three source mesh parts/eight material primitives into one mesh, and preserves the skin, bind matrices and three animation clips. A static color marker distinguishes body surfaces from facial details. The source's fixed −90° X root correction remains; pelvis local Z is vertical under that correction. Root animation, scale animation and non-pelvis translations were already removed by 3B.1 and remain removed. World yaw 0 faces +Z, π/2 faces +X.

## Runtime architecture and determinism

- `ReplayScene.tsx`: one `PlayerFigure` per canonical player, keyed by scenario ID plus player ID. Its root still samples canonical position/yaw from the shared early frame clock. Existing selection, ring, hover and POV handlers stay at that root. `ProceduralMannequin` is the preserved renderer, including its original number texture and gait. Its owned number resources are released when replaced by a loaded skeletal body.
- `useCharacterAsset.ts` / `characterAssets.ts`: one cached asset request and one scene-level load state. Loading or a failed/invalid asset displays a coherent procedural team. A rejected promise is retained until reload, so repeated scenario switches cannot create retry storms. Stale async completions after unmount are ignored. A late successful shared asset is valid for either scenario; player instances always use current keyed roster data. Validation checks clip duration, compatible rig and required skin attributes before any player is switched.
- `AnimatedPlayer.tsx`: each effect setup creates a fresh `SkeletonUtils.clone`, skeleton, mixer, actions and independent bone transforms; cleanup removes the instance, uncaches the mixer and disposes its skeleton texture. StrictMode cleanup/setup is safe. Paused timestamps skip repeated evaluation. Rendering matrix updates are left to Three rather than redundantly traversing the skeleton in each evaluator.
- `kitMaterial.ts`: one immutable number atlas and shared shader program; material ownership is reference counted by color/number/goalkeeper combination. Uniforms are fixed for each kit, so players never overwrite another player's number or color. No per-player number textures, decal meshes or material cloning. Source geometry, clips and atlas live for the page lifetime; owned kit references are released on unmount. Skinning carries the kit and projected numbers on the actual body surface, eliminating detached-number clipping. Fragment-space boundaries produce clean shirt/short/sock edges, with collar/hem trim, sock bands, boots and distinct goalkeeper sleeves.
- `animationSampler.ts` / `locomotionPhase.ts`: pure canonical sampling. A centered 0.5-second distance window smooths cosmetic speed without changing position interpolation. Idle/walk/jog weights use the existing measured-speed ranges. A fixed 0.05-second canonical integration grid compiles signed gait travel once per immutable player, with a stable identity phase. Reversing travel now reverses clip phase continuously instead of blending opposing forward/backward leg poses. A small pelvis turn and compensating spine cue soften lateral locomotion while preserving canonical root yaw. The integration cache contains scenario-derived values, never playback history or frame deltas.

Each frame reads the existing absolute replay time. Three paused actions receive explicit clip times/weights and evaluate with **`mixer.update(0)`**, never accumulated `update(delta)`. There are no accumulated fades or root motion. Cosmetic bone twists restore the preceding unmapped mixer pose before evaluation, because Three can skip an unchanged binding; this prevents twists from accumulating on paused/repeated timestamps. Tests compare actual bone transforms after forward/backward seeks, restart and all speeds for both rosters.

The single skinned mesh uses a conservative local sphere centered at `(0, .95, 0)`, radius `1.65m`, rather than universally disabling culling. Tests verify all deformed vertices across all three clips against this envelope. It is intentionally specific to this locomotion asset; reassess it when 3B.3 adds football actions. Geometry, shader program, atlas and sanitized clips are shared; bones, skeletons, mixers and action playback state are independent.

## Performance methodology and reproduction

The [benchmark script](../frontend/scripts/benchmark-characters.mjs) launches installed headless Chrome serially at 1440×1100 CSS pixels, DPR 1 and 1.5 (the canvas's normal upper DPR setting). Each camera/scenario/configuration gets a fresh browser context, **five seconds of active warmup and twenty seconds of active replay**, covering the full authored sequence. It records mean/median/p95 frame intervals, achieved rAF FPS, slow-frame counts/streaks, mean/max draw calls, triangles including shadow passes, renderer geometry/texture object counts, readiness time, GLB request count and scenario-switch latency/resources. Object counts are not GPU memory bytes. Readiness measures named rigs attached to the scene; warmup handles shader compilation.

The harness resolves the **exact Vite module URL already mounted by the page**, including its `?t=` suffix, and asserts that the **live ball actually moves** from the start position to the terminal position. An initial exploratory run imported a bare store URL and could control a second store; those measurements were discarded and replaced. The earlier three-second Phase 3B.1 observations are superseded by this verified comparison.

Run against the ordinary development server:

```sh
cd frontend
node scripts/benchmark-characters.mjs --output=../output/benchmarks/characters.json
node scripts/benchmark-characters.mjs --modes=skeletal --scenarios=the-invisible-run,the-missed-chance --output=../output/benchmarks/3b2-optimized.json
```

The actual pre-optimization comparison uses an isolated archive of committed `cfd7f67` on port 5174, with only its Voss-only conditional changed to accept `characters=procedural|single|skeletal`. The source checkout is never reset. Reproduce the archive with `git archive cfd7f67 | tar -x -C /tmp/butterfly-3b2-baseline`; link its `frontend/node_modules` to the installed dependencies and give its Vite configuration a separate `/tmp` cache directory, then run it on port 5174. The experimental conditional is:

```tsx
new URLSearchParams(location.search).get('characters') === 'skeletal' ||
(new URLSearchParams(location.search).get('characters') !== 'procedural' &&
 scenario.id === 'the-invisible-run' && player.id === 'a9')
```

```sh
node scripts/benchmark-characters.mjs --url=http://localhost:5174 --output=../output/benchmarks/3b2-before.json
```

Raw results are retained in `output/benchmarks/` (ignored generated artifacts). Benchmarks run without the test suite competing for GPU resources. These local, display-refresh-limited rAF results are **not GPU timings or evidence of large headroom**, and cannot establish cross-device performance. Isolated scheduling/GC stalls can also affect a procedural or single-rig run; use draw/resource reductions and repeated comparable views alongside frame intervals.

Measured on the development arm64 Mac using Chrome 155. Values below span both camera views/DPRs (the optimized row includes both scenarios):

| Configuration | Mean interval, ms | Median / p95, ms | Achieved rAF FPS | Mean draw calls | Triangles incl. shadows | Geometry / texture objects |
| --- | --- | --- | --- | --- | --- | --- |
| Original procedural | 16.67–16.88 | 16.7 / 16.7 | 59.25–60.00 | 680–718 | 62,550–66,028 | 70–78 / 25–26 |
| Original single rig | 16.67–17.14 | 16.7 / 16.7–16.8 | 58.35–60.00 | 669–707 | 88,426–91,896 | 79–87 / 33–34 |
| Original 22-rig experiment | 16.67–16.82 | 16.7 / 16.7–16.8 | 59.45–60.00 | 457–476 | 633,691–635,124 | 99–108 / 201–202 |
| Optimized 22 rigs | 16.67–16.88 | 16.7 / 16.7–16.8 | 59.25–60.00 | 107–124 | 614,445–635,036 | 71–79 / 27 |

Full-team draw calls decrease about **74–77%**, texture object counts about **87%**. The triangle workload remains large because this milestone preserves the mesh and its shadows, with conservative frustum culling rather than an LOD system. Near-refresh FPS across these cases does not demonstrate that the optimized renderer has substantial unused GPU capacity.

Original full-team scene readiness ranged **1.12–1.95s**, optimized **0.84–1.71s**; these cold-context samples include development-server/module variability and should not be treated as an isolated loading-speed comparison. Each rigged configuration made **one GLB request**, including scenario switches. Two-frame scenario-switch probes improved from **363–657ms** to **53–137ms**. Resource counts stayed bounded after switching; a separate browser test performs ten switches and checks both GPU object counts and material references.

The worst optimized 20-second sample had 11 frames above 25ms out of 1,187 intervals, with a longest streak of four; other samples had none. All optimized p95 values remain 16.7–16.8ms. This meets the practical desktop target on this machine with occasional local stalls, not a guarantee of uninterrupted 60 FPS. All 20 comparison cases verified live ball movement and completed without runtime/shader errors.

A final **60-second active replay stress sample**, five-second warmup, broadcast at DPR 1.5, completed three sequences with two restarts: **3,578 intervals, mean 16.768ms, median 16.7ms, p95 16.8ms, 59.64 FPS**. There were 17 intervals above 25ms, with a maximum two-frame streak. It retained one asset request, 22 rigs and 27 texture objects, with no runtime/shader errors. Reproduce with:

```sh
node scripts/benchmark-characters.mjs --modes=skeletal --dprs=1.5 --cameras=broadcast --seconds=60 --warmup=5 --output=../output/benchmarks/3b2-stress.json
```

The verified measurements are also preserved in [the repository benchmark record](benchmarks/phase-3b2.json). This remains a local headless-browser measurement, not a cross-device or thermal endurance benchmark.

## Verification

Frontend commands from `frontend/`:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

TypeScript, ESLint and production build pass. Vitest: **33 passed**, including actual imported bones for both 22-player rosters, canonical speed/phase boundaries, backward seeking, clip bounds, correct kit data, reference-counted shared materials and idempotent disposal. The replay JS chunk is approximately **1,001kB / 269kB gzip**; Vite's existing nonblocking size warning remains. No package dependency was added.

Playwright: **19 passed**. New coverage checks all 22 roots/bone poses/kits in each scenario at 0, 3, 9, 10.4, 14 and 20 seconds; 0.5×/1×/2× and backward seeking; real mesh selection/hover; POV hiding; original tactical interactions; ten scenario switches with bounded GPU/material resources; exactly one asset request; missing/invalid model fallback without retry storms. Node-to-Chrome canonical yaw comparisons use 1e-12 tolerance for engine-level `atan2` rounding, while repeated in-browser bone snapshots compare exactly. Existing mouse/touch/keyboard timelines, camera changes, health/CORS, complete match outcomes and tactical evidence/hash regressions remain green.

Captured and visually inspected both full-team broadcast views, both overhead views, opposing colored players and the goalkeeper, including The Invisible Run at 9/14 seconds and The Missed Chance during its attack. The surface number stays attached through the inspected torso poses; some contact/sliding and generic goalkeeper posture remain visible.

Backend regression commands from `backend/` (installed `uv` is outside the sandbox PATH):

```sh
UV_CACHE_DIR=/tmp/butterfly-uv-cache /Users/pavitar/.local/bin/uv run --no-sync pytest
UV_CACHE_DIR=/tmp/butterfly-uv-cache /Users/pavitar/.local/bin/uv run --no-sync ruff check .
```

**59 passed, 1 skipped**, Ruff passes. The skipped test is the opt-in external SkillCorner-data integration. No backend changes were made. The existing Starlette/httpx deprecation warning remains.

## Historical 3B.2 limits and subsequent Phase 3B.3

The full team is recognizably human, consistently styled and color/number differentiated, but all characters share the same athletic body/head asset. The material-based shirt follows the original sculpt instead of adding tailored fabric geometry. Numbers remain surface-bound during torso motion, though perspective/curvature and broadcast size can reduce legibility. Generic hand poses, some lateral foot sliding and small contact variations remain. Reversed forward locomotion is still a compromise for backpedalling; there is no true strafe clip or planted-foot solver. No IK, physics, retargeting framework, cloth or facial animation was added.

The original 3B.2 milestone did not claim football actions. The subsequent [3B.3 action layer](FOOTBALL_ACTIONS.md) supplies pass, receive and shot poses, improves sole penetration, and revalidates culling, determinism and performance. The remaining paragraph describes the historical foundation. No goalkeeper dive pose is claimed. 3B.3 can extend the sampler's existing `action` slot using canonical event IDs/times, while preserving absolute-time evaluation. Revalidate animated bounds, contact alignment and performance for each added action. The measured full-team architecture is ready for that milestone; lower-end hardware and long-duration GPU/thermal headroom remain unmeasured.
