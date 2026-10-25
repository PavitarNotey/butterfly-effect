import originalSource from './invisible-run.json?raw'
import missedSource from './missed-chance.json?raw'
import untouchedSource from './untouched-pass.json?raw'
import type { Scenario } from './types'

/** Fail early on invalid references/timestamps rather than silently rendering another story. */
export function validateScenario(s: Scenario): Scenario {
  const ids = new Set(s.players.map(p => p.id))
  const teamIds = new Set(s.teams.map(t => t.id))
  if (s.version !== 1 || (!Number.isFinite(s.duration) || s.duration <= 0) || s.players.length !== 22 || ids.size !== 22 || teamIds.size !== 2) throw new Error('Invalid scenario roster')
  function timeline(keys: { t: number }[]) {
    if (keys.length < 2 || keys[0].t !== 0 || keys.at(-1)?.t !== s.duration) throw new Error('Incomplete track')
    keys.forEach((key, i) => {
      if (!Number.isFinite(key.t) || (i > 0 && key.t <= keys[i - 1].t)) throw new Error('Unordered track')
    })
  }
  for (const p of s.players) {
    if (!teamIds.has(p.teamId)) throw new Error('Unknown team')
    timeline(p.positions)
    timeline(p.facing)
    if (p.facing.some(k => !Number.isFinite(k.yaw))) throw new Error('Invalid heading')
  }
  timeline(s.ball)
  for (const track of [s.ball, ...s.players.map(p => p.positions)]) {
    if (track.some(k => k.position.length !== 3 || k.position.some(n => !Number.isFinite(n)))) throw new Error('Invalid position')
  }
  if (new Set(s.events.map(e => e.id)).size !== s.events.length) throw new Error('Duplicate event')
  for (const e of s.events) {
    if (e.t < 0 || e.t > s.duration || e.playerIds.some(id => !ids.has(id))) throw new Error('Invalid event')
  }
  if (s.events.some((e, i) => i > 0 && e.t < s.events[i - 1].t)) throw new Error('Unordered events')
  if (s.relevantPlayerIds.some(id => !ids.has(id))) throw new Error('Invalid POV player')
  if (s.possession[0]?.t !== 0 || s.possession.some((p, i) => (p.playerId !== null && !ids.has(p.playerId)) || p.t < 0 || p.t > s.duration || (i > 0 && p.t <= s.possession[i - 1].t))) throw new Error('Invalid possession')
  for (const e of s.events) if (e.type === 'dummy') {
    const pass = s.events.find(p => p.id === e.passEventId), receive = s.events.find(p => p.id === e.receiveEventId)
    const passer = pass && s.possession.findLast(p => p.t < pass.t)?.playerId
    const receiver = receive && s.possession.find(p => p.t === receive.t)?.playerId
    if (e.nonContact !== true || e.possessionTransfer !== false || !ids.has(e.actorId) || !e.playerIds.includes(e.actorId) || pass?.type !== 'pass' || receive?.type !== 'receive' || ![e.start,e.t,e.end].every(Number.isFinite) || !(pass.t < e.start && e.start < e.t && e.t < e.end && e.end < receive.t) || !passer || !receiver || passer === receiver || [passer,receiver].includes(e.actorId) || !pass.playerIds.includes(passer) || !receive.playerIds.includes(receiver) || [passer,receiver].some(id => s.players.find(p => p.id === id)?.teamId !== s.players.find(p => p.id === e.actorId)?.teamId) || !s.possession.some(p => p.t === pass.t && p.playerId === null) || s.possession.some(p => p.t >= pass.t && p.t < receive.t && p.playerId !== null) || s.events.some(p => p.t > pass.t && p.t < receive.t && ['pass','receive','shot','block'].includes(p.type))) throw new Error('Invalid non-contact dummy')
  }
  return s
}

// Raw text is retained byte-for-byte for the API evidence SHA-256 integrity check.
export const scenarioSources = [originalSource, missedSource, untouchedSource].map(source => ({ source, scenario: validateScenario(JSON.parse(source) as Scenario) }))
export const scenarios = scenarioSources.map(entry => entry.scenario)
export const scenario = scenarios[0] // Default fixture export for independent original-scenario regression tests.
export function sourceFor(id: string) { return scenarioSources.find(entry => entry.scenario.id === id)!.source }
export function outcome(s: Scenario) { return s.events.findLast(e => ['goal','miss','block'].includes(e.type))?.type ?? 'replay' }
