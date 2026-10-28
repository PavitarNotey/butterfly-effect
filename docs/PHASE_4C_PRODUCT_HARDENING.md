# Phase 4C — Product hardening

The cost/request controls here remain current. [v4 tactical insight](AI_TACTICAL_INSIGHT.md) supersedes this milestone's v3 prompt, selected-moment packet size and blanket causal-word screening. Its additional context remains inside the same enforced cost/input/output bounds. No v4 live calls have been made.

## Investigation and design

Pre-existing `AGENTS.md` edits are preserved. Source and current contracts take precedence over historical reports. No canonical changes, paid model calls, deployment, Azure resources or new infrastructure are authorized for this phase.

Initial findings:

- **P0:** Foundry has hourly worst-case attempt reservations, but no paid-generation switch, lifetime allowance or enforced estimated-spend ceiling. Prices default to zero (unset), and cost is only reported after completion. Retry accounting is too coarse for actual attempts.
- **P0:** Once a recap/moment/commentary is enabled, mode changes and some remounts automatically request generation. Server deduplication works, but it cannot prevent intentionally distinct mode requests from spending.
- **P1:** AI availability labels default to Foundry during failed, disabled or invalid status checks.
- **P1:** Match Center narrative evidence has no direct guided playback action, although the existing controller and validated bundle already support it in Studio.
- **P2:** First-time guidance is fragmented across controls. The subsequent desktop/tablet/mobile review retained the broadcast design and single replay clock.

Baseline: backend 162 passed / one optional skip; frontend 207 passed; typecheck, ESLint, Ruff and production build passed. Full browser baseline passed: 74 tests (5.7 minutes), completed before runtime edits.

Design: add a backend-owned, atomic per-attempt paid budget to the existing provider, with fail-closed enable/pricing checks, hourly/lifetime allowances, conservative UTF-8 input/schema plus maximum-output reservations, and conservative settlement on failure/cancellation. SDK retries remain disabled; each application retry reserves independently. Preserve cache/deduplication and allow cache-only reads without new generation. Keep aggregate diagnostics in a Python method, outside the public HTTP API.

Retain phase4-v3 storytelling instructions and factual validation. Compact redundant transport fields in model input without changing trusted source statements, citation allowlists or served contracts. Use per-task output ceilings and report offline size estimates separately from actual provider usage/billing.

Frontend generation starts only from explicit actions. Mode switches may retrieve saved/in-flight content, but cannot create it. Refresh controls will say whether they check saved content or request analysis. Reuse the existing guided controller for “Show me why,” validated against the active scenario/event/source and the current evidence bundle. Preserve one canvas/store/clock.

For visual changes retain charcoal #0d1216, navy #111c28, dividers #2a3947, paper #f1f1e9, muted #aebbc9 and lime #c8ed8d with the existing type system. Keep the pitch central and add a compact, optional introduction rather than a blocking tutorial. The existing 32/68 desktop layout and responsive stack are retained; no animation dependency was added.

The Foundry skill dependency check reports missing `azd`. No CLI installation or cloud workflow is needed for this SDK/local-code task. Current SDK guidance was checked with Context7; accessibility guidance was fetched from the Web Interface Guidelines source.

## Implemented cost policy

`AI_PAID_GENERATION_ENABLED=false` is the default, including when credentials are present. Both configured deployment prices must be positive before a Foundry submission is permitted. `.env.example` contains the complete configuration; no private environment contents were inspected, copied into outputs or edited for this work.

