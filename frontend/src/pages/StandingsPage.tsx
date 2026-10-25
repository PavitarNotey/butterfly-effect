import { useCallback } from 'react'
import { getOverview } from '../league/client'
import { DataState, StandingsTable } from '../league/components'
import { useLeague } from '../league/LeagueContext'
import { useResource } from '../league/useResource'

export default function StandingsPage() {
  const league = useLeague()
  const load = useCallback((signal: AbortSignal) => getOverview(league, signal), [league])
  const { resource, retry } = useResource('standings', load)
  return <main className="site-container listing-page" id="page-main" tabIndex={-1}><p className="section-kicker">{league.name.toUpperCase()} / 2026–27</p><h1>The standings<span>.</span></h1><p className="page-intro">Matchweek {league.matchweek} of {league.totalMatchweeks}. Ten clubs. Every result counts.</p>{resource.status !== 'ready' ? <DataState error={resource.status === 'error' ? resource.error : undefined} retry={retry} /> : <><StandingsTable league={league} rows={resource.data.standings} /><div className="standings-explanation"><h2>How the table is calculated</h2><p>Nine complete rounds, plus the three finished matches in Matchweek 10. Clubs with an upcoming fixture have played nine games; the others have played ten.</p><p>Three points for a win, one for a draw. Clubs are ordered by points, goal difference, then goals scored. Club ID is the final tie-breaker.</p><p>This is a fictional midseason table derived from 48 authored results.</p></div></>}</main>
}
