import type { AmountView } from '@/lib/display-currency'
import { cn } from '@/lib/utils'
import styles from './Money.module.css'

/**
 * One amount as the page shows it (see lib/display-currency.ts): the figure,
 * the reported amount beside a converted one ("$54.12 · ₩75,000"), or the
 * reported amount with a "not in USD" marker whose reason is in a tooltip and
 * in text for screen readers. The marker takes focus so the reason can be read
 * from the keyboard too.
 */
export default function Money({
  view,
  fallback = '—',
  className,
  showOriginal = true,
}: {
  view: AmountView | null
  fallback?: string
  className?: string
  /** False where there is no room: the original moves into the tooltip. */
  showOriginal?: boolean
}) {
  if (!view) return <span className={className}>{fallback}</span>
  const state = view.marker ? 'unconverted' : view.original ? 'converted' : 'reported'
  return (
    <span className={cn(styles.money, className)} data-money={state}>
      <span className={styles.figure} title={view.original && !showOriginal ? view.detail ?? undefined : undefined}>{view.text}</span>
      {view.original && showOriginal ? (
        <span className={styles.original} title={view.detail ?? undefined}>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, reported as </span>
          {view.original}
        </span>
      ) : null}
      {view.original && !showOriginal ? <span className="sr-only">, reported as {view.original}</span> : null}
      {view.marker ? (
        <span className={styles.marker} tabIndex={0} data-money-marker="">
          <span aria-hidden="true">{view.marker}</span>
          <span className="sr-only">{`, ${view.marker}. ${view.detail ?? ''}`}</span>
          {view.detail ? <span className={styles.tip} role="tooltip" aria-hidden="true">{view.detail}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
