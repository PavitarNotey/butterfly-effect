import type { CameraMode, TacticalView } from './store'
import { gazeTarget, sampleGaze } from './gaze'
import type { FreeLook } from './gaze'
import type { Scenario, Vec3 } from './types'
import type { GuidedReplay } from '../tactics/guided'
import { clampTime, samplePosition, sampleYaw } from './sample'

export interface CameraPose { position: Vec3; target: Vec3; up: Vec3; fov: number; hiddenPlayerId?: string }
export interface CameraOptions { aspect?: number; tacticalView?: TacticalView | null; freeLook?: FreeLook; reducedMotion?: boolean; guided?: GuidedReplay | null }
const focusTracks = new WeakMap<Scenario, Vec3[]>()
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

function localFocus(s: Scenario, t: number): Vec3 {
  const ball = samplePosition(s.ball, t)
  let x = 0, z = 0, total = 0
  let minX = ball[0], maxX = ball[0], minZ = ball[2], maxZ = ball[2]
  for (const player of s.players) {
    const p = samplePosition(player.positions, t)
    if (s.relevantPlayerIds.includes(player.id)) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0])
      minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2])
    }
    const distance2 = (p[0] - ball[0]) ** 2 + (p[2] - ball[2]) ** 2
    const weight = Math.exp(-distance2 / 800) * (s.relevantPlayerIds.includes(player.id) ? 2 : 1)
    x += p[0] * weight; z += p[2] * weight; total += weight
  }
  // Keep the authored key actors (including the wide decoy) in context, with
  // a smaller ball/nearby-player bias. No selection-dependent camera movement.
  return [(minX + maxX) * .35 + (ball[0] * .65 + x / total * .35) * .3, 0, (minZ + maxZ) * .35 + (ball[2] * .65 + z / total * .35) * .3]
}

/** A cached, time-indexed focus track: symmetric one-second smoothing followed
 * by C1 cubic interpolation. No camera damping, frame delta or playback history.
 * Soft spatial weights retain nearby teammates/defenders without nearest-ID cuts.
 */
export function samplePlayFocus(s: Scenario, time: number): Vec3 {
  let track = focusTracks.get(s)
  if (!track) {
    const count = Math.ceil(s.duration / .25)
    track = Array.from({ length: count + 1 }, (_, i) => {
      const center: Vec3 = [0, 0, 0], weights = [1, 4, 6, 4, 1]
      for (let k = 0; k < 5; k++) {
        const p = localFocus(s, clampTime(i * s.duration / count + (k - 2) * .5, s.duration))
        center[0] += p[0] * weights[k] / 16; center[2] += p[2] * weights[k] / 16
      }
      return center
    })
    focusTracks.set(s, track)
  }
  const index = clampTime(time, s.duration) / s.duration * (track.length - 1), i = Math.floor(index), f = index - i
  const a = track[Math.max(0, i - 1)], b = track[i], c = track[Math.min(track.length - 1, i + 1)], d = track[Math.min(track.length - 1, i + 2)]
  const cubic = (axis: number) => .5 * (2 * b[axis] + (-a[axis] + c[axis]) * f + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * f * f + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * f * f * f)
  return [clamp(cubic(0), -s.pitch.length / 2 + 8, s.pitch.length / 2 - 8), 0, clamp(cubic(2), -s.pitch.width / 2 + 10, s.pitch.width / 2 - 10)]
}

export function constrainTacticalView(s: Scenario, view: TacticalView): TacticalView {
  return {
    center: [clamp(view.center[0], -s.pitch.length / 2 + 3, s.pitch.length / 2 - 3), clamp(view.center[1], -s.pitch.width / 2 + 3, s.pitch.width / 2 - 3)],
    height: clamp(view.height, 16, 110),
  }
}

/** Automatic poses are pure scenario + mode + time + viewport functions. Manual
 * overhead framing is an explicit user override and never changes replay state.
 */
