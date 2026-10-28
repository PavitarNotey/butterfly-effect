import { clampTime, samplePosition, sampleYaw } from "../sample";
import type { Player, Scenario, Vec3 } from "../types";

export type FootballActionKind = "pass" | "receive" | "shot";
export type FootSide = "l" | "r";
export interface FootballAction {
  kind: FootballActionKind;
  technique?: "driven";
  eventId: string;
  actorId: string;
  start: number;
  contact: number;
  end: number;
  elapsed: number;
  phase: number;
  weight: number;
  foot: FootSide;
  ballLocal: Vec3;
  direction: number;
  supportLocal: Vec3;
}
export const actionWindows = {
  pass: [0.55, 0.7],
  receive: [0.4, 0.65],
  shot: [0.8, 0.95],
} as const;
export const smooth = (a: number, b: number, value: number) => {
  const x = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
type Definition = Omit<
  FootballAction,
  "elapsed" | "phase" | "weight" | "supportLocal"
> & { position: Vec3; yaw: number };
const definitions = new WeakMap<Scenario, Definition[]>();
function local(vector: Vec3, yaw: number): Vec3 {
  return [
    vector[0] * Math.cos(yaw) - vector[2] * Math.sin(yaw),
    vector[1],
    vector[0] * Math.sin(yaw) + vector[2] * Math.cos(yaw),
  ];
}

/** Possession transitions identify the actor; contextual event participants never
 * become kickers. Outcome events deliberately do not create another action.
 *
 * @param s - Immutable canonical events and possession used as cache identity.
 * @returns Contact definitions with deterministic actor choice and disjoint same-player windows.
 */
export function footballActions(s: Scenario): readonly Definition[] {
  let result = definitions.get(s);
  if (!result) {
    result = [];
    for (const event of s.events) {
      if (
        event.type !== "pass" &&
        event.type !== "receive" &&
        event.type !== "shot"
      )
        continue;
      const sameTimeReceiver =
        event.type !== "receive" &&
        s.events.some((e) => e.type === "receive" && e.t === event.t)
          ? s.possession.find(
              (key) => key.t === event.t && key.playerId !== null,
            )?.playerId
          : null;
      const actorId =
        event.type === "receive"
          ? s.possession.find((key) => key.t === event.t)?.playerId
          : (sameTimeReceiver ??
            s.possession.filter((key) => key.t < event.t).at(-1)?.playerId);
      const actor = s.players.find((player) => player.id === actorId);
      if (!actor || !event.playerIds.includes(actor.id)) continue;
      const position = samplePosition(actor.positions, event.t),
        yaw = sampleYaw(actor.facing, event.t);
      const ball = samplePosition(s.ball, event.t);
      const ballLocal = local(
        ball.map((value, i) => value - position[i]) as Vec3,
        yaw,
      );
      const before = samplePosition(
        s.ball,
        event.type === "receive" ? event.t - 0.1 : event.t,
      );
      const after = samplePosition(
        s.ball,
        event.type === "receive" ? event.t : event.t + 0.1,
      );
      const direction =
        Math.atan2(after[0] - before[0], after[2] - before[2]) - yaw;
      const technique =
        s.id === "the-missed-chance" && event.type === "shot"
          ? ("driven" as const)
          : undefined;
      const [prepare, recover] = technique
        ? [0.55, 0.78]
        : actionWindows[event.type];
      result.push({
        kind: event.type,
        technique,
        eventId: event.id,
        actorId: actor.id,
        start: event.t - prepare,
        contact: event.t,
        end: event.t + recover,
        foot: ballLocal[0] >= 0 ? "l" : "r",
        ballLocal,
        direction: Math.atan2(Math.sin(direction), Math.cos(direction)),
        position,
        yaw,
      });
    }
    // Contacts within 10 microseconds cannot represent distinct foot strikes.
    // Resolve those consistently (shot > pass > receive, then event ID), rather
    // than letting event order decide. Every other contact keeps its own peak.
    const priority = { receive: 0, pass: 1, shot: 2 };
    result.sort(
      (a, b) =>
        a.contact - b.contact ||
        priority[b.kind] - priority[a.kind] ||
        a.eventId.localeCompare(b.eventId),
    );
    result = result.filter(
      (action) =>
        !result!.some(
          (other) =>
            other !== action &&
            other.actorId === action.actorId &&
            Math.abs(other.contact - action.contact) <= 1e-5 &&
            (priority[other.kind] > priority[action.kind] ||
              (priority[other.kind] === priority[action.kind] &&
                other.eventId < action.eventId)),
        ),
    );
    // Disjoint midpoint windows give a continuous zero-weight handover.
    for (const action of result) {
      const previous = result.findLast(
        (other) =>
          other.actorId === action.actorId && other.contact < action.contact,
      );
      const next = result.find(
        (other) =>
          other.actorId === action.actorId && other.contact > action.contact,
      );
      if (previous)
        action.start = Math.max(
          action.start,
          (previous.contact + action.contact) / 2,
        );
      if (next)
        action.end = Math.min(action.end, (action.contact + next.contact) / 2);
    }
    definitions.set(s, result);
  }
  return result;
}

/** Cosmetic contact geometry is separate from Python's tactical evidence.
 *
 * @param s - Canonical contact/possession context.
 * @param player - Player whose action window is sampled.
 * @param time - Absolute scenario seconds.
 * @returns A local cosmetic contact/support-foot target, or null outside a window.
 */
export function sampleFootballAction(
  s: Scenario,
  player: Player,
  time: number,
): FootballAction | null {
  const t = clampTime(time, s.duration);
  const action = footballActions(s).find(
    (a) => a.actorId === player.id && t > a.start && t < a.end,
  );
  if (!action) return null;
  const { position, yaw, ...definition } = action;
  const now = samplePosition(player.positions, t),
    currentYaw = sampleYaw(player.facing, t);
  const supportX = action.foot === "l" ? -0.15 : 0.15,
    supportZ = 0.03;
  const fixed: Vec3 = [
    position[0] + supportX * Math.cos(yaw) + supportZ * Math.sin(yaw) - now[0],
    0.09,
    position[2] - supportX * Math.sin(yaw) + supportZ * Math.cos(yaw) - now[2],
  ];
  const planted = local(fixed, currentYaw),
    elapsed = t - action.contact;
  const lock = smooth(-0.3, -0.12, elapsed) * (1 - smooth(0.12, 0.35, elapsed));
  const fadeIn = Math.min(0.18, action.contact - action.start),
    fadeOut = Math.min(0.25, action.end - action.contact);
  return {
    ...definition,
    elapsed,
    phase: (t - action.start) / (action.end - action.start),
    weight:
      smooth(action.start, action.start + fadeIn, t) *
      (1 - smooth(action.end - fadeOut, action.end, t)),
    supportLocal: [
      supportX + (planted[0] - supportX) * lock,
      0.09,
      supportZ + (planted[2] - supportZ) * lock,
    ],
  };
}
