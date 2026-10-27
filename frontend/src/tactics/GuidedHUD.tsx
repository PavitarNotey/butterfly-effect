import { useEffect, useRef } from 'react'
import { replayStore, useReplay } from '../replay/store'

export function GuidedHUD({ time, onBack }: { time: number; onBack: () => void }) {
  const guide = useReplay(s => s.guided)
  const scenario = useReplay(s => s.scenario)
  const heading = useRef<HTMLHeadingElement>(null)
  const evidenceId = guide?.evidenceId
  useEffect(() => { if (evidenceId) heading.current?.focus({ preventScroll: true }) }, [evidenceId])
  if (!guide) return null
  const progress = Math.min(1, Math.max(0, (time - guide.startTime) / (guide.endTime - guide.startTime)))
  return <section className="guided-hud" aria-label="Guided evidence replay" data-testid="guided-replay" data-evidence-id={guide.evidenceId} data-moment-id={guide.momentId} data-kind={guide.kind} data-status={guide.status} data-layer={guide.layer}>
    <div className="guided-heading"><span>{guide.status === 'complete' ? 'Sequence complete' : guide.status === 'paused' ? 'Sequence paused' : `Guided replay · ${guide.speed}×`}</span><button aria-label="Close guided replay" onClick={() => { replayStore.getState().closeGuided(); onBack() }}>×</button></div>
    <h3 ref={heading} tabIndex={-1}>{guide.title}</h3><p>{guide.caption}</p>
    <span className="guided-players">{guide.startTime.toFixed(1)}–{guide.endTime.toFixed(1)}s{guide.followBounds ? ' · Following the runner · Faint route: full recorded interval; bright route: progress' : ''}</span>
    <span className="guided-players">{guide.relevantPlayerIds.map(id => scenario.players.find(p => p.id === id)!.name).join(' · ')}</span>
    <progress aria-label="Guided replay progress" value={progress} max={1} />
    <div className="guided-actions"><button onClick={() => replayStore.getState().replayGuided()}>Replay again</button><button onClick={() => { replayStore.getState().closeGuided(); onBack() }}>Back to analysis</button>{guide.status !== 'complete' && <button aria-label={guide.status === 'playing' ? 'Pause guided replay' : 'Resume guided replay'} onClick={() => guide.status === 'playing' ? replayStore.getState().pause() : replayStore.getState().play()}>{guide.status === 'playing' ? 'Pause' : 'Resume'}</button>}</div>
    <span className="sr-only" role="status">{guide.status === 'complete' ? `${guide.title}. Sequence complete.` : ''}</span>
  </section>
}
