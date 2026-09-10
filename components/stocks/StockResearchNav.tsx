'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import {
  stockResearchHref,
  stockResearchKeyFromPath,
  stockResearchPrimaryItems,
} from '@/components/stocks/stock-nav-config'
import styles from './StockResearchNav.module.css'

type ActiveRail = {
  left: number
  width: number
  ready: boolean
}

export default function StockResearchNav({ ticker }: { ticker: string }) {
  const pathname = usePathname()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeRail, setActiveRail] = useState<ActiveRail>({ left: 0, width: 0, ready: false })
  const activeKey = stockResearchKeyFromPath(pathname)

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
                  href={stockResearchHref(ticker, item)}
                  aria-current={selected ? 'page' : undefined}
                  className={styles.link}
                >
                  <span className={styles.linkLabel}>{item.label}</span>
                </Link>
              </div>
            )
          })}
          <span
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
