import { describe, expect, it } from 'vitest'
import { scenarios } from './scenario'
import { playerMatches } from './playerFilter'

describe('player picker filtering', () => {
  const players = scenarios[0].players
  it('searches by player name, shirt number, and position', () => {
    expect(players.filter(player => playerMatches(player, 'Dane Mercer')).map(player => player.id)).toEqual(['d4'])
    expect(players.filter(player => playerMatches(player, '9')).some(player => player.number === 9)).toBe(true)
    expect(players.filter(player => playerMatches(player, 'goalkeeper'))).toHaveLength(2)
  })
  it('represents both teams and all 22 players without a query', () => {
    const matches = players.filter(player => playerMatches(player, ''))
    expect(matches).toHaveLength(22)
    expect(new Set(matches.map(player => player.teamId))).toEqual(new Set(scenarios[0].teams.map(team => team.id)))
  })
})
