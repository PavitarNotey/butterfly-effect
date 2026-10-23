import { sourceFor } from '../replay/scenario'
import { replayStore } from '../replay/store'
import type { Scenario } from '../replay/types'
import type { EvidenceBundle } from './types'

export function validateEvidence(bundle: EvidenceBundle, expectedHash: string, scenario: Scenario = replayStore.getState().scenario): EvidenceBundle {
  if (!bundle || !Array.isArray(bundle.evidence) || !Array.isArray(bundle.frames) || !Array.isArray(bundle.moments)) throw new Error('Malformed evidence response')
  if (bundle.version !== 1 || bundle.scenarioId !== scenario.id || bundle.sourceHash !== expectedHash) throw new Error('Evidence does not match this replay. Refresh both servers.')
  const players = new Set(scenario.players.map(p => p.id)), events = new Set(scenario.events.map(e => e.id))
  const facts = new Set(bundle.evidence.map(e => e.id))
  if (facts.size !== bundle.evidence.length || bundle.frames.length < 2 || !bundle.moments.length) throw new Error('Incomplete evidence response')
  for (const e of bundle.evidence) {
    if (e.status !== 'observation' || ![e.start,e.end].every(Number.isFinite) || e.start < 0 || e.end > scenario.duration || e.end < e.start || e.playerIds.some(id => !players.has(id)) || e.eventIds.some(id => !events.has(id)) || e.metrics.some(m => !Number.isFinite(m.value))) throw new Error('Invalid evidence references or measurements')
  }
  for (const m of bundle.moments) {
    if (![m.start,m.end].every(Number.isFinite) || m.start < 0 || m.end > scenario.duration || m.end < m.start || m.evidenceIds.some(id => !facts.has(id)) || m.playerIds.some(id => !players.has(id))) throw new Error('Invalid moment references')
    for (const movement of m.movements) {
      if (!players.has(movement.playerId) || ![movement.startTime,movement.endTime].every(Number.isFinite) || movement.startTime < 0 || movement.endTime > scenario.duration || movement.endTime < movement.startTime || !movement.path.length || movement.path.some((key,i) => !Number.isFinite(key.t) || key.t < 0 || key.t > scenario.duration || key.position.length !== 3 || key.position.some(n => !Number.isFinite(n)) || (i > 0 && key.t <= movement.path[i-1].t))) throw new Error('Invalid movement geometry')
    }
  }
  const frames = bundle.frames
  if (frames[0].t !== 0 || frames.at(-1)?.t !== scenario.duration || frames.some((f,i) => !Number.isFinite(f.t) || (i > 0 && f.t <= frames[i-1].t))) throw new Error('Invalid evidence timeline')
  for (const f of frames) {
    const points = [f.corridor.start, f.corridor.end, f.space.center, f.space.nearestDefenderPosition, ...f.relationships.flatMap(r => [r.a,r.b])]
    if (points.some(p => p.length !== 3 || p.some(n => !Number.isFinite(n)))) throw new Error('Invalid overlay coordinates')
  }
  return bundle
}

export async function loadEvidence(signal: AbortSignal, scenario: Scenario = replayStore.getState().scenario): Promise<EvidenceBundle> {
  const api = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
  const response = await fetch(`${api}/api/scenarios/${scenario.id}/evidence`, { signal })
  if (!response.ok) throw new Error(`Evidence request failed (${response.status}).`)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceFor(scenario.id)))
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('')
  return validateEvidence(await response.json() as EvidenceBundle, hash, scenario)
}

/** Same timestamp for panel and geometry. Metrics use the most recent measured sample. */
export function frameAt(bundle: EvidenceBundle, t: number) {
  const index = Math.max(0, bundle.frames.findLastIndex(f => f.t <= t))
  const a = bundle.frames[index], b = bundle.frames[Math.min(index+1,bundle.frames.length-1)]
  return { a, b, fraction: b.t === a.t ? 0 : Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))) }
}
export function momentAt(bundle: EvidenceBundle, t: number) {
  return bundle.moments.findLast(m => m.start <= t) || bundle.moments[0]
}
