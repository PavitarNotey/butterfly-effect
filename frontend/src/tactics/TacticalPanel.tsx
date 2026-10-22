import { useEffect } from 'react'
import { playerById } from '../replay/scenario'
import { replayStore } from '../replay/store'
import { frameAt, loadEvidence, momentAt } from './data'
import { useTactics } from './store'
import type { TacticalState } from './store'
import type { Evidence, Layer } from './types'

const layerNames: Record<Layer,string> = { passing: 'Passing lanes', movement: 'Defensive movement', space: 'Space & coverage', relationships: 'Player relationships' }
const factLayer: Record<Evidence['category'],Layer> = { movement:'movement', relationships:'relationships', corridor:'passing', space:'space', finish:'passing' }
export function TacticalPanel({ time }: { time: number }) {
  const state = useTactics()
  const { enabled, bundle, attempt } = state
  useEffect(() => {
    if (!enabled || bundle) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    useTactics.setState({ status:'loading', error:'' })
    void loadEvidence(controller.signal).then(bundle => {
      if (!controller.signal.aborted) useTactics.setState({ bundle, status:'ready' })
    }).catch(error => {
      if (!controller.signal.aborted) useTactics.setState({ status:'error', error: error instanceof Error ? error.message : 'Evidence unavailable.' })
    }).finally(() => window.clearTimeout(timeout))
    function timedOut() {
      if (controller.signal.aborted) useTactics.setState({ status:'error', error:'Evidence request timed out. Retry when the API is available.' })
    }
    controller.signal.addEventListener('abort', timedOut)
    return () => { controller.signal.removeEventListener('abort', timedOut); controller.abort(); window.clearTimeout(timeout) }
  }, [enabled,bundle,attempt])

  return <TacticalPanelView time={time} state={state} />
}

export function TacticalPanelView({ time, state }: { time: number; state: TacticalState }) {
  const { enabled, bundle, status, layers, error } = state
  const controls = state
  const moment = bundle ? momentAt(bundle,time) : null
  const frame = bundle ? frameAt(bundle,time).a : null
  const facts = bundle && moment ? moment.evidenceIds.map(id => bundle.evidence.find(e => e.id === id)!).filter(Boolean) : []
  const lead = facts.find(f => f.category === (moment?.id === 'receive' ? 'space' : moment?.id === 'finish' ? 'finish' : 'corridor'))
  return <section className="tactical-panel" aria-label="Tactical analysis">
    <div className="tactical-heading"><div><p className="eyebrow">SHOW THE MOVEMENT · MEASURE THE CHANGE</p><h2>Tactical intelligence</h2></div><button className="analysis-toggle" aria-pressed={enabled} onClick={() => controls.setEnabled(!enabled)}>{enabled ? 'Return to replay' : 'Analyze this moment'}</button></div>
    {!enabled && <p className="tactical-intro">Explore the run, the defensive reshaping, and the recorded passing opportunity.</p>}
    {enabled && <>
      {status === 'loading' && <p className="evidence-message" aria-live="polite">Loading measured evidence…</p>}
      {status === 'error' && <div className="evidence-message" role="alert"><p>{error} Replay remains available.</p><button onClick={controls.retry}>Retry evidence</button></div>}
      {bundle && moment && frame && <>
        <div className="tactical-layers">{(Object.keys(layerNames) as Layer[]).map(layer => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={() => controls.toggleLayer(layer)} />{layerNames[layer]}</label>)}</div>
        <div className="tactical-moments" aria-label="Tactical moments">{bundle.moments.map((m,i) => <button key={m.id} aria-pressed={m.id === moment.id} onClick={() => { replayStore.getState().pause(); replayStore.getState().seek(m.start) }}><span>0{i+1}</span>{m.title}<time>{m.start.toFixed(1)}s</time></button>)}</div>
        <div className="analysis-content">
          <div className="primary-finding"><p className="eyebrow">GEOMETRIC OBSERVATION <span>{moment.start.toFixed(1)}–{moment.end.toFixed(1)}s</span></p><h3 data-testid="tactical-moment-title">{moment.title}</h3>{lead && <p data-testid="primary-observation">{lead.observation}</p>}
            <div className="live-measures" data-testid="live-metrics"><span>Nearest to receiving point <b>{frame.space.nearestDistance.toFixed(2)} m</b></span><span>Within {frame.space.radius} m <b>{frame.space.defendersWithinRadius} {frame.space.defendersWithinRadius === 1 ? 'defender' : 'defenders'}</b></span><span>Measured at <b>{frame.t.toFixed(2)} s</b></span></div>
            {moment.id !== 'finish' && <div className={`corridor-state ${frame.corridor.state}`} data-testid="corridor-state">{frame.corridor.kind === 'observed_travel' ? 'Recorded pass · full travel interval' : 'Proposed corridor · static geometry'}<strong>{frame.corridor.state} under geometric thresholds</strong></div>}
            {layers.relationships && <div className="live-pairs">{frame.relationships.filter(r => moment.playerIds.includes(r.aId) && moment.playerIds.includes(r.bId)).slice(0,2).map(r => <span key={`${r.aId}:${r.bId}`}>{playerById[r.aId].name} ↔ {playerById[r.bId].name}<b>{r.distance.toFixed(2)} m</b></span>)}</div>}
            <p className="interpretation"><b>Authored interpretation</b>{moment.interpretation}</p>
            <p className="evidence-qualification">Temporal sequence ≠ proven causation. No counterfactual or awareness inference.</p>
          </div>
          <div className="evidence-list"><p className="eyebrow">SUPPORTING EVIDENCE</p><p className="involved-players">{moment.playerIds.map(id => playerById[id].name).join(' · ')}</p>{facts.map(f => <details key={f.id} className="evidence-item"><summary>{f.title}</summary><p>{f.observation}</p><dl>{f.metrics.map(m => <div key={m.name}><dt title={m.definition}>{m.name}</dt><dd>{Number.isInteger(m.value) ? m.value : m.value.toFixed(2)} {m.unit}</dd></div>)}</dl><button onClick={() => controls.reveal(factLayer[f.category])}>Reveal {layerNames[factLayer[f.category]].toLowerCase()}</button><small>{f.id}</small></details>)}<details className="evidence-item"><summary>Definitions & limitations</summary>{bundle.assumptions.map(a => <p key={a}>{a}</p>)}<p>Corridor half-width {bundle.thresholds.corridorHalfWidth} m; contested margin {bundle.thresholds.contestedMargin} m.</p><p>Arrows show displacement in the selected interval, clipped to replay time. The receiving-region radius is a measurement boundary.</p></details></div>
        </div>
      </>}
    </>}
  </section>
}
