import type { Fixture, League, MatchKeyEvent } from './types'

export function matchMinute(event: Pick<MatchKeyEvent, 'minute' | 'stoppageTime'>) {
  return `${event.minute}${event.stoppageTime ? `+${event.stoppageTime}` : ''}′`
}

export function scoreText(fixture: Pick<Fixture, 'status' | 'score'>) {
  return fixture.status === 'finished' && fixture.score ? `${fixture.score.home} – ${fixture.score.away}` : 'Upcoming'
}

// The same explicit timezone on every device, independent of browser settings.
export function kickoffText(kickoff: string) {
  return `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(kickoff))} UTC`
}

export function orderedEvents(events: MatchKeyEvent[]) {
  return [...events].sort((a, b) => a.matchSeconds - b.matchSeconds || a.id.localeCompare(b.id))
}

export function momentPath(match: Pick<Fixture, 'id'>, event: Pick<MatchKeyEvent, 'id'>) {
  return `/matches/${encodeURIComponent(match.id)}/moments/${encodeURIComponent(event.id)}`
}

export function clubFor(league: League, id: string) { return league.clubs.find(c => c.id === id)! }
