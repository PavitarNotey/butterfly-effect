import { sourceFor } from "../replay/scenario";
import { replayStore } from "../replay/store";
import type { Scenario } from "../replay/types";
import type { EvidenceBundle } from "./types";

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown, message: string): Record<string, unknown> {
  requireValid(
    value !== null && typeof value === "object" && !Array.isArray(value),
    message,
  );
  return value as Record<string, unknown>;
}
function list(value: unknown, message: string): unknown[] {
  requireValid(Array.isArray(value), message);
  return value;
}
function text(value: unknown, message: string): string {
  requireValid(typeof value === "string", message);
  return value;
}
function finite(
  value: unknown,
  message: string,
  min = -Infinity,
  max = Infinity,
): number {
  requireValid(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max,
    message,
  );
  return value;
}
function vector(value: unknown, message: string): number[] {
  const values = list(value, message);
  requireValid(values.length === 3, message);
  return values.map((n) => finite(n, message));
}
function strings(value: unknown, message: string): string[] {
  return list(value, message).map((item) => text(item, message));
}
function reference(value: unknown, ids: Set<string>, message: string): string {
  const id = text(value, message);
  requireValid(ids.has(id), message);
  return id;
}
function references(
  value: unknown,
  ids: Set<string>,
  message: string,
): string[] {
  const values = list(value, message).map((id) => reference(id, ids, message));
  requireValid(new Set(values).size === values.length, message);
  return values;
}

/** Validate untrusted JSON once, before state/renderer code uses generated types.
 * These are structural/reference checks, not a second tactical geometry engine.
 *
 * @param value - Untrusted decoded API JSON.
 * @param expectedHash - SHA-256 of the exact local raw scenario text.
 * @param scenario - Active canonical identities and timeline.
 * @returns The accepted typed bundle; invalid values throw instead of creating fallback geometry.
 */
