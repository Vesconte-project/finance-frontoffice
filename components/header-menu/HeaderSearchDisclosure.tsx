'use client'

import { useEffect, useState, type Ref } from 'react'
import { Search } from 'lucide-react'
import HeaderSearch from '@/components/HeaderSearch'
import HeaderMenuTrigger from '@/components/header-menu/HeaderMenuTrigger'

/**
 * Compact-screen search, folded into the header bar.
 *
 * The trigger is an icon among the bar's other controls. Opening grows the
 * field out of the icon until it covers the bar (CSS clip from the icon's
 * measured edges), with the suggestions dropping below on the same surface.
 * The field stays mounted so it can take focus inside the opening tap, which
 * is what lets mobile browsers raise the keyboard.
 */
export function HeaderSearchTrigger({
  expanded,
  controls,
  onToggle,
}: {
  expanded: boolean
  controls: string
  onToggle: (trigger: HTMLButtonElement, viaKeyboard: boolean) => void
}) {
  return (
    <HeaderMenuTrigger
      expanded={expanded}
      controls={controls}
      label="Search tickers or companies"
      onToggle={onToggle}
      className="site-header__search-trigger"
    >
      <Search className="size-[18px]" aria-hidden="true" />
    </HeaderMenuTrigger>
  )
}

export function HeaderSearchField({
  id,
  open,
  fieldRef,
  onCancel,
}: {
  id: string
  open: boolean
  fieldRef?: Ref<HTMLDivElement>
  onCancel: () => void
}) {
  const rows = useFittingSuggestionRows(open)
  return (
    <div
      id={id}
      ref={fieldRef}
      data-mobile-search
      className="site-header__search-field"
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <HeaderSearch className="site-header__search-combobox" maxSuggestions={rows} />
      <button type="button" className="site-header__search-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

/* Matches the compact row in globals.css: 48px plus its 1px divider. */
const ROW_HEIGHT = 49
const BAR_HEIGHT = 56
const PANEL_PADDING = 12
const MIN_ROWS = 4
// The combobox caps its list at 448px, which holds eight whole rows.
const MAX_ROWS = 8

/**
 * As many suggestions as fit between the bar and the bottom of the visible
 * viewport, which the on-screen keyboard shrinks — whole rows only, so none
 * sits half-hidden at the keyboard's edge.
 */
function useFittingSuggestionRows(open: boolean) {
  const [rows, setRows] = useState(8)
  useEffect(() => {
    if (!open) return
    const viewport = window.visualViewport
    const measure = () => {
      const height = viewport?.height ?? window.innerHeight
      const fit = Math.floor((height - BAR_HEIGHT - PANEL_PADDING) / ROW_HEIGHT)
      setRows(Math.min(MAX_ROWS, Math.max(MIN_ROWS, fit)))
    }
    measure()
    viewport?.addEventListener('resize', measure)
    return () => viewport?.removeEventListener('resize', measure)
  }, [open])
  return rows
}

/** Measures where the field should grow from, then focuses it. */
export function openSearchFromTrigger(
  bar: HTMLElement | null,
  field: HTMLElement | null,
  trigger: HTMLElement
) {
  if (!bar || !field) return
  const barRect = bar.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  bar.style.setProperty('--search-from-left', `${Math.max(0, triggerRect.left - barRect.left)}px`)
  bar.style.setProperty('--search-from-right', `${Math.max(0, barRect.right - triggerRect.right)}px`)
  // React clears `inert` on the next render; focus has to land in this tap.
  field.inert = false
  field.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
}
