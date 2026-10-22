import type { FacingKey, PositionKey, Scenario, Vec3 } from './types'

export function clampTime(t: number, duration: number) {
  return Math.max(0, Math.min(duration, Number.isFinite(t) ? t : 0))
}

function segment<T extends { t: number }>(keys: T[], time: number): [T, T, number] {
  const t = clampTime(time, keys.at(-1)!.t)
  const i = keys.findIndex(k => k.t > t)
  if (i < 1) return [keys.at(-1)!, keys.at(-1)!, 0]
  const a = keys[i - 1], b = keys[i]
  return [a, b, (t - a.t) / (b.t - a.t)]
}

export function samplePosition(keys: PositionKey[], t: number): Vec3 {
  const [a, b, f] = segment(keys, t)
  return a.position.map((v, i) => v + (b.position[i] - v) * f) as Vec3
}

export function sampleYaw(keys: FacingKey[], t: number): number {
  const [a, b, f] = segment(keys, t)
  const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))
  return a.yaw + delta * f
}

export function sampleSpeed(keys: PositionKey[], t: number): number {
  const [a, b] = segment(keys, t)
  if (a === b) return 0
  return Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]) / (b.t - a.t)
}

/** Travel distance for cosmetic ball spin; stationary keyframes stop rotating. */
export function sampleTravel(keys: PositionKey[], time: number): number {
  const t = clampTime(time, keys.at(-1)!.t)
  let distance = 0
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i]
    if (t <= a.t) break
    const fraction = Math.min(1, (t - a.t) / (b.t - a.t))
    distance += Math.hypot(...a.position.map((v, axis) => b.position[axis] - v)) * fraction
  }
  return distance
}

export function sampleWorld(s: Scenario, t: number) {
  const time = clampTime(t, s.duration)
  return {
    time,
    players: s.players.map(p => ({ id: p.id, position: samplePosition(p.positions, time), yaw: sampleYaw(p.facing, time) })),
    ball: samplePosition(s.ball, time),
    possession: s.possession.filter(k => k.t <= time).at(-1)?.playerId ?? null,
    event: s.events.filter(e => e.t <= time).at(-1),
  }
}
