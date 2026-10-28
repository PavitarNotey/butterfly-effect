import type { FacingKey, PositionKey, Scenario, Vec3 } from "./types";

/**
 * Clamp replay seconds to the scenario bounds; nonfinite input becomes zero.
 */
export function clampTime(t: number, duration: number) {
  return Math.max(0, Math.min(duration, Number.isFinite(t) ? t : 0));
}

/**
 * Locate the active linear segment; interior keys select the following segment.
 * Tracks must be strictly increasing; cropped-track callers keep time at or after the first key.
 */
function segment<T extends { t: number }>(
  keys: T[],
  time: number,
): [T, T, number] {
  const t = clampTime(time, keys.at(-1)!.t);
  const i = keys.findIndex((k) => k.t > t);
  if (i < 1) return [keys.at(-1)!, keys.at(-1)!, 0];
  const a = keys[i - 1],
    b = keys[i];
  return [a, b, (t - a.t) / (b.t - a.t)];
}

/**
 * Sample world X/Y/Z metres using canonical piecewise-linear interpolation.
 * This is the same piecewise-linear rule used by Python tactical measurements.
 *
 * @param keys - Validated position keys; canonical replay tracks start at zero.
 * @param t - Scenario seconds, clamped to zero/final-key time; cropped callers keep t within their interval.
 * @returns A fresh interpolated world-space vector in metres.
 */
export function samplePosition(keys: PositionKey[], t: number): Vec3 {
  const [a, b, f] = segment(keys, t);
  return a.position.map((v, i) => v + (b.position[i] - v) * f) as Vec3;
}

/**
 * Interpolate authored yaw along the shortest angular arc, in radians.
 *
 * @param keys - Validated authored facing keys.
 * @param t - Absolute scenario seconds.
 * @returns Yaw in radians along the shortest arc; the value need not be angle-normalized.
 */
export function sampleYaw(keys: FacingKey[], t: number): number {
  const [a, b, f] = segment(keys, t);
  const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  return a.yaw + delta * f;
}

/**
 * Return planar segment speed in metres/second; the final key is stationary.
 *
 * @returns Planar metres/second on the active segment, not smoothed animation speed.
 */
export function sampleSpeed(keys: PositionKey[], t: number): number {
  const [a, b] = segment(keys, t);
  if (a === b) return 0;
  return (
    Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]) /
    (b.t - a.t)
  );
}

/** Travel distance for cosmetic ball spin; stationary keyframes stop rotating.
 *
 * @param keys - Strictly increasing canonical position keys.
 * @param time - Absolute scenario seconds, clamped to the track.
 * @returns Travelled X/Y/Z metres including ball height, independent of replay history.
 */
export function sampleTravel(keys: PositionKey[], time: number): number {
  const t = clampTime(time, keys.at(-1)!.t);
  let distance = 0;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1],
      b = keys[i];
    if (t <= a.t) break;
    const fraction = Math.min(1, (t - a.t) / (b.t - a.t));
    distance +=
      Math.hypot(...a.position.map((v, axis) => b.position[axis] - v)) *
      fraction;
  }
  return distance;
}

/**
 * Sample the scenario players, ball and possession from one absolute timestamp.
 * Returns a snapshot without mutating tracks or advancing the replay clock.
 */
export function sampleWorld(s: Scenario, t: number) {
  const time = clampTime(t, s.duration);
  return {
    time,
    players: s.players.map((p) => ({
      id: p.id,
      position: samplePosition(p.positions, time),
      yaw: sampleYaw(p.facing, time),
    })),
    ball: samplePosition(s.ball, time),
    possession:
      s.possession.filter((k) => k.t <= time).at(-1)?.playerId ?? null,
    event: s.events.filter((e) => e.t <= time).at(-1),
  };
}
