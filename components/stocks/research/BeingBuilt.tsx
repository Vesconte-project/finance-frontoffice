import type { ReactNode } from 'react'
import styles from './BeingBuilt.module.css'

/**
 * The final place of a block whose data has not arrived yet.
 *
 * It shows the block's label, one sentence telling the reader what will appear
 * here, and the "Being built" badge — never a value, a dash, a zero or sample
 * data. It keeps the block's eventual size (`size`), so the page does not move
 * when the data lands. The sentence talks to the reader, not to the team.
 */
export default function BeingBuilt({
  label,
  children,
  size = 'block',
  headingLevel = 'h3',
}: {
  /** The block's own label, as it will read once the data is there. */
  label?: string
  /** What the block will show, in one sentence for the reader. */
  children: ReactNode
  /** `chart` keeps a chart's height, `block` a card's, `inline` a single row's. */
  size?: 'chart' | 'block' | 'inline'
  headingLevel?: 'h2' | 'h3' | 'h4'
}) {
  const Heading = headingLevel
  return (
    <div className={styles.block} data-being-built data-size={size}>
      <div className={styles.head}>
        {label ? <Heading className={styles.label}>{label}</Heading> : null}
        <BeingBuiltBadge />
      </div>
      <p className={styles.message}>{children}</p>
    </div>
  )
}

/** The badge alone, for a row or a field that is not there yet. */
export function BeingBuiltBadge() {
  return <span className={styles.badge} data-being-built-badge>Being built</span>
}