| Setting                                     |    Default | Meaning                                                                 |
| ------------------------------------------- | ---------: | ----------------------------------------------------------------------- |
| `AI_CALLS_PER_HOUR`                         |         40 | Actual paid submissions, including retries, over a rolling hour         |
| `AI_CALLS_PER_LIFETIME`                     |         12 | Actual paid submissions since this service process started              |
| `AI_ESTIMATED_BUDGET_USD`                   |       0.25 | Estimated accounted cost plus outstanding reservations                  |
| `AI_CONCURRENCY`                            |          2 | Concurrent generation sets; pending unique sets remain bounded to eight |
| `AI_REQUESTS_PER_MINUTE`                    |         12 | Per-client HTTP request allowance, including saved reads                |
| `AI_MAX_RETRIES`                            |          1 | Application retry; SDK retries remain zero                              |
| `AI_TIMEOUT_SECONDS`                        |         35 | Each SDK attempt; existing bounded service timeout retained             |
| `AI_MAX_INPUT_BYTES`                        |      64000 | Instructions, compact input and output-schema UTF-8 bytes               |
| `AI_MAX_OUTPUT_TOKENS`                      |       3500 | Global output ceiling, intersected with the task ceiling                |
| `AI_MOMENT_OUTPUT_TOKENS`                   |       1400 | Short event explanation                                                 |
| `AI_RECAP_OUTPUT_TOKENS`                    |       1600 | Match recap                                                             |
| `AI_COMMENTARY_OUTPUT_TOKENS`               |       3500 | Complete ordered cue set                                                |
| `AI_CACHE_ENTRIES` / `AI_CACHE_TTL_SECONDS` | 128 / 3600 | Existing bounded LRU and TTL                                            |
| Input/output USD per million                |      0 / 0 | **Unconfigured**, never free; both must be supplied                     |

A short lock protects allowance checks, attempt increments and Decimal-valued reservations across async tasks and threads. No lock is held during network I/O. Each attempted submission reserves `(input_bound × input_rate + max_output × output_rate) / 1,000,000`. The input bound uses every UTF-8 byte of instructions, compact input and schema as a conservative token allowance, plus 4096 tokens of protocol/schema overhead. The existing 40000-character packet limit also remains. This deliberately over-reserves relative to the offline bytes/4 comparison; it is not an exact tokenizer or a guarantee about Azure's accounting.

Known returned usage replaces that attempt's cost reservation with its estimated cost. An unexpectedly larger usage report is recorded without clamping, blocking later work as appropriate. Missing/partial usage, parsing failure, network failure and cancellation retain the full reservation. Settlement is idempotent. Attempt slots are never refunded; each retry must pass a fresh reservation. Quota/auth/deployment errors do not trigger costly retries. Rejected reservations never invoke `responses.parse`.

Browser disconnects still do not cancel a shared generation needed by other viewers. The task can finish and populate cache; the user-requested attempt remains accounted. Service shutdown cancels pending work, settling submitted attempts conservatively. Mock work remains separately bounded and records zero paid attempts.

These are **single-process development/demo controls**, not a hard Azure or subscription-wide billing cap. Process restarts reset counters; multiple workers/instances multiply them. A crash loses in-memory accounting and cache. Network outcomes and provider billing may differ from returned usage and estimates. Pricing must match the actual deployment and billing currency; cached-input discounts and billing adjustments are not modeled. Configure current rates from the deployment's Azure pricing information, not from the illustrative comparison below. Environment changes apply when settings are loaded; restarting also resets local counters. Do not reset/restart merely to bypass exhausted allowances.

`IntelligenceService.diagnostics()` exposes provider, paid-enable/pricing state, actual SDK attempts, failed/uncertain attempts, cache hits, in-flight joins, cache-only misses, validation rejection/fallback counts, mock generations, request/budget rejections, returned tokens, estimated accounted/reserved cost, remaining allowances, pending sets and cache size. It intentionally has **no HTTP route** and contains no keys or raw model prose. Inspect it only inside the trusted running process (for example through an existing local debugger); a new Python process cannot read another process's counters. Returned per-request usage remains a separate existing response contract; absent usage is not an assertion of zero billing.

## Intentional generation and saved analysis

Only explicit **Analyze this moment**, **Explain this moment**, **Enable AI commentary**, **Request commentary**, or a user retry of that generation action may create work. Even those reuse a matching current cache/in-flight task first. Opening pages, mounting components, mode changes, collapse/expand, playback, camera changes, seeking, speed changes, evidence playback and route transitions cannot create generation through a React effect.

After a viewer has requested content, mode changes check saved results using the additive `cache_only` input. `Check saved analysis` does the same. A cache-only request may join an existing task, but a miss returns 409 without creating one. The UI then offers an explicit request action. Retry preserves whether the failed action was a saved read or a generation request. Rapid identical clicks are guarded synchronously in the hook and deduplicated again by the service. StrictMode may repeat safe status/saved reads; generation is performed by an event handler.

