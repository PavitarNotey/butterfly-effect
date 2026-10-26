import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useResource } from '../league/useResource'
import { replayStore, useReplay } from '../replay/store'
import { useReplayTime } from '../replay/useReplayTime'
import type { Scenario } from '../replay/types'
import { loadEvidence } from '../tactics/data'
import { useTactics } from '../tactics/store'
import { commentary, cueAt, explain, getStatus } from './client'
import type { Intelligence, Mode, Narrative } from './client'
import { AnalysisError, AnalysisLoading } from './AnalysisPresentation'
import { narrativeSentences } from './presentation'
import { useIntelligenceRequest } from './useIntelligenceRequest'
import './Intelligence.css'

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return <div className="ai-mode" role="group" aria-label="Explanation mode">{(['casual', 'analyst'] as const).map(m => <button type="button" key={m} aria-pressed={mode === m} onClick={() => onChange(m)}>{m === 'casual' ? 'Casual Fan' : 'Analyst'}</button>)}</div>
}

const labels = { foundry: 'AI-generated', mock: 'Authored demo', validation_fallback: 'Authored fallback' }
export function NarrativeView({ data, narrative, onEvidence }: { data: Intelligence; narrative: Narrative; onEvidence?: (id: string) => void }) {
  return <article className={`ai-narrative ai-ready-reveal${data.cached ? ' is-cached' : ''}`} data-provider={data.provider}>
    <p className={`ai-provenance ${data.provider !== 'foundry' ? 'is-demo' : ''}`}><span>{labels[data.provider]}</span> · Synthetic replay{data.cached ? <span className="ai-cached"> · Cached</span> : null}</p>
    <h3 className="ai-headline">{narrative.headline}</h3><p className="ai-explanation">{narrativeSentences(narrative.explanation).map((sentence, i) => <span className="ai-sentence" key={i} style={{ '--sentence-index': Math.min(i, 5) } as CSSProperties}>{sentence}</span>)}</p><div className="ai-takeaway"><span>Worth watching</span><p className="ai-impact">{narrative.why_it_matters}</p></div>
    {narrative.key_evidence.some(source => source.kind !== 'match_metadata') && <details className="ai-evidence"><summary>Explore the evidence</summary>{narrative.key_evidence.filter(source => source.kind !== 'match_metadata').map(source => <div key={source.id} className="ai-source"><span>{({ measurement: 'Measured replay detail', recorded_event: 'Recorded play', authored_interpretation: 'Tactical reading' } as Record<string, string>)[source.kind]}</span><p>{source.statement}</p>{source.evidence_id && onEvidence && <button onClick={() => onEvidence(source.evidence_id!)}>Watch this detail</button>}</div>)}<p className="ai-evidence-note">Replay details describe the recorded play. Player intent and alternative outcomes remain unknown.</p></details>}
  </article>
}

function AIAvailability() {
  const { resource } = useResource('ai-status', getStatus)
  return <p className="ai-availability">{resource.status === 'ready' && resource.data.provider === 'mock' ? 'Authored demo · Synthetic replay' : 'Microsoft Foundry · Synthetic replay'}</p>
}

function LoadedMoment({ scenario, eventId, mode }: { scenario: Scenario; eventId: string; mode: Mode }) {
  const load = useCallback((signal: AbortSignal) => explain(scenario, eventId, mode, signal), [scenario, eventId, mode])
  const request = useIntelligenceRequest(`${scenario.id}:${eventId}:${mode}`, load)
  const [evidenceError, setEvidenceError] = useState('')
  const evidenceRequest = useRef<AbortController | null>(null)
  useEffect(() => () => evidenceRequest.current?.abort(), [scenario.id, eventId, mode])
  async function watch(id: string) {
    evidenceRequest.current?.abort()
    const controller = new AbortController()
    evidenceRequest.current = controller
    setEvidenceError('')
    try {
      const bundle = await loadEvidence(AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), scenario)
      if (controller.signal.aborted || replayStore.getState().scenario.id !== scenario.id) return
      const moment = bundle.moments.find(m => m.evidenceIds.includes(id))
      if (!moment) throw new Error('Supporting replay is unavailable.')
      useTactics.setState({ bundle, status: 'ready' })
      replayStore.getState().startGuided(bundle, id, moment.id)
      document.querySelector('[data-testid="replay-viewport"]')?.scrollIntoView({ behavior: 'instant', block: 'center' })
    } catch { if (!controller.signal.aborted) setEvidenceError('Supporting replay could not be loaded. Retry from tactical analysis.') }
  }
  return <>{request.pending && <AnalysisLoading refreshing={request.data !== null} />}{request.error && <AnalysisError error={request.error} retained={request.data !== null} retry={request.refresh} />}{request.data && <NarrativeView key={request.revision} data={request.data} narrative={request.data.narratives[0]} onEvidence={id => { void watch(id) }} />}{evidenceError && <p role="alert">{evidenceError}</p>}</>
}

