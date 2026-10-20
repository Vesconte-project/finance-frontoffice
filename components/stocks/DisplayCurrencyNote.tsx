import { displayCurrencySummary, type DisplayCurrencyReport } from '@/lib/display-currency'
import styles from './DisplayCurrencyNote.module.css'

/**
 * The line under the ticker chrome when amounts are shown in a display
 * currency: what the figures are, and how many could not be converted.
 */
export default function DisplayCurrencyNote({
  report,
  spaced = false,
}: {
  report: DisplayCurrencyReport | null | undefined
  /** Above a research tab, which has no spacing of its own for a line before it. */
  spaced?: boolean
}) {
  const summary = displayCurrencySummary(report)
  if (!summary) return null
  return (
    <p className={styles.note} data-spaced={spaced || undefined} data-display-currency-note={report?.target ?? ''}>
      <span>{summary.lead}</span>
      {summary.gaps ? <span className={styles.gaps} data-display-currency-gaps="">{summary.gaps}</span> : null}
    </p>
  )
}