Cache identity includes the packet's source/evidence fingerprint, mode, prompt version, provider, model, compact transport version and effective output ceiling. TTL, eviction, hash validation and deep copies remain. Successful same-key content stays visible if a saved check fails; stale scenario/event/mode responses are aborted and ignored.

### Request-count verification

The browser suite uses only the isolated port-8001 mock API. The baseline commentary test counted generation-capable HTTP requests and asserted one additional request on an uncached mode switch; it allowed one or two initial StrictMode fetches. The new test-owned mock cache records generation-eligible submissions separately from safe saved reads and new mock results. Python tests independently assert actual SDK `parse` counts with fake responses and atomic service accounting. These are different measurements; HTTP requests are not automatically billable model attempts.

| Interaction                                 | Before: generation-capable HTTP delta | After: generation-capable HTTP delta |
| ------------------------------------------- | ------------------------------------: | -----------------------------------: |
| Open home / match                           |                                     0 |                                    0 |
| Playback / seek / camera                    |                                     0 |                                    0 |
| Enable commentary under StrictMode          |          1–2 allowed by baseline test |                                    1 |
| Switch commentary to an uncached mode       |                       1 automatically |               0; one safe saved read |
| Explicitly request that new commentary mode |        Included in automatic behavior |                                    1 |
| Check existing analysis                     |          1 generation-capable request |               0; one cache-only read |
| Watch verified evidence                     |                                     0 |                                    0 |

The deterministic request-count journey also covers three rapid clicks, uncached/cached mode switches, a saved check, collapse/expand and a committed route remount. Its measured counters are saved in `output/playwright/phase4c/request-counts.json`; final values and suite results are recorded below.

## Efficiency and factual protections

The storytelling instructions remain **phase4-v3**. Request transport/cache identity is **phase4c-compact-v1**. The model no longer receives each event stream envelope's redundant `id`, `sequence` and repeated `evidence_ids`. Canonical `event_id`, type, time, match time and player IDs stay. Every source ID, exact source statement, unit, citation allowlist, hash, threshold, limitation and recorded match fact is unchanged. Served event streams and public evidence are unchanged. Tests compare every retained field across all scenarios and request kinds.

No validator or tactical engine change was made. Analyst still requires two distinct relevant measurements when available; recap match-event/final-score anchors remain mandatory. Generated prose stays qualitative. Reference, quantity, causal/intent, probability, counterfactual and markup protections remain. Mock Casual recaps now include one optional real measured citation so the offline demo can offer a supporting guided replay; the unchanged validator screens it. Live Casual output without measured support retains Studio/evidence navigation instead of inventing an observation.

Run `uv run python -m ai.estimate` from `backend/` for the offline comparison. It constructs no provider and sends no request. Values below use UTF-8 bytes/4, including instructions/schema, as a **rough relative size estimate**, not real token usage. The conservative budget reservation is substantially larger.

| Untouched-pass request | Before rough input | After rough input | Before max output | After max output |
| ---------------------- | -----------------: | ----------------: | ----------------: | ---------------: |
| Casual moment (pass)   |               4719 |              3523 |              3500 |             1400 |
| Analyst moment (pass)  |               4788 |              3592 |              3500 |             1400 |
| Casual recap           |               5903 |              4707 |              3500 |             1600 |
| Analyst recap          |               5971 |              4775 |              3500 |             1600 |
| Casual commentary      |               6602 |              5406 |              3500 |             3500 |
| Analyst commentary     |               6806 |              5610 |              3500 |             3500 |

Across the three scenarios this removes approximately 16–25% of estimated input, while preserving all facts. Short moment ceilings decrease 60%; recap ceilings decrease approximately 54%; multi-event commentary stays at 3500 to avoid truncating a complete cue set. A lower ceiling is not a guarantee of lower actual output, and mock fixtures cannot establish live completion quality. There is no automatic retry for incomplete/invalid structured output; labeled authored fallback remains.

For **illustrative rates only** of $1 per million input / $2 per million output, the Analyst recap's rough input plus maximum output estimate changes from $0.012971 to $0.007975. Its actual conservative reservation is $0.026396 (23196 input allowance + 1600 output). These are not current Azure prices or actual charges. With unconfigured prices the diagnostic estimate is `null` and paid work is refused.

