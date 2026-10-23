import { clampTime, samplePosition, sampleYaw } from '../sample'
import type { Player, Scenario, Vec3 } from '../types'

export type FootballActionKind = 'pass' | 'receive' | 'shot'
export type FootSide = 'l' | 'r'
export interface FootballAction {
  kind: FootballActionKind
  eventId: string
  actorId: string
  start: number
  contact: number
  end: number
  elapsed: number
  phase: number
  weight: number
  foot: FootSide
  ballLocal: Vec3
  direction: number
  supportLocal: Vec3
}
export const actionWindows = { pass: [.55, .70], receive: [.40, .65], shot: [.80, .95] } as const
export const smooth = (a: number, b: number, value: number) => {
  const x = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
type Definition = Omit<FootballAction, 'elapsed' | 'phase' | 'weight' | 'supportLocal'> & { position: Vec3; yaw: number }
const definitions = new WeakMap<Scenario, Definition[]>()
function local(vector: Vec3, yaw: number): Vec3 {
  return [vector[0] * Math.cos(yaw) - vector[2] * Math.sin(yaw), vector[1], vector[0] * Math.sin(yaw) + vector[2] * Math.cos(yaw)]
}

/** Possession transitions identify the actor; contextual event participants never
 * become kickers. Outcome events deliberately do not create another action. */
export function footballActions(s: Scenario): readonly Definition[] {
  let result = definitions.get(s)
  if (!result) {
    result = []
    for (const event of s.events) {
      if (event.type !== 'pass' && event.type !== 'receive' && event.type !== 'shot') continue
      const actorId = event.type === 'receive'
        ? s.possession.find(key => key.t === event.t)?.playerId
        : s.possession.filter(key => key.t < event.t).at(-1)?.playerId
      const actor = s.players.find(player => player.id === actorId)
      if (!actor || !event.playerIds.includes(actor.id)) continue
      const position = samplePosition(actor.positions, event.t), yaw = sampleYaw(actor.facing, event.t)
      const ball = samplePosition(s.ball, event.t)
      const ballLocal = local(ball.map((value, i) => value - position[i]) as Vec3, yaw)
      const before = samplePosition(s.ball, event.type === 'receive' ? event.t - .1 : event.t)
      const after = samplePosition(s.ball, event.type === 'receive' ? event.t : event.t + .1)
      const direction = Math.atan2(after[0] - before[0], after[2] - before[2]) - yaw
      const [prepare, recover] = actionWindows[event.type]
      result.push({ kind: event.type, eventId: event.id, actorId: actor.id, start: event.t - prepare, contact: event.t, end: event.t + recover, foot: ballLocal[0] >= 0 ? 'l' : 'r', ballLocal, direction: Math.atan2(Math.sin(direction), Math.cos(direction)), position, yaw })
    }
    // A quick control/shot may have overlapping default windows. Split only
    // those adjacent actions at their contact midpoint so the earlier receive
    // cannot mask the shot or abruptly hand over a fully weighted pose.
    for (const action of result) {
      const previous = result.findLast(other => other.actorId === action.actorId && other.contact < action.contact)
      const next = result.find(other => other.actorId === action.actorId && other.contact > action.contact)
      if (previous) action.start = Math.max(action.start, (previous.contact + action.contact) / 2)
      if (next) action.end = Math.min(action.end, (action.contact + next.contact) / 2)
    }
    definitions.set(s, result)
  }
  return result
}

/** Cosmetic contact geometry is separate from Python's tactical evidence. */
export function sampleFootballAction(s: Scenario, player: Player, time: number): FootballAction | null {
  const t = clampTime(time, s.duration)
  const action = footballActions(s).find(a => a.actorId === player.id && t > a.start && t < a.end)
  if (!action) return null
  const { position, yaw, ...definition } = action
  const now = samplePosition(player.positions, t), currentYaw = sampleYaw(player.facing, t)
  const supportX = action.foot === 'l' ? -.15 : .15, supportZ = .03
  const fixed: Vec3 = [position[0] + supportX * Math.cos(yaw) + supportZ * Math.sin(yaw) - now[0], .09, position[2] - supportX * Math.sin(yaw) + supportZ * Math.cos(yaw) - now[2]]
  const planted = local(fixed, currentYaw), elapsed = t - action.contact
  const lock = smooth(-.30, -.12, elapsed) * (1 - smooth(.12, .35, elapsed))
  return { ...definition, elapsed, phase: (t - action.start) / (action.end - action.start), weight: smooth(action.start, action.start + .18, t) * (1 - smooth(action.end - .25, action.end, t)), supportLocal: [supportX + (planted[0] - supportX) * lock, .09, supportZ + (planted[2] - supportZ) * lock] }
}
