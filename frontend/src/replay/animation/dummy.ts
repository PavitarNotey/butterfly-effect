import type { Player, Scenario } from '../types'
import { smooth } from './footballActions'

/** Separate from FootballAction: there is deliberately no foot/contact target. */
export interface DummyAction {
  kind: 'dummy'
  eventId: string
  actorId: string
  passage: number
  elapsed: number
  weight: number
  anticipation: number
}
const definitions = new WeakMap<Scenario, Extract<Scenario['events'][number], { type: 'dummy' }>[]>()
export function sampleDummy(s: Scenario, player: Player, t: number): DummyAction | null {
  let events = definitions.get(s)
  if (!events) {
    events = s.events.filter((event): event is Extract<Scenario['events'][number], { type: 'dummy' }> => event.type === 'dummy')
    definitions.set(s, events)
  }
  const event = events.find(e => e.actorId === player.id && t > e.start && t < e.end)
  if (!event) return null
  const fadeIn = Math.min(.22, event.t - event.start), fadeOut = Math.min(.18, event.end - event.t)
  return { kind: 'dummy', eventId: event.id, actorId: event.actorId, passage: event.t, elapsed: t - event.t,
    weight: smooth(event.start, event.start + fadeIn, t) * (1 - smooth(event.end - fadeOut, event.end, t)),
    anticipation: smooth(event.start, event.t - .12, t) }
}
