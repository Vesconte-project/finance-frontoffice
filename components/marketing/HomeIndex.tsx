import Link from 'next/link'
import styles from './HomeIndex.module.css'

/**
 * The index of the product.
 *
 * The homepage names one capability — a ranked list — and a reader who stops
 * there believes the product is a table. Every destination below already exists
 * and was verified to resolve before it was linked; nothing here is a promise.
 *
 * It is deliberately an index and not a feature grid: one line per destination,
 * a capability in the reader's terms on the left and where it lives on the
 * right. No cards, no icons, no per-row copy. The heading is the section's
 * entire prose budget.
 */

type IndexEntry = {
  /** What the reader wants to do, in their words — not the product noun. */
  label: string
  /** Where it lives, named rather than pathed; the path is the href. */
  destination: string
  href: string
}

const ENTRIES: IndexEntry[] = [
  { label: 'Every company', destination: 'Company pages', href: '/stocks' },
  { label: 'Filter the universe', destination: 'Screener', href: '/screener' },
  { label: 'What moves with what', destination: 'Correlations', href: '/markets/network' },
  { label: 'Follow a name', destination: 'Watchlist', href: '/dashboard/watchlist' },
  { label: 'Know when it changes', destination: 'Alerts', href: '/dashboard/alerts' },
  { label: 'Test a thesis', destination: 'Model Lab', href: '/models' },
]

export default function HomeIndex() {
  return (
    <section className={styles.section} aria-labelledby="home-index-heading">
      <div className={styles.container}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 id="home-index-heading" className={styles.heading}>
              The rest of the work
            </h2>
          </div>

          <ul className={styles.list}>
            {ENTRIES.map((entry) => (
              <li key={entry.href} className={styles.item}>
                <Link href={entry.href} className={styles.row}>
                  <span className={styles.label}>{entry.label}</span>
                  <span className={styles.destination}>
                    <span aria-hidden="true" className={styles.arrow}>
                      →
                    </span>
                    {entry.destination}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