## Evidence-to-replay design

The prominent **Show me why** action appears when the narrative cites measured replay evidence. `useEvidenceReplay` loads the existing bundle through SHA-256 and structural/reference validation. It requires matching scenario/source identity, a cited source/evidence ID, the exact server-owned observation, overlapping canonical event references and a supporting authored moment. Match Center additionally checks the existing league-to-canonical replay mapping. Generated prose never selects the target or supplies geometry.

The action installs the validated bundle, starts the existing Zustand guided replay, scrolls to the one embedded canvas and focuses its caption. Existing category framing, relevant-player highlights, tactical layer, captions, slowed playback, completion, replay-again, close and restoration remain. MatchViewer now renders the same GuidedHUD used by Studio; there is no second canvas, timer or store. The previous camera, speed, selection, tactical settings and time use the existing restoration context. Missing/stale evidence yields a useful retryable message. Mode/scenario/route changes abort evidence loading and cannot attach it to another passage.

The tests exercise all three Match Centers on desktop and mobile, exact evidence identity, completion, replay-again, keyboard focus, return to the previous time/camera, no extra analysis request, stale hashes, missing moments and navigation during loading. Existing unit tests continue to verify interval boundaries, single-clock seeking and restoration/interruption.

## UX, accessibility and website review

- Availability now distinguishes checking, authored demo, configured on-request Foundry, paused generation, disabled/invalid configuration and unreachable service. No default/static label implies a successful live connection. Existing AI-generated/demo/fallback provenance remains visible.
- Casual/Analyst descriptions explain the reading style and that mode changes check saved analysis. Errors preserve successful same-key content and explain usage-control pauses without exposing administrative diagnostics.
- Technical evidence remains in a closed native disclosure. Primary prose and the replay takeaway precede measurements.
- A restrained **How to explore** native disclosure explains the synthetic passage, playback, perspective, explicit analysis and guided evidence. It creates no modal, account or persisted preference. The replay remains immediately operable.
- New buttons use the existing 44px touch targets, keyboard activation, focus styling, disclosure relationships and loading announcements. Guided playback focuses its caption; returning focuses Show me why. Reduced-motion behavior remains.
- Match preview labels/footnotes were raised from tiny 5–9px captions to readable 11px where appropriate; supporting format labels use 9px. Tablet idle controls keep a simple reading order instead of introducing extra grid rows for status/hints.
- Home, fixtures/results, standings, Match Center, Replay Studio, scenario library, fixture navigation and upcoming fixtures were inspected at 1440, 1024 and 390px. No document-level horizontal overflow was found; the standings table intentionally scrolls inside its region on mobile. Screenshots and keyboard journeys cover all primary routes.

## Replay realism and performance review

No canonical track, event, outcome, score or tactical geometry was changed. Existing deterministic animation, shot contact, goalkeeper/defender reactions, simulated gaze, POV, broadcast framing and goal/miss behavior were retained. The full browser suite reviews actual skeletal poses, canonical roots/ball, opening/pass/receive/shot/post-event frames, seek/restart/speed/camera transitions, all scenarios and resource cleanup. Additional Match Center captures show the untouched pass, receiving/finish evidence and the wide miss with its actual supporting overlays. No reproducible new football presentation defect justified altering the animation systems.

The Match Center scene stays memoized while DOM time updates. Hidden commentary no longer keeps its 20Hz cue-rendering subtree mounted; its saved request state remains in the parent. Repeated preview/Studio transitions record frame samples and GL resource counts, verify one canvas/22 rigs and stable geometry/texture/GLB-request counts. Home has no canvas. Headless frame samples are local observations, not physical-device FPS guarantees.

Production WebGL (1019.39 kB / 275.37 gzip) and canonical data (608.04 / 130.01 gzip) bundles are unchanged from baseline. The main bundle changes 293.49 → 293.44 kB (91.79 → 91.78 gzip); AI panel grows 12.72 → 16.88 kB (4.68 → 6.04 gzip) for explicit request/evidence handling. The known >500 kB lazy-bundle warning remains visible. Splitting established Three/R3F dependencies offered no demonstrated net benefit here; no renderer/dependency rewrite was made.

## Separately approved live verification — not executed

