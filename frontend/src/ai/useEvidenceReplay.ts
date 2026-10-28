import { useEffect, useRef, useState } from "react";
import { replayStore } from "../replay/store";
import type { Scenario } from "../replay/types";
import { loadEvidence } from "../tactics/data";
import { useTactics } from "../tactics/store";
import type { EvidenceBundle } from "../tactics/types";
import type { Intelligence, Narrative } from "./client";

/** Resolve only exact server-owned observations, never words in generated prose.
 *
 * @param id - Optional exact detail citation; omit to choose a cited measurement.
 * @returns The owning fact/moment, or null if source identity or statement verification fails.
 */
export function supportingMoment(
  bundle: EvidenceBundle,
  data: Intelligence,
  narrative: Narrative,
  id?: string,
) {
  if (
    bundle.scenarioId !== data.scenario_id ||
    bundle.sourceHash !== data.source_hash
  )
    return null;
  for (const source of narrative.key_evidence) {
    if (
      source.kind !== "measurement" ||
      !source.evidence_id ||
      source.id !== source.evidence_id ||
      !narrative.source_ids.includes(source.id) ||
      (id && source.evidence_id !== id)
    )
      continue;
    const fact = bundle.evidence.find(
      (e) =>
        e.id === source.evidence_id &&
        e.observation === source.statement &&
        e.eventIds.some((event) => source.event_ids.includes(event)),
    );
    const moment =
      fact && bundle.moments.find((m) => m.evidenceIds.includes(fact.id));
    if (fact && moment) return { fact, moment };
  }
  return null;
}

/**
 * Bridge exact cited measurements into the existing guided replay controller.
 * Abandons stale requests on scenario/result changes and exposes pending/error state.
 * No prose-to-geometry conversion, additional canvas or independent clock is created.
 */
export function useEvidenceReplay(
  scenario: Scenario,
  data: Intelligence | null,
  contextValid = true,
) {
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState({ data, pending: false, error: "" });
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [scenario.id, data, contextValid],
  );
  async function watch(id?: string) {
    if (!data || controller.current) return;
    if (!contextValid) {
      setState({
        data,
        pending: false,
        error:
          "This match’s replay reference could not be verified. Return to the match events to inspect it.",
      });
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setState({ data, pending: true, error: "" });
    try {
      const bundle = await loadEvidence(
        AbortSignal.any([active.signal, AbortSignal.timeout(8000)]),
        scenario,
      );
      if (
        active.signal.aborted ||
        replayStore.getState().scenario.id !== scenario.id
      )
        return;
      const support = supportingMoment(bundle, data, data.narratives[0], id);
      if (!support) throw new Error("No matching guided observation");
      useTactics.setState({ bundle, status: "ready" });
      replayStore
        .getState()
        .startGuided(
          bundle,
          support.fact.id,
          support.moment.id,
          id ? "evidence" : "moment",
        );
      document
        .querySelector(
          '[data-testid="replay-viewport"], [data-testid="match-viewer"]',
        )
        ?.scrollIntoView({ behavior: "instant", block: "center" });
      setState({ data, pending: false, error: "" });
    } catch {
      if (!active.signal.aborted)
        setState({
          data,
          pending: false,
          error:
            "Supporting replay is unavailable. Try again or explore the evidence below.",
        });
    } finally {
      if (controller.current === active) controller.current = null;
    }
  }
  return {
    watch,
    pending: state.data === data && state.pending,
    error: state.data === data ? state.error : "",
  };
}
