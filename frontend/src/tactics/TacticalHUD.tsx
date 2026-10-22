import { replayStore } from '../replay/store'
import { frameAt, momentAt } from './data'
import { useTactics } from './store'
import type { Layer } from './types'

/** Compact controls stay beside the picture; detailed evidence remains below the replay. */
export function TacticalHUD({ time }: { time: number }) {
  const state = useTactics()
  if (!state.enabled || !state.bundle) return null
  const moment = momentAt(state.bundle,time), frame = frameAt(state.bundle,time).a
  const labels: [Layer,string][] = [['passing','Lane'],['movement','Runs'],['space','Space'],['relationships','Links']]
  return <div className="tactical-hud" aria-label="Replay tactical controls">
    <div className="hud-title"><span>TACTICAL VIEW</span><button aria-label="Exit tactical view" onClick={() => state.setEnabled(false)}>×</button></div>
    <select aria-label="Analytical moment" value={moment.id} onChange={e => {
      const selected = state.bundle!.moments.find(m => m.id === e.target.value)!
      replayStore.getState().pause(); replayStore.getState().seek(selected.start)
    }}>{state.bundle.moments.map(m => <option key={m.id} value={m.id}>{m.title} · {m.start.toFixed(1)}s</option>)}</select>
    <div className="hud-layers">{labels.map(([layer,label]) => <button key={layer} aria-label={`Toggle ${layer} overlay`} aria-pressed={state.layers[layer]} onClick={() => state.toggleLayer(layer)}>{label}</button>)}</div>
    <p>{moment.focus === 'finish' ? 'Recorded shot path' : `${frame.corridor.state} · ${frame.corridor.kind === 'observed_travel' ? 'recorded pass' : 'static corridor'}`}<span>Measured {frame.t.toFixed(2)}s</span></p>
  </div>
}
