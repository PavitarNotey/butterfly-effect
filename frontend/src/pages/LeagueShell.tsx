import { Link, NavLink, Outlet } from 'react-router'
import { getLeague } from '../league/client'
import { DataState } from '../league/components'
import { LeagueContext } from '../league/LeagueContext'
import { useResource } from '../league/useResource'

export function SiteHeader() {
  return <header className="site-header"><Link className="site-brand" to="/" aria-label="Butterfly Effect home"><svg className="site-logo" viewBox="0 0 40 32" aria-hidden="true"><path d="M20 16 3 3v26l34-26v26L20 16Z" fill="none" stroke="currentColor" strokeWidth="2.5"/></svg><span>BUTTERFLY <b>EFFECT</b></span></Link><nav aria-label="Main navigation"><NavLink to="/" end>Home</NavLink><NavLink to="/fixtures">Fixtures & results</NavLink><NavLink to="/standings">Standings</NavLink></nav><span className="fiction-label"><i /> A FICTIONAL FOOTBALL WORLD</span></header>
}

export default function LeagueShell() {
  const { resource, retry } = useResource('league', getLeague)
  return <div className="football-site"><a className="skip-link" href="#page-main">Skip to content</a><SiteHeader />{resource.status === 'ready' ? <LeagueContext value={resource.data}><Outlet /></LeagueContext> : <main id="page-main"><DataState error={resource.status === 'error' ? resource.error : undefined} retry={retry} /></main>}<footer className="site-footer"><div><Link className="footer-wordmark" to="/">BUTTERFLY EFFECT <span>⋈</span></Link><p>A different perspective on the beautiful game.</p></div><div><p>Original fictional clubs. Authored match stories.<br />Synthetic tracking. Evidence-grounded analysis.</p><Link to="/studio">Scenario library ↗</Link></div><span>2026 / AN INDEPENDENT FOOTBALL EXPERIENCE</span></footer></div>
}
