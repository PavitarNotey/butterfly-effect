import { sampleFootballAction } from './footballActions'
import type { FootballAction } from './footballActions'
import { locomotionPhase } from './locomotionPhase'
import { clampTime, samplePosition, sampleTravel, sampleYaw } from '../sample'
import type { Player, Scenario } from '../types'

export interface AnimationSample {
  time: number
  speed: number
  weights: { idle: number; walk: number; jog: number }
  cycles: number
  idleTime: number
  travelAngle: number
  backward: number
  lowerBodyYaw: number
  action: FootballAction | null
}

function smoothstep(a: number, b: number, value: number) {
  const x = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** Cosmetic only. A centred 0.5s distance window softens velocity discontinuities;
 * canonical positions/facing are untouched. No wall clock, delta, speed or history.
 * Both moving clips share a distance-indexed cycle so blending preserves foot phase.
 */
export function sampleAnimation(scenario: Scenario, player: Player, time: number): AnimationSample {
  const t = clampTime(time, scenario.duration)
  const start = Math.max(0, t - .25), end = Math.min(scenario.duration, t + .25)
  const speed = (sampleTravel(player.positions, end) - sampleTravel(player.positions, start)) / (end - start)
  const moving = smoothstep(.08, .5, speed)
  const jog = smoothstep(1.25, 2.4, speed)
  const before = samplePosition(player.positions, start), after = samplePosition(player.positions, end)
  const travelYaw = Math.atan2(after[0] - before[0], after[2] - before[2])
  const angle = travelYaw - sampleYaw(player.facing, t)
  const travelAngle = speed > .08 ? Math.atan2(Math.sin(angle), Math.cos(angle)) : 0
  return {
    time: t, speed,
    weights: { idle: 1 - moving, walk: moving * (1 - jog), jog: moving * jog },
    cycles: locomotionPhase(player, t),
    idleTime: t + player.number * .173,
    travelAngle,
    // Diagnostic back-facing cue; signed phase handles continuous reversal.
    backward: 1 - smoothstep(-.5, .05, Math.cos(travelAngle)),
    lowerBodyYaw: Math.sin(travelAngle) * .22 * moving,
    action: sampleFootballAction(scenario, player, t),
  }
}
