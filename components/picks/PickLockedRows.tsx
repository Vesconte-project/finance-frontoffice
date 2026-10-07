import Link from 'next/link'
import { Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import type { PickTier } from '@/lib/picks-access-rules'

/**
 * The rows a reader is not entitled to.
 *
 * These placeholders are built from a rank number and nothing else. There is no
 * blurred real data here and no hidden payload behind them, because the rows they
 * stand for were dropped server-side in `lib/picks-access.ts` before this component
 * was reached — `lockedCount` is a number, not a list.
 *
 * The current ranking is paid. What stays free is pointed to rather than withheld:
 * a company's own standing on its page, and the weekly ranking.
 */
export default function PickLockedRows({
  lockedCount,
  visibleCount,
  totalRanked,
  readingLabel,
  tier,
}: {
  lockedCount: number
  visibleCount: number
  totalRanked: number
  readingLabel: string
  tier: PickTier
}) {
  if (lockedCount <= 0) return null

  const previewRows = Math.min(lockedCount, 4)

  return (
    <Card padding="none" className="rounded-[var(--radius-2xl)] p-6 md:p-7" data-picks-locked="">
      <div className="text-caption inline-flex w-fit items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Ranks {visibleCount + 1}–{totalRanked}
      </div>

      <h2 className="text-section-title mt-4 text-content-primary">
        {totalRanked} companies ranked on {readingLabel.toLowerCase()}.
      </h2>
      <p className="text-body mt-2 max-w-[60ch]">
        The current ranking is part of a paid plan. Where any single company stands is free on its own page,
        and one ranking a week is open to everyone.
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
        <Link href="/pricing" data-analytics-id="picks_locked_pricing" className={buttonClass({ variant: 'primary' })}>
          See plans
        </Link>
        <Link href="/picks/weekly" data-analytics-id="picks_locked_weekly" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          This week&apos;s free ranking
        </Link>
        {tier === 'anonymous' ? (
          <Link href="/sign-in" data-analytics-id="picks_locked_sign_in" data-analytics-event="auth_start" data-analytics-intent="sign_in" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
            Sign in
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
