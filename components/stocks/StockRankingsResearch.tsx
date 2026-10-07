import Link from 'next/link'
import Card from '@/components/ui/Card'
import PickDisclosure from '@/components/picks/PickDisclosure'
import { PICK_READING_CONTENT, PICK_READING_TO_SLUG, formatSnapshotDate } from '@/lib/picks-content'
import { absenceCopy, formatStandingPercent, type TickerReadings } from '@/lib/ticker-readings'
import { readingPartsDetail } from '@/lib/reading-eligibility'

/**
 * Where one company stands in each ranking. Free to every reader.
 *
 * It answers "where is this one", never "which ones lead": a standing is shown as a
 * band (`Top 12%`) and a position out of the ranked population, with what the
 * reading measures beside it. The ordered list itself is the paid ranking.
 */
export default function StockRankingsResearch({
  ticker,
  readings,
}: {
  ticker: string
  readings: TickerReadings | null
}) {
  const asOfLabel = formatSnapshotDate(readings?.asOf ?? null)

  return (
    <div className="flex flex-col gap-6" data-research-view="" data-ticker-rankings="">
      <header className="max-w-3xl">
        <h1 className="text-section-title text-content-primary">Where {ticker} stands</h1>
        <p className="text-body mt-2">
          Each ranking reads the same companies for a different question. A standing places {ticker} against
          every other ranked company{asOfLabel ? `, as of ${asOfLabel}` : ''}.
        </p>
      </header>

      {readings ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {readings.readings.map((item) => {
            const content = PICK_READING_CONTENT[item.reading]
            const href = `/picks/${PICK_READING_TO_SLUG[item.reading]}`
            const detail =
              item.status === 'absent' && item.absenceReason === 'insufficient_coverage'
                ? readingPartsDetail(item.measuredParts, item.missingParts)
                : null

            return (
              <Card key={item.reading} className="flex flex-col rounded-[var(--radius-2xl)]" data-reading={item.reading}>
                <div className="text-caption uppercase tracking-[0.18em] text-content-muted">{content.label}</div>

                {item.status === 'ranked' ? (
                  <>
                    <div className="numeric-tabular mt-3 text-3xl font-black leading-none text-content-primary">
                      {formatStandingPercent(item.standing.position, item.standing.universeSize)}
                    </div>
                    <div className="text-caption numeric-tabular mt-2 text-content-muted">
                      #{item.standing.position} of {item.standing.universeSize} ranked companies
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 text-xl font-semibold text-content-primary">{absenceCopy(item.absenceReason)}</div>
                    {detail ? <div className="text-caption mt-2 text-content-muted">{detail}</div> : null}
                  </>
                )}

                <p className="text-body-sm mt-4 text-content-secondary">{content.reader}</p>

                <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  {content.measures.map((measure) => (
                    <li key={measure.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-caption text-content-secondary">{measure.label}</span>
                      {measure.weight ? (
                        <span className="numeric-tabular text-caption text-content-muted">{measure.weight}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <Link
                  href={href}
                  className="text-caption mt-auto pt-4 text-content-muted underline underline-offset-2 hover:text-content-primary"
                >
                  How {content.label.toLowerCase()} is read
                </Link>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card tone="quiet" className="rounded-[var(--radius-2xl)]">
          <p className="text-body">Standings for {ticker} are not available right now.</p>
        </Card>
      )}

      <p className="text-caption text-content-muted">
        Top and Bottom bands place a company against the others; they are not marks out of a hundred. The full
        current order is part of a paid plan;{' '}
        <Link href="/picks/weekly" className="underline underline-offset-2 hover:text-content-primary">
          this week&apos;s ranking
        </Link>{' '}
        is free.
      </p>

      <PickDisclosure asOfLabel={asOfLabel} />
    </div>
  )
}
