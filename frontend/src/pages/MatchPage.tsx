import { lazy, Suspense, useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiConnection } from '../ApiConnection'
import { getMatch, getOverview, LeagueApiError } from '../league/client'
import { ClubMark, DataState, EventTimeline, ReplayBoundary } from '../league/components'
import { clubFor, kickoffText, matchMinute, momentPath, scoreText } from '../league/format'
import { useLeague } from '../league/LeagueContext'
import type { MatchDetail } from '../league/types'
import { useResource } from '../league/useResource'
import NotFoundPage from './NotFoundPage'

const ReplaySession = lazy(() => import('../league/ReplaySession'))

function UpcomingContext({ match }: { match: MatchDetail }) {
  const league = useLeague()
  const load = useCallback((signal: AbortSignal) => getOverview(league, signal), [league])
  const { resource, retry } = useResource(`preview-${match.id}`, load)
  if (resource.status !== 'ready') return <DataState label="Loading the league context…" error={resource.status === 'error' ? resource.error : undefined} retry={retry} />
  return <section className="preview-context"><p className="section-kicker">THE SEASON SO FAR</p><div>{[match.homeId, match.awayId].map(id => {
    const row = resource.data.standings.find(r => r.clubId === id)!
    return <article key={id}><h3>{clubFor(league, id).name}</h3><dl><div><dt>Position</dt><dd>{row.position}</dd></div><div><dt>Played</dt><dd>{row.played}</dd></div><div><dt>Points</dt><dd>{row.points}</dd></div></dl></article>
  })}</div><Link className="text-link" to="/standings">Explore the league table ↗</Link></section>
}

function MatchContent({ match, studio, eventId }: { match: MatchDetail; studio: boolean; eventId?: string }) {
  const league = useLeague()
  const [search] = useSearchParams()
  const home = clubFor(league, match.homeId), away = clubFor(league, match.awayId)
  const analyzed = match.events.find(e => e.replay)
  const event = studio ? match.events.find(e => e.id === eventId && e.replay) : analyzed
  if (studio && !event) return <NotFoundPage message="This analyzed moment could not be found." />
  if (studio && event) return <div id="page-main" tabIndex={-1} className="studio-route"><div className="studio-context"><nav aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to={`/matches/${match.id}?event=${event.id}#${event.id}`}>{home.name} {scoreText(match)} {away.name}</Link><span>/</span><span>Analyzed moment</span></nav><Link className="return-to-match" to={`/matches/${match.id}?event=${event.id}#${event.id}`}>← Return to Match Center</Link><ApiConnection /></div><ReplayBoundary><Suspense fallback={<div className="viewer-loading">Loading Replay Studio…</div>}><ReplaySession match={match} eventId={event.id} studio analysisPath={momentPath(match, event)} /></Suspense></ReplayBoundary></div>
  const featured = match.id === league.featured.matchId
  return <main id="page-main" className="site-container match-page" tabIndex={-1}>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/fixtures">Matchweek {match.matchweek}</Link><span>/</span><span>Match Center</span></nav>
    <section className="match-scoreboard" aria-label="Match details"><div className="match-competition"><span>{league.name.toUpperCase()} <span>/</span> MATCHWEEK {match.matchweek}</span>{featured && <b>MATCH OF THE WEEK</b>}</div><div className="scoreboard-main"><div className="scoreboard-team"><ClubMark club={home} /><h1>{home.name}</h1></div><div className="scoreboard-score"><span className="match-status">{match.status === 'finished' ? 'FULL TIME' : 'UPCOMING'}</span><strong data-testid="match-final-score">{match.score ? scoreText(match) : 'VS'}</strong><time>{kickoffText(match.kickoff)}</time></div><div className="scoreboard-team"><ClubMark club={away} /><h2>{away.name}</h2></div></div><div className="scorers-row">{[home, away].map(c => <p key={c.id}>{match.events.filter(e => e.type === 'goal' && e.teamId === c.id).map(e => `${e.playerName} ${matchMinute(e)}`).join(' · ') || (match.score ? '—' : '')}</p>)}</div><p className="venue-line">{match.venue} <span>·</span> Original fictional fixture</p></section>
    {match.status === 'finished' && analyzed ? <>
      <div className="match-workspace"><div><div className="match-summary"><p className="section-kicker">{featured ? 'THE PASS THAT WASN’T TOUCHED' : 'THE MATCH STORY'}</p><h2>{featured ? 'The smallest touch was no touch at all.' : analyzed.headline}</h2><p>{match.summary}</p></div><ReplayBoundary><Suspense fallback={<div className="viewer-loading">Preparing the interactive replay…</div>}><ReplaySession key={match.id} match={match} eventId={analyzed.id} studio={false} analysisPath={momentPath(match, analyzed)} /></Suspense></ReplayBoundary></div><EventTimeline match={match} selectedEventId={search.get('event') ?? undefined} /></div>
      {match.editorial.length > 0 && <section className="match-editorial"><p className="section-kicker">A CLOSER LOOK / THE FEATURED SEQUENCE</p><h2>Follow the ball.<br /><em>Then follow everything else.</em></h2><div>{match.editorial.map((paragraph, i) => <article key={paragraph}><span>0{i + 1}</span><h3>{['The buildup', 'The untouched diagonal', 'The arrival & finish'][i]}</h3><p>{paragraph}</p></article>)}</div></section>}
    </> : <div className="upcoming-match"><section><p className="section-kicker">MATCH PREVIEW</p><h2>A new chapter on Sunday.</h2><p>{match.summary}</p><p>Kickoff: <time>{kickoffText(match.kickoff)}</time> at {match.venue}.</p><span className="upcoming-note">The match has not been played. Analysis becomes available only for reconstructed passages.</span></section><UpcomingContext match={match} /></div>}
  </main>
}

export default function MatchPage({ studio = false }: { studio?: boolean }) {
  const { matchId = '', eventId } = useParams()
  const league = useLeague()
  const load = useCallback((signal: AbortSignal) => getMatch(matchId, league, signal), [matchId, league])
  const { resource, retry } = useResource(`match-${matchId}`, load)
  if (resource.status === 'error' && resource.error instanceof LeagueApiError && resource.error.status === 404) return <NotFoundPage message="This match could not be found." />
  if (resource.status !== 'ready') return <main id="page-main"><DataState label="Opening the Match Center…" error={resource.status === 'error' ? resource.error : undefined} retry={retry} /></main>
  return <MatchContent key={`${matchId}:${eventId ?? 'match'}`} match={resource.data} studio={studio} eventId={eventId} />
}
