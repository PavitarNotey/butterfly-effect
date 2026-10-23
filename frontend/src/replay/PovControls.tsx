import { useEffect, useRef } from 'react'
import { replayStore, useReplay } from './store'
import type { FreeLook } from './gaze'

export function PovControls() {
  const camera = useReplay(s => s.camera), playing = useReplay(s => s.playing)
  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; look: FreeLook } | null>(null)
  useEffect(() => {
    const element = surface.current
    return () => {
      const pointer = drag.current?.pointer
      drag.current = null
      if (pointer !== undefined && element?.hasPointerCapture(pointer)) element.releasePointerCapture(pointer)
    }
  }, [camera, playing])
  if (!camera.startsWith('pov:')) return null
  return <>
    {!playing && <div ref={surface} className="pov-look-surface" tabIndex={0} role="group" aria-label="Paused player free-look. Drag or use arrow keys to look around. Home resets view."
      onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus({ preventScroll: true }); drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, look: replayStore.getState().freeLook } }}
      onPointerMove={e => { const start = drag.current; if (!start || start.pointer !== e.pointerId) return; replayStore.getState().setFreeLook({ yaw: start.look.yaw - (e.clientX - start.x) * .006, pitch: start.look.pitch + (e.clientY - start.y) * .005 }) }}
      onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
      onBlur={e => { const pointer = drag.current?.pointer; drag.current = null; if (pointer !== undefined && e.currentTarget.hasPointerCapture(pointer)) e.currentTarget.releasePointerCapture(pointer) }}
      onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={e => {
        const look = replayStore.getState().freeLook
        const direction: Record<string, FreeLook> = { ArrowLeft: { yaw: .12, pitch: 0 }, ArrowRight: { yaw: -.12, pitch: 0 }, ArrowUp: { yaw: 0, pitch: .1 }, ArrowDown: { yaw: 0, pitch: -.1 } }
        if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); replayStore.getState().resetFreeLook() }
        if (direction[e.key]) { e.preventDefault(); replayStore.getState().setFreeLook({ yaw: look.yaw + direction[e.key].yaw, pitch: look.pitch + direction[e.key].pitch }) }
      }} />}
    <div className="pov-help"><strong>{playing ? 'Following simulated gaze' : 'Paused · look around'}</strong><span>{playing ? 'Pause to explore the field.' : 'Drag or use arrow keys. Resuming follows the player.'}</span>{!playing && <div><button onClick={() => replayStore.getState().resetFreeLook()}>Reset view</button><button onClick={() => { replayStore.getState().resetFreeLook(); replayStore.getState().play() }}>Follow player</button></div>}</div>
  </>
}
