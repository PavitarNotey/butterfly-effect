import { useCallback, useId, useState } from 'react'
import { Link } from 'react-router'
import { momentPath } from '../league/format'
import type { MatchDetail } from '../league/types'
import { scenarios } from '../replay/scenario'
import { resolveReplay } from '../league/replayReference'
import { recap } from './client'
import type { Mode } from './client'
import { AIAvailability, ModeHint, ModeSwitch, NarrativeView } from './IntelligencePanel'
import { AnalysisError, AnalysisLoading, AnalysisMotif } from './AnalysisPresentation'
import { analysisState } from './presentation'
import { useIntelligenceRequest } from './useIntelligenceRequest'
import { useEvidenceReplay } from './useEvidenceReplay'

function RecapIntelligence({ match }: { match: MatchDetail }) {
  const [mode, setMode] = useState<Mode>('casual')
  const [enabled, setEnabled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const bodyId = useId()
  const event = match.events.find(e => e.replay)!
  const scenario = scenarios.find(s => s.id === event.replay!.scenarioId)!
  const load = useCallback((signal: AbortSignal, cacheOnly: boolean) => recap(scenario, match.id, event.id, mode, signal, cacheOnly), [scenario, match.id, event.id, mode])
  const request = useIntelligenceRequest(`${match.id}:recap:${mode}`, load, enabled)
  const evidence = useEvidenceReplay(scenario, request.data, resolveReplay(match, event.id, scenarios) !== null)
  const state = analysisState(request.data, request.pending, request.error)
  return <section className="ai-panel match-intelligence" aria-label="AI Match Recap" data-testid="match-intelligence" data-state={state} data-mode={mode}>
    <div className="ai-heading"><div><h2>AI Intelligence</h2></div><button className="ai-collapse" aria-label={collapsed ? 'Expand AI intelligence' : 'Collapse AI intelligence'} aria-expanded={!collapsed} aria-controls={bodyId} onClick={() => setCollapsed(c => !c)}>{collapsed ? '+' : '−'}</button></div>
    <div id={bodyId} hidden={collapsed}>
      <AIAvailability />
      {!enabled && <div className="ai-invitation"><AnalysisMotif /><h3>There’s more to this moment.</h3><p>Follow the movement. Find the opening. See the play with a different perspective.</p></div>}
      {!enabled && <p className="ai-mobile-invitation">See the detail behind the play.</p>}
      <ModeSwitch mode={mode} onChange={setMode} />
      <ModeHint mode={mode} />
      {!request.data && <button className="ai-primary" disabled={request.pending} onClick={() => { setEnabled(true); request.generate() }}>Analyze this moment</button>}
      {enabled && !request.pending && !request.data && !request.error && <p className="ai-empty">No saved analysis in this mode. Request it when you’re ready.</p>}
      {request.pending && <AnalysisLoading refreshing={request.data !== null} />}
      {request.error && <AnalysisError error={request.error} retained={request.data !== null} retry={request.retry} />}
      {request.data && <NarrativeView key={request.revision} data={request.data} narrative={request.data.narratives[0]} onEvidence={id => { void evidence.watch(id) }} evidencePending={evidence.pending} />}
      {evidence.error && <p className="ai-error" role="alert">{evidence.error}</p>}
      {request.data && <button className="ai-refresh" disabled={request.pending} onClick={request.checkSaved}>Check saved analysis</button>}
      <div className="ai-panel-footer"><Link className="ai-replay-link" to={momentPath(match, event)}>Open Replay Studio <span aria-hidden="true">↗</span></Link>{!request.data && <span className="ai-synthetic">Synthetic match</span>}</div>
      <span className="sr-only" role="status">{request.data && !request.pending && !request.error ? 'Football analysis ready.' : ''}</span>
    </div>
  </section>
}

export function MatchRecap({ match }: { match: MatchDetail }) {
  if (match.status !== 'finished' || !match.events.some(e => e.replay)) return null
  return <RecapIntelligence key={match.id} match={match} />
}
