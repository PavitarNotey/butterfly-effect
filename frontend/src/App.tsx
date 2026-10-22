import { lazy, memo, Suspense } from 'react'
import { ApiConnection } from './ApiConnection'
import { scenarios, outcome } from './replay/scenario'
import { replayStore, useReplay } from './replay/store'
import type { CameraMode, PlaybackSpeed } from './replay/store'
import { Timeline } from './replay/Timeline'
import { useReplayTime } from './replay/useReplayTime'
import { TacticalPanel } from './tactics/TacticalPanel'
import { TacticalHUD } from './tactics/TacticalHUD'
import './App.css'

const ReplayScene = memo(lazy(() => import('./replay/ReplayScene').then(m => ({ default: m.ReplayScene }))))
function clock(t: number) { return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}` }

function App() {
  const scenario = useReplay(s => s.scenario)
  const playerById = Object.fromEntries(scenario.players.map(p => [p.id, p]))
  const time = useReplayTime()
  const playing = useReplay(s => s.playing)
  const speed = useReplay(s => s.speed)
  const camera = useReplay(s => s.camera)
  const manualFraming = useReplay(s => s.tacticalView !== null)
  const selectedId = useReplay(s => s.selectedId)
  const trails = useReplay(s => s.trails)
  const selected = playerById[selectedId]
  const team = scenario.teams.find(t => t.id === selected.teamId)!
  const event = scenario.events.filter(e => e.t <= time).at(-1)!
  const goals = scenario.teams.map(team => scenario.events.filter(e => e.type === 'goal' && e.t <= time && playerById[e.playerIds[0]]?.teamId === team.id).length)
  const attackingTeam = scenario.teams.find(t => t.id === playerById[scenario.events.find(e => e.type === 'shot')!.playerIds[0]].teamId)!
  const actions = replayStore.getState()
  function seek(t: number) { actions.pause(); actions.seek(t) }

  return <div className="studio">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark" aria-hidden="true">⋈</span><span>BUTTERFLY<span className="brand-light"> EFFECT</span></span></a>
      <span className="studio-label">MATCH INSIGHT STUDIO <span>/</span> SCENARIO LIBRARY</span>
      <ApiConnection />
    </header>
    <main>
      <section className="scenario-heading">
        <div><p className="eyebrow">EVERY MOMENT HAS A STORY</p><h1>{scenario.title}<span className="title-dot">.</span></h1><p className="scenario-subtitle">{scenario.description}</p></div>
        <div className="scenario-meta"><label className="scenario-select">Scenario<select aria-label="Scenario" value={scenario.id} onChange={e => actions.setScenario(e.target.value)}>{scenarios.map(s => <option key={s.id} value={s.id}>{s.title} — {outcome(s) === 'goal' ? 'Goal' : 'Missed opportunity'}</option>)}</select></label><span className="badge">ORIGINAL SYNTHETIC SCENARIO</span><span>{scenario.duration} SECONDS <b>/</b> {scenario.players.length} PERSPECTIVES</span></div>
      </section>
      <div className="replay-workspace" id="replay">
        <section className="replay-panel" aria-label="Replay studio">
          <div className="panel-top"><span><i className="square" /> {camera === 'broadcast' ? 'BROADCAST' : camera === 'tactical' ? 'TACTICAL · ACTIVE PLAY' : camera === 'overview' ? 'TACTICAL · FULL PITCH' : `PLAYER POV · ${playerById[camera.slice(4)]?.name.toUpperCase()}`}</span><span className="badge">{playing ? 'REPLAY IN MOTION' : 'REPLAY PAUSED'}</span></div>
          <div className="viewport" data-testid="replay-viewport" data-camera={camera}>
            <Suspense fallback={<div className="scene-message">Loading replay studio…</div>}><ReplayScene /></Suspense>
            <div className="scorebug"><span className="score-team" style={{color:scenario.teams[0].color}}>{scenario.teams[0].shortName}</span><strong data-testid="score">{goals[0]} <span>–</span> {goals[1]}</strong><span className="score-team" style={{color:scenario.teams[1].color}}>{scenario.teams[1].shortName}</span><time data-testid="match-clock">{clock(scenario.matchStartSeconds + time)}</time></div>
            <span className="viewport-corner">BE <span>REPLAY</span></span>
            <TacticalHUD time={time} />
            <div className="viewport-bottom"><span>{camera.startsWith('pov:') ? 'RECORDED HEADING · SIMULATED PLAYER VIEW' : `${attackingTeam.name.toUpperCase()} ${attackingTeam.attackDirection === 1 ? '→ ATTACKING THE RIGHT GOAL' : '← ATTACKING THE LEFT GOAL'}`}</span><span>{scenario.pitch.length} × {scenario.pitch.width} M</span></div>
          </div>
          <div className="playback">
            <div className="playback-row"><div className="playback-buttons">
              <button className="play-button" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => playing ? actions.pause() : actions.play()}>{playing ? 'Ⅱ' : '▶'}</button>
              <button className="icon-button" aria-label="Restart replay" onClick={actions.restart}>↺</button>
              <span role="timer" aria-label="Replay time" aria-live="off" data-testid="replay-time" className="replay-time">{time.toFixed(1)}<span> / {scenario.duration.toFixed(1)} s</span></span>
            </div><div className="playback-settings"><label>Speed <select aria-label="Playback speed" value={speed} onChange={e => actions.setSpeed(Number(e.target.value) as PlaybackSpeed)}>{[.5,1,2].map(s => <option key={s} value={s}>{s}×</option>)}</select></label><label className="trails-toggle"><input type="checkbox" checked={trails} onChange={actions.toggleTrails} /> Movement trail</label></div></div>
            <Timeline time={time} onMoment={seek} />
          </div>
          <div className="camera-bar"><span className="small-label">CAMERA</span><button aria-pressed={camera === 'broadcast'} onClick={() => actions.setCamera('broadcast')}>Broadcast</button><button aria-pressed={camera === 'tactical'} onClick={() => actions.setCamera('tactical')}>Tactical</button><button aria-pressed={camera === 'overview'} onClick={() => actions.setCamera('overview')}>Full pitch</button><select aria-label="Player perspective" value={camera.startsWith('pov:') ? camera : ''} onChange={e => actions.setCamera(e.target.value as CameraMode)}><option value="" disabled>Player POV ↗</option>{scenario.relevantPlayerIds.map(id => <option key={id} value={`pov:${id}`}>{playerById[id].name} · {playerById[id].teamId === attackingTeam.id ? 'Attacker' : 'Defender'}</option>)}<optgroup label="Full roster">{scenario.players.filter(p => !scenario.relevantPlayerIds.includes(p.id)).map(p => <option key={p.id} value={`pov:${p.id}`}>{p.name} · {p.role}</option>)}</optgroup></select></div>
          {(camera === 'tactical' || camera === 'overview') && <div className="camera-help"><span>Wheel to zoom · drag to pan</span>{manualFraming && <button onClick={() => actions.resetTacticalView()}>{camera === 'tactical' ? 'Follow play' : 'Reset view'}</button>}</div>}
        </section>
        <aside className="inspection-panel">
          <section className="selected-player"><p className="eyebrow">PLAYER INSPECTION</p><div className="player-identity"><div className="shirt-number" style={{ color: team.color }}>{selected.number}</div><div><h2 data-testid="selected-name">{selected.name}</h2><p style={{ color: team.color }}>{team.name}</p></div></div><p className="player-role">{selected.role}</p><label className="roster-label">Select on the pitch or choose a player<select aria-label="Selected player" value={selectedId} onChange={e => actions.selectPlayer(e.target.value)}>{scenario.teams.map(team => <optgroup key={team.id} label={team.name}>{scenario.players.filter(p => p.teamId === team.id).map(p => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}</optgroup>)}</select></label><button className="pov-button" onClick={() => actions.setCamera(`pov:${selectedId}`)}>View from {selected.name.split(' ')[0]}'s eyes <span>↗</span></button><p className="pov-note">POV follows authored facing direction. It does not establish awareness or intent.</p></section>
          <section className="moment-panel"><p className="eyebrow">INSIDE THE MOMENT</p><h2>{event.label}</h2><p className="event-detail">{event.detail}</p><div className="moments">{scenario.events.filter(e => e.keyMoment).map((e,i) => <button key={e.id} className={event.id === e.id ? 'active' : ''} onClick={() => seek(e.t)}><span className="moment-index">0{i+1}</span><span>{e.label}</span><time>{e.t.toFixed(1)}s</time></button>)}</div></section>
          <div className="scenario-note"><span /> HANDCRAFTED REPLAY <span className="muted">V1 / SEED {scenario.seed}</span></div>
        </aside>
      </div>
      <TacticalPanel time={time} />
      <footer><span>SYNTHETIC TEAMS. ONE SHARED TIMELINE.</span><span>Click a player. Change your perspective. <span className="footer-mark">⋈</span></span></footer>
    </main>
  </div>
}
export default App
