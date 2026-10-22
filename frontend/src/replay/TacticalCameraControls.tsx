import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { replayStore, useReplay } from './store'
import type { TacticalView } from './store'

/** Direct overhead controls. Only deliberate input creates a persistent override;
 * automatic camera evaluation continues to use absolute replay time otherwise. */
export function TacticalCameraControls() {
  const mode = useReplay(s => s.camera)
  const { gl, camera } = useThree()
  useEffect(() => {
    if (mode !== 'tactical' && mode !== 'overview') return
    const canvas = gl.domElement
    let drag: { x: number; y: number; pointer: number; view: TacticalView; units: number } | null = null
    let moved = false, swallowClick = false
    const view = (): TacticalView => replayStore.getState().tacticalView ?? { center: [camera.position.x, camera.position.z], height: camera.position.y }
    const units = (height: number) => 2 * height * Math.tan((camera as PerspectiveCamera).fov * Math.PI / 360) / canvas.getBoundingClientRect().height
    function wheel(event: WheelEvent) {
      event.preventDefault()
      const before = view(), rect = canvas.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1)
      const height = Math.max(16, Math.min(110, before.height * Math.exp(Math.max(-1, Math.min(1, delta * .001)))))
      const offsetX = (event.clientX - rect.left - rect.width / 2) * units(before.height)
      const offsetZ = (event.clientY - rect.top - rect.height / 2) * units(before.height)
      replayStore.getState().setTacticalView({ height, center: [before.center[0] + offsetX * (1 - height / before.height), before.center[1] + offsetZ * (1 - height / before.height)] })
    }
    function down(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary) return
      swallowClick = false; moved = false
      const start = view()
      drag = { x: event.clientX, y: event.clientY, pointer: event.pointerId, view: start, units: units(start.height) }
    }
    function move(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointer) return
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y
      if (!moved && Math.hypot(dx, dy) < 5) return
      moved = true
      canvas.setPointerCapture(event.pointerId)
      event.preventDefault(); event.stopImmediatePropagation()
      document.body.style.cursor = 'grabbing'
      replayStore.getState().setTacticalView({ height: drag.view.height, center: [drag.view.center[0] - dx * drag.units, drag.view.center[1] - dy * drag.units] })
    }
    function finish(event?: PointerEvent) {
      if (!drag || (event && event.pointerId !== drag.pointer)) return
      const pointer = drag.pointer
      drag = null
      if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer)
      if (moved) {
        swallowClick = event?.type === 'pointerup'
        event?.stopImmediatePropagation()
        document.body.style.cursor = 'auto'
      }
      moved = false
    }
    function click(event: MouseEvent) {
      if (swallowClick) { event.preventDefault(); event.stopImmediatePropagation(); swallowClick = false }
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('pointerdown', down, true)
    canvas.addEventListener('pointermove', move, true)
    canvas.addEventListener('pointerup', finish, true)
    canvas.addEventListener('pointercancel', finish, true)
    canvas.addEventListener('lostpointercapture', finish, true)
    canvas.addEventListener('click', click, true)
    const blur = () => finish()
    window.addEventListener('blur', blur)
    return () => {
      finish()
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('pointerdown', down, true)
      canvas.removeEventListener('pointermove', move, true)
      canvas.removeEventListener('pointerup', finish, true)
      canvas.removeEventListener('pointercancel', finish, true)
      canvas.removeEventListener('lostpointercapture', finish, true)
      canvas.removeEventListener('click', click, true)
      window.removeEventListener('blur', blur)
    }
  }, [mode, gl, camera])
  return null
}
