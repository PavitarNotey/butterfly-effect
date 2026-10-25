import { Component } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { clubFor, kickoffText, matchMinute, momentPath, orderedEvents, scoreText } from './format'
import type { Club, Fixture, FixtureSummary, League, MatchDetail, StandingsRow } from './types'

export function ClubMark({ club, small = false }: { club: Club; small?: boolean }) {
  return <span className={`club-mark${small ? ' small' : ''}`} style={{ '--club-color': club.color } as CSSProperties} aria-hidden="true"><svg viewBox="0 0 48 56" fill="none"><path d="M4 5 24 1 44 5v25c0 11-12 20-20 25C16 50 4 41 4 30Z" fill="currentColor" fillOpacity=".11" stroke="currentColor" strokeWidth="1.5"/><path d="M12 12v17c0 7 6 13 12 17 6-4 12-10 12-17V12" stroke="currentColor" strokeOpacity=".3"/><path d="m14 31 10-16 10 16H14Z" stroke="currentColor" strokeWidth="2"/></svg><b>{club.shortName}</b></span>
}


export function DataState({ error, retry, label = 'Loading the competition…' }: { error?: Error; retry?: () => void; label?: string }) {
  return <div className="data-state" role={error ? 'alert' : 'status'}><span className="state-symbol" aria-hidden="true">⋈</span><h1>{error ? 'The matchday is out of reach.' : label}</h1><p>{error ? error.message : 'Bringing the fixtures and stories into view.'}</p>{error && retry ? <button className="site-button primary" onClick={retry}>Retry connection</button> : null}</div>
}

export class ReplayBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="data-state" role="alert"><h2>The 3D replay could not load.</h2><p>Check your connection and reload to try again. The match story and key events remain available.</p><button className="site-button" onClick={() => window.location.reload()}>Reload replay</button></div> : this.props.children
  }
}

export function FixtureStrip({ league, fixtures }: { league: League; fixtures: Fixture[] }) {
  return <section className="fixture-ribbon" aria-label={`Matchweek ${league.matchweek} fixtures`}><div className="ribbon-label"><span>THE MATCHDAY</span><strong>MW {league.matchweek}</strong><small>24–25 OCT</small></div><div className="fixture-scroll">{fixtures.map(f => {
    const home = clubFor(league, f.homeId), away = clubFor(league, f.awayId)
    const featured = f.id === league.featured.matchId
    return <Link key={f.id} className={`strip-fixture${featured ? ' featured' : ''}`} to={`/matches/${f.id}`} data-testid="strip-fixture" aria-label={`${home.name} versus ${away.name}, ${scoreText(f)}${featured ? ', Match of the Week' : ''}`}><div className="strip-status"><span>{f.status === 'finished' ? 'FT' : 'UPCOMING'}</span>{featured ? <b>MATCH OF THE WEEK</b> : <span>{f.status === 'upcoming' ? 'SUN 25 OCT' : 'SAT 24 OCT'}</span>}</div>{[home, away].map((c, i) => <div className="strip-team" key={c.id}><i style={{ background: c.color }} /><span>{c.shortName}</span><strong>{f.score ? (i === 0 ? f.score.home : f.score.away) : '–'}</strong></div>)}{!f.score && <small>{kickoffText(f.kickoff)}</small>}</Link>
  })}</div></section>
}

export function StandingsTable({ league, rows, compact = false }: { league: League; rows: StandingsRow[]; compact?: boolean }) {
  return <div className="table-scroll"><table className={`standings-table${compact ? ' compact' : ''}`}><caption className="sr-only">{league.name} standings, Matchweek {league.matchweek}</caption><thead><tr><th scope="col"><span className="sr-only">Position</span>#</th><th scope="col">Club</th><th scope="col"><abbr title="Played">P</abbr></th>{!compact && <><th scope="col"><abbr title="Wins">W</abbr></th><th scope="col"><abbr title="Draws">D</abbr></th><th scope="col"><abbr title="Losses">L</abbr></th><th scope="col"><abbr title="Goals for">GF</abbr></th><th scope="col"><abbr title="Goals against">GA</abbr></th></>}<th scope="col"><abbr title="Goal difference">GD</abbr></th><th scope="col"><abbr title="Points">Pts</abbr></th></tr></thead><tbody>{rows.map(r => {
    const club = clubFor(league, r.clubId)
    return <tr key={r.clubId}><td>{String(r.position).padStart(2, '0')}</td><th scope="row"><span className="table-club"><i style={{ background: club.color }} /><span>{club.name}</span></span></th><td>{r.played}</td>{!compact && <><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td>{r.goalsFor}</td><td>{r.goalsAgainst}</td></>}<td>{r.goalDifference > 0 ? '+' : ''}{r.goalDifference}</td><td className="points">{r.points}</td></tr>
  })}</tbody></table></div>
}

export function EventTimeline({ match, selectedEventId }: { match: MatchDetail; selectedEventId?: string }) {
  return <section className="event-timeline" aria-label="Key match events"><div className="section-heading"><h2>Key events</h2><span>FULL TIME</span></div><ol>{orderedEvents(match.events).map(e => {
    const content = <><time>{matchMinute(e)}</time><div><span className="event-type">{e.type === 'goal' ? 'GOAL' : e.type === 'major_miss' ? 'MAJOR MISS' : 'SAVE'} <span aria-hidden="true">/</span> {e.playerName}</span><h3>{e.headline}</h3><p>{e.description}</p>{e.replay ? <span className="replay-indicator">Explore in 3D <span aria-hidden="true">↗</span></span> : <small className="event-authored">Authored match event · no reconstruction</small>}</div></>
    return <li key={e.id} id={e.id} className={`${e.replay ? 'has-replay' : 'informational'}${selectedEventId === e.id ? ' selected-event' : ''}`} data-testid={e.replay ? 'replay-event' : 'informational-event'}>{e.replay ? <Link to={momentPath(match, e)}>{content}</Link> : <div className="event-information">{content}</div>}</li>
  })}</ol><p className="timeline-disclosure">Match events are fictional editorial metadata. Only the marked event has synthetic 3D tracking.</p></section>
}

export function ResultRow({ league, fixture }: { league: League; fixture: FixtureSummary }) {
  const home = clubFor(league, fixture.homeId), away = clubFor(league, fixture.awayId)
  return <Link className="result-row" to={`/matches/${fixture.id}`} aria-label={`${home.name} ${scoreText(fixture)} ${away.name}`} aria-describedby={fixture.analyzedEvent ? `fixture-story-${fixture.id}` : undefined}><ClubMark club={home} small /><span className="result-home">{home.name}</span><strong>{scoreText(fixture)}</strong><span className="result-away">{away.name}</span><ClubMark club={away} small /><span className="row-arrow" aria-hidden="true">↗</span>{fixture.analyzedEvent && <small className="result-story" id={`fixture-story-${fixture.id}`}><span>3D ANALYSIS</span> {fixture.analyzedEvent.headline}</small>}</Link>
}
