import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import PickCard, { PickCapitalNote, PickHeroCard } from '@/components/picks/PickCard'
import PickLockedRows from '@/components/picks/PickLockedRows'
import PickReadingRail from '@/components/picks/PickReadingRail'
import { resolveVisiblePicks } from '@/lib/picks-access'
import { PICK_READING_CONTENT, PICK_SCORE_CAVEAT, type PickReadingKey } from '@/lib/picks-content'

/**
 * The body of a picks page, shared by the three routes.
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

function formatAsOf(asOf: string | null): string | null {
  if (!asOf) return null
  const parsed = new Date(`${asOf}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function PicksReadingPage({ reading }: { reading: PickReadingKey }) {
  const content = PICK_READING_CONTENT[reading]
  const result = await resolveVisiblePicks(reading)

  const header = (
    <header className="max-w-3xl">
      <div className="text-caption uppercase tracking-[0.18em] text-content-muted">
        Picks · {content.label}
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

  const [leader, ...rest] = result.items
  const asOfLabel = formatAsOf(result.asOf)
  const isIncome = reading === 'income'

  return (
    <div className="container-lg section-gap">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {header}
        {asOfLabel ? (
          <div className="text-caption shrink-0 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-content-muted">
            Snapshot · {asOfLabel}
          </div>
        ) : null}
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="Nothing qualified for this ranking"
          description="Every tracked name was held back by the coverage floor or is not a company. That is worth reporting as a data problem rather than reading as an empty market."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            {leader ? (
              <div className="flex flex-col gap-2">
                <PickHeroCard item={leader} rank={1} />
                {isIncome ? <PickCapitalNote value={leader.capitalPerThousandIncome} /> : null}
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {rest.map((item, index) => (
                  <div key={item.symbol} className="flex flex-col gap-1.5">
                    <PickCard item={item} rank={index + 2} />
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
            />

            <p className="text-caption text-content-muted">{PICK_SCORE_CAVEAT}</p>
          </div>

          <PickReadingRail reading={reading} filters={result.filters} totalRanked={result.totalRanked} />
        </div>
      )}
    </div>
  )
}
