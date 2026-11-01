'use client'

import { Check, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { THEME_VERDICTS } from '@/lib/atlas-pro'
import type { AtlasTheme } from '@/lib/atlas-pro-model'
import type { Remote } from './use-atlas-json'
import styles from './AtlasPro.module.css'

/**
 * The ETF themes panel (pro-spec §4): what thematic ETFs hold together, as many as there are —
 * a search over a scrolling list, each with its size and whether prices confirm it. Picking one
 * highlights its companies; the map itself stays the same.
 */
export default function AtlasThemeMenu({ themes, theme, onPick }: {
  themes: Remote<AtlasTheme[]>
  theme: AtlasTheme | null
  onPick: (theme: AtlasTheme | null) => void
}) {
  const id = useId()
  const list = useRef<HTMLDivElement>(null)
  const [term, setTerm] = useState('')
  const items = themes.status === 'ok' ? themes.data : []
  const search = useRef<HTMLInputElement>(null)
  // opening the panel takes the keyboard into it: the search when there is one, else the current choice
  const ready = themes.status === 'ok'
  useEffect(() => {
    if (!ready) return
    if (search.current) search.current.focus()
    else list.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [ready])
  const needle = term.trim().toLowerCase()
  // a theme matches where one of its words starts: "ai" finds AI and Airlines, not Retail
  const shown = needle ? items.filter((item) => item.label.toLowerCase().split(/[^a-z0-9]+/).some((word) => word.startsWith(needle)) || item.label.toLowerCase().startsWith(needle)) : items
  // arrows move between the choices, as in any radio group
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const radios = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])]
    const index = radios.indexOf(document.activeElement as HTMLButtonElement)
    radios[(index + (event.key === 'ArrowDown' ? 1 : radios.length - 1)) % radios.length]?.focus()
    event.preventDefault()
  }
  const choice = (key: string, checked: boolean, onClick: () => void, body: ReactNode) => (
    <button key={key} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1} onClick={onClick}>
      <span className={styles.themeCheck} aria-hidden="true">{checked ? <Check size={13} /> : null}</span>
      {body}
    </button>
  )
  return (
    <>
      {items.length > 6 ? (
        <label className={styles.themeSearch}>
          <Search size={14} aria-hidden="true" />
          <input ref={search} type="search" placeholder="Find a theme" aria-label="Find an ETF theme" value={term} onChange={(event) => setTerm(event.target.value)} autoComplete="off" />
        </label>
      ) : null}
      <div ref={list} id={`${id}-list`} className={styles.themeList} role="radiogroup" aria-label="ETF theme" onKeyDown={onKey}>
        {choice('all', theme === null, () => onPick(null), <span className={styles.themeName}>All companies</span>)}
        {shown.map((item) => {
          const verdict = item.verdict ? THEME_VERDICTS[item.verdict][0] : null
          return choice(item.themeId, theme?.themeId === item.themeId, () => onPick(item), (
            <>
              <span className={styles.themeName}>{item.label}</span>
              {verdict ? <i className={styles.themeVerdict} data-verdict={item.verdict} title={verdict} aria-label={verdict} /> : null}
              <small>{item.memberCount}</small>
            </>
          ))
        })}
      </div>
      {themes.status === 'loading' || themes.status === 'idle' ? <p className={styles.layerNote} role="status">Loading ETF themes…</p> : null}
      {themes.status === 'error' || themes.status === 'denied' ? <p className={styles.layerNote}>ETF themes could not load.</p> : null}
      {themes.status === 'ok' && !items.length ? <p className={styles.layerNote}>No ETF themes this week.</p> : null}
      {needle && items.length && !shown.length ? <p className={styles.layerNote}>No theme by that name.</p> : null}
      {items.some((item) => item.verdict) ? (
        <p className={styles.themeKey}>
          <i className={styles.themeVerdict} data-verdict="together" aria-hidden="true" /> prices confirm it
          <i className={styles.themeVerdict} data-verdict="apart" aria-hidden="true" /> they do not
        </p>
      ) : null}
    </>
  )
}
