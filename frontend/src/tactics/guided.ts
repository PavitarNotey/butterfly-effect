import type { CameraMode, PlaybackSpeed, TacticalView } from '../replay/store'
import { samplePosition } from '../replay/sample'
import type { Scenario } from '../replay/types'
import type { EvidenceBundle, Layer } from './types'
import { evidenceLayer, presentEvidence } from './presentation'

export interface RestorationContext {
  time: number; camera: CameraMode; tacticalView: TacticalView | null; selectedId: string | null; speed: PlaybackSpeed
  enabled: boolean; layers: Record<Layer, boolean>
}
export interface GuidedReplay {
  scenarioId: string; sourceHash: string; evidenceId: string; momentId: string
  startTime: number; endTime: number; focusTime: number; relevantPlayerIds: string[]
  layer: Layer; category: EvidenceBundle['evidence'][number]['category']; preferredCamera: CameraMode
  title: string; caption: string; status: 'playing' | 'paused' | 'complete'; speed: PlaybackSpeed
  restoration: RestorationContext
}

/** Input must be the current hash-validated bundle, never an arbitrary fact object. */
export function resolveGuided(bundle: EvidenceBundle, scenario: Scenario, evidenceId: string, momentId: string, restoration: RestorationContext): GuidedReplay {
  const evidence = bundle.evidence.find(e => e.id === evidenceId)
  const moment = bundle.moments.find(m => m.id === momentId)
  if (bundle.scenarioId !== scenario.id || !bundle.sourceHash || !evidence || !moment?.evidenceIds.includes(evidenceId) || evidence.playerIds.some(id => !scenario.players.some(p => p.id === id))) throw new Error('Guided evidence does not match this replay')
  if (![evidence.start, evidence.end].every(Number.isFinite) || evidence.start < 0 || evidence.end > scenario.duration || evidence.end < evidence.start) throw new Error('Invalid guided interval')
  const copy = presentEvidence(evidence, scenario)
  return {
    scenarioId: scenario.id, sourceHash: bundle.sourceHash, evidenceId, momentId,
    startTime: Math.max(0, evidence.start - .65), endTime: Math.min(scenario.duration, evidence.end + (evidence.category === 'finish' ? 1.1 : .65)), focusTime: (evidence.start + evidence.end) / 2,
    relevantPlayerIds: evidence.category === 'corridor' || evidence.category === 'finish' ? [...new Set([...evidence.playerIds, ...moment.playerIds])] : evidence.playerIds,
    layer: evidenceLayer[evidence.category], category: evidence.category, preferredCamera: evidence.category === 'finish' ? 'broadcast' : 'tactical',
    title: copy.title, caption: copy.sentence, status: 'playing', speed: evidence.category === 'finish' || evidence.category === 'corridor' ? .5 : 1, restoration,
  }
}
export function guidedFraming(guided: GuidedReplay, scenario: Scenario): TacticalView | null {
  if (guided.preferredCamera !== 'tactical') return null
  const points = guided.relevantPlayerIds.flatMap(id => {
    const p = scenario.players.find(p => p.id === id)!
    return [samplePosition(p.positions, guided.startTime), samplePosition(p.positions, guided.endTime)]
  })
  if (guided.category === 'space' || guided.category === 'corridor') points.push(samplePosition(scenario.ball, guided.focusTime))
  const xs = points.map(p => p[0]), zs = points.map(p => p[2])
  const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2
  return { center: [x, z], height: Math.min(90, Math.max(34, (Math.max(...xs) - Math.min(...xs) + 20) * .95, (Math.max(...zs) - Math.min(...zs) + 22) * 1.2)) }
}
