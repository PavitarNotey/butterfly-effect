import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import catalog from "../../../backend/league/catalog.json";
import { createReplayStore } from "../replay/store";
import { scenarios, sourceFor } from "../replay/scenario";
import { MatchRecap } from "./MatchRecap";
import { ModeSwitch, NarrativeView } from "./IntelligencePanel";
import {
  commentary,
  cueAt,
  explain,
  getStatus,
  validateIntelligence,
} from "./client";
import type { Intelligence } from "./client";
import type { MatchDetail } from "../league/types";
import {
  analysisErrorMessage,
  analysisState,
  narrativeSentences,
} from "./presentation";
import { supportingMoment } from "./useEvidenceReplay";
import type { EvidenceBundle } from "../tactics/types";

const scenario = scenarios.find((s) => s.id === "the-untouched-pass")!;
async function fixture(): Promise<Intelligence> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sourceFor(scenario.id)),
  );
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const narrative: Intelligence["narratives"][number] = {
    event_id: "dummy",
    headline: "The ball continues untouched",
    explanation: "The recorded pass continues without a touch.",
    why_it_matters: "Follow the ball to the receiver.",
    source_ids: ["event:dummy"],
    mode: "casual",
    key_evidence: [
      {
        id: "event:dummy",
        kind: "recorded_event",
        statement: "Recorded non-contact.",
        event_ids: ["dummy"],
        evidence_id: null,
        units: [],
      },
    ],
    limitations: ["Synthetic reconstruction."],
    confidence_label: "references-and-claims-screened",
  };
  return {
    scenario_id: scenario.id,
    match_id: "vesper-tidal",
    source_hash: hash,
    input_hash: "input-v1",
    mode: "casual",
    synthetic: true,
    provider: "mock",
    model: "fixture",
    prompt_version: "v1",
    cached: false,
    narratives: [narrative],
    cues: [
      {
        id: "stable-dummy",
        event_id: "dummy",
        replay_time: scenario.events.find((e) => e.id === "dummy")!.t,
        narrative,
      },
    ],
    events: scenario.events.map((e, i) => ({
      id: e.id,
      sequence: i,
      event_id: e.id,
      type: e.type,
      replay_time: e.t,
      match_seconds: scenario.matchStartSeconds + e.t,
      match_minute: 67,
      player_ids: e.playerIds,
      evidence_ids: [],
    })),
    recorded_match_facts: [],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      cost_is_approximate: true,
    },
    validation_note: "References screened; prose is interpretation.",
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("AI contract boundary and presentation", () => {
  it("checks source hash, event identity, mode, references and cue timing", async () => {
    const good = await fixture();
    expect(
      await validateIntelligence(good, scenario, "casual", "dummy"),
    ).toEqual(good);
    for (const bad of [
      { ...good, source_hash: "stale" },
      { ...good, mode: "analyst" },
      { ...good, scenario_id: "other" },
      { ...good, provider: "pretend-live" },
      { ...good, cues: [{ ...good.cues[0], replay_time: 999 }] },
      {
        ...good,
        narratives: [{ ...good.narratives[0], source_ids: ["unknown"] }],
      },
    ]) {
      await expect(
        validateIntelligence(bad, scenario, "casual", "dummy"),
      ).rejects.toThrow("does not match");
    }
  });
  it("renders explicit mock/fallback provenance and escapes untrusted prose", async () => {
    const data = await fixture();
    data.narratives[0].headline = "<script>bad()</script>";
    const html = renderToStaticMarkup(
      <NarrativeView data={data} narrative={data.narratives[0]} />,
    );
    expect(html).toContain("Authored demo");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Explore the evidence");
    data.provider = "validation_fallback";
    expect(
      renderToStaticMarkup(
        <NarrativeView data={data} narrative={data.narratives[0]} />,
      ),
    ).toContain("Authored fallback");
    expect(
      renderToStaticMarkup(<ModeSwitch mode="analyst" onChange={() => {}} />),
    ).toContain('aria-pressed="true">Analyst');
  });
  it.each(["foundry", "mock", "validation_fallback"] as const)(
    "preserves connected tactical prose and honest %s provenance",
    async (provider) => {
      const data = await fixture();
      data.provider = provider;
      const explanation =
        "The pass continues to Kian Merrick because Soren Ellery leaves it untouched. Asa Bellamy’s diagonal meets the receiving run beyond the attacker nearest the ball. Watch Merrick’s arrival alongside the cover closing around him, then follow the reception into the shot.";
      data.narratives[0].explanation = explanation;
      data.narratives[0].why_it_matters =
        "Watch the same pass travel beyond Ellery to the moving receiver.";
      const html = renderToStaticMarkup(
        <NarrativeView data={data} narrative={data.narratives[0]} />,
      );
      expect(narrativeSentences(explanation).join("")).toBe(explanation);
      expect(html).toContain(`data-provider="${provider}"`);
      expect(html).toContain(
        {
          foundry: "AI-generated",
          mock: "Authored demo",
          validation_fallback: "Authored fallback",
        }[provider],
      );
      expect(html).toContain("because Soren Ellery leaves it untouched.");
      expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/);
      expect(html).not.toContain(data.validation_note);
    },
  );
  it("never renders recaps for upcoming fixtures", () => {
    const match = catalog.matches.find(
      (m) => m.status === "upcoming",
    ) as MatchDetail;
    expect(renderToStaticMarkup(<MatchRecap match={match} />)).toBe("");
  });
  it("does not expose internal IDs or validator diagnostics, including expanded evidence markup", async () => {
    const data = await fixture();
    const html = renderToStaticMarkup(
      <NarrativeView data={data} narrative={data.narratives[0]} />,
    );
    expect(html).not.toContain("event:dummy");
    expect(html).not.toContain(data.validation_note);
    expect(html).not.toContain("confidence_label");
    expect(html).not.toContain("Why this explanation?");
    expect(html).toContain("Recorded play");
  });
  it("keeps sentence text intact and derives honest loading, fallback and error states", async () => {
    const text =
      "The pass keeps moving. The receiver arrives! Watch the finish.";
    expect(narrativeSentences(text).join("")).toBe(text);
    const data = await fixture();
    expect(analysisState(null, false, null)).toBe("idle");
    expect(analysisState(null, true, null)).toBe("loading");
    expect(analysisState(data, false, null)).toBe("ready");
    expect(
      analysisState({ ...data, provider: "validation_fallback" }, false, null),
    ).toBe("fallback");
    expect(analysisState(data, false, new Error("failed"))).toBe("error");
    expect(
      analysisErrorMessage(new Error("private configuration diagnostics")),
    ).not.toContain("diagnostics");
  });
  it.each(["casual", "analyst"] as const)(
    "keeps %s technical evidence in a closed disclosure",
    async (mode) => {
      const data = await fixture();
      data.mode = mode;
      data.narratives[0].mode = mode;
      data.narratives[0].key_evidence.push({
        id: "measured-gap",
        kind: "measurement",
        statement: "Tracking-centre gap: 2.4 m.",
        evidence_id: "measured-gap",
        event_ids: ["dummy"],
        units: ["m"],
      });
      const html = renderToStaticMarkup(
        <NarrativeView data={data} narrative={data.narratives[0]} />,
      );
      expect(html.slice(0, html.indexOf("<details"))).not.toContain(
        "Tracking-centre gap",
      );
      expect(html).toContain("Tracking-centre gap: 2.4 m.");
      expect(html).toContain("Measured replay detail");
      expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/);
      expect(html).not.toContain("ai-spatial-context");
    },
  );
  it("sends bounded typed requests and surfaces provider errors", async () => {
    const value = await fixture();
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => value });
    vi.stubGlobal("fetch", fetcher);
    await explain(scenario, "dummy", "casual", new AbortController().signal);
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      scenario_id: scenario.id,
      event_id: "dummy",
      mode: "casual",
    });
    const full = {
      ...value,
      narratives: scenario.events.map((e) => ({
        ...value.narratives[0],
        event_id: e.id,
      })),
    };
    fetcher.mockResolvedValue({ ok: true, json: async () => full });
    await commentary(scenario, "casual", new AbortController().signal);
    fetcher.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Foundry quota reached." }),
    });
    await expect(
      explain(scenario, "dummy", "analyst", new AbortController().signal),
    ).rejects.toThrow("quota");
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "mock",
        available: true,
        message: "Offline fixtures.",
      }),
    });
    expect((await getStatus(new AbortController().signal)).provider).toBe(
      "mock",
    );
  });
  it("treats cache-only misses as empty and explicitly marks every cache read", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(
      await explain(scenario, "dummy", "analyst", signal, true),
    ).toBeNull();
    expect(JSON.parse(fetcher.mock.calls[0][1].body).cache_only).toBe(true);
    expect(await commentary(scenario, "analyst", signal, true)).toBeNull();
    expect(fetcher.mock.calls[1][0]).toContain("cache_only=true");
    await expect(
      explain(scenario, "dummy", "analyst", signal),
    ).rejects.toThrow();
  });
  it("resolves replay support only from exact cited observations and matching source identity", async () => {
    const data = await fixture(),
      narrative = data.narratives[0];
    const source = {
      id: "measured-gap",
      kind: "measurement" as const,
      statement: "Recorded gap.",
      evidence_id: "measured-gap",
      event_ids: ["dummy"],
      units: ["m"],
    };
    narrative.source_ids.push(source.id);
    narrative.key_evidence.push(source);
    const fact = {
      id: source.id,
      observation: source.statement,
      eventIds: ["dummy"],
    };
    const moment = { id: "dummy-guide", evidenceIds: [source.id] };
    const bundle = {
      scenarioId: data.scenario_id,
      sourceHash: data.source_hash,
      evidence: [fact],
      moments: [moment],
    } as unknown as EvidenceBundle;
    expect(supportingMoment(bundle, data, narrative)).toEqual({ fact, moment });
    expect(
      supportingMoment({ ...bundle, sourceHash: "stale" }, data, narrative),
    ).toBeNull();
    expect(
      supportingMoment({ ...bundle, scenarioId: "other" }, data, narrative),
    ).toBeNull();
    expect(
      supportingMoment({ ...bundle, moments: [] }, data, narrative),
    ).toBeNull();
    expect(supportingMoment(bundle, data, narrative, "invented")).toBeNull();
    source.statement = "Invented measurement.";
    expect(supportingMoment(bundle, data, narrative)).toBeNull();
    source.statement = fact.observation;
    source.event_ids = ["shot"];
    expect(supportingMoment(bundle, data, narrative)).toBeNull();
  });
  it("samples the same cue under pause, seek, speed and restart with no fetch", async () => {
    const data = await fixture();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    let wall = 0;
    const store = createReplayStore(() => wall);
    store.getState().setScenario(scenario.id);
    const t = data.cues[0].replay_time;
    store.getState().seek(t);
    expect(cueAt(data.cues, store.getState().readTime())?.event_id).toBe(
      "dummy",
    );
    store.getState().pause();
    wall += 1000;
    expect(cueAt(data.cues, store.getState().readTime())?.event_id).toBe(
      "dummy",
    );
    store.getState().seek(t - 0.5);
    store.getState().setSpeed(2);
    store.getState().play();
    wall += 300;
    expect(cueAt(data.cues, store.getState().readTime())?.event_id).toBe(
      "dummy",
    );
    store.getState().restart();
    expect(cueAt(data.cues, store.getState().readTime())).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
