'use client'

import { usePathname } from 'next/navigation'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import {
  stockResearchKeyFromPath,
  stockResearchPrimaryItems,
} from '@/components/stocks/stock-nav-config'
import LoadingPulse from '@/components/ui/LoadingPulse'
import styles from './TickerResearchLoading.module.css'

function destination(pathname: string) {
  const item = stockResearchPrimaryItems.find(
    (candidate) => candidate.key === stockResearchKeyFromPath(pathname),
  )
  return {
    // An empty `loadingTitle` means the view has no page header of its own.
    // Read from the nav config rather than naming a route here, so a view that
    // drops its header does not have to be remembered in two places.
    title: item?.loadingTitle ?? item?.label ?? 'Research',
    // What is announced while it loads, which a view still needs even when it
    // shows no heading.
    announce: item?.label ?? 'Research',
  }
}

export default function TickerResearchLoading() {
  const pathname = usePathname()
  const { title, announce } = destination(pathname)

  const indicator = (
    <section className={styles.root} data-ticker-research-loading="">
      <LoadingPulse label={`Loading ${announce}`} />
    </section>
  )

  if (!title) return indicator

  return (
    <ResearchViewShell title={title} busy>
      {indicator}
    </ResearchViewShell>
  )
}
