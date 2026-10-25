import { useCallback } from 'react'
import { Link } from 'react-router'
import { getOverview } from '../league/client'
import { ClubMark, DataState, FixtureStrip, ResultRow, StandingsTable } from '../league/components'
import { clubFor, kickoffText, momentPath } from '../league/format'
import { useLeague } from '../league/LeagueContext'
import { useResource } from '../league/useResource'

export default function HomePage() {
  const league = useLeague()
  const load = useCallback((signal: AbortSignal) => getOverview(league, signal), [league])
  const { resource, retry } = useResource('overview', load)
  if (resource.status !== 'ready') return <main id="page-main"><DataState error={resource.status === 'error' ? resource.error : undefined} retry={retry} /></main>
  const { fixtures, standings } = resource.data
  const featured = fixtures.find(f => f.id === league.featured.matchId)!
  return <main id="page-main" tabIndex={-1}>
    <FixtureStrip league={league} fixtures={fixtures} />
    <div className="site-container">
      <div className="edition-line"><span>{league.name.toUpperCase()} <span>/</span> THE MATCHWEEK EDITION</span><span>2026–27 <span>/</span> MATCHWEEK {league.matchweek}</span></div>
      <section className="match-hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="section-kicker"><i /> MATCH OF THE WEEK</p><h1 id="hero-title">The pass<br />that wasn’t<br /><em>touched.</em></h1><p className="hero-deck">{league.featured.introduction}</p><div className="hero-match"><span>{clubFor(league, featured.homeId).name}</span><strong>{featured.score?.home}–{featured.score?.away}</strong><span>{clubFor(league, featured.awayId).name}</span><small>FULL TIME · MATCHWEEK {league.matchweek}</small></div><div className="hero-actions"><Link className="site-button primary" to={momentPath(featured, { id: league.featured.eventId })}>Step inside the moment <span aria-hidden="true">↗</span></Link><Link className="text-link" to={`/matches/${featured.id}`}>Explore the match →</Link></div></div><div className="hero-image"><img src="/images/untouched-pass-poster.png" alt="The canonical Vesper–Tidal synthetic replay: Ellery lets Bellamy’s diagonal continue toward the arriving Merrick." width="1440" height="900" fetchPriority="high" /><div className="hero-image-top"><span>BE / MATCH STORIES</span><span>01 — THE UNTOUCHED PASS</span></div><div className="hero-image-caption"><span className="frame-cross" aria-hidden="true">+</span><div><strong>A moment. Every perspective.</strong><p>Explore the passage in interactive 3D.</p></div><span className="image-index">66:06.65<br /><small>SYNTHETIC RECONSTRUCTION</small></span></div></div></section>
      <div className="home-columns"><section className="week-results"><div className="section-heading"><div><p className="section-kicker">THE WEEKEND, SO FAR</p><h2>Results with a story.</h2></div><Link className="text-link" to="/fixtures">All fixtures ↗</Link></div><div className="results-list">{fixtures.filter(f => f.status === 'finished').map(f => <ResultRow key={f.id} league={league} fixture={f} />)}</div><p className="section-note">Three finished matches. Three passages to explore from every angle.</p><div className="upcoming-heading"><span className="section-kicker">STILL TO COME</span><span>SUNDAY 25 OCTOBER</span></div><div className="upcoming-grid">{fixtures.filter(f => f.status === 'upcoming').map(f => <Link key={f.id} to={`/matches/${f.id}`} className="upcoming-item"><time>{kickoffText(f.kickoff)}</time><div><ClubMark club={clubFor(league, f.homeId)} small /><ClubMark club={clubFor(league, f.awayId)} small /></div><h3>{clubFor(league, f.homeId).name}<br /><span>vs {clubFor(league, f.awayId).name}</span></h3><span className="text-link">Match preview ↗</span></Link>)}</div></section><aside className="home-table"><div className="section-heading"><div><p className="section-kicker">{league.name.toUpperCase()}</p><h2>The table.</h2></div><Link className="text-link" to="/standings">Full table ↗</Link></div><StandingsTable league={league} rows={standings.slice(0, 5)} compact /><p className="section-note">Nine rounds complete. This weekend’s three results are included.</p></aside></div>
      <section className="experience-banner"><span className="experience-mark" aria-hidden="true">⋈</span><div><p className="section-kicker">SEE THE GAME DIFFERENTLY</p><h2>The score tells you what.<br /><span>The movement tells a richer story.</span></h2><p>Watch a passage unfold. Change your perspective. Explore the measured evidence behind the movement.</p></div><Link className="site-button" to={momentPath(featured, { id: league.featured.eventId })}>Explore the Replay Studio ↗</Link></section>
    </div>
  </main>
}
