import type { CameraMode } from './store'
import type { Scenario, Vec3 } from './types'
import { samplePosition, sampleYaw } from './sample'

export interface CameraPose { position: Vec3; target: Vec3; up: Vec3; fov: number; hiddenPlayerId?: string }
/** Camera pose is a pure function of mode + canonical time, including every transition. */
export function sampleCamera(s: Scenario, mode: CameraMode, t: number): CameraPose {
  if (mode.startsWith('pov:')) {
    const id = mode.slice(4)
    const p = s.players.find(p => p.id === id)
    if (p) {
      const pos = samplePosition(p.positions, t), yaw = sampleYaw(p.facing, t)
      const dx = Math.sin(yaw), dz = Math.cos(yaw)
      return { position: [pos[0], 1.68, pos[2]], target: [pos[0] + dx * 20, 1.15, pos[2] + dz * 20], up: [0, 1, 0], fov: 84, hiddenPlayerId: id }
    }
  }
  if (mode === 'tactical') return { position: [0, 96, 0], target: [0, 0, 0], up: [0, 0, -1], fov: 68 }
  const ball = samplePosition(s.ball, t)
  const focusX = Math.max(12, Math.min(35, ball[0] * .65 + 5))
  return { position: [focusX - 9, 38, 53], target: [focusX, 0, 0], up: [0, 1, 0], fov: 49 }
}
