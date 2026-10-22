# Phase 3B — single skeletal player foundation

Implemented on 22 October 2026 from clean `main`, commit `8962cb83c805119d647afd4e0094e3dea1578b61`. No worktree, reset, commit or push. Reviewed README, replay, football realism and tactical architecture, renderer, camera, sampler, store, generated types and existing tests. Both Phase 3A scenarios and their evidence remain intact; no backend, canonical JSON, contracts, clock, camera or tactical calculations were changed.

## Demo

Run the API and frontend as described in [README](../README.md): `cd frontend && pnpm dev`, then open http://localhost:5173. In **The Invisible Run**, select **9 · Leon Voss**. He is the only skeletal prototype; the other 21 players retain the procedural renderer. All 22 Missed Chance players retain it.

Inspect 0, 3, 9, 10.4 and 14 seconds using the timeline. Voss blends slow walking into jogging as his recorded movement increases, then eases back toward idle/walking. Pause, seek backwards, change speed, restart, switch cameras and use **View from Leon's eyes**. Selection, ring, label, hover, trails and evidence interactions retain their existing behavior. His whole visual root is hidden in his POV. He does not kick at 14 seconds yet: football actions are the next milestone.

Browser screenshots are generated under `output/playwright/3b/`, with broadcast and close-up views at every requested timestamp. Close-ups temporarily frame the actual mounted character **in the test only**; the application camera implementation is unchanged. The missing-asset test forces a 404 and verifies that Voss remains selectable as a procedural mannequin while the replay plays.

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

## Prepared asset and reproduction

`frontend/public/characters/voss/player.glb`: **745,052 bytes**, **14,318 triangles**, **65 bones**, **8 material primitives**, no textures or external buffers. SHA-256: `4fd5b79211ca0b659f8a84fb1013949fe1ffc6d4c2ec4c802d4fe11d4fce303c`.

The standard-library-only [preparation script](../frontend/scripts/prepare_character.py) validates both archive hashes, selects `Base Characters/Godot - UE/Superhero_Male_FullBody.gltf` and `Unreal-Godot/UAL1_Standard.glb`, strips unused UV/color/texture payloads, assigns skin/kit/shorts/socks/boots/hair/eye regions, copies three clips by bone name and packs one self-contained GLB. The authored source skeleton includes a fixed −90° X root correction; preserve it. Local pelvis Z is vertical under that correction. Root animation, joint scale animation and other joint translations are removed; only relative pelvis vertical movement survives. World yaw 0 therefore still faces +Z, π/2 faces +X. No root-motion displacement or yaw is applied.

Rebuild from the exact official archives, retained outside the repository:

```sh
cd frontend
python3 scripts/prepare_character.py /tmp/butterfly-quaternius-base.zip /tmp/butterfly-quaternius-animation.zip
```

No asset conversion dependency was added. Geometry and clips are small enough for this prototype; 22 copies of this full mesh would still need profiling/LOD and draw-call work.

## Runtime architecture and determinism

- `ReplayScene.tsx`: minimal body substitution for scenario `the-invisible-run`, player `a9`. Existing canonical root transform, interaction handlers, selection ring and POV visibility remain in the original player wrapper. The default procedural body remains available, including during loading/failure.
- `animation/animationSampler.ts`: pure `scenario + player + replayTime → sample`. A centered 0.5s travel-distance window softens cosmetic speed at position keys. Smooth weights blend idle/walk/jog at 0.08–0.5m/s and 1.25–2.4m/s. Full gait cycles use recorded distance / 1.8m plus a stable per-number offset; idle uses replay seconds. Opposing body/travel headings smoothly blend reversed gait evaluation. Playback speed, wall time, prior pose and frame delta are absent.
- `animation/characterAssets.ts`: one cached immutable GLTF; `SkeletonUtils.clone` creates independent bones and skeletons. Each instance owns a mixer, cloned kit materials and spine-attached number geometry. No bone, mixer or mutable material state is shared. Geometry is shared. Source materials/geometry stay cached; owned mixers, skeleton GPU textures, materials and number geometry are cleaned up. Runtime also filters root animation tracks.
- `animation/AnimatedPlayer.tsx`: async load and validation failures retain the procedural body; stale async completions are ignored. An effect creates a fresh instance per setup, including StrictMode's cleanup/setup and scenario remounts. No disposable instance is created in a render memo.