No live Foundry call was made in Phase 4C. Historical v2 verification is not evidence that v3 plus compact transport and new ceilings works live.

After the user explicitly approves **at most two paid requests**, configure valid backend credentials, explicit positive deployment prices, paid enable, concurrency 1, `AI_CALLS_PER_LIFETIME=2`, `AI_CALLS_PER_HOUR=2`, and an estimated ceiling covering the reservations. Stop after a failed/fallback response; do not silently run additional attempts.

Run only these two commands from `backend/`, once each:

```bash
uv run python -m ai.smoke recap --mode casual
uv run python -m ai.smoke recap --mode analyst
```

Each command fixes retries to zero and max output to 1400, so there are at most **two submissions and 2800 output tokens**. The default input-byte bound permits at most `2 × (64000 + 4096) = 136192` reserved input tokens; total bounded token allowance is 138992. The current untouched-pass requests reserve 22923 + 23196 = 46119 input tokens offline (settings/schema changes require rechecking). At illustrative $1/$2 rates, the broad configured bound would reserve $0.141792; current packet reservations total $0.051719. Use actual configured prices to compute approval cost.

Each smoke command is a fresh process with independent counters; the documented two-command count is the procedural aggregate limit, not a shared cross-process counter. Do not run the web server concurrently for this check. Confirm both return `provider=foundry`, the current `PROMPT_VERSION` (`phase4-v4-tactical-insight`), the intended mode and the required measured references, with no authored fallback. Retain safe token/provenance logs. Then set paid enable back to false. A failed or incomplete response consumes that request; any further experiment needs new approval.

## Deployment deferrals and limitations

Public multi-instance deployment needs durable shared atomic quotas/idempotency, aggregate spend monitoring, trusted client identity/rate limiting, access controls appropriate to generation, ingress/retry behavior, secret management, deployment-specific price review and Azure-side budget alerts/quotas. None was provisioned. An Azure cost alert alone must not be described as a real-time stop mechanism.

No live connectivity, paid completion quality, multi-worker budget enforcement or physical mobile device testing is claimed. Lexical screening and valid citations remain conservative safeguards rather than a semantic proof of generated prose. Third-person/POV attention and body language remain simulated. Saved-only misses and service failures leave deterministic replay and measured evidence available. The locally absent `azd` CLI was not installed because no cloud/agent deployment workflow was required.

Recommended next milestone: a separately approved two-request v3/compact-transport verification, followed by a deployment design review for durable quotas and production operation. Do not deploy or enable broader paid traffic as part of this task.

## Exact file inventory

The initial working tree contained only pre-existing `AGENTS.md` edits. Those are preserved; this phase adds current cost/request/evidence rules and a report link to that file. All other listed changes belong to Phase 4C. Generated contracts changed only for additive `cache_only` inputs.

<details>
<summary>Changed and added files (36)</summary>

