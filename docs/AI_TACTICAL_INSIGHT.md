# Explain This Moment — tactical insight

Updated October 27, 2026. Prompt revision: `phase4-v4-tactical-insight`. Transport remains `phase4c-compact-v1`. No live Foundry calls, deployment, commit or push were made for this revision.

The explanation now prioritizes the tactical significance of the selected sequence: the player relationship, ball route or closing cover worth watching, its connection to the next recorded action, and a specific replay takeaway. Selected moments request approximately 50–85 words in Casual Fan and 80–130 in Analyst, allowing shorter answers when evidence is limited. Commentary keeps short, timestamp-specific cues within its existing output ceiling. Recaps retain result anchors and the distinction between metadata-only events and the reconstructed passage.

## Diagnosis

The previous instructions explicitly prohibited explaining causal mechanisms in Analyst mode. The shared lexical screen rejected every `because`, `therefore` and `led to`, including an observable non-contact ball continuation. Most non-dummy mock/fallback moments also used generic “watch the recorded action” text. A selected-event packet supplied only two measurements, without the full run/arrival/cover context.

These are reproducible local causes of dry explanations. They do **not** establish which provider produced a particular historical deployment response: no production response or trace was supplied. Inspect that response's existing `provider` field and visible provenance first. `foundry` means accepted AI output, `mock` means Authored demo, and `validation_fallback` means rejected output replaced with Authored fallback. A configured Foundry availability label is not proof of a successful generation.

## Implementation

- `ai/evidence.py` selects bounded existing observations for the selected focus and the surrounding curated run, dummy/pass, arrival and finish. Run/arrival cover is included when available. The focus's primary observation stays first. Source statements, evidence IDs, original event associations and canonical hashes remain authoritative; surrounding measurements are not relabeled as observations of the focus event.
- `ai/reasoning.py` derives a small set of qualitative reasoning licenses from current canonical actions and exact current computed observations. Explicit non-contact supports same-pass continuation; negative separation change supports closing cover; a complete recorded receiver route supports a qualified reading of meeting the pass; reception followed by the same player's shot supports chronology.
- `ai/prompts.py` shows the **same** licenses and required support IDs used by `ai/validation.py`. A sentence using screened mechanism/connective language must match a licensed sentence and cite all its support. Other prose remains free-form under the existing quantity, identity, relevance, intent and markup checks. Matching ignores case, ordinary whitespace, apostrophe style and terminal punctuation only. It does not strip or repair claims to force acceptance. A valid sentence does not authorize an adjacent claim.
- `ai/citations.py` includes the primary replayable observation in Casual suggestions and relevant closing-cover context. Analyst still needs distinct measurements actually associated with the selected focus when available; contextual measurements cannot replace them. Recap anchors and measurement requirements remain.
- `ai/authored.py` supplies reviewed, mode-specific readings for all four selected sequences in each showcase. The explicit mock provider and rejected-output fallback share those safe readings, with distinct provenance. Short commentary excerpts avoid narrating future actions as already completed.
- `ai/service.py` logs accepted output provenance and safe rejection categories, alongside mode, target, scenario and prompt version. Internal diagnostics add accepted Foundry counts and bounded category counts. `providers.py` logs structured-parse failures without raw response text. There is no new public diagnostic endpoint.

The public Pydantic/OpenAPI response contracts are unchanged. Canonical data, geometry calculations, replay clock, frontend production behavior, Azure workflows, cost settings, attempt reservations, output limits, timeouts, retries and explicit-generation requirements are unchanged. The new prompt and packet hashes invalidate older cache entries naturally. Technical evidence remains closed by default.

## Examples: The Dummy

These are **actual deterministic authored demo/fallback fixtures validated locally**, not live Foundry outputs. The mocked SDK acceptance test exercises the production parsing/validation path without contacting Foundry; it is not a live quality evaluation.

**Casual Fan (60 words):**

> The pass continues to Kian Merrick because Soren Ellery leaves it untouched. That is the key detail: follow the ball beyond Ellery and pick up Merrick's arrival, rather than treating Ellery as the receiver. Asa Bellamy's diagonal and Merrick's run belong to the same passage. With Felix Arden closing nearby, watch the reception and the quick shot in the continuation.

**Analyst (94 words):**

> The pass continues to Kian Merrick because Soren Ellery leaves it untouched. Asa Bellamy's diagonal travels through Ellery's position toward the receiving run, with no possession transfer at the dummy. The receiving run carries the tactical story beyond the attacker nearest the ball. The ball has a route through the nearby defenders, while Felix Arden narrows the gap to Merrick around the arrival. That contrast matters: an available ball route does not mean the receiver is free of nearby cover. Watch the uninterrupted pass first, then Merrick's reception and the shot in the continuation.

