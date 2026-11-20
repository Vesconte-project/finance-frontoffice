'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import SegmentedControl from '@/components/ui/SegmentedControl'
import styles from './HomeMarketStory.module.css'

const OPTIONS = ['US tech giants', 'Across markets'] as const

export default function HomeAtlasPreview({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<(typeof OPTIONS)[number]>(OPTIONS[0])
  const concentrated = selection === OPTIONS[0]

  return (
    <div className={styles.atlasPreview} data-home-portfolio={concentrated ? 'tech' : 'spread'}>
      <div className={styles.atlasIntro}>
        <p className={styles.kicker}>Market Atlas</p>
        <h2 id="home-atlas-title">How diversified are you?</h2>
        <div className={styles.portfolioSummary} aria-live="polite">
          <p data-portfolio-copy="tech" aria-hidden={!concentrated}>
            In this example, Apple, Microsoft, Nvidia, Alphabet and Meta sit in the same region.
          </p>
          <p data-portfolio-copy="spread" aria-hidden={concentrated}>
            In this example, five companies from different industries sit in five regions.
          </p>
        </div>
        <SegmentedControl options={OPTIONS} value={selection} onChange={setSelection} ariaLabel="Example portfolio" className={styles.portfolioChoice} />
        <Link href="/markets/network" prefetch={false} className={styles.link}>
          Open Market Atlas <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {children}
    </div>
  )
}