Each frame reads the existing early frame-clock sample. Clip times and weights are assigned directly; paused mixer actions are evaluated with **`mixer.update(0)`**, never `update(delta)`. Reverse playback is cosmetic clip-phase evaluation, not negative elapsed time. There are no accumulated fades, warps, root motion or history-dependent transitions. Repeated timestamps produce identical bone transforms, including after backward seeks and speed changes.

Future event actions can extend the sampler's explicit `action` slot and consume canonical event IDs/timestamps. This milestone does not supply synthetic football body poses or infer awareness from heading.

## Validation and performance

Passing checks:

- `pnpm typecheck`, `pnpm lint`, `pnpm test`: **29 tests**, including pure sampling, boundaries/endpoints, playback speeds and actual imported bone transforms/independence/disposal.
- `pnpm build`: passes; replay JS chunk approximately 996.5kB (267.5kB gzip), plus the 745kB local GLB. Existing nonblocking large-chunk warning remains.
- `pnpm test:e2e`: **17 passed**, including both scenarios, original tactical evidence/hash verification, mouse/touch seeking, mesh click, hover, POV, repeated remounts, missing-asset fallback and actual live bone snapshots. Requested timestamps captured in both broadcast and close-up. Close-ups at all five requested timestamps were visually inspected. An attempted `pnpm exec playwright test tests/animation.spec.ts` could not start its sandboxed web-server probe because `uv` was absent from PATH; the full approved `pnpm test:e2e` run subsequently passed.
- Backend regression: `UV_CACHE_DIR=/tmp/butterfly-uv-cache /Users/pavitar/.local/bin/uv run --no-sync pytest` and the same prefix with `ruff check .`: **59 passed, 1 skipped**, Ruff passes. The skip is the opt-in external SkillCorner data test; no backend edits. Bare `uv` was absent from the sandbox PATH, so its installed absolute path was used. Existing Starlette/httpx deprecation warning remains.

Local headless Chrome 155 on an arm64 Mac, 1280×633, DPR 1, default broadcast paused at 0 seconds, 179 frame intervals after dropping the first: procedural baseline mean **16.666ms**, median **16.7ms**, p95 **16.8ms**; prototype mean **16.666ms**, median **16.7ms**, p95 **16.8ms**. A verified active 1× playback sample from replay **9.000 to 11.997s** measured mean **16.666ms**, median **16.7ms**, p95 **16.8ms** over another 179 intervals. These approximately three-second rAF observations are refresh-limited, not GPU timing, a sustained performance benchmark or a claim about 22 characters. The initial rig scene reported 677 render calls and 89,044 triangles including shadow passes; render counts vary with camera/selection. Cross-device performance is unmeasured.

## Limits and next milestone

This is a genuine imported skeletal locomotion proof. The model has an athletic rather than photorealistic silhouette and much more articulated limbs than the procedural players. Kit colors are material regions over the original sculpt, not separate tailored clothing: fabric shape, seams and close-up hem/sock boundaries remain crude. Generic clenched-hand locomotion, some lateral foot sliding, simplified reversed walking, slight contact variation and number decal clipping at extreme torso bends remain possible. No strafe clips, planted-foot IK, football touch/shot animation or ball contact alignment is claimed. Broadcast scale makes the improvement subtler than the test close-ups.

The architecture is ready for a measured expansion to independently posed players and event-linked actions. Do not switch all 22 to this asset without a dedicated profile: shared geometry does not remove skinning or draw-call costs. Next: tune kit/number surfaces and gait contact, integrate licensed receiving/passing/shooting clips against original event times, then profile a 22-instance experiment before making it the default.
