'use client'

import { Fragment, useEffect, useState, type CSSProperties, type FocusEvent } from 'react'
import Link from 'next/link'
import { ChartNetwork } from 'lucide-react'
import HeaderSearch from '@/components/HeaderSearch'
import { PICK_READING_CONTENT, PICK_READING_KEYS } from '@/lib/picks-content'

const HEADLINE = 'Be a better investor'
const READINGS = PICK_READING_KEYS.map((key) => PICK_READING_CONTENT[key].label).join(' · ')

/**
 * Homepage hero search.
 *
 * At the top it's the centrepiece of the first screen — a large centred search
 * with an editorial heading above and a compact correlations action below. On scroll it lifts
 * and fades as the small in-flow header pill search takes over (see .dock-search
 * in globals.css).
 *
 * While it's focused it tells the constellation (via a `meridian:search-focus`
 * window event) to zoom out and blur — "scanning the universe" for the ticker.
 */
function emit(focused: boolean) {
  window.dispatchEvent(new CustomEvent('meridian:search-focus', { detail: { focused } }))
}

export default function DockingSearch() {
  const [revealReady, setRevealReady] = useState(false)
  const onFocus = () => emit(true)
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Only when focus truly leaves the search, not when moving within it.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) emit(false)
  }

  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) setRevealReady(true)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div data-dock-search className="dock-search" data-reveal-ready={revealReady ? 'true' : 'false'} onFocus={onFocus} onBlur={onBlur}>
      <div className="dock-search__intro">
        <h1 className="dock-search__title" aria-label={HEADLINE}>
          {HEADLINE.split(' ').map((word, wordIndex) => (
            <Fragment key={word}>
              <span className="dock-search__word" aria-hidden="true" style={{ ['--i' as string]: wordIndex } as CSSProperties}>{word}</span>
              {wordIndex < HEADLINE.split(' ').length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </h1>
        <p className="dock-search__subtitle">{"Don't guess. Analyze."}</p>
      </div>
      <div className="dock-search__field">
        <HeaderSearch className="w-full" maxSuggestions={4} placeholder="Search a ticker or company…" />
      </div>
      <div className="dock-search__support">
        <Link
          href="/markets/network"
          className="dock-search__cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
          aria-label="Open correlations network"
          title="Open correlations network"
        >
          <ChartNetwork className="dock-search__cta-icon size-4" aria-hidden="true" />
          <span className="dock-search__cta-label">Correlations</span>
        </Link>
      </div>
      <p className="dock-search__readings">{READINGS}</p>
    </div>
  )
}
