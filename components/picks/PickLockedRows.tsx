import Link from 'next/link'
import { Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'

/**
 * The rows an anonymous reader does not get.
 *
 * These placeholders are built from a rank number and nothing else. There is no
 * blurred real data here and no hidden payload behind them, because the rows they
 * stand for were dropped server-side in `lib/picks-access.ts` before this component
 * was reached — `lockedCount` is a number, not a list.
 */
export default function PickLockedRows({
  lockedCount,
  visibleCount,
  totalRanked,
  readingLabel,
}: {
  lockedCount: number
  visibleCount: number
  totalRanked: number
  readingLabel: string
}) {
  if (lockedCount <= 0) return null

  const previewRows = Math.min(lockedCount, 4)

  return (
    <Card padding="none" className="rounded-[var(--radius-2xl)] p-6 md:p-7">
      <div className="text-caption inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Ranks {visibleCount + 1}–{totalRanked}
      </div>

      <h2 className="text-section-title mt-4 text-content-primary">
        {lockedCount} more {readingLabel.toLowerCase()} names.
      </h2>
      <p className="text-body mt-2 max-w-[56ch]">
        You are seeing the top {visibleCount}. Create a free account to open the rest of the
        ranking — no card, no trial.
      </p>

      <ul className="mt-5 flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: previewRows }, (_, index) => (
          <li
            key={index}
            className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface-elevated px-4 py-3"
          >
            <span className="numeric-tabular text-caption w-10 shrink-0 text-content-muted">
              {visibleCount + index + 1}
            </span>
            <span className="h-3 w-24 rounded-full bg-content-muted/20" />
            <span className="hidden h-3 flex-1 rounded-full bg-content-muted/12 sm:block" />
            <Lock className="h-3.5 w-3.5 shrink-0 text-content-muted/70" />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/sign-up" data-analytics-id="picks_locked_sign_up" data-analytics-event="auth_start" data-analytics-intent="sign_up" className={buttonClass({ variant: 'primary' })}>
          Create a free account
        </Link>
        <Link href="/sign-in" data-analytics-id="picks_locked_sign_in" data-analytics-event="auth_start" data-analytics-intent="sign_in" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          I already have one
        </Link>
      </div>
    </Card>
  )
}
