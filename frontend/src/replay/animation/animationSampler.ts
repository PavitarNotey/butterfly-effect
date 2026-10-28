import { sampleReaction } from "./reactions";
import { sampleDummy } from "./dummy";
import type { DummyAction } from "./dummy";
import type { FootballReaction } from "./reactions";
import { sampleFootballAction } from "./footballActions";
import type { FootballAction } from "./footballActions";
import { locomotionPhase } from "./locomotionPhase";
import { sampleAttention } from "./attention";
import type { FootballAttention } from "./attention";
import { clampTime, samplePosition, sampleTravel, sampleYaw } from "../sample";
import type { Player, Scenario } from "../types";

export interface AnimationSample {
  time: number;
  speed: number;
  weights: { idle: number; walk: number; jog: number };
  cycles: number;
  idleTime: number;
  travelAngle: number;
  backward: number;
  lowerBodyYaw: number;
  action: FootballAction | null;
  reaction: FootballReaction | null;
  dummy: DummyAction | null;
  attention: FootballAttention;
}

function smoothstep(a: number, b: number, value: number) {
  const x = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** Cosmetic only. A centred 0.5s distance window softens velocity discontinuities;
 * canonical positions/facing are untouched. No wall clock, delta, speed or history.
 * Both moving clips share a distance-indexed cycle so blending preserves foot phase.
 *
 * @param scenario - Immutable canonical action/possession context.
 * @param player - Player whose presentation pose is sampled.
 * @param time - Absolute replay seconds; direct and backward seeks remain deterministic.
 * @returns Clip weights/phases plus action, dummy, reaction and illustrative attention samples.
 */
export function sampleAnimation(
  scenario: Scenario,
  player: Player,
  time: number,
): AnimationSample {
  const t = clampTime(time, scenario.duration);
  const start = Math.max(0, t - 0.25),
    end = Math.min(scenario.duration, t + 0.25);
  const speed =
    (sampleTravel(player.positions, end) -
      sampleTravel(player.positions, start)) /
    (end - start);
  const moving = smoothstep(0.08, 0.5, speed);
  const jog = smoothstep(1.25, 2.4, speed);
  const before = samplePosition(player.positions, start),
    after = samplePosition(player.positions, end);
  const travelYaw = Math.atan2(after[0] - before[0], after[2] - before[2]);
  const angle = travelYaw - sampleYaw(player.facing, t);
  const travelAngle =
    speed > 0.08 ? Math.atan2(Math.sin(angle), Math.cos(angle)) : 0;
  return {
    time: t,
    speed,
    weights: { idle: 1 - moving, walk: moving * (1 - jog), jog: moving * jog },
    // The faster revised wide run lengthens its stride instead of spinning the
    // existing jog clip at an implausibly high cadence. Other profiles retain
    // their original phase table and stride length.
    cycles: locomotionPhase(
      player,
      t,
      scenario.id === "the-missed-chance" ? 1.05 : 0.4,
    ),
    idleTime: t + player.number * 0.173,
    travelAngle,
    // Diagnostic back-facing cue; signed phase handles continuous reversal.
    backward: 1 - smoothstep(-0.5, 0.05, Math.cos(travelAngle)),
    lowerBodyYaw: Math.sin(travelAngle) * 0.22 * moving,
    action: sampleFootballAction(scenario, player, t),
    reaction: sampleReaction(scenario, player, t),
    dummy: sampleDummy(scenario, player, t),
    attention: sampleAttention(scenario, player, t),
  };
}