export function validateEvidence(
  value: unknown,
  expectedHash: string,
  scenario: Scenario = replayStore.getState().scenario,
): EvidenceBundle {
  const bundle = record(value, "Malformed evidence response");
  requireValid(
    bundle.version === 1 &&
      bundle.scenarioId === scenario.id &&
      bundle.sourceHash === expectedHash,
    "Evidence does not match this replay. Refresh both servers.",
  );
  const players = new Set(scenario.players.map((p) => p.id)),
    events = new Set(scenario.events.map((e) => e.id));
  const time = (value: unknown, message: string) =>
    finite(value, message, 0, scenario.duration);
  function interval(start: unknown, end: unknown, message: string) {
    const a = time(start, message),
      b = time(end, message);
    requireValid(a <= b, message);
    return [a, b];
  }
  function path(
    value: unknown,
    message: string,
    start?: number,
    end?: number,
    staticEndpoints = false,
  ) {
    const keys = list(value, message).map((value) => {
      const key = record(value, message);
      return {
        t: time(key.t, message),
        position: vector(key.position, message),
      };
    });
    requireValid(
      keys.length > 0 &&
        keys.every(
          (key, i) =>
            i === 0 ||
            (staticEndpoints ? key.t === keys[i - 1].t : key.t > keys[i - 1].t),
        ),
      message,
    );
    requireValid(
      (start === undefined || keys[0].t === start) &&
        (end === undefined || keys.at(-1)!.t === end),
      message,
    );
    return keys;
  }
  function thresholds(value: unknown, message: string) {
    const config = record(value, message);
    const halfWidth = finite(config.corridorHalfWidth, message, 0, 5);
    const margin = finite(config.contestedMargin, message, 0, 5);
    const radius = finite(config.coverageRadius, message, 0, 20);
    requireValid(halfWidth > 0 && radius > 0, message);
    return [halfWidth, margin, radius];
  }
  const config = thresholds(bundle.thresholds, "Invalid evidence thresholds");
  requireValid(
    finite(bundle.sampleStep, "Invalid evidence sample step") > 0,
    "Invalid evidence sample step",
  );
  strings(bundle.assumptions, "Invalid evidence assumptions");

  function corridor(value: unknown) {
    const message = "Invalid corridor references or geometry",
      c = record(value, message);
    requireValid(
      c.kind === "proposed_static" || c.kind === "observed_travel",
      message,
    );
    const passer = reference(c.passerId, players, message),
      receiver = reference(c.receiverId, players, message);
    requireValid(passer !== receiver, message);
    reference(c.staticDefenderId, players, message);
    const [start, end] = interval(c.releaseTime, c.arrivalTime, message);
    requireValid(
      c.kind === "proposed_static" ? start === end : start < end,
      message,
    );
    const from = vector(c.start, message),
      to = vector(c.end, message);
    finite(c.staticDistance, message, 0);
    finite(c.sweptCorridorDistance, message, 0);
    requireValid(
      ["clear", "contested", "obstructed"].includes(text(c.state, message)),
      message,
    );
    requireValid(
      thresholds(c.thresholds, message).every((n, i) => n === config[i]),
      message,
    );
    const closest = record(c.movingClosest, message);
    reference(closest.playerId, players, message);
    finite(closest.distance, message, 0);
    finite(closest.t, message, start, end);
    vector(closest.playerPosition, message);
    vector(closest.ballPosition, message);
    // A static preview is a segment with two spatial endpoints at one instant.
    const keys = path(
      c.path,
      message,
      start,
      end,
      c.kind === "proposed_static",
    );
    requireValid(
      keys.length >= 2 && (c.kind !== "proposed_static" || keys.length === 2),
      message,
    );
    requireValid(
      keys[0].position.every((n, i) => n === from[i]) &&
        keys.at(-1)!.position.every((n, i) => n === to[i]),
      message,
    );
  }

  const evidence = list(bundle.evidence, "Malformed evidence response");
  const facts = new Set(
    evidence.map((value) =>
      text(record(value, "Invalid evidence").id, "Invalid evidence ID"),
    ),
  );
  requireValid(
    facts.size === evidence.length && evidence.length > 0,
    "Incomplete evidence response",
  );
  for (const value of evidence) {
    const message = "Invalid evidence references or measurements",
      e = record(value, message);
    requireValid(
      ["movement", "relationships", "corridor", "space", "finish"].includes(
        text(e.category, message),
      ) && e.status === "observation",
      message,
    );
    interval(e.start, e.end, message);
    requireValid(references(e.playerIds, players, message).length > 0, message);
    references(e.eventIds, events, message);
    text(e.title, message);
    text(e.observation, message);
    strings(e.limitations, message);
    for (const value of list(e.metrics, message)) {
      const metric = record(value, message);
      finite(metric.value, message);
      for (const key of ["name", "unit", "definition"])
        text(metric[key], message);
    }
  }
  const moments = list(bundle.moments, "Malformed evidence response");
  const momentIds = new Set(
    moments.map((value) =>
      text(
        record(value, "Invalid moment references").id,
        "Invalid moment references",
      ),
    ),
  );
  requireValid(
    momentIds.size === moments.length &&
      moments.length >= 3 &&
      moments.length <= 5,
    "Invalid moment references",
  );
  let previousStart = -Infinity;
  for (const value of moments) {
    const message = "Invalid moment references",
      m = record(value, message);
    const [start, end] = interval(m.start, m.end, message);
    requireValid(start < end, message);
    const focus = finite(m.focusTime, message, start, end);
    const eventId = reference(m.focusEventId, events, message);
    requireValid(
      scenario.events.some((e) => e.id === eventId && e.t === focus),
      message,
    );
    requireValid(start >= previousStart, message);
    previousStart = start;
    const actors = references(m.playerIds, players, message);
    requireValid(
      actors.length > 0 && references(m.evidenceIds, facts, message).length > 0,
      message,
    );
    requireValid(
      strings(m.evidenceIds, message).includes(
        reference(m.primaryEvidenceId, facts, message),
      ),
      message,
    );
    requireValid(
      m.followPlayerId === null ||
        actors.includes(reference(m.followPlayerId, players, message)),
      message,
    );
    requireValid(
      ["movement", "corridor", "space", "relationships", "finish"].includes(
        text(m.focus, message),
      ) && m.interpretationStatus === "authored_interpretation",
      message,
    );
    text(m.title, message);
    text(m.interpretation, message);
    for (const value of list(m.movements, "Invalid movement geometry")) {
      const message = "Invalid movement geometry",
        movement = record(value, message);
      requireValid(
        actors.includes(reference(movement.playerId, players, message)),
        message,
      );
      const [moveStart, moveEnd] = interval(
        movement.startTime,
        movement.endTime,
        message,
      );
      requireValid(moveStart === start && moveEnd === end, message);
      const keys = path(movement.path, message, moveStart, moveEnd);
      const from = vector(movement.start, message),
        to = vector(movement.end, message);
      vector(movement.vector, message);
      requireValid(
        keys[0].position.every((n, i) => n === from[i]) &&
          keys.at(-1)!.position.every((n, i) => n === to[i]),
        message,
      );
      for (const key of [
        "longitudinal",
        "lateral",
        "distance",
        "pathLength",
        "meanSpeed",
      ])
        finite(movement[key], message);
    }
    requireValid(
      m.followPlayerId === null ||
        list(m.movements, message).some(
          (value) => record(value, message).playerId === m.followPlayerId,
        ),
      message,
    );
  }
  for (const value of list(bundle.chain, "Invalid chain references")) {
    const message = "Invalid chain references",
      link = record(value, message);
    reference(link.fromMomentId, momentIds, message);
    reference(link.toMomentId, momentIds, message);
    references(link.evidenceIds, facts, message);
    requireValid(link.relation === "precedes_not_proven_cause", message);
  }
  const frames = list(bundle.frames, "Malformed evidence response");
  requireValid(frames.length >= 2, "Incomplete evidence response");
  let previousTime = -Infinity,
    previousPairs: string[] | undefined;
  for (const value of frames) {
    const f = record(value, "Invalid evidence timeline"),
      t = time(f.t, "Invalid evidence timeline");
    requireValid(t > previousTime, "Invalid evidence timeline");
    previousTime = t;
    const pairs = list(f.relationships, "Invalid relationship references").map(
      (value) => {
        const message = "Invalid relationship references or geometry",
          r = record(value, message);
        const a = reference(r.aId, players, message),
          b = reference(r.bId, players, message);
        vector(r.a, message);
        vector(r.b, message);
        finite(r.distance, message, 0);
        requireValid(typeof r.defenderGoalSide === "boolean", message);
        return JSON.stringify([a, b]);
      },
    );
    const expectedPairs = previousPairs;
    requireValid(
      new Set(pairs).size === pairs.length &&
        (!expectedPairs ||
          (pairs.length === expectedPairs.length &&
            pairs.every((pair, i) => pair === expectedPairs[i]))),
      "Inconsistent relationship order between frames",
    );
    previousPairs = pairs;
    corridor(f.corridor);
    const message = "Invalid nearest-defender references or space geometry",
      space = record(f.space, message);
    reference(space.nearestDefenderId, players, message);
    vector(space.center, message);
    vector(space.nearestDefenderPosition, message);
    requireValid(finite(space.radius, message) > 0, message);
    finite(space.nearestDistance, message, 0);
    requireValid(
      Number.isInteger(
        finite(space.defendersWithinRadius, message, 0, players.size),
      ),
      message,
    );
  }
  requireValid(
    record(frames[0], "Invalid evidence timeline").t === 0 &&
      record(frames.at(-1), "Invalid evidence timeline").t ===
        scenario.duration,
    "Invalid evidence timeline",
  );
  corridor(bundle.actualPass);
  requireValid(
    record(bundle.actualPass, "Invalid recorded pass").kind ===
      "observed_travel",
    "Invalid recorded pass",
  );
  path(bundle.shotPath, "Invalid shot path");
  return value as EvidenceBundle;
}

