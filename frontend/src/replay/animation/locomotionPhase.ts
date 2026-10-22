import { samplePosition, sampleYaw } from '../sample'
import type { Player } from '../types'

const step = .05
const phases = new WeakMap<Player, Float64Array>()

/** Integrate a fixed canonical grid once, never frame deltas. Reversing travel
 * reverses clip time continuously instead of mixing two opposing leg poses.
 * A smooth signed projection eases direction changes through lateral movement.
 */
export function locomotionPhase(player: Player, time: number) {
  let table = phases.get(player)
  if (!table) {
    const duration = player.positions.at(-1)!.t
    table = new Float64Array(Math.ceil(duration / step) + 1)
    let before = samplePosition(player.positions, 0)
    for (let i = 1; i < table.length; i++) {
      const t = Math.min(duration, i * step)
      const after = samplePosition(player.positions, t)
      const dx = after[0] - before[0], dz = after[2] - before[2], distance = Math.hypot(dx, dz)
      const yaw = sampleYaw(player.facing, t - step / 2)
      const forward = distance > 1e-9 ? (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / distance : 0
      table[i] = table[i - 1] + distance * forward / Math.hypot(forward, .3) / 1.8
      before = after
    }
    phases.set(player, table)
  }
  const index = Math.min(table.length - 1, time / step), a = Math.floor(index), b = Math.min(table.length - 1, a + 1)
  // Stable identity offset avoids synchronising opponents with the same number.
  const identity = [...player.id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 27) % 997 / 997
  return table[a] + (table[b] - table[a]) * (index - a) + identity
}
