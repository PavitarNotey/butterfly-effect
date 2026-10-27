import { useCallback, useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { useResource } from '../league/useResource'
import { replayStore, useReplay } from '../replay/store'
import { useTactics } from '../tactics/store'
import { momentAt } from '../tactics/data'
import { useReplayTime } from '../replay/useReplayTime'
import type { Scenario } from '../replay/types'
import { commentary, cueAt, explain, getStatus } from './client'
import type { Intelligence, Mode, Narrative } from './client'
import { AnalysisError, AnalysisLoading } from './AnalysisPresentation'
import { narrativeSentences } from './presentation'
import { useIntelligenceRequest } from './useIntelligenceRequest'
import { useEvidenceReplay } from './useEvidenceReplay'
import './Intelligence.css'

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return <div className="ai-mode" role="group" aria-label="Explanation mode">{(['casual', 'analyst'] as const).map(m => <button type="button" key={m} aria-pressed={mode === m} onClick={() => onChange(m)}>{m === 'casual' ? 'Casual Fan' : 'Analyst'}</button>)}</div>
}

const labels = { foundry: 'AI-generated', mock: 'Authored demo', validation_fallback: 'Authored fallback' }
export function NarrativeView({ data, narrative, onEvidence, evidencePending = false }: { data: Intelligence; narrative: Narrative; onEvidence?: (id?: string) => void; evidencePending?: boolean }) {
  return <article className={`ai-narrative ai-ready-reveal${data.cached ? ' is-cached' : ''}`} data-provider={data.provider}>
    <p className={`ai-provenance ${data.provider !== 'foundry' ? 'is-demo' : ''}`}><span>{labels[data.provider]}</span> · Synthetic replay{data.cached ? <span className="ai-cached"> · Cached</span> : null}</p>
    <h3 className="ai-headline">{narrative.headline}</h3><p className="ai-explanation">{narrativeSentences(narrative.explanation).map((sentence, i) => <span className="ai-sentence" key={i} style={{ '--sentence-index': Math.min(i, 5) } as CSSProperties}>{sentence}</span>)}</p><div className="ai-takeaway"><span>Worth watching</span><p className="ai-impact">{narrative.why_it_matters}</p></div>
    {onEvidence && narrative.key_evidence.some(s => s.kind === 'measurement' && s.evidence_id) && <button className="ai-show-why" data-testid="show-me-why" disabled={evidencePending} onClick={() => onEvidence()}>{evidencePending ? 'Loading supporting replay…' : 'Show me why'} <span aria-hidden="true">↗</span></button>}
    {evidencePending && <span className="sr-only" role="status">Loading the verified supporting replay.</span>}
    {narrative.key_evidence.some(source => source.kind !== 'match_metadata') && <details className="ai-evidence"><summary>Explore the evidence</summary>{narrative.key_evidence.filter(source => source.kind !== 'match_metadata').map(source => <div key={source.id} className="ai-source"><span>{({ measurement: 'Measured replay detail', recorded_event: 'Recorded play', authored_interpretation: 'Tactical reading' } as Record<string, string>)[source.kind]}</span><p>{source.statement}</p>{source.evidence_id && onEvidence && <button disabled={evidencePending} onClick={() => onEvidence(source.evidence_id!)}>Watch this detail</button>}</div>)}<p className="ai-evidence-note">Replay details describe the recorded play. Player intent and alternative outcomes remain unknown.</p></details>}
  </article>
}

export function AIAvailability() {
  const { resource } = useResource('ai-status', getStatus)
  const label = resource.status === 'loading' ? 'Checking analysis availability…'
    : resource.status === 'error' ? 'Analysis service unreachable · Replay available'
    : resource.data.provider === 'mock' ? 'Authored demo · Synthetic replay'
    : resource.data.available && resource.data.provider === 'foundry' ? 'Microsoft Foundry · On request'
    : resource.data.provider === 'foundry' ? 'New AI generation paused · Replay available'
    : 'AI unavailable · Replay and measured evidence available'
  return <p className="ai-availability">{label}</p>
}

function CommentaryView({ scenario, data }: { scenario: Scenario; data: Intelligence }) {
  const time = useReplayTime()
  const cue = cueAt(data.cues, time)
  const processed = data.events.filter(e => e.replay_time <= time)
  return <div className="ai-commentary" data-testid="ai-commentary" data-event={cue?.event_id ?? ''}>
    <p className="ai-provenance">{labels[data.provider]} · synchronized text</p>
    {cue ? <><h3>{cue.narrative.headline}</h3><p>{cue.narrative.explanation}</p></> : <p>Commentary begins with the recorded passage.</p>}
    <details className="ai-stream"><summary>Synthetic event stream · {processed.length}/{data.events.length}</summary><p>Recorded events feed the evidence and commentary. Seeking samples this ordered stream; it creates no new events or AI requests.</p><ol>{data.events.map(e => <li key={e.id} data-emitted={e.replay_time <= time}><time>{e.replay_time.toFixed(2)} s</time> {scenario.events.find(event => event.id === e.event_id)?.label}<span>{e.evidence_ids.length} linked observations</span></li>)}</ol></details>
  </div>
}

