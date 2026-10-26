import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react'
import { ApiConnection } from './ApiConnection'
import { scenarios, outcome } from './replay/scenario'
import { replayStore, useReplay } from './replay/store'
import type { PlaybackSpeed } from './replay/store'
import { Timeline } from './replay/Timeline'
import { useReplayTime } from './replay/useReplayTime'
import { TacticalPanel } from './tactics/TacticalPanel'
import { TacticalHUD } from './tactics/TacticalHUD'
import { GuidedHUD } from './tactics/GuidedHUD'
import { PovControls } from './replay/PovControls'
import { PlayerPicker } from './replay/PlayerPicker'
import { MomentIntelligence } from './ai/IntelligencePanel'
import './App.css'

const ReplayScene = memo(lazy(() => import('./replay/ReplayScene').then(m => ({ default: m.ReplayScene }))))
function clock(t: number) { return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}` }
function SelectionHint() {
  const [visible, setVisible] = useState(true)
  useEffect(() => { const timeout = window.setTimeout(() => setVisible(false), 6500); return () => window.clearTimeout(timeout) }, [])
  return visible ? <p className="selection-hint">Click any player to inspect or view their POV</p> : null
}

function ReplayStudio({ embedded = false, withinShell = false }: { embedded?: boolean; withinShell?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const analysisContainer = useRef<HTMLDivElement>(null)
  const reducedMotion = useReplay(s => s.reducedMotion)
  const guided = useReplay(s => s.guided !== null)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => replayStore.getState().setReducedMotion(preference.matches)
    sync(); preference.addEventListener('change', sync)
    return () => preference.removeEventListener('change', sync)
  }, [])
  function showReplay() { viewport.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' }) }
  function backToAnalysis() {
    analysisContainer.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
    analysisContainer.current?.querySelector<HTMLElement>('#analysis')?.focus({ preventScroll: true })
  }
  const scenario = useReplay(s => s.scenario)
  const playerById = Object.fromEntries(scenario.players.map(p => [p.id, p]))
  const time = useReplayTime()
  const playing = useReplay(s => s.playing)
  const speed = useReplay(s => s.speed)
  const camera = useReplay(s => s.camera)
  const manualFraming = useReplay(s => s.tacticalView !== null)
  const selectedId = useReplay(s => s.selectedId)
  const trails = useReplay(s => s.trails)
  const selected = selectedId ? playerById[selectedId] : null
  const team = selected ? scenario.teams.find(t => t.id === selected.teamId)! : null
  const event = scenario.events.filter(e => e.t <= time).at(-1)!
  const goals = scenario.teams.map(team => scenario.events.filter(e => e.type === 'goal' && e.t <= time && playerById[e.playerIds[0]]?.teamId === team.id).length)
  const attackingTeam = scenario.teams.find(t => t.id === playerById[scenario.events.find(e => e.type === 'shot')!.playerIds[0]].teamId)!
  const actions = replayStore.getState()
  function seek(t: number) { actions.pause(); actions.seek(t) }
  const cameraPlayerId = camera.includes(':') ? camera.slice(camera.indexOf(':') + 1) : null
  const cameraPlayer = cameraPlayerId ? playerById[cameraPlayerId] : null
  const cameraTitle = camera === 'broadcast' ? 'BROADCAST' : camera === 'tactical' ? 'TACTICAL · ACTIVE PLAY' : camera === 'overview' ? 'TACTICAL · FULL PITCH' : camera.startsWith('pov:') ? `PLAYER POV · ${cameraPlayer?.name.toUpperCase()}` : `FOLLOWING · ${cameraPlayer?.name.toUpperCase()}`

  return <div className="studio">
    <a href="#replay" className="skip-link">Skip to replay</a>
    {!embedded && (withinShell ? <div className="library-toolbar"><p className="eyebrow">SCENARIO LIBRARY</p><ApiConnection /></div> : <header className="topbar">
      <a className="brand" href="/"><span className="brand-mark" aria-hidden="true">⋈</span><span>BUTTERFLY<span className="brand-light"> EFFECT</span></span></a>
      <span className="studio-label">MATCH INSIGHT STUDIO <span>/</span> SCENARIO LIBRARY</span>
      <ApiConnection />
    </header>)}
    <main id={withinShell ? 'page-main' : undefined} tabIndex={withinShell ? -1 : undefined}>
      <section className="scenario-heading">
        <div><p className="eyebrow">EVERY MOMENT HAS A STORY</p><h1>{scenario.title}<span className="title-dot">.</span></h1><p className="scenario-subtitle">{scenario.description}</p></div>
        <div className="scenario-meta">{!embedded && <label className="scenario-select">Scenario<select aria-label="Scenario" value={scenario.id} onChange={e => actions.setScenario(e.target.value)}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.title} — {outcome(s) === 'goal' ? 'Goal' : 'Missed opportunity'}</option>)}</select></label>}<span className="badge">ORIGINAL SYNTHETIC SCENARIO</span><span>{scenario.duration} SECONDS <b>/</b> {scenario.players.length} PERSPECTIVES</span></div>
      </section>
      <div className="replay-workspace" id="replay">
        <section className="replay-panel" aria-label="Replay studio">
          <div className="panel-top"><span><i className="square" /> {cameraTitle}</span><span className="badge">{playing ? 'REPLAY IN MOTION' : 'REPLAY PAUSED'}</span></div>
          <div ref={viewport} className={`viewport${guided ? ' is-guided' : ''}`} data-testid="replay-viewport" data-camera={camera}>
            <Suspense fallback={<div className="scene-message">Loading replay studio…</div>}><ReplayScene /></Suspense>
            {embedded && <span className="passage-score-caption">GOALS IN THIS PASSAGE</span>}
            <div className="scorebug" aria-label={embedded ? 'Goals in this reconstructed passage' : undefined}><span className="score-team" style={{color:scenario.teams[0].color}}>{scenario.teams[0].shortName}</span><strong data-testid="score">{goals[0]} <span>–</span> {goals[1]}</strong><span className="score-team" style={{color:scenario.teams[1].color}}>{scenario.teams[1].shortName}</span><time data-testid="match-clock">{clock(scenario.matchStartSeconds + time)}</time></div>
            <span className="viewport-corner">BE <span>REPLAY</span></span>
            <TacticalHUD time={time} />
            <GuidedHUD time={time} onBack={backToAnalysis} />
            <PovControls key={`${scenario.id}:${camera}`} />
            {!selectedId && !guided && !camera.startsWith('pov:') ? <SelectionHint key={scenario.id} /> : null}
            {!guided && time < (scenario.events.find(e => e.type === 'run')?.t ?? 3) && !camera.startsWith('pov:') && <div className="buildup-card"><strong>The buildup</strong><span>{scenario.events[0].detail}</span><button onClick={() => seek(scenario.events.find(e => e.type === 'run')?.t ?? 3)}>Jump to key moment</button></div>}
            <div className="viewport-bottom"><span>{camera.startsWith('pov:') ? 'SIMULATED GAZE · ATTENTION IS INFERRED, NOT OBSERVED' : `${attackingTeam.name.toUpperCase()} ${attackingTeam.attackDirection === 1 ? '→ ATTACKING THE RIGHT GOAL' : '← ATTACKING THE LEFT GOAL'}`}</span><span>{scenario.pitch.length} × {scenario.pitch.width} M</span></div>
          </div>
          <div className="playback">
            <div className="playback-row"><div className="playback-buttons">
              <button className="play-button" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => playing ? actions.pause() : actions.play()}>{playing ? 'Ⅱ' : '▶'}</button>
              <button className="icon-button" aria-label="Restart replay" onClick={actions.restart}>↺</button>
              <span role="timer" aria-label="Replay time" aria-live="off" data-testid="replay-time" className="replay-time">{time.toFixed(1)}<span> / {scenario.duration.toFixed(1)} s</span></span>
            </div><div className="playback-settings"><label>Speed <select aria-label="Playback speed" value={speed} onChange={e => actions.setSpeed(Number(e.target.value) as PlaybackSpeed)}>{[.5,1,2].map(s => <option key={s} value={s}>{s}×</option>)}</select></label><label className="trails-toggle"><input type="checkbox" checked={trails} disabled={!selectedId} onChange={actions.toggleTrails} /> Movement trail</label></div></div>
            <Timeline time={time} onMoment={seek} />
          </div>
          <div className="camera-bar"><span className="small-label">CAMERA</span><button aria-pressed={camera === 'broadcast'} onClick={() => actions.setCamera('broadcast')}>Broadcast</button><button aria-pressed={camera === 'tactical'} onClick={() => actions.setCamera('tactical')}>Tactical</button><button aria-pressed={camera === 'overview'} onClick={() => actions.setCamera('overview')}>Full pitch</button><PlayerPicker key={scenario.id} scenario={scenario} selectedId={selectedId} onSelect={actions.selectPlayer} /></div>
          <label className="motion-option"><input type="checkbox" checked={reducedMotion} onChange={e => actions.setReducedMotion(e.target.checked)} /> Reduce camera motion</label>
          {(camera === 'tactical' || camera === 'overview') && <div className="camera-help"><span>Wheel to zoom · drag to pan</span>{manualFraming && <button onClick={() => actions.resetTacticalView()}>{camera === 'tactical' ? 'Follow play' : 'Reset view'}</button>}</div>}
          <MomentIntelligence key={scenario.id} scenario={scenario} />
        </section>
        <aside className="inspection-panel">
          <section className={`selected-player${selected ? ' has-selection' : ''}`} aria-label="Player inspection">
            {selected && team ? <>
              <div className="player-card-heading"><p className="eyebrow">PLAYER INSPECTION</p><button type="button" className="player-card-close" aria-label={`Dismiss ${selected.name}`} onClick={() => actions.selectPlayer(null)}>×</button></div>
              <div className="player-identity"><div className="shirt-number" style={{ color: team.color }}>{selected.number}</div><div><h2 data-testid="selected-name">{selected.name}</h2><p style={{ color: team.color }}>{team.name}</p></div></div>
              <p className="player-role">{selected.role}</p>
              <div className="player-card-actions"><button className="pov-button" aria-label={`View ${selected.name}'s POV`} onClick={() => actions.setCamera(`pov:${selected.id}`)}>View POV <span aria-hidden="true">↗</span></button><button className="follow-button" onClick={() => actions.setCamera(`follow:${selected.id}`)}>Follow Player</button></div>
              <p className="pov-note">POV uses simulated gaze from recorded movement and ball position. Attention is inferred for presentation, not observed.</p>
            </> : <div className="player-empty"><span aria-hidden="true">◎</span><p className="eyebrow">PLAYER INSPECTION</p><h2>Select Any Player</h2><p>Pick a player on the pitch or open the roster to inspect their role and camera views.</p></div>}
          </section>
          <section className="moment-panel"><p className="eyebrow">INSIDE THE MOMENT</p><h2>{event.label}</h2><p className="event-detail">{event.detail}</p><div className="moments">{scenario.events.filter(e => e.keyMoment).map((e,i) => <button key={e.id} className={event.id === e.id ? 'active' : ''} onClick={() => seek(e.t)}><span className="moment-index">0{i+1}</span><span>{e.label}</span><time>{e.t.toFixed(1)}s</time></button>)}</div></section>
          <div className="scenario-note"><span /> HANDCRAFTED REPLAY <span className="muted">V1 / SEED {scenario.seed}</span></div>
        </aside>
      </div>
      <div ref={analysisContainer}><TacticalPanel time={time} onWatch={showReplay} /></div>
      <footer><span>SYNTHETIC TEAMS. ONE SHARED TIMELINE.</span><span>Click a player. Change your perspective. <span className="footer-mark">⋈</span></span></footer>
    </main>
  </div>
}
export default ReplayStudio
