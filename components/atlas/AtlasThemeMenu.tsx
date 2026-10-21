'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import type { AtlasTheme } from '@/lib/atlas-pro-model'
import type { Remote } from './use-atlas-json'
import base from './AtlasExplorer.module.css'
import styles from './AtlasPro.module.css'

/**
 * "Theme: All companies" (pro-spec §4): a menu of what thematic funds hold
 * together. Picking one highlights its companies; the map itself stays the same.
 */
export default function AtlasThemeMenu({ open, onOpen, themes, theme, onPick }: {
  open: boolean
  onOpen: (open: boolean) => void
  themes: Remote<AtlasTheme[]>
  theme: AtlasTheme | null
  onPick: (theme: AtlasTheme | null) => void
}) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const items = themes.status === 'ok' ? themes.data : []
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !button.current?.parentElement?.contains(event.target)) onOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, onOpen, themes.status])
  const pick = (next: AtlasTheme | null) => {
    onPick(next)
    onOpen(false)
    button.current?.focus()
  }
  const onKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
      event.preventDefault()
    } else if (event.key === 'Escape') {
      event.stopPropagation()
      onOpen(false)
      button.current?.focus()
    } else if (event.key === 'Tab') onOpen(false)
  }
  const label = theme ? `${theme.label} · ${theme.memberCount}` : 'All companies'
  return (
    <div className={styles.themeControl}>
      <button
        ref={button}
        type="button"
        className={base.pill}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => onOpen(!open)}
      >
        <span className={base.eyebrow}>Theme</span>
        <span className={styles.themeLabel}>{label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? (
        <ul ref={menu} id={`${id}-menu`} className={styles.menu} role="menu" aria-label="Theme" onKeyDown={onKey}>
          <li role="none">
            <button type="button" role="menuitemradio" aria-checked={theme === null} onClick={() => pick(null)}>All companies</button>
          </li>
          {themes.status === 'loading' ? <li role="none" className={styles.menuNote}>Loading themes…</li> : null}
          {themes.status === 'error' || themes.status === 'denied' ? <li role="none" className={styles.menuNote}>Themes could not load.</li> : null}
          {themes.status === 'ok' && !items.length ? <li role="none" className={styles.menuNote}>No themes this week.</li> : null}
          {items.map((item) => (
            <li role="none" key={item.themeId}>
              <button type="button" role="menuitemradio" aria-checked={theme?.themeId === item.themeId} onClick={() => pick(item)}>
                {item.label} <small>{item.memberCount}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
