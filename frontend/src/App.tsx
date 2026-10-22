import { useEffect, useState } from 'react'
import type { components } from './api/schema'
import './App.css'

type Connection = 'checking' | 'connected' | 'offline'
const apiUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

function App() {
  const [connection, setConnection] = useState<Connection>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    let active = true
    async function checkHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`, { signal: controller.signal })
        if (!response.ok) throw new Error('Health request failed')
        const data: components['schemas']['HealthResponse'] = await response.json()
        if (data.status !== 'ok' || data.project !== 'butterfly-effect') {
          throw new Error('Unexpected health response')
        }
        if (active) setConnection('connected')
      } catch {
        if (active) setConnection('offline')
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void checkHealth()
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  return (
    <div className="studio">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark" aria-hidden="true">⋈</span><span>BUTTERFLY<span className="brand-light"> EFFECT</span></span></a>
        <span className="studio-label">MATCH INSIGHT STUDIO <span>/</span> 001</span>
        <div className="connection"><span role="status" className={`api-status ${connection}`}><i />{connection === 'connected' ? 'API connected' : connection === 'offline' ? 'API offline' : 'Connecting to API'}</span><button className="retry" disabled={connection === 'checking'} onClick={() => { setConnection('checking'); setAttempt(attempt + 1) }} aria-label="Recheck API connection">↻</button></div>
      </header>

      <main>
        <section className="intro">
          <div><p className="eyebrow"><span /> A NEW PERSPECTIVE ON THE GAME</p><h1>Every moment.<br /><em>A different story.</em></h1></div>
          <div className="intro-note"><span className="small-label">BEYOND THE HIGHLIGHT</span><p>The run before the pass. The space before the goal. Explore the moments that change everything.</p><a href="#replay">Step inside the moment <span>↗</span></a></div>
        </section>

        <section className="workspace" id="replay" aria-label="Future replay studio">
          <div className="replay-panel">
            <div className="panel-top"><span><i className="square" /> BROADCAST REPLAY</span><span className="badge">STUDIO PREVIEW</span></div>
            <div className="replay-stage">
              <div className="pitch-art" aria-hidden="true"><div className="pitch-boundary"><div className="halfway" /><div className="center-circle" /><div className="penalty left" /><div className="penalty right" /><div className="goal-box left" /><div className="goal-box right" /></div></div>
              <div className="stage-caption"><span className="preview-icon" aria-hidden="true">▷</span><h2>The pitch is set.</h2><p>Your next perspective is coming.</p><span className="stage-tag">3D REPLAY PLACEHOLDER</span></div>
              <span className="stage-coordinate">BE / REPLAY ENGINE</span><span className="stage-format">SYNTHETIC FOOTBALL EXPERIENCE</span>
            </div>
            <div className="transport"><span className="transport-icon" aria-hidden="true">▷</span><span>00:00 <span className="muted">/ --:--</span></span><div className="track" /><span className="muted">Replay coming soon</span></div>
          </div>
          <aside className="story-panel">
            <p className="eyebrow">THE BUTTERFLY EFFECT</p><h2>Small movements.<br />Big consequences.</h2><p className="story-copy">A different angle can change how you see the whole game.</p>
            <div className="feature"><span>01</span><div><h3>Step onto the pitch</h3><p>A future 3D replay brings the moment into focus.</p></div></div>
            <div className="feature"><span>02</span><div><h3>Change your perspective</h3><p>Broadcast, tactical and player views. One shared moment.</p></div></div>
            <div className="feature"><span>03</span><div><h3>Follow the evidence</h3><p>Discover the story behind the movement.</p></div></div>
            <div className="development"><i /> IN DEVELOPMENT <span>FOUNDATION / V0.1</span></div>
          </aside>
        </section>
        <footer><span>BUILT TO SEE THE GAME DIFFERENTLY.</span><span>Synthetic scenarios. Real curiosity. <span className="footer-mark">⋈</span></span></footer>
      </main>
    </div>
  )
}

export default App
