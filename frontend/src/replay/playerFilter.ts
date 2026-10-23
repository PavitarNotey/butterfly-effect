import type { Player } from './types'

export function playerMatches(player: Player, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return `${player.number} ${player.name} ${player.role}`.toLocaleLowerCase().includes(needle)
}
