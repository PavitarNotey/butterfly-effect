import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { TacticalMoment } from './types'

interface MomentPickerProps {
  moments: TacticalMoment[]
  selectedId: string
  onSelect: (moment: TacticalMoment) => void
}

interface PopoverPosition { top: number; left: number; width: number; maxHeight: number }

/** Compact semantic-button selector; the portal keeps its menu outside the
 * replay viewport's clipping boundary. */
export function MomentPicker({ moments, selectedId, onSelect }: MomentPickerProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const popoverId = useId(), valueId = useId()
  const selected = moments.find(moment => moment.id === selectedId) ?? moments[0]

  function options() {
    return Array.from(popover.current?.querySelectorAll<HTMLButtonElement>('[data-moment-option]') ?? [])
  }
  function close(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  function choose(moment: TacticalMoment) {
    onSelect(moment)
    close(true)
  }
  function onOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const buttons = options(), index = buttons.indexOf(event.currentTarget)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus()
    }
  }

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const edge = 8, gap = 7, width = Math.min(248, window.innerWidth - edge * 2)
      const below = window.innerHeight - rect.bottom - gap - edge
      const above = rect.top - gap - edge
      const useBelow = below >= 260 || below >= above
      const maxHeight = Math.min(260, Math.max(0, useBelow ? below : above))
      setPosition({ top: useBelow ? rect.bottom + gap : rect.top - gap - maxHeight, left: Math.max(edge, Math.min(rect.right - width, window.innerWidth - width - edge)), width, maxHeight })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const focus = requestAnimationFrame(() => options().find(button => button.dataset.momentId === selectedId)?.focus())
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !popover.current?.contains(target)) close()
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(focus)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, selectedId])

  return <>
    <button ref={trigger} className="moment-picker-trigger" type="button" aria-label="Analytical moment" aria-describedby={valueId} aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen(value => !value)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
    }}>
      <span id={valueId} className="moment-picker-value"><span>{selected.title}</span><time>{selected.start.toFixed(1)}s</time></span>
      <span className="moment-picker-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && position && createPortal(<div ref={popover} id={popoverId} className="moment-picker-popover" role="dialog" aria-modal="false" aria-label="Choose analytical moment" style={position}>
      <div className="moment-picker-heading">Analytical moments <span>{moments.length}</span></div>
      <ol className="moment-picker-options">{moments.map((moment, index) => <li key={moment.id}>
        <button type="button" data-moment-option data-moment-id={moment.id} aria-pressed={moment.id === selectedId} onKeyDown={onOptionKeyDown} onClick={() => choose(moment)}>
          <span className="moment-picker-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="moment-picker-name">{moment.title}</span>
          <time>{moment.start.toFixed(1)}s</time>
        </button>
      </li>)}</ol>
    </div>, document.body)}
  </>
}
