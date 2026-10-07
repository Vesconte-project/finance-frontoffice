import Link from 'next/link'
import { PICK_READING_CONTENT, PICK_READING_KEYS, PICK_READING_TO_SLUG, type PickReadingKey } from '@/lib/picks-content'
import styles from './Rankings.module.css'

/** Moves between the three readings and the weekly cut. Links, because each is its own route. */
export default function RankingsNav({ active }: { active: PickReadingKey | 'weekly' }) {
  return (
    <nav className={styles.nav} aria-label="Rankings">
      {PICK_READING_KEYS.map((key) => (
        <Link
          key={key}
          href={`/picks/${PICK_READING_TO_SLUG[key]}`}
          className={styles.navLink}
          aria-current={active === key ? 'page' : undefined}
        >
          {PICK_READING_CONTENT[key].label}
        </Link>
      ))}
      <Link href="/picks/weekly" className={styles.navLink} aria-current={active === 'weekly' ? 'page' : undefined}>
        This week<span className={styles.navFree}>Free</span>
      </Link>
    </nav>
  )
}
