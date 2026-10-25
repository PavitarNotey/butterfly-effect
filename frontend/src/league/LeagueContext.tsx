import { createContext, useContext } from 'react'
import type { League } from './types'

export const LeagueContext = createContext<League | null>(null)
export function useLeague() {
  const league = useContext(LeagueContext)
  if (!league) throw new Error('League page requires a verified competition')
  return league
}
