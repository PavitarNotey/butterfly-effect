import type { components } from '../api/schema'
import { sourceFor } from '../replay/scenario'
import type { Scenario } from '../replay/types'

export type Intelligence = components['schemas']['Intelligence']
export type Narrative = components['schemas']['Narrative']
export type Mode = 'casual' | 'analyst'
export type Cue = components['schemas']['Cue']
export type AIStatus = components['schemas']['AIStatus']
const base = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

async function request(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  try {
    const response = await fetch(`${base}/api/ai${path}`, {
      method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any([signal, AbortSignal.timeout(78000)]),
    })
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null)
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null
      throw new Error(typeof detail === 'string' ? detail : 'Intelligence is unavailable. Please retry.')
    }
    return await response.json()
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('Intelligence took too long. Retry shortly; replay remains available.', { cause: error })
    if (error instanceof TypeError) throw new Error('Cannot reach the intelligence service. Check the backend connection.', { cause: error })
    throw error
  }
}

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
function assert(v: unknown): asserts v { if (!v) throw new Error('Intelligence does not match this replay. Refresh both servers and retry.') }
const text = (v: unknown) => typeof v === 'string' && v.length > 0

/** Identity/reference checks do not prove the generated prose true. */
export async function validateIntelligence(value: unknown, scenario: Scenario, mode: Mode, target?: string, matchId?: string): Promise<Intelligence> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceFor(scenario.id)))
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
  assert(record(value) && value.scenario_id === scenario.id && value.source_hash === hash && value.mode === mode && value.synthetic === true && ['foundry', 'mock', 'validation_fallback'].includes(String(value.provider)))
  assert(!matchId || value.match_id === matchId)
  assert(Array.isArray(value.narratives) && value.narratives.length > 0 && Array.isArray(value.cues) && Array.isArray(value.events) && Array.isArray(value.recorded_match_facts) && text(value.validation_note))
  const allowed = new Set(scenario.events.map(e => e.id))
  const sourceValid = (s: unknown) => record(s) && text(s.id) && text(s.statement) && ['recorded_event', 'match_metadata', 'measurement', 'authored_interpretation'].includes(String(s.kind)) && (s.evidence_id === null || typeof s.evidence_id === 'string') && Array.isArray(s.event_ids) && s.event_ids.every(text) && Array.isArray(s.units) && s.units.every(text)
  for (const n of value.narratives) {
    assert(record(n) && text(n.event_id) && (target ? n.event_id === target : allowed.has(String(n.event_id))) && n.mode === mode && text(n.headline) && text(n.explanation) && text(n.why_it_matters) && n.confidence_label === 'references-and-claims-screened' && Array.isArray(n.key_evidence) && Array.isArray(n.source_ids) && Array.isArray(n.limitations))
    assert(n.source_ids.every(text) && new Set(n.source_ids).size === n.source_ids.length && n.limitations.every(text))
    assert(n.key_evidence.length === n.source_ids.length && n.key_evidence.every((s, i) => sourceValid(s) && record(s) && s.id === (n.source_ids as unknown[])[i]))
  }
  assert(target ? value.narratives.length === 1 : value.narratives.length === scenario.events.length && value.narratives.every((n, i) => record(n) && n.event_id === scenario.events[i].id))
  assert(value.recorded_match_facts.every(sourceValid))
  let previous = -Infinity
  for (const cue of value.cues) {
    assert(record(cue) && text(cue.id) && allowed.has(String(cue.event_id)) && typeof cue.replay_time === 'number' && cue.replay_time >= previous && scenario.events.some(e => e.id === cue.event_id && e.t === cue.replay_time) && record(cue.narrative) && cue.narrative.event_id === cue.event_id && cue.narrative.mode === mode)
    assert(value.narratives.some(n => record(n) && record(cue.narrative) && n.event_id === cue.event_id && n.headline === cue.narrative.headline && n.explanation === cue.narrative.explanation))
    previous = cue.replay_time
  }
  assert(value.events.length === scenario.events.length)
  value.events.forEach((event, i) => assert(record(event) && event.sequence === i && event.event_id === scenario.events[i].id && event.replay_time === scenario.events[i].t))
  return value as Intelligence
}

export async function getStatus(signal: AbortSignal): Promise<AIStatus> {
  const value = await request('/status', signal)
  if (!record(value) || !['foundry', 'mock', 'disabled', 'invalid_configuration'].includes(String(value.provider)) || typeof value.available !== 'boolean' || !text(value.message)) throw new Error('AI status is unavailable.')
  return value as AIStatus
}
export async function explain(scenario: Scenario, eventId: string, mode: Mode, signal: AbortSignal) {
  return validateIntelligence(await request('/moments/explain', signal, { scenario_id: scenario.id, event_id: eventId, mode }), scenario, mode, eventId)
}
export async function commentary(scenario: Scenario, mode: Mode, signal: AbortSignal) {
  return validateIntelligence(await request(`/scenarios/${scenario.id}/commentary?mode=${mode}`, signal), scenario, mode)
}
export async function recap(scenario: Scenario, matchId: string, eventId: string, mode: Mode, signal: AbortSignal) {
  return validateIntelligence(await request(`/matches/${matchId}/recap?mode=${mode}`, signal), scenario, mode, eventId, matchId)
}

/** Pure sampling of the authoritative clock; no generation on a seek. */
export function cueAt(cues: Cue[], time: number) { return cues.findLast(c => c.replay_time <= time) ?? null }
