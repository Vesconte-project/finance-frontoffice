import type { ReactNode } from 'react'
import RankingsNav from '@/components/picks/RankingsNav'
import RankingsUniverse from '@/components/picks/RankingsUniverse'
import type { PickReadingKey } from '@/lib/picks-content'
import styles from './Rankings.module.css'

/** The page frame: the universe behind the header band, the content over it. */
export function RankingsStage({ seed, children, ...rest }: { seed: string; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className={styles.stage} {...rest}>
      <RankingsUniverse seed={seed} />
      <div className={styles.page}>{children}</div>
    </div>
  )
}

/**
 * The header band. Its node is where the universe turns around; the band's
 * bottom edge is where the sky fades out.
 */
export function RankingsHeader({
  eyebrow,
  title,
  subtitle,
  stamp,
  active,
}: {
  eyebrow: string
  title: ReactNode
  subtitle: ReactNode
  stamp: string | null
  active: PickReadingKey | 'weekly'
}) {
  return (
    <header className={styles.head} data-rankings-band="">
      <div className={styles.titleRow}>
        <div>
          <div className={styles.eyebrowRow}>
            <span className={styles.node} data-rankings-anchor="" aria-hidden="true" />
            <p className={styles.eyebrow}>{eyebrow}</p>
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {stamp ? (
          <span className={styles.stamp}>
            <span className={styles.stampDot} aria-hidden="true" />
            {stamp}
          </span>
        ) : null}
      </div>
      <RankingsNav active={active} />
    </header>
  )
}
