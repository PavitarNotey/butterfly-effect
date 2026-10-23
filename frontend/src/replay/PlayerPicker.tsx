import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Scenario } from './types'
import { playerMatches } from './playerFilter'

interface PlayerPickerProps {
  scenario: Scenario
  selectedId: string | null
  onSelect: (id: string) => void
}

/** One semantic roster picker serves inspection and camera workflows. The list
 * uses real buttons so every pointer action has the same keyboard equivalent. */
export function PlayerPicker({ scenario, selectedId, onSelect }: PlayerPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const dialogId = useId(), searchId = useId(), statusId = useId()
  const selected = scenario.players.find(player => player.id === selectedId)
  const filtered = useMemo(() => scenario.players.filter(player => playerMatches(player, query)), [scenario, query])
  const filteredIds = useMemo(() => new Set(filtered.map(player => player.id)), [filtered])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    if (window.matchMedia('(pointer: fine)').matches) requestAnimationFrame(() => search.current?.focus())
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function optionButtons() {
    return Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-player-option]') ?? [])
  }
  function focusOption(index: number) {
    const options = optionButtons()
    options[Math.max(0, Math.min(options.length - 1, index))]?.focus()
  }
  function onOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const options = optionButtons(), index = options.indexOf(event.currentTarget)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); focusOption(index + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); focusOption(event.key === 'Home' ? 0 : options.length - 1)
    }
  }
  function choose(id: string) {
    onSelect(id); setOpen(false); trigger.current?.focus()
  }

  return <div className="player-picker" ref={root}>
    <button ref={trigger} className="player-picker-trigger" type="button" aria-label="Open player picker" aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">{selected ? selected.number : '22'}</span>
      <b>{selected ? selected.name : 'Choose Player'}</b>
      <i aria-hidden="true">⌃</i>
    </button>
    {open ? <section id={dialogId} className="player-picker-popover" role="dialog" aria-modal="false" aria-label="Choose a player">
      <header><div><strong>Player Roster</strong><span>{filtered.length} of {scenario.players.length} players</span></div><button type="button" className="picker-close" aria-label="Close player picker" onClick={() => { setOpen(false); trigger.current?.focus() }}>×</button></header>
      <label htmlFor={searchId}>Search Players</label>
      <div className="player-search"><span aria-hidden="true">⌕</span><input ref={search} id={searchId} name="player-search" type="search" autoComplete="off" placeholder="Search name, number or position…" value={query} aria-describedby={statusId} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(0) }
        if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(optionButtons().length - 1) }
      }} /></div>
      <span id={statusId} className="sr-only" role="status" aria-live="polite">{filtered.length} players found</span>
      <div className="player-picker-list" tabIndex={-1}>
        {scenario.teams.map(team => {
          const players = scenario.players.filter(player => player.teamId === team.id && filteredIds.has(player.id))
          if (!players.length) return null
          return <section className="picker-team" key={team.id} aria-labelledby={`${dialogId}-${team.id}`}>
            <h3 id={`${dialogId}-${team.id}`}><span style={{ backgroundColor: team.color }} />{team.name}<small>{players.length}</small></h3>
            <ul>{players.map(player => <li key={player.id}>
              <button type="button" data-player-option data-player-id={player.id} data-testid={`player-option-${player.id}`} aria-pressed={selectedId === player.id} onKeyDown={onOptionKeyDown} onClick={() => choose(player.id)}>
                <span className="picker-number" style={{ color: team.color }}>{player.number}</span><span className="picker-name"><b>{player.name}</b><small>{player.role}</small></span><span className="picker-check" aria-hidden="true">{selectedId === player.id ? '✓' : '›'}</span>
              </button>
            </li>)}</ul>
          </section>
        })}
        {!filtered.length ? <p className="picker-empty">No players match “{query}”.</p> : null}
      </div>
    </section> : null}
  </div>
}
