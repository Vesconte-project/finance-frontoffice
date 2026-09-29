import Link from 'next/link'
import Card from '@/components/ui/Card'
import { PICK_READING_CONTENT, PICK_READING_TO_SLUG, PICK_READING_KEYS } from '@/lib/picks-content'
import type { PickReadingKey } from '@/lib/picks-content'
import type { PickFilters } from '@/lib/picks'
import { eligibilitySentence } from '@/lib/reading-eligibility'
import { cn } from '@/lib/utils'

/**
 * "How this list is read".
 *
 * The backend reports its filters in the payload rather than only applying them,
 * precisely so a reader looking at 25 rows out of 686 can be told what happened to
 * the other 661. This renders that, instead of leaving it in a JSON field nobody sees.
 */
export default function PickReadingRail({
  reading,
  filters,
  totalRanked,
}: {
  reading: PickReadingKey
  filters: PickFilters
  totalRanked: number
}) {
  const content = PICK_READING_CONTENT[reading]
  const others = PICK_READING_KEYS.filter((key) => key !== reading)

  return (
    <aside className="flex flex-col gap-4">
      <Card className="rounded-[var(--radius-2xl)]">
        <h2 className="text-card-title text-content-primary">How this list is read</h2>
        <p className="text-body-sm mt-2 text-content-secondary">{content.reader}</p>

        <div className="mt-5 flex flex-col gap-4">
          {content.measures.map((measure) => (
            <div key={measure.label} className="border-l-2 border-primary/30 pl-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label-sm font-semibold text-content-primary">{measure.label}</span>
                {measure.weight ? (
                  <span className="numeric-tabular text-caption text-content-muted">{measure.weight}</span>
                ) : null}
              </div>
              <p className="text-caption mt-0.5 text-content-muted">{measure.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="text-caption uppercase tracking-[0.18em] text-content-muted">Deliberately ignores</div>
          <p className="text-body-sm mt-1 font-semibold text-content-primary">{content.ignores}</p>
          <p className="text-caption mt-1 leading-relaxed text-content-muted">{content.ignoresReason}</p>
        </div>

        {content.note ? (
          <p className="text-caption mt-4 leading-relaxed text-content-muted">{content.note}</p>
        ) : null}
      </Card>

      <Card tone="quiet" className="rounded-[var(--radius-2xl)]">
        <h2 className="text-card-title text-content-primary">What was filtered out</h2>
        <p className="text-body-sm mt-2 text-content-secondary">
          {totalRanked} names qualified out of the tracked universe. Two filters run before the
          ranking, because leaving them off produces a list that is wrong in ways you could not see.
        </p>
        <dl className="mt-4 flex flex-col gap-3">
          <div>
            <dt className="text-label-sm font-semibold text-content-primary">Thin coverage</dt>
            <dd className="text-caption mt-0.5 text-content-muted">
              {filters.eligibility ? (
                `${eligibilitySentence(filters.eligibility)} Without that, the top result can be a score built from a quarter of the model.`
              ) : filters.minCoverage > 0 ? (
                <>
                  A reading assembled from less than{' '}
                  <span className="numeric-tabular">{Math.round(filters.minCoverage * 100)}%</span> of its parts is
                  not ranked. Without it the top result can be a score built from a quarter of the model.
                </>
              ) : (
                'A reading assembled from too little of its data is not ranked. Without that, the top result can be a score built from a quarter of the model.'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm font-semibold text-content-primary">Things that are not companies</dt>
            <dd className="text-caption mt-0.5 text-content-muted">
              {filters.nonCompanyRule
                ? `Excluded by what is missing rather than by a label: ${filters.nonCompanyRule}.`
                : 'Funds and ETFs are excluded by the absence of financial statements rather than by a label.'}
            </dd>
          </div>
        </dl>
      </Card>

      <Card tone="quiet" className="rounded-[var(--radius-2xl)]">
        <h2 className="text-card-title text-content-primary">The same companies, read differently</h2>
        <p className="text-body-sm mt-2 text-content-secondary">
          These are not three weightings of one score. They measure different things, so a name near the
          top here can be nowhere on the others.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {others.map((key) => {
            const other = PICK_READING_CONTENT[key]
            return (
              <Link
                key={key}
                href={`/picks/${PICK_READING_TO_SLUG[key]}`}
                className={cn(
                  'state-interactive group flex items-baseline justify-between gap-3 rounded-[var(--radius-lg)]',
                  'border border-border bg-surface-elevated px-4 py-3',
                  'hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45'
                )}
              >
                <span className="text-label-sm font-semibold text-content-primary">{other.label}</span>
                <span className="text-caption text-content-muted">{other.ignores} ignored</span>
              </Link>
            )
          })}
        </div>
      </Card>
    </aside>
  )
}
