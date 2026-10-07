import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import PickCard, { PickCapitalNote } from '@/components/picks/PickCard'
import PickDisclosure from '@/components/picks/PickDisclosure'
import { getSectorCut, type SectorCut } from '@/lib/picks'
import {
  PICK_READING_CONTENT,
  PICK_READING_TO_SLUG,
  PICK_SCORE_CAVEAT,
  formatSnapshotDate,
} from '@/lib/picks-content'
import { weeklyCutFor } from '@/lib/picks-weekly'

/**
 * The free weekly ranking: the top ten of one reading inside one sector.
 *
 * Open to every reader, so nothing here goes through the tier cut. Which reading and
 * sector run is decided by the date (`lib/picks-weekly.ts`), never by hand.
 */
export default async function WeeklyCutPage() {
  const week = weeklyCutFor(new Date())
  const content = PICK_READING_CONTENT[week.reading]
  const readingHref = `/picks/${PICK_READING_TO_SLUG[week.reading]}`
  const weekLabel = formatSnapshotDate(week.weekStart)

  let cut: SectorCut | 'unavailable'
  try {
    cut = await getSectorCut(week.reading, week.sector)
  } catch (error) {
    console.error('[picks] weekly cut unavailable', {
      reading: week.reading,
      sector: week.sector,
      message: error instanceof Error ? error.message : String(error),
    })
    cut = 'unavailable'
  }

  const header = (
    <header className="max-w-3xl">
      <div className="text-caption uppercase tracking-[0.18em] text-content-muted">
        Rankings · This week{weekLabel ? ` · from ${weekLabel}` : ''}
      </div>
      <h1 className="text-page-title mt-2 text-content-primary">
        {week.sector}, ranked on {content.label.toLowerCase()}.
      </h1>
      <p className="text-body mt-3">
        The top ten {week.sector} companies on the{' '}
        <Link href={readingHref} className="underline underline-offset-2 hover:text-content-primary">
          {content.label.toLowerCase()} ranking
        </Link>
        , open to everyone. A different sector and reading each week, chosen by the calendar, not by us.
      </p>
    </header>
  )

  if (cut === 'unavailable') {
    return (
      <div className="container-lg section-gap" data-weekly-cut="unavailable">
        {header}
        <EmptyState
          analyticsId="picks_weekly_unavailable"
          title="This week's ranking is temporarily unavailable"
          description="Vesconte could not load the current scorecard snapshot. Nothing is wrong with your account — the request upstream did not complete."
          action={<RetryButton analyticsId="picks_weekly_retry">Retry</RetryButton>}
        />
      </div>
    )
  }

  if (cut.status === 'unsupported' || cut.ranking.items.length === 0) {
    return (
      <div className="container-lg section-gap" data-weekly-cut="unpublished">
        {header}
        <EmptyState
          analyticsId="picks_weekly_unpublished"
          title="This week's ranking is not published yet"
          description="Rankings by sector are still being added. Until they are, where any single company stands is free on its own page."
        />
      </div>
    )
  }

  const { ranking } = cut
  const asOfLabel = formatSnapshotDate(ranking.asOf)
  const isIncome = week.reading === 'income'

  return (
    <div className="container-lg section-gap" data-weekly-cut="ok">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {header}
        {asOfLabel ? (
          <div className="text-caption shrink-0 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-content-muted">
            Snapshot · {asOfLabel}
          </div>
        ) : null}
      </div>

      <div className="flex max-w-5xl flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {ranking.items.map((item, index) => (
            <div key={item.symbol} className="flex flex-col gap-1.5">
              <PickCard item={item} rank={index + 1} />
              {isIncome ? <PickCapitalNote value={item.capitalPerThousandIncome} className="px-1" /> : null}
            </div>
          ))}
        </div>

        <p className="text-caption text-content-muted">
          {PICK_SCORE_CAVEAT} Ranks are within {week.sector} only.{' '}
          <Link href={readingHref} className="underline underline-offset-2 hover:text-content-primary">
            How the {content.label.toLowerCase()} ranking is read
          </Link>
        </p>

        <PickDisclosure asOfLabel={asOfLabel} />
      </div>
    </div>
  )
}
