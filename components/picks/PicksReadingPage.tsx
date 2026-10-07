import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import PickCard, { PickCapitalNote } from '@/components/picks/PickCard'
import PickDisclosure from '@/components/picks/PickDisclosure'
import PickLockedRows from '@/components/picks/PickLockedRows'
import PickReadingRail from '@/components/picks/PickReadingRail'
import { resolveVisiblePicks } from '@/lib/picks-access'
import { PICK_READING_CONTENT, PICK_SCORE_CAVEAT, formatSnapshotDate, type PickReadingKey } from '@/lib/picks-content'

/**
 * The body of a ranking page, shared by the three routes. Every row gets the same card:
 * a featured first place would read as "buy this one", and the gap between neighbouring
 * ranks is smaller than the model can resolve.
 *
 * The routes are static paths rather than one `[reading]` segment on purpose. With a
 * dynamic segment, an unknown slug can only be rejected during render — and by then a
 * `force-dynamic` response has begun streaming, so `notFound()` renders the 404 body
 * under a 200 status. Three real routes make an unknown path miss the router
 * entirely, which is a true 404 with no code involved.
 *
 * The entitlement cut happens in `resolveVisiblePicks`, server-side, before anything
 * reaches this component. Nothing here filters or hides rows.
 */

export default async function PicksReadingPage({ reading }: { reading: PickReadingKey }) {
  const content = PICK_READING_CONTENT[reading]
  const result = await resolveVisiblePicks(reading)

  const header = (
    <header className="max-w-3xl">
      <div className="text-caption uppercase tracking-[0.18em] text-content-muted">
        Rankings · {content.label}
      </div>
      <h1 className="text-page-title mt-2 text-content-primary">{content.headline}</h1>
      <p className="text-body mt-3">{content.subtitle}</p>
    </header>
  )

  if (result.status === 'unavailable') {
    return (
      <div className="container-lg section-gap">
        {header}
        <EmptyState
          analyticsId={`picks_unavailable:${reading}`}
          title="This ranking is temporarily unavailable"
          description="Vesconte could not load the current scorecard snapshot. Nothing is wrong with your account — the request upstream did not complete."
          action={<RetryButton analyticsId="picks_unavailable_retry">Retry</RetryButton>}
        />
      </div>
    )
  }

  const asOfLabel = formatSnapshotDate(result.asOf)
  const isIncome = reading === 'income'

  return (
    <div className="container-lg section-gap">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {header}
        {asOfLabel ? (
          <div className="text-caption shrink-0 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-content-muted">
            Snapshot · {asOfLabel}
          </div>
        ) : null}
      </div>

      {result.totalRanked === 0 ? (
        <EmptyState
          title="Nothing qualified for this ranking"
          description="Every tracked name was held back by the coverage floor or is not a company. That is worth reporting as a data problem rather than reading as an empty market."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            {result.items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {result.items.map((item, index) => (
                  <div key={item.symbol} className="flex flex-col gap-1.5">
                    <PickCard item={item} rank={index + 1} />
                    {isIncome ? (
                      <PickCapitalNote value={item.capitalPerThousandIncome} className="px-1" />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <PickLockedRows
              lockedCount={result.lockedCount}
              visibleCount={result.items.length}
              totalRanked={result.totalRanked}
              readingLabel={content.label}
              tier={result.tier}
            />

            {result.items.length > 0 ? (
              <p className="text-caption text-content-muted">{PICK_SCORE_CAVEAT}</p>
            ) : null}

            <PickDisclosure asOfLabel={asOfLabel} />
          </div>

          <PickReadingRail reading={reading} filters={result.filters} totalRanked={result.totalRanked} />
        </div>
      )}
    </div>
  )
}
