import { samplePosition, sampleYaw } from '../sample'
import type { Player, Scenario } from '../types'
import { smooth } from './footballActions'

export interface FootballAttention { yaw: number; pitch: number; chest: number }
const neutral: FootballAttention = { yaw: 0, pitch: 0, chest: 0 }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value))
const runners: Record<string, string> = { c2: 's7', c5: 's9', c6: 's9', c4: 's9' }
const actors = new WeakMap<Scenario, Map<string, Player>>()

/** Illustrative head/shoulder attention, never observed intent or root movement.
 * Only the revised miss opts in; targets use absolute canonical samples and no
 * history, random motion, per-frame roster filtering or additional replay clock.
 */
export function sampleAttention(s: Scenario, p: Player, t: number): FootballAttention {
  if (s.id !== 'the-missed-chance') return neutral
  let roster = actors.get(s)
  if (!roster) { roster = new Map(s.players.map(player => [player.id, player])); actors.set(s, roster) }
  const position = samplePosition(p.positions, t), ball = samplePosition(s.ball, t), facing = sampleYaw(p.facing, t)
  const distance = Math.hypot(ball[0] - position[0], ball[2] - position[2])
  let yaw = clamp(angle(Math.atan2(ball[0] - position[0], ball[2] - position[2]) - facing), -.8, .8)
  const runner = roster.get(runners[p.id])
  if (runner) {
    const target = samplePosition(runner.positions, t)
    const runnerYaw = clamp(angle(Math.atan2(target[0] - position[0], target[2] - position[2]) - facing), -.8, .8)
    yaw = yaw * .65 + runnerYaw * .35
  }
  const owner = s.possession.findLast(key => key.t <= t)?.playerId === p.id
  // A carrier alternates a brief glance at the feet with a forward scan. Stop
  // scanning as the recorded release approaches, rather than implying choice.
  const release = s.events.find(event => (event.type === 'pass' || event.type === 'shot') && event.playerIds[0] === p.id && event.t >= t)
  const scan = owner ? Math.sin(t * Math.PI / 1.4) ** 4 * (1 - smooth(-.7, -.15, t - (release?.t ?? t))) : 0
  const pitch = owner ? .30 * (1 - scan) : clamp(Math.atan2(1.55 - ball[1], Math.max(2.5, distance)), -.12, .22)
  const envelope = smooth(0, .22, t) * (1 - smooth(s.duration - .5, s.duration, t))
  return { yaw: yaw * (1 - scan * .8) * envelope, pitch: pitch * envelope, chest: yaw * .20 * envelope }
}
