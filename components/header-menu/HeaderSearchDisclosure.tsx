'use client'

import type { Ref } from 'react'
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
  return (
    <div
      id={id}
      ref={fieldRef}
      data-mobile-search
      className="site-header__search-field"
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      {/* Six rows fit between the bar and an open phone keyboard. */}
      <HeaderSearch className="site-header__search-combobox" maxSuggestions={6} />
      <button type="button" className="site-header__search-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
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
