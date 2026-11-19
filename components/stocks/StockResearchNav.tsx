'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import {
  stockResearchHref,
  stockResearchKeyFromPath,
  stockResearchPrimaryItems,
  TICKER_TAB_SWIPE_EVENT,
  type TickerTabSwipeDetail,
} from '@/components/stocks/stock-nav-config'
import { useDisplayCurrencyParam } from '@/hooks/useDisplayCurrency'
import { withDisplayCurrency } from '@/lib/display-currency'
import styles from './StockResearchNav.module.css'

type ActiveRail = {
  left: number
  width: number
  ready: boolean
}

// A tab chosen while its route is still on its way stays selected this long at most.
const CHOSEN_TIMEOUT_MS = 10000

const order = (key: string) => stockResearchPrimaryItems.findIndex((item) => item.key === key)

/**
 * Whether a chosen tab is still on its way: the address is on the tab it was
 * chosen from, or on a tab between the two (swiped past in a chain). Arrived, or
 * moved anywhere else (browser back), the address decides again.
 */
function chosenStillOnItsWay(chosen: { key: string; from: string } | null, activeKey: string) {
  if (!chosen || chosen.key === activeKey) return false
  const at = order(activeKey), from = order(chosen.from), to = order(chosen.key)
  return at >= Math.min(from, to) && at <= Math.max(from, to)
}

export default function StockResearchNav({ ticker }: { ticker: string }) {
  const pathname = usePathname()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLSpanElement>(null)
  const restingRail = useRef({ left: 0, width: 0 })
  const [activeRail, setActiveRail] = useState<ActiveRail>({ left: 0, width: 0, ready: false })
  const activeKey = stockResearchKeyFromPath(pathname)
  // The display currency travels with the reader from tab to tab.
  const displayCurrency = useDisplayCurrencyParam()
  // The tab the reader has just chosen (a click or a swipe), selected at once
  // rather than when its route arrives. The page itself (aria-current) is still
  // the one on screen until then.
  const [chosen, setChosen] = useState<{ key: string; from: string } | null>(null)
  const shownKey = chosenStillOnItsWay(chosen, activeKey) ? chosen!.key : activeKey
  const placedOnce = useRef(false)

  useEffect(() => {
    if (!chosen) return
    // A route that never arrives gives the bar back to the address.
    const timer = window.setTimeout(() => setChosen(null), CHOSEN_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [chosen])

  useEffect(() => {
    const syncActiveRail = (animate: boolean) => {
      const scroller = scrollerRef.current
      const activeItem = scroller?.querySelector<HTMLElement>('[data-active="true"]')
      if (!scroller || !activeItem) return

      setActiveRail({ left: activeItem.offsetLeft, width: activeItem.offsetWidth, ready: true })
      const centeredLeft = activeItem.offsetLeft - (scroller.clientWidth - activeItem.offsetWidth) / 2
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // The bar slides to a newly chosen tab; it is placed without motion on arrival and resize.
      scroller.scrollTo({ left: Math.max(0, centeredLeft), behavior: animate && !reduced ? 'smooth' : 'auto' })
    }

    syncActiveRail(placedOnce.current)
    placedOnce.current = true
    const onResize = () => syncActiveRail(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [shownKey])

  const choose = (event: MouseEvent<HTMLAnchorElement>, key: string) => {
    // A new tab or window, or another handler, leaves this page where it is.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    setChosen(key === activeKey ? null : { key, from: activeKey })
  }

  // During a sideways swipe the rail slides toward the neighbouring tab with the finger.
  useEffect(() => {
    const onSwipe = (event: Event) => {
      const rail = railRef.current
      const scroller = scrollerRef.current
      if (!rail || !scroller) return
      const { progress, from: start, committed } = (event as CustomEvent<TickerTabSwipeDetail>).detail
      // A committed swipe selects its tab now, not when the tab arrives.
      const committedKey = committed === undefined ? undefined : stockResearchPrimaryItems[committed]?.key
      if (committedKey) {
        const here = stockResearchKeyFromPath(window.location.pathname)
        // A chain keeps the tab it started from, so tabs swiped past stay in between.
        setChosen((previous) => committedKey === here ? null : { key: committedKey, from: chosenStillOnItsWay(previous, here) ? previous!.from : here })
      }
      if (progress === null) {
        // Back to where React placed it, easing.
        rail.style.transition = ''
        rail.style.setProperty('--active-rail-left', `${restingRail.current.left}px`)
        rail.style.setProperty('--active-rail-width', `${restingRail.current.width}px`)
        return
      }
      const items = Array.from(scroller.querySelectorAll<HTMLElement>('[data-active]'))
      const current = start ?? items.findIndex((item) => item.dataset.active === 'true')
      const from = items[current]
      const to = items[current + Math.sign(progress)] ?? from
      if (!from || !to) return
      const share = Math.min(1, Math.abs(progress))
      const left = from.offsetLeft + (to.offsetLeft - from.offsetLeft) * share
      const width = from.offsetWidth + (to.offsetWidth - from.offsetWidth) * share
      // Follows the finger directly; a commit (±1) or a release back to a tab (0) eases.
      rail.style.transition = share === 1 || progress === 0 ? '' : 'none'
      rail.style.setProperty('--active-rail-left', `${left}px`)
      rail.style.setProperty('--active-rail-width', `${width}px`)
    }
    window.addEventListener(TICKER_TAB_SWIPE_EVENT, onSwipe)
    return () => window.removeEventListener(TICKER_TAB_SWIPE_EVENT, onSwipe)
  }, [])

  useEffect(() => {
    restingRail.current = { left: activeRail.left, width: activeRail.width }
  }, [activeRail])

  const railStyle = {
    '--active-rail-left': `${activeRail.left}px`,
    '--active-rail-width': `${activeRail.width}px`,
  } as CSSProperties

  return (
    <div className={styles.root} data-stock-research-nav="">
      <nav data-analytics-surface="ticker_research_nav" aria-label="Ticker research" className={styles.nav}>
        <div ref={scrollerRef} className={styles.scroller}>
          {stockResearchPrimaryItems.map((item) => {
            const selected = shownKey === item.key
            return (
              <div key={item.key} className={styles.item} data-active={selected}>
                <Link
                  prefetch={false}
                  href={withDisplayCurrency(stockResearchHref(ticker, item), displayCurrency)}
                  aria-current={activeKey === item.key ? 'page' : undefined}
                  onClick={(event) => choose(event, item.key)}
                  className={styles.link}
                >
                  <span className={styles.linkLabel}>{item.label}</span>
                </Link>
              </div>
            )
          })}
          <span
            ref={railRef}
            aria-hidden="true"
            className={styles.activeRail}
            data-ready={activeRail.ready}
            style={railStyle}
          />
        </div>
      </nav>
    </div>
  )
}
