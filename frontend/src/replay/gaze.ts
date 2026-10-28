import {
  clampTime,
  samplePosition,
  sampleSpeed,
  sampleTravel,
  sampleYaw,
} from "./sample";
import type { Player, Scenario, Vec3 } from "./types";

export interface FreeLook {
  yaw: number;
  pitch: number;
}
export const neutralLook: FreeLook = { yaw: 0, pitch: 0 };
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const angle = (n: number) => Math.atan2(Math.sin(n), Math.cos(n));
/**
 * Bound a paused POV offset in radians without changing recorded player facing.
 */
export function constrainFreeLook(look: FreeLook): FreeLook {
  return {
    yaw: clamp(Number.isFinite(look.yaw) ? look.yaw : 0, -Math.PI, Math.PI),
    pitch: clamp(Number.isFinite(look.pitch) ? look.pitch : 0, -1.05, 1.05),
  };
}

/** Inferred presentation gaze, never observed awareness. Smooth event-relative
 * attention windows and symmetric canonical samples make seeking reproducible. */
function directionAt(
  s: Scenario,
  p: Player,
  t: number,
  reducedMotion: boolean,
): FreeLook {
  const pos = samplePosition(p.positions, t),
    ball = samplePosition(s.ball, t),
    facing = sampleYaw(p.facing, t);
  const distance = Math.hypot(ball[0] - pos[0], ball[2] - pos[2]);
  const nearAction = s.events
    .filter(
      (e) =>
        e.playerIds.includes(p.id) &&
        ["pass", "receive", "shot"].includes(e.type),
    )
    .reduce(
      (weight, e) => Math.max(weight, Math.exp(-(((t - e.t) / 1.35) ** 2))),
      0,
    );
  const possession =
    s.possession.filter((k) => k.t <= t).at(-1)?.playerId === p.id;
  const track = Math.max(
    nearAction,
    possession ? 0.88 : 0.35 + 0.3 * Math.exp(-distance / 18),
  );
  // A small deterministic field scan fades as an action becomes imminent.
  const scanTime = Math.floor(t / 6) * 6,
    scanOrigin = samplePosition(p.positions, scanTime);
  const teammates = s.players.filter(
    (other) => other.teamId === p.teamId && other.id !== p.id,
  );
  // Choose a nearby presentation target at a stable scan boundary; no measured
  // attention or tactical evidence is inferred from this camera-only choice.
  const mate = teammates.reduce((nearest, candidate) => {
    const a = samplePosition(nearest.positions, scanTime),
      b = samplePosition(candidate.positions, scanTime);
    return Math.hypot(b[0] - scanOrigin[0], b[2] - scanOrigin[2]) <
      Math.hypot(a[0] - scanOrigin[0], a[2] - scanOrigin[2])
      ? candidate
      : nearest;
  });
  const matePosition = samplePosition(mate.positions, t);
  const mateYaw = clamp(
    angle(
      Math.atan2(matePosition[0] - pos[0], matePosition[2] - pos[2]) - facing,
    ),
    -0.65,
    0.65,
  );
  const scan = reducedMotion
    ? 0
    : Math.sin(t * 0.9 + p.number * 0.37) * 0.15 +
      mateYaw * 0.2 * Math.sin((t * Math.PI) / 6) ** 2;
  const ballYaw = clamp(
    angle(Math.atan2(ball[0] - pos[0], ball[2] - pos[2]) - facing),
    -1.25,
    1.25,
  );
  // Look a little ahead of a ball at the feet, keeping the horizon visible.
  const pitch = clamp(
    Math.atan2(ball[1] - 1.68, Math.max(3.5, distance)),
    -0.43,
    0.28,
  );
  return {
    yaw: ballYaw * track + scan * (1 - nearAction),
    pitch: pitch * track,
  };
}
/**
 * @returns Bounded simulated eye orientation; this is not measured human attention.
 */
export function sampleGaze(
  s: Scenario,
  p: Player,
  time: number,
  reducedMotion = false,
) {
  const t = clampTime(time, s.duration),
    facing = sampleYaw(p.facing, t),
    weights = [1, 4, 6, 4, 1];
  let yaw = 0,
    pitch = 0;
  weights.forEach((weight, i) => {
    const gaze = directionAt(
      s,
      p,
      clampTime(t + (i - 2) * 0.12, s.duration),
      reducedMotion,
    );
    yaw += (gaze.yaw * weight) / 16;
    pitch += (gaze.pitch * weight) / 16;
  });
  const speed = sampleSpeed(p.positions, t),
    phase = (sampleTravel(p.positions, t) * Math.PI * 2) / 1.4;
  const bob = reducedMotion ? 0 : Math.sin(phase) * 0.013 * Math.min(1, speed);
  return { yaw: facing + yaw, pitch, eyeHeight: 1.68 + bob };
}
/**
 * Convert eye position and yaw/pitch radians to a look-at point in world coordinates.
 */
export function gazeTarget(position: Vec3, yaw: number, pitch: number): Vec3 {
  return [
    position[0] + Math.sin(yaw) * Math.cos(pitch) * 20,
    position[1] + Math.sin(pitch) * 20,
    position[2] + Math.cos(yaw) * Math.cos(pitch) * 20,
  ];
}
