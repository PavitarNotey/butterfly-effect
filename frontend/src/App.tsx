import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import LeagueShell from './pages/LeagueShell'
import HomePage from './pages/HomePage'
import FixturesPage from './pages/FixturesPage'
import StandingsPage from './pages/StandingsPage'
import MatchPage from './pages/MatchPage'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'
import './Website.css'
import './Dropdowns.css'

const ScenarioLibrary = lazy(() => import('./league/ReplaySession').then(m => ({ default: m.ScenarioLibrary })))

function RoutePresentation() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    document.title = `${pathname === '/' ? 'Matchday' : pathname === '/standings' ? 'Standings' : pathname === '/fixtures' ? 'Fixtures & results' : pathname.includes('/moments/') ? 'Replay Studio' : pathname === '/studio' ? 'Scenario library' : 'Match Center'} — Butterfly Effect`
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

export default function App() {
  return <BrowserRouter><RoutePresentation /><Routes><Route element={<LeagueShell />}><Route index element={<HomePage />} /><Route path="studio" element={<Suspense fallback={<main id="page-main" className="data-state" tabIndex={-1}>Loading the scenario library…</main>}><ScenarioLibrary /></Suspense>} /><Route path="fixtures" element={<FixturesPage />} /><Route path="standings" element={<StandingsPage />} /><Route path="matches/:matchId" element={<MatchPage />} /><Route path="matches/:matchId/moments/:eventId" element={<MatchPage studio />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes></BrowserRouter>
}
