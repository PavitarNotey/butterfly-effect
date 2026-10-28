import { samplePosition } from "../replay/sample";
import type { PositionKey } from "../replay/types";

/** Render the validated polyline, including every bend and the current partial
 * segment. No rolling trail window and no invented interpolation or geometry.
 *
 * @param buffer - Caller-owned XYZ storage sized for the path plus a partial endpoint.
 * @param path - Validated canonical polyline with strictly increasing times.
 * @param time - Scenario seconds; Infinity requests the entire route.
 * @returns Number of written vertices for drawRange; updates the buffer in place.
 */
export function writeTrajectory(
  buffer: Float32Array,
  path: PositionKey[],
  time: number,
): number {
  if (!path.length) return 0;
  const until = Math.max(path[0].t, Math.min(time, path.at(-1)!.t));
  let count = 0;
  for (const key of path) {
    if (key.t > until) break;
    buffer[count * 3] = key.position[0];
    buffer[count * 3 + 1] = 0.12;
    buffer[count * 3 + 2] = key.position[2];
    count++;
  }
  if (count < path.length && path[count - 1].t < until) {
    const p = samplePosition(path, until);
    buffer[count * 3] = p[0];
    buffer[count * 3 + 1] = 0.12;
    buffer[count * 3 + 2] = p[2];
    count++;
  }
  return count;
}