function LoadedCommentary({ scenario, mode }: { scenario: Scenario; mode: Mode }) {
  const load = useCallback((signal: AbortSignal) => commentary(scenario, mode, signal), [scenario, mode])
  const { resource, retry } = useResource(`${scenario.id}:commentary:${mode}`, load)
  const time = useReplayTime()
  if (resource.status === 'loading') return <p role="status">Preparing commentary for the complete passage…</p>
  if (resource.status === 'error') return <AnalysisError error={resource.error} retained={false} retry={retry} />
  const data = resource.data, cue = cueAt(data.cues, time)
  const processed = data.events.filter(e => e.replay_time <= time)
  return <div className="ai-commentary" data-testid="ai-commentary" data-event={cue?.event_id ?? ''}>
    <p className="ai-provenance">{labels[data.provider]} · synchronized text</p>
    {cue ? <><h3>{cue.narrative.headline}</h3><p>{cue.narrative.explanation}</p></> : <p>Commentary begins with the recorded passage.</p>}
    <details className="ai-stream"><summary>Synthetic event stream · {processed.length}/{data.events.length}</summary><p>Recorded events feed the evidence and commentary. Seeking samples this ordered stream; it creates no new events or AI requests.</p><ol>{data.events.map(e => <li key={e.id} data-emitted={e.replay_time <= time}><time>{e.replay_time.toFixed(2)} s</time> {scenario.events.find(event => event.id === e.event_id)?.label}<span>{e.evidence_ids.length} linked observations</span></li>)}</ol></details>
  </div>
}

export function MomentIntelligence({ scenario }: { scenario: Scenario }) {
  const [mode, setMode] = useState<Mode>('casual')
  const [chosen, setChosen] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [timed, setTimed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const activeScenario = useReplay(s => s.scenario.id)
  if (activeScenario !== scenario.id) return null
  return <section className="ai-panel" aria-label="AI moment intelligence">
    <div className="ai-heading"><h2>Inside the play</h2><button aria-expanded={!collapsed} aria-label={collapsed ? 'Expand intelligence' : 'Collapse intelligence'} onClick={() => setCollapsed(c => !c)}>{collapsed ? '+' : '−'}</button></div>
    {!collapsed && <><AIAvailability /><ModeSwitch mode={mode} onChange={setMode} />
      <label className="ai-event-label">Moment to explain<select aria-label="Moment to explain" value={chosen} onChange={e => setChosen(e.target.value)}><option value="">Current replay moment</option>{scenario.events.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
      <button className="ai-primary" onClick={() => setTarget(chosen || scenario.events.findLast(e => e.t <= replayStore.getState().readTime())?.id || scenario.events[0].id)}>Explain this moment</button>
      {target && <div className="ai-moment-result"><p className="ai-context">{scenario.events.find(e => e.id === target)?.label}</p><LoadedMoment scenario={scenario} eventId={target} mode={mode} /></div>}
      <button className="ai-commentary-toggle" aria-pressed={timed} onClick={() => setTimed(t => !t)}>{timed ? 'Hide commentary' : 'Enable AI commentary'}</button>
      {timed && <LoadedCommentary scenario={scenario} mode={mode} />}
    </>}
  </section>
}
