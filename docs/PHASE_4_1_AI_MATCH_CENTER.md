# Phase 4.1 — AI-first Match Center

Implemented October 26, 2026. No commit or push.

## Baseline and design

The inspected Match Center placed its recap below the replay, a side-by-side event timeline and editorial content. Requests hid successful content during retries. Narrative disclosures exposed internal IDs and validation diagnostics. There was no animation dependency.

The final layout keeps the broadcast palette: charcoal `#0d1216`, navy `#111c28`, dividers `#2a3947`, paper `#f1f1e9`, muted type `#aebbc9`, lime `#c8ed8d`, with the existing sans-serif typography. The left intelligence column occupies approximately 32% of desktop content. The right column holds the replay, then the existing match timeline and editorial. A 620px replay minimum and 1100px breakpoint prevent a squeezed viewport. The panel sticks below the measured global chrome only on desktop screens at least 820px tall, with bounded internal scrolling. Tablet uses a compact stacked invitation; mobile uses a short invitation and keyboard-accessible collapse control.

## Experience and implementation

- `frontend/src/pages/MatchPage.tsx` and `frontend/src/Website.css`: left-hand lazy-loaded AI panel, responsive grid and height-aware sticky positioning. Existing scoreboards, fixture navigation, match URLs and Replay Studio links remain intact.
- `frontend/src/ai/MatchRecap.tsx`: idle, loading, ready, fallback and error states; Casual Fan/Analyst selection; **Analyze this moment**; refresh/retry; Microsoft Foundry attribution; direct **Open Replay Studio** action.
- `frontend/src/ai/AnalysisPresentation.tsx`, `presentation.ts`, `Intelligence.css`: shared neutral loading/error presentation, a brief evidence sweep and decorative tactical markers. Actual response completion starts the headline/sentence/takeaway reveal. Normal reveals finish in about 790ms; cached reveals finish in about 400ms. The sweep runs twice and stops, without claiming processing stages or imposing a loading delay. Reduced motion disables the animation. No dependency was added.
- `frontend/src/ai/useIntelligenceRequest.ts`: aborts and ignores stale mode/match/event requests, immediately hides content from other request keys, and retains the same successful narrative when a refresh fails. A successful-response revision controls reveal remounting; failed refreshes do not replay it.
- `frontend/src/ai/IntelligencePanel.tsx`: concise football headline, explanation and takeaway. Human-readable evidence is closed by default. Internal IDs, claim-screening diagnostics, repeated final-score/event inventories and the redundant highlight block are absent from the ordinary interface. Exact measured excerpts remain available, with existing guided-replay actions in Replay Studio. Provenance distinguishes **AI-generated**, **Authored demo** and **Authored fallback**. Commentary still samples the shared replay clock; errors use the same sanitized retry presentation.

## Storytelling and Analyst rejection diagnosis

`backend/ai/prompts.py` now asks for a memorable football detail, supported movement/position/timing relationships and a short replay takeaway, without opening on data structures or validation. Casual remains conversational; Analyst adds supported tactical depth. `backend/ai/providers.py` versions this as **phase4-v3**, invalidating older prompt cache entries, and aligns deterministic demo/fallback stories with the same presentation.

The earlier real Analyst recap rejection was **`Analyst requires measured spatial context`**: the prompt's mandatory list contained match-event and final-score references while the validator independently required measured references. The shared `backend/ai/citations.py` policy now supplies both prompting and verification with the same eligible IDs and measurement minimum. A subsequent real response failed **quantitative prose** screening; the prompt now explicitly names the existing prohibited words and qualitative alternatives. These prior fixes are retained. [The Phase 4 report](PHASE_4_AI_INTELLIGENCE.md#rejection-diagnosis) records the diagnosis and four earlier live calls, including passing Casual and Analyst recaps.

This phase adds structured rejection-log context in `backend/ai/service.py`: safe rule/reason, scenario, target IDs, mode and prompt version. It does not log provider prose or credentials. The fallback stays explicitly authored. No factual screen was disabled or relaxed. Pydantic output contracts, enum-constrained IDs, evidence hashes, numerical-source ownership, quantity/causal/intent protections, request limits, caching/deduplication and gpt-5-mini integration remain in place. Canonical scenarios, league catalog and tactical geometry are unchanged. The existing OpenAPI snapshot matches the current application; no public contract regeneration was needed for this phase.

## Verification

Automated tests use the test-owned port-8001 **mock** API. Foundry/fallback presentation tests relabel mock fixtures to exercise provenance; these are not live model results. **No paid Foundry requests were made for Phase 4.1.** The latest v3 wording has not been smoke-tested against Azure; another live test needs a separately stated count and approval under this phase's instructions.

- Backend: **159 passed, one existing optional skip**; Ruff and formatting checks passed. Includes all evidence/quantity/causal guards and a new structured-log test verifying that rejected prose is absent from logs.
- Frontend: **202 unit tests passed**; typecheck and ESLint passed.
- Browser: **all 71 Playwright tests passed** in 5.3 minutes, including all 12 AI journeys. The focused 12-test AI suite also passed before the full run.
- Production build passed. Main JS is 293.49kB, the lazy shared intelligence chunk 12.72kB, recap chunk 2.53kB and AI CSS 7.28kB before gzip. The existing 1.02MB lazy WebGL chunk warning remains visible. Motion uses CSS transforms/opacity, adds no replay-clock subscription and changes no per-frame world-state sampling. This is not a new FPS benchmark.
- `git diff --check`, public OpenAPI equality and unchanged canonical-data/catalog/geometry checks passed. Local credentials and browser artifacts remain ignored. Existing unrelated working-tree changes are preserved.

Browser coverage includes desktop/tablet/mobile panel placement, no idle generation, collapse and keyboard controls, response-gated reveal, cached animation, retained content after failed refresh, stale mode/match cancellation, provenance, initially hidden evidence, removal of raw diagnostics, reduced motion, guided replay and commentary pause/seek/speed/restart behavior. Mobile checks use browser emulation, not a physical device.

## Screenshots

Visually inspected at 1440px desktop, 1024px tablet and 390px mobile. Screenshots use explicit authored-demo data. The desktop view is scrolled to frame the panel and pitch beneath the sticky navigation; the scoreboard remains above it.

- [Desktop idle](../output/playwright/phase4-1/idle-1440.png)
- [Desktop ready](../output/playwright/phase4-1/desktop-ready.png)
- [Tablet idle](../output/playwright/phase4-1/idle-1024.png)
- [Mobile idle](../output/playwright/phase4-1/idle-390.png)
- [Mobile ready, reduced motion](../output/playwright/phase4-1/mobile-ready.png)

## Limits and review status

Lexical validation remains conservative; citation validity is not proof of every natural-language assertion. Existing process-local cache/rate limits retain their documented deployment limitations. No new Azure resource, dependency or independent clock was introduced. Remaining optional work is an approved small v3 Foundry smoke check. Source changes are ready for review; all required checks above passed. Nothing has been committed or pushed.