/**
 * Fetch and validate evidence for scenario using the caller's abort/timeout signal.
 * Hashes the exact raw local JSON so formatting/content revisions cannot silently reuse stale evidence.
 */
export async function loadEvidence(
  signal: AbortSignal,
  scenario: Scenario = replayStore.getState().scenario,
): Promise<EvidenceBundle> {
  const api = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
  const response = await fetch(`${api}/api/scenarios/${scenario.id}/evidence`, {
    signal,
  });
  if (!response.ok)
    throw new Error(`Evidence request failed (${response.status}).`);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sourceFor(scenario.id)),
  );
  const hash = Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  return validateEvidence(await response.json(), hash, scenario);
}

/** Same timestamp for panel and geometry. Metrics use the most recent measured sample.
 *
 * @returns Bracketing frames and visual interpolation fraction; metric labels use frame a.
 */
export function frameAt(bundle: EvidenceBundle, t: number) {
  const index = Math.max(
    0,
    bundle.frames.findLastIndex((f) => f.t <= t),
  );
  const a = bundle.frames[index],
    b = bundle.frames[Math.min(index + 1, bundle.frames.length - 1)];
  return {
    a,
    b,
    fraction:
      b.t === a.t ? 0 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))),
  };
}
/**
 * Return the latest sequence whose focus has occurred, or the initial sequence.
 * Overlapping contextual intervals do not advance the active analysis before its focus event.
 */
export function momentAt(bundle: EvidenceBundle, t: number) {
  // Overlapping sequences become current at their recorded focus event, not
  // at the earlier contextual start of their replay window.
  return bundle.moments.findLast((m) => m.focusTime <= t) || bundle.moments[0];
}
