import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import catalog from '../../../backend/league/catalog.json'
import { getLeague, getMatch, getOverview, LeagueApiError, validateLeague, validateMatch, validateStandings } from './client'
import { DataState, EventTimeline, StandingsTable } from './components'
import { kickoffText, matchMinute, orderedEvents, scoreText } from './format'
import { resolveReplay } from './replayReference'
import { scenarios } from '../replay/scenario'
import { resetReplaySession } from '../replay/session'
import { replayStore } from '../replay/store'
import { useTactics } from '../tactics/store'
import type { StandingsRow } from './types'

const league = validateLeague(catalog.league)
const matches = catalog.matches.map(m => validateMatch(m, league))
const featured = matches.find(m => m.id === league.featured.matchId)!
const linked = featured.events.find(e => e.replay)!
const rows: StandingsRow[] = league.clubs.map((c, i) => ({ position: i + 1, clubId: c.id, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 })).sort((a, b) => a.clubId.localeCompare(b.clubId)).map((r, i) => ({ ...r, position: i + 1 }))
afterEach(() => vi.unstubAllGlobals())

describe('match presentation', () => {
  it('formats finished scores, upcoming fixtures and explicit UTC kickoff', () => {
    expect(scoreText(featured)).toBe('2 – 1')
    expect(scoreText(matches[3])).toBe('Upcoming')
    expect(kickoffText(matches[3].kickoff)).toBe('25 Oct, 14:00 UTC')
  })
  it('formats football minutes and stoppage time, separately from replay seconds', () => {
    expect(matchMinute(linked)).toBe('67′')
    expect(matchMinute({ minute: 90, stoppageTime: 3 })).toBe('90+3′')
    expect(linked.matchSeconds).toBe(3968.02)
  })
  it('orders events without mutating the source', () => {
    const reversed = [...featured.events].reverse()
    expect(orderedEvents(reversed)).toEqual(featured.events)
    expect(reversed[0]).toEqual(linked)
  })
  it('links only reconstructed events; informational goals and saves have no links or play controls', () => {
    const html = renderToStaticMarkup(<MemoryRouter><EventTimeline match={featured} /></MemoryRouter>)
    expect((html.match(/<a /g) ?? []).length).toBe(1)
    expect(html).toContain('/matches/vesper-tidal/moments/vesper-tidal-merrick')
    expect((html.match(/data-testid="informational-event"/g) ?? []).length).toBe(3)
    expect(html).not.toContain('<button')
    expect(html).toContain('Kian Merrick')
  })
  it('renders all clubs and standings arithmetic in an accessible table', () => {
    const html = renderToStaticMarkup(<StandingsTable league={league} rows={rows} />)
    expect(html).toContain('<caption')
    expect(html).toContain('scope="row"')
    league.clubs.forEach(c => expect(html).toContain(c.name))
    expect((html.match(/<tr>/g) ?? []).length).toBe(11)
  })
  it('provides loading and retryable failure states without substitute results', () => {
    expect(renderToStaticMarkup(<DataState />)).toContain('role="status"')
    const html = renderToStaticMarkup(<DataState error={new Error('Network failed')} retry={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Retry connection')
    expect(html).not.toContain('2 – 1')
  })
})

describe('route-to-replay integrity', () => {
  it('resolves all three canonical outcomes and identities', () => {
    for (const match of matches.filter(m => m.status === 'finished')) {
      const e = match.events.find(e => e.replay)!
      const result = resolveReplay(match, e.id, scenarios)!
      expect(result.reference.scenarioId).toBe(e.replay!.scenarioId)
      expect(result.event.playerName).toBe(e.playerName)
    }
    const miss = matches[2].events.find(e => e.replay)!
    expect(miss.type).toBe('major_miss')
    expect(resolveReplay(matches[2], miss.id, scenarios)?.reference.eventId).toBe('miss')
  })
  it('rejects invalid, absent, cross-match, mismatched, or mistimed references', () => {
    expect(resolveReplay(featured, 'missing', scenarios)).toBeNull()
    expect(resolveReplay(featured, featured.events[0].id, scenarios)).toBeNull()
    expect(resolveReplay(matches[3], linked.id, scenarios)).toBeNull()
    const bad = (changes: object) => ({ ...featured, events: featured.events.map(e => e.id === linked.id ? { ...e, ...changes } : e) })
    for (const changes of [{ playerName: 'Someone else' }, { type: 'major_miss' }, { matchSeconds: 4000 }, { matchId: 'aurora-boreal' }, { replay: null }, { replay: { ...linked.replay, scenarioId: 'missing' } }, { replay: { ...linked.replay, eventId: 'shot' } }, { replay: { ...linked.replay, startTime: Infinity } }, { replay: { ...linked.replay, startTime: 12 } }]) {
      expect(resolveReplay(bad(changes), linked.id, scenarios)).toBeNull()
    }
  })
  it('cleans all transient replay state on same-scenario re-entry and scenario changes', () => {
    resetReplaySession('the-untouched-pass', 3.8)
    const state = replayStore.getState()
    state.selectPlayer('v9'); state.setCamera('pov:v9'); state.toggleTrails(); state.setSpeed(2)
    useTactics.getState().setEnabled(true)
    state.play(); state.beginScrub()
    resetReplaySession('the-untouched-pass')
    expect(replayStore.getState()).toMatchObject({ playing: false, speed: 1, camera: 'broadcast', selectedId: null, guided: null, trails: false, scrubbing: false, resumeAfterScrub: false })
    expect(replayStore.getState().readTime()).toBe(0)
    expect(useTactics.getState()).toMatchObject({ enabled: false, bundle: null, status: 'idle' })
    resetReplaySession('the-missed-chance', 8)
    expect(replayStore.getState().scenario.id).toBe('the-missed-chance')
    expect(replayStore.getState().readTime()).toBe(8)
    resetReplaySession('the-invisible-run')
  })
})

describe('league API boundary', () => {
  it('fetches and validates the actual response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog.league))))
    expect(await getLeague(new AbortController().signal)).toEqual(league)
  })
  it('exposes network errors, malformed data and unknown-match HTTP status', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(new Response('{"clubs":[]}')).mockResolvedValueOnce(new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    await expect(getLeague(new AbortController().signal)).rejects.toThrow('Check the API')
    await expect(getLeague(new AbortController().signal)).rejects.toThrow('could not be verified')
    await expect(getMatch('missing', league, new AbortController().signal)).rejects.toMatchObject({ status: 404 })
  })
  it('rejects wrong match IDs, invalid goal counts, duplicate clubs and broken player membership', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(featured))))
    await expect(getMatch('wrong', league, new AbortController().signal)).rejects.toBeInstanceOf(LeagueApiError)
    expect(() => validateMatch({ ...featured, score: { home: 3, away: 1 } }, league)).toThrow()
    expect(() => validateLeague({ ...league, clubs: league.clubs.map(() => league.clubs[0]) })).toThrow()
    expect(() => validateMatch({ ...featured, events: featured.events.map(e => ({ ...e, playerId: 'missing' })) }, league)).toThrow()
    expect(() => validateStandings(rows.map(r => ({ ...r, points: 100 })), league)).toThrow()
  })
  it('loads independent overview requests together and validates the round', async () => {
    const summaries = catalog.matches.map(m => ({ ...m, analyzedEvent: m.events.find(e => e.replay) ?? null }))
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/fixtures') ? summaries : rows)))))
    const result = await getOverview(league, new AbortController().signal)
    expect(result.fixtures).toHaveLength(5)
    expect(result.standings).toHaveLength(10)
  })
})