export function ModeHint({ mode }: { mode: Mode }) {
  return <p className="ai-mode-hint">{mode === 'casual' ? 'The play in plain language.' : 'A closer look at measured spacing and movement.'} Switching modes checks saved analysis.</p>
}

export function MomentIntelligence({ scenario }: { scenario: Scenario }) {
  const [mode, setMode] = useState<Mode>('casual')
  const [chosen, setChosen] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [timed, setTimed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const bodyId = useId()
  const load = useCallback((signal: AbortSignal, cacheOnly: boolean) => target ? explain(scenario, target, mode, signal, cacheOnly) : Promise.resolve(null), [scenario, target, mode])
  const key = `${scenario.id}:${target}:${mode}`
  const request = useIntelligenceRequest(key, load, target !== null)
  const loadTimed = useCallback((signal: AbortSignal, cacheOnly: boolean) => commentary(scenario, mode, signal, cacheOnly), [scenario, mode])
  const timedRequest = useIntelligenceRequest(`${scenario.id}:commentary:${mode}`, loadTimed, timed)
  const evidence = useEvidenceReplay(scenario, request.data)
  const activeScenario = useReplay(s => s.scenario.id)
  const tactics = useTactics()
  const bundle = tactics.bundle?.scenarioId === scenario.id ? tactics.bundle : null
  if (activeScenario !== scenario.id) return null
  function generateMoment() {
    if (!bundle) return
    const current = replayStore.getState()
    const moment = bundle.moments.find(m => m.id === (chosen || current.guided?.momentId)) ?? momentAt(bundle, current.readTime())
    const event = moment.focusEventId
    setTarget(event)
    request.generateFor(`${scenario.id}:${event}:${mode}`, (signal, cacheOnly) => explain(scenario, event, mode, signal, cacheOnly))
  }
  return <section className="ai-panel" aria-label="AI moment intelligence">
    <div className="ai-heading"><h2>Inside the play</h2><button aria-controls={bodyId} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand intelligence' : 'Collapse intelligence'} onClick={() => setCollapsed(c => !c)}>{collapsed ? '+' : '−'}</button></div>
    <div id={bodyId} hidden={collapsed}><AIAvailability /><ModeSwitch mode={mode} onChange={setMode} /><ModeHint mode={mode} />
      <label className="ai-event-label">Moment to explain<select aria-label="Moment to explain" value={chosen} disabled={!bundle} onChange={e => setChosen(e.target.value)}><option value="">Current replay moment</option>{bundle?.moments.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
      {!bundle && <p className="ai-empty">{tactics.status === 'error' ? <>Tactical sequences are unavailable. <button onClick={tactics.retry}>Retry sequences</button></> : 'Loading recorded sequences…'}</p>}
      <button className="ai-primary" disabled={request.pending || !bundle} onClick={generateMoment}>Explain this moment</button>
      {target && <div className="ai-moment-result"><p className="ai-context">{bundle?.moments.find(m => m.focusEventId === target)?.title ?? scenario.events.find(e => e.id === target)?.label}</p>
        {request.pending && <AnalysisLoading refreshing={request.data !== null} />}
        {request.error && <AnalysisError error={request.error} retained={request.data !== null} retry={request.retry} />}
        {!request.pending && !request.data && !request.error && <p className="ai-empty">No saved analysis in this mode. Choose Explain this moment to request it.</p>}
        {request.data && <><NarrativeView key={request.revision} data={request.data} narrative={request.data.narratives[0]} onEvidence={id => { void evidence.watch(id) }} evidencePending={evidence.pending} /><button className="ai-refresh" disabled={request.pending} onClick={request.checkSaved}>Check saved analysis</button></>}
        {evidence.error && <p className="ai-error" role="alert">{evidence.error}</p>}
      </div>}
      <button className="ai-commentary-toggle" aria-pressed={timed} onClick={() => { if (!timed && !timedRequest.data) timedRequest.generate(); setTimed(t => !t) }}>{timed ? 'Hide commentary' : 'Enable AI commentary'}</button>
      {timed && <>
        {timedRequest.pending && <AnalysisLoading refreshing={timedRequest.data !== null} />}
        {timedRequest.error && <AnalysisError error={timedRequest.error} retained={timedRequest.data !== null} retry={timedRequest.retry} />}
        {timedRequest.data && !collapsed && <CommentaryView scenario={scenario} data={timedRequest.data} />}
        {!timedRequest.pending && !timedRequest.data && !timedRequest.error && <div className="ai-empty"><p>No saved commentary in this mode.</p><button onClick={timedRequest.generate}>Request commentary</button></div>}
      </>}
    </div>
  </section>
}