- [AGENTS.md](../AGENTS.md)
- [README.md](../README.md)
- [backend/.env.example](../backend/.env.example)
- [backend/README.md](../backend/README.md)
- [backend/ai/budget.py](../backend/ai/budget.py)
- [backend/ai/config.py](../backend/ai/config.py)
- [backend/ai/errors.py](../backend/ai/errors.py)
- [backend/ai/estimate.py](../backend/ai/estimate.py)
- [backend/ai/models.py](../backend/ai/models.py)
- [backend/ai/providers.py](../backend/ai/providers.py)
- [backend/ai/request.py](../backend/ai/request.py)
- [backend/ai/routes.py](../backend/ai/routes.py)
- [backend/ai/service.py](../backend/ai/service.py)
- [backend/openapi.json](../backend/openapi.json)
- [backend/tests/test_ai.py](../backend/tests/test_ai.py)
- [backend/tests/test_ai_budget.py](../backend/tests/test_ai_budget.py)
- [docs/PHASE_4C_PRODUCT_HARDENING.md](../docs/PHASE_4C_PRODUCT_HARDENING.md)
- [docs/PHASE_4_1_AI_MATCH_CENTER.md](../docs/PHASE_4_1_AI_MATCH_CENTER.md)
- [docs/PHASE_4_AI_INTELLIGENCE.md](../docs/PHASE_4_AI_INTELLIGENCE.md)
- [frontend/src/App.css](../frontend/src/App.css)
- [frontend/src/ReplayStudio.tsx](../frontend/src/ReplayStudio.tsx)
- [frontend/src/ai/Intelligence.css](../frontend/src/ai/Intelligence.css)
- [frontend/src/ai/IntelligencePanel.tsx](../frontend/src/ai/IntelligencePanel.tsx)
- [frontend/src/ai/MatchRecap.tsx](../frontend/src/ai/MatchRecap.tsx)
- [frontend/src/ai/ai.test.tsx](../frontend/src/ai/ai.test.tsx)
- [frontend/src/ai/client.ts](../frontend/src/ai/client.ts)
- [frontend/src/ai/presentation.ts](../frontend/src/ai/presentation.ts)
- [frontend/src/ai/useEvidenceReplay.ts](../frontend/src/ai/useEvidenceReplay.ts)
- [frontend/src/ai/useIntelligenceRequest.ts](../frontend/src/ai/useIntelligenceRequest.ts)
- [frontend/src/api/schema.d.ts](../frontend/src/api/schema.d.ts)
- [frontend/src/league/MatchViewer.tsx](../frontend/src/league/MatchViewer.tsx)
- [frontend/src/pages/MatchPage.tsx](../frontend/src/pages/MatchPage.tsx)
- [frontend/src/replay/ReplayIntroduction.tsx](../frontend/src/replay/ReplayIntroduction.tsx)
- [frontend/tests/ai-match-center.spec.ts](../frontend/tests/ai-match-center.spec.ts)
- [frontend/tests/ai.spec.ts](../frontend/tests/ai.spec.ts)
- [frontend/tests/hardening.spec.ts](../frontend/tests/hardening.spec.ts)

</details>

New modules separate the safe exception type, atomic budget, compact request preparation and offline size comparison; the frontend evidence hook reuses the established validator/controller. Existing browser assertions are retained with explicit actions added where automatic mode generation was intentionally removed. No new dependency was added.

## Final verification record

| Check                                                                                         | Result                                                      |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Baseline backend / frontend / browser                                                         | 162 passed + 1 optional skip / 207 passed / 74 passed       |
| Final backend (`uv run python -m pytest -q`)                                                  | **184 passed, 1 optional skip**                             |
| Backend Ruff (`uv run ruff check .`)                                                          | Passed                                                      |
| Changed Python formatting (`ruff format --check ai tests/test_ai.py tests/test_ai_budget.py`) | Passed                                                      |
| Frontend typecheck / lint                                                                     | Passed                                                      |
| Frontend Vitest                                                                               | **209 passed**                                              |
| Production build                                                                              | Passed; existing lazy WebGL/data size warning retained      |
| Full Playwright regression                                                                    | **86 passed, zero retries, 7.5 minutes**                    |
| Final hardening rerun after 44px guided-control adjustment                                    | **12 passed**                                               |
| Additional invalid league-reference browser regression                                        | **1 passed**; 87 distinct browser cases have been exercised |
| Final desktop/mobile evidence screenshot journeys                                             | **2 passed**, all three scenarios in each journey           |
| All three authoring recipes, check mode                                                       | Passed, no writes                                           |
| OpenAPI / TypeScript schema regeneration                                                      | Completed for additive cache-only inputs                    |
| Canonical hashes / ledger / prompt and validator diff                                         | Unchanged                                                   |
| `git diff --check`                                                                            | Passed                                                      |

The existing Starlette/httpx deprecation warning remains; no dependency migration was needed. `uv` required access to its existing cache outside the workspace sandbox; the approved reruns passed. No requested check remains blocked. Screenshots use desktop/tablet/mobile browser emulation, not physical devices.

The final mock count journey recorded **two generation-eligible submissions / two new mock results / three safe saved reads** across opening, playback, seeking, cameras, three rapid clicks, two modes, saved checking, collapse/expand and route remount. Three rapid clicks created one submission. The uncached mode change, saved check and remount created zero new mock results. These UI mock counts are not Azure calls. The fake-SDK backend tests independently verify rejected requests submit zero times, distinct concurrent requests cannot bypass lifetime/spend reservations, retries require new allowances, and cancellation/unknown usage remains charged to the local estimate.

