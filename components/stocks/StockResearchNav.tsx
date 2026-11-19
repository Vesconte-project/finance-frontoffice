'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

export default function StockResearchNav({ ticker }: { ticker: string }) {
  const pathname = usePathname()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLSpanElement>(null)
  const restingRail = useRef({ left: 0, width: 0 })
  const [activeRail, setActiveRail] = useState<ActiveRail>({ left: 0, width: 0, ready: false })
  const activeKey = stockResearchKeyFromPath(pathname)
  // The display currency travels with the reader from tab to tab.
  const displayCurrency = useDisplayCurrencyParam()

  useEffect(() => {
    const syncActiveRail = () => {
      const scroller = scrollerRef.current
      const activeItem = scroller?.querySelector<HTMLElement>('[data-active="true"]')
      if (!scroller || !activeItem) return

      setActiveRail({ left: activeItem.offsetLeft, width: activeItem.offsetWidth, ready: true })
      const centeredLeft = activeItem.offsetLeft - (scroller.clientWidth - activeItem.offsetWidth) / 2
      scroller.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'auto' })
    }

    syncActiveRail()
    window.addEventListener('resize', syncActiveRail)
    return () => window.removeEventListener('resize', syncActiveRail)
  }, [activeKey])

  // During a sideways swipe the rail slides toward the neighbouring tab with the finger.
  useEffect(() => {
    const onSwipe = (event: Event) => {
      const rail = railRef.current
      const scroller = scrollerRef.current
      if (!rail || !scroller) return
      const { progress } = (event as CustomEvent<TickerTabSwipeDetail>).detail
      if (progress === null) {
        // Back to where React placed it, easing.
        rail.style.transition = ''
        rail.style.setProperty('--active-rail-left', `${restingRail.current.left}px`)
        rail.style.setProperty('--active-rail-width', `${restingRail.current.width}px`)
        return
      }
      const items = Array.from(scroller.querySelectorAll<HTMLElement>('[data-active]'))
      const current = items.findIndex((item) => item.dataset.active === 'true')
      const from = items[current]
      const to = items[current + Math.sign(progress)]
      if (!from || !to) return
      const share = Math.min(1, Math.abs(progress))
      const left = from.offsetLeft + (to.offsetLeft - from.offsetLeft) * share
      const width = from.offsetWidth + (to.offsetWidth - from.offsetWidth) * share
      // Follows the finger directly; a commit (±1) or release eases.
      rail.style.transition = share === 1 ? '' : 'none'
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
            const selected = activeKey === item.key
            return (
              <div key={item.key} className={styles.item} data-active={selected}>
                <Link
                  prefetch={false}
                  href={withDisplayCurrency(stockResearchHref(ticker, item), displayCurrency)}
                  aria-current={selected ? 'page' : undefined}
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