Worth watching: **Watch the same pass travel beyond Ellery to the moving receiver.**

## Limitations and remaining verification

Merrick's recorded approach starts in the attacking half. Earlier deep-midfield movement is not reconstructed and must not be invented. Positional data does not reveal player thoughts, attention, deception or alternative outcomes. A clear ball route is not a success probability; the dummy is not proven to have caused the goal.

The validator remains conservative lexical screening plus narrow deterministic licenses, not a general semantic proof. Valid references do not establish that every free-form sentence is true. Unsupported synonyms can escape a lexical screen, and legitimate paraphrases of licensed mechanisms can still be rejected. Expand licenses only with specific evidence predicates and adversarial fixtures. No extra paid “judge” model or automatic regeneration was added.

Live generation quality and completion at the new word guidance remain unverified. Any future live smoke set requires explicit approval of its bounded request count; retries should be disabled for that check. Do not present historical v2/v3 calls or mocked SDK responses as v4 live verification.

<details>
<summary>Technical evidence, diagnostics and verification</summary>

The new `tests/test_ai_insight.py` covers positive reasoning, qualified readings, missing proof citations, source tampering, adjacent unsupported assertions, invented intent/outcomes in every prose field, context versus focus citation requirements, exact observations, scenario-specific mode fixtures, mocked SDK success without fallback, categorized rejection and unchanged OpenAPI. Existing AI/budget tests continue to cover both modes, full commentary sets, recaps, invalid references, quantity screening, limits, cache identity and retries.

Frontend unit/browser assertions cover connected prose, all provenance states, hidden technical evidence, both audiences, desktop/mobile wrapping, exact guided-moment association, request counts, commentary clock synchronization, stale requests, failed refresh retention and reduced motion. Screenshots are ignored artifacts in `output/playwright/insight/`.

For a selected untouched-pass dummy request, exact supporting sources include `event:dummy`, `the-untouched-pass:v1:dummy:dummy`, `the-untouched-pass:v1:pass:corridor` and `the-untouched-pass:v1:receive:cover`. The latter is context, not a dummy-linked measurement. No exact values are generated in prose; immutable source excerpts retain them.

Rejection categories are finite: quantity, intent/certainty, unsupported mechanism, missing mechanism citations, structured output, markup, target/source identity, source relevance and citation contract. SDK parsing has a separate `structured_parse` log category. Logs contain no raw provider prose or credentials. Process-local diagnostics remain accessible only inside the trusted running process.

Input is larger because the selected moment now includes useful surrounding evidence and shared reasoning instructions. Existing 40,000-character packet and configured byte bounds, conservative pre-call cost reservations, and 1,400/1,600/3,500 task output ceilings remain enforced. Offline size estimates are not provider token usage or billing measurements. No rendering code or frame-loop work changed.

Offline Analyst request samples: the selected untouched-pass dummy packet contains 14,843 characters; its conservative input allowance including schema/protocol overhead is 24,228. Sampled commentary allowances across the three scenarios are 26,504–32,844, inside the configured request bound. These are deliberately conservative reservation allowances, not tokenizer measurements. Increasing useful context can increase reserved/actual cost; no budget was raised to compensate.

Final verification:

- Backend: **281 passed, one optional external-service skip**, Ruff passed. Existing Starlette/httpx deprecation warning remains.
- Frontend: **226 unit tests passed**, typechecking and ESLint passed. Production build passed with the existing Azure backend `VITE_API_URL`; existing large WebGL/data chunk warnings remain.
- Browser: **32/32 passed in a single final run** of `pnpm test:e2e ai.spec.ts ai-match-center.spec.ts hardening.spec.ts sequences.spec.ts`. This covers both modes, commentary/recaps, all selected moments, exact evidence playback, synchronized continuous run, interruption, cache-only switching, fallback provenance, failed refresh retention, desktop/tablet/mobile layouts and reduced motion. The new interaction test's old button label was corrected; the continuous-run test now waits for the actual lazy scene/player before inspection without relaxing trajectory assertions.
- Inspected actual desktop and mobile explanation screenshots. Technical details stayed closed; long Analyst prose wraps within the panel. Browser emulation only, not physical-device testing. Existing resource-retention regression checks passed; no new frame-time benchmark is claimed.
- Public OpenAPI matches the application. Sixteen protected workflow, canonical, geometry, dependency, cost/configuration and contract files match HEAD byte-for-byte. `git diff --check` passed.

Changes are ready for review and remain uncommitted and undeployed. The remaining optional verification is an explicitly approved bounded live v4 Foundry smoke test.

</details>