Local two-second active renderer samples across preview → Studio → preview → Studio recorded one canvas, 22 rigs, **89 draw calls / 532802 triangles / 55 geometries / 27 textures / one GLB request** at every transition. Median frame time was approximately 16.7ms and p95 16.7–16.8ms. These short headless measurements support the cleanup/resource comparison; they are not a universal FPS claim. The exact local measurements are in `output/playwright/phase4c/render-resources.json`.

The three unchanged source hashes are:

<details>
<summary>Canonical traceability</summary>

- Invisible Run: `8d2667ffaf9b1475ef40acfc8aa2f5319011abb14e22c2a80208139f3f9b7e30`
- Missed Chance: `0d9214e800ed9053d40ff4f8fa94272a930d3bc9453af3f082fe8913bb3f9bee`
- Untouched Pass: `877de5ba96de6b8c50d7c4c05725665b87119927c4280cf1640c5fda98fad439`

Their durations remain 13.2 / 12 / 13.6 seconds, with goal / miss / goal outcomes. League results remain 2–1 / 0–1 / 2–1 for Aurora / Solstice / Vesper respectively. No canonical JSON, match ledger, `prompts.py`, `citations.py`, `validation.py` or tactical engine file changed.

</details>

## Screenshots

These local review artifacts are intentionally ignored by Git under `output/`; regenerate them with the hardening browser journeys. They contain mock/authored content. The desktop ready capture frames the experience beneath sticky navigation; full-page screenshots taken while scrolled can otherwise misrepresent sticky element positions.

<details>
<summary>Updated Match Center, guided replay, Studio and mobile views</summary>

### Match Center — desktop

![Match Center: authored recap, closed evidence and Show me why beside the replay](../output/playwright/phase4c/vesper-tidal-ready-1440.png)

### Embedded supporting replay

![Untouched-pass supporting replay, exact player highlights and existing guided controls](../output/playwright/phase4c/the-untouched-pass-guided-1440.png)

### Replay Studio

![Replay Studio with optional introduction and existing football controls](../output/playwright/phase4c/studio-1440.png)

### Mobile explanation

![Mobile Match Center with readable narrative and Show me why](../output/playwright/phase4c/vesper-tidal-ready-390.png)

### Mobile evidence playback

![Mobile missed-chance replay with its caption below the unobstructed pitch](../output/playwright/phase4c/the-missed-chance-guided-390.png)

[Tablet Match Center](../output/playwright/phase4c/match-1024.png), [mobile Studio](../output/playwright/phase4c/studio-390.png), [homepage](../output/playwright/phase4c/home-1440.png), [fixtures](../output/playwright/phase4c/fixtures-390.png), [standings](../output/playwright/phase4c/standings-390.png), [scenario library](../output/playwright/phase4c/library-1440.png).

</details>

The working tree is ready for review, including the preserved earlier `AGENTS.md` changes. No commit/push, deployment, provisioning, paid request or private-environment edit was made. Paid completion quality remains deliberately unverified until a separate explicit approval.

## Dropdown styling follow-up

The subsequent dropdown review consolidates native speed, scenario and Moment to explain controls plus the existing player/tactical moment pickers in `frontend/src/Dropdowns.css`. They share dark surfaces, lime chevrons, selected/focus states, readable typography and 44px targets. Supporting browsers receive themed native select popups through `appearance: base-select`; other browsers retain native interaction with the styled control and dark color scheme. No dropdown interaction/state system or dependency was added.

Removed conflicting native-select rules from `App.css` and `ai/Intelligence.css`, imported the shared stylesheet in `App.tsx`, and rendered speed/scenario option labels as single text strings so customizable native options do not insert flex gaps between React text nodes. The scenario heading gives its control a stable width; playback controls wrap at very narrow widths.

All five dropdowns were opened and visually inspected at 1440, 1024, 390 and 320px, with selection, Escape/focus restoration, menu bounds and document overflow checks. Review screenshots and the offline browser script/results are in ignored `output/dropdowns/`. The existing AI, player-selection, tactical-picker and fixture-navigation browser suites passed **26 tests**. Frontend lint and production build passed. Backend, canonical data and model generation behavior are unchanged by this follow-up.
