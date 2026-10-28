import type { Player } from "./types";

/**
 * Match a roster query against a player's searchable identity fields without changing selection.
 */
export function playerMatches(player: Player, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${player.number} ${player.name} ${player.role}`
    .toLocaleLowerCase()
    .includes(needle);
}
