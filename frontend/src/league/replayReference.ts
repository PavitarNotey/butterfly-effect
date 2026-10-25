import type { MatchDetail, MatchKeyEvent, ReplayReference } from './types'
import type { Scenario } from '../replay/types'

/** Also check the API link against the exact local canonical data before mounting. */
export function resolveReplay(match: MatchDetail, eventId: string, scenarios: Scenario[]): { event: MatchKeyEvent; reference: ReplayReference; scenario: Scenario } | null {
  const event = match.events.find(e => e.id === eventId && e.matchId === match.id)
  const reference = event?.replay
  if (!event || !reference || match.status !== 'finished') return null
  const scenario = scenarios.find(s => s.id === reference.scenarioId)
  const anchor = scenario?.events.find(e => e.id === reference.eventId)
  const actor = scenario?.players.find(p => p.id === anchor?.playerIds[0])
  if (!scenario || !anchor || !actor || (event.type === 'goal' ? anchor.type !== 'goal' : event.type === 'major_miss' ? anchor.type !== 'miss' : true)) return null
  if (actor.id !== event.playerId || actor.name !== event.playerName || actor.teamId !== event.teamId || ![match.homeId, match.awayId].includes(actor.teamId) || !scenario.teams.every(t => [match.homeId, match.awayId].includes(t.id))) return null
  if (Math.abs(scenario.matchStartSeconds + anchor.t - event.matchSeconds) > .000001 || !Number.isFinite(reference.startTime) || reference.startTime < 0 || reference.startTime > anchor.t || anchor.t > scenario.duration) return null
  return { event, reference, scenario }
}