export function sampleCamera(s: Scenario, mode: CameraMode, t: number, options: CameraOptions = {}): CameraPose {
  const guide = options.guided
  const dummy = guide?.scenarioId === s.id && mode === 'broadcast' ? s.events.find(e => e.id === guide.dummyEventId && e.type === 'dummy') : undefined
  if (dummy?.type === 'dummy') {
    const actor = s.players.find(p => p.id === dummy.actorId)!, p = samplePosition(actor.positions, dummy.t)
    const yaw = sampleYaw(actor.facing, dummy.t), dx = -Math.sin(yaw), dz = -Math.cos(yaw)
    // Existing guided camera ownership/restoration, with an oblique incoming
    // view. Seeing between the legs requires elevation well below overhead.
    const scale = Math.max(1, 1.25 / (options.aspect ?? 16 / 9))
    return { position: [p[0] - dx * 9 * scale + dz * 5.5 * scale, 3.6 * scale, p[2] - dz * 9 * scale - dx * 5.5 * scale], target: [p[0] + dx * 1.5, .65, p[2] + dz * 1.5], up: [0,1,0], fov: 48 }
  }
  if (mode.startsWith('pov:')) {
    const id = mode.slice(4), p = s.players.find(p => p.id === id)
    if (p) {
      const pos = samplePosition(p.positions, t), gaze = sampleGaze(s, p, t, options.reducedMotion)
      const position: Vec3 = [pos[0], gaze.eyeHeight, pos[2]], look = options.freeLook ?? { yaw: 0, pitch: 0 }
      return { position, target: gazeTarget(position, gaze.yaw + look.yaw, Math.max(-1.35, Math.min(1.2, gaze.pitch + look.pitch))), up: [0, 1, 0], fov: 84, hiddenPlayerId: id }
    }
  }
  if (mode.startsWith('follow:')) {
    const id = mode.slice(7), player = s.players.find(p => p.id === id)
    if (player) {
      const position = samplePosition(player.positions, t), yaw = sampleYaw(player.facing, t)
      return {
        position: [position[0] - Math.sin(yaw) * 7.5, 4.4, position[2] - Math.cos(yaw) * 7.5],
        target: [position[0], 1.15, position[2]], up: [0, 1, 0], fov: 48,
      }
    }
  }
  const aspect = Math.max(.25, options.aspect ?? 16 / 9)
  const focus = samplePlayFocus(s, t)
  if (mode === 'tactical' || mode === 'overview') {
    const full = mode === 'overview'
    const fov = full ? 68 : 48
    const automatic = full
      ? { center: [0, 0] as [number, number], height: Math.max(96, (s.pitch.length + 8) / (2 * Math.tan(fov * Math.PI / 360) * aspect)) }
      : { center: [focus[0], focus[2]] as [number, number], height: 48 * Math.max(1, 1.35 / aspect) }
    const view = options.tacticalView ? constrainTacticalView(s, options.tacticalView) : automatic
    return { position: [view.center[0], view.height, view.center[1]], target: [view.center[0], 0, view.center[1]], up: [0, 0, -1], fov }
  }
  const scale = Math.max(1, 1.4 / aspect)
  if (s.id === 'the-missed-chance') {
    const receive = s.events.find(event => event.type === 'receive')!, shot = s.events.find(event => event.type === 'shot')!
    const shooter = s.players.find(player => player.id === shot.playerIds[0])!
    const position = samplePosition(shooter.positions, shot.t)
    const progress = clamp((t - receive.t) / (shot.t - receive.t), 0, 1)
    const close = progress * progress * (3 - 2 * progress)
    // Establish the pass first, then bring the shooter and goal together into
    // the frame. Absolute-time framing preserves seeks and camera ownership.
    const x = focus[0] + (position[0] * .65 + s.pitch.length / 2 * .35 - focus[0]) * close
    const z = focus[2] + (position[2] * .6 - focus[2]) * close
    return { position: [x - 7 * scale, (24 - 4 * close) * scale, z + (32 - 5 * close) * scale], target: [x, .7, z], up: [0, 1, 0], fov: 44 }
  }
  return { position: [focus[0] - 7 * scale, 24 * scale, focus[2] + 32 * scale], target: [focus[0], .7, focus[2]], up: [0, 1, 0], fov: 44 }
}
