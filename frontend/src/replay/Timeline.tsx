import { useRef } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { scenario } from './scenario'
import { replayStore } from './store'

export function Timeline({ time, onMoment }: { time: number; onMoment: (time: number) => void }) {
  const activePointer = useRef<number | null>(null)
  const actions = replayStore.getState()

  function begin(event: PointerEvent<HTMLInputElement>) {
    if (!event.isPrimary || event.button !== 0 || activePointer.current !== null) return
    activePointer.current = event.pointerId
    actions.beginScrub()
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function finish(event?: PointerEvent<HTMLInputElement>) {
    if (event && activePointer.current !== event.pointerId) return
    activePointer.current = null
    actions.endScrub()
  }

  return <>
    <div className="timeline">
      <input
        aria-label="Replay timeline" aria-valuetext={`${time.toFixed(1)} of ${scenario.duration} seconds`}
        type="range" min="0" max={scenario.duration} step="0.01" value={time}
        style={{ '--progress': `${time / scenario.duration * 100}%` } as CSSProperties}
        onChange={event => actions.seek(event.currentTarget.valueAsNumber)}
        onPointerDown={begin} onPointerUp={finish} onPointerCancel={finish}
        onLostPointerCapture={finish} onBlur={() => finish()}
      />
      <div className="timeline-markers">{scenario.events.filter(e => e.keyMoment).map(e =>
        <button key={e.id} aria-label={`Seek to ${e.label}`} title={`${e.label} · ${e.t}s`}
          style={{ left: `${e.t / scenario.duration * 100}%` }} onClick={() => onMoment(e.t)}
          className={e.t <= time ? 'reached' : ''}><span /></button>
      )}</div>
    </div>
    <div className="timeline-scale"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span><span>00:20</span></div>
  </>
}
