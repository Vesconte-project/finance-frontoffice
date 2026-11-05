import type { CanonicalAvailability } from '@/lib/canonical-research'
import { isoCurrency } from '@/lib/display-currency'
import styles from './CurrencyNotice.module.css'

type Part = { label: string; read: (CanonicalAvailability & { rows?: unknown[] }) | null | undefined }

/** The parts of a tab that were asked for in the display currency but stay as reported. */
export function keptAsReported(parts: readonly Part[]): string[] {
  return parts
    .filter(({ read }) => read?.available && (read.rows?.length ?? 0) > 0 && read.displayCurrency && !read.displayCurrency.converted)
    .map(({ label }) => label)
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * One line at the top of a ticker tab when a display currency is chosen and
 * some of the tab stays in the listing's currency, because the backend has no
 * rate for some of its dates. Each part is shown whole in one currency, never
 * mixed; this says which.
 */
export default function CurrencyNotice({ display, listing, kept, summaryConverted }: {
  /** The currency asked for, or null. */
  display: string | null
  listing: string
  /** Parts that stay in the listing's currency (`keptAsReported`). */
  kept: readonly string[]
  /** Whether the page's prices and market values are in `display`. */
  summaryConverted: boolean
}) {
  if (!display || display === (isoCurrency(listing) ?? listing)) return null
  const stays = summaryConverted ? kept : ['prices and market values', ...kept]
  if (!stays.length) return null
  const text = list(stays)
  return (
    <p className={styles.notice} role="note" data-currency-notice={display}>
      <span>Shown in {display}.</span> {text[0].toUpperCase() + text.slice(1)} {stays.length === 1 && !/s$/.test(stays[0]) ? 'stays' : 'stay'} in {listing}: some of their dates have no {display} rate, and a chart never mixes currencies.
    </p>
  )
}
