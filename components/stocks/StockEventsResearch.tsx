import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import type { CanonicalEvent, DisclosurePayload, EventCalendarPayload } from '@/lib/canonical-research'
import { normalizeEarningsHistory } from '@/lib/event-research'
import { formatCompactMoney } from '@/lib/currency'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './StockEventsResearch.module.css'

function formatDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatSurprise(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  const rounded = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.abs(value))
  return `${value >= 0 ? '+' : '−'}${rounded}%`
}

type CalendarEntry = {
  key: string
  row: CanonicalEvent
  /** An earlier date this event was scheduled for, if it moved. */
  movedFrom: string | null
}

/**
 * One entry per event, not one per time we heard about it.
 *
 * This read model is bitemporal: it returns a row for every `knownAt` at which
 * an event was observed. The page was rendering each of those as its own event,
 * so Apple's next earnings appeared twenty-five times — identical rows differing
 * only in the day we learned the same unchanged fact, and counted as
 * "25 canonical events" in the coverage panel.
 *
 * Identity deliberately excludes `occursAt`, so a group survives the date
 * moving; that move is the one thing in the revision history worth showing, and
 * it is surfaced rather than buried in twenty-five duplicates.
 */
function collapseEvents(rows: CanonicalEvent[]): CalendarEntry[] {
  const groups = new Map<string, CanonicalEvent[]>()
  for (const row of rows) {
    const key = `${row.domain}:${row.eventType}:${row.title}`
    const existing = groups.get(key)
    if (existing) existing.push(row)
    else groups.set(key, [row])
  }

  return [...groups.entries()].map(([key, group]) => {
    const byKnownAt = [...group].sort((left, right) => (right.knownAt ?? '').localeCompare(left.knownAt ?? ''))
    const current = byKnownAt[0]
    const earlier = byKnownAt.find((row) => row.occursAt && row.occursAt !== current.occursAt)
    return { key, row: current, movedFrom: earlier?.occursAt ?? null }
  })
}

function Calendar({ title, entries }: { title: string; entries: CalendarEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <ol className={styles.calendar}>
        {entries.map((entry) => (
          <li key={entry.key}>
            <time dateTime={entry.row.occursAt ?? undefined}>{formatDate(entry.row.occursAt)}</time>
            <div>
              <strong>{entry.row.title}</strong>
              {entry.movedFrom ? <p>Moved from {formatDate(entry.movedFrom)}</p> : null}
            </div>
            {entry.row.documentUrl ? (
              <a href={entry.row.documentUrl} target="_blank" rel="noreferrer">
                {entry.row.documentType ? entry.row.documentType.replace(/_/g, ' ') : 'Document'} ↗
              </a>
            ) : <span />}
          </li>
        ))}
      </ol>
    </section>
  )
}

function EarningsHistory({ data }: { data: StockResearchData }) {
  const { rows, duplicateKeys } = normalizeEarningsHistory(data.summary.earningsHistory)
  if (rows.length === 0) return null

  return (
    <section className={styles.section}>
      <h2>Reported against estimate</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Reported</th>
              <th scope="col">EPS</th>
              <th scope="col">Estimate</th>
              <th scope="col">Surprise</th>
              <th scope="col">Revenue</th>
              <th scope="col">Estimate</th>
              <th scope="col">Surprise</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.earningsDate}-${row.fiscalPeriod ?? 'period'}`}>
                <th scope="row">{row.fiscalPeriod ?? formatDate(row.earningsDate)}</th>
                <td>{formatDate(row.earningsDate)}</td>
                <td>{formatNumber(row.epsActual)}</td>
                <td>{formatNumber(row.epsEstimate)}</td>
                <td data-direction={row.epsSurprisePct === null ? undefined : row.epsSurprisePct >= 0 ? 'up' : 'down'}>
                  {formatSurprise(row.epsSurprisePct)}
                </td>
                <td>{row.revenueActual === null ? '' : formatCompactMoney(row.revenueActual, data.currency)}</td>
                <td>{row.revenueEstimate === null ? '' : formatCompactMoney(row.revenueEstimate, data.currency)}</td>
                <td data-direction={row.revenueSurprisePct === null ? undefined : row.revenueSurprisePct >= 0 ? 'up' : 'down'}>
                  {formatSurprise(row.revenueSurprisePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {duplicateKeys.length > 0 ? (
        <p className={styles.note}>
          {duplicateKeys.length} {duplicateKeys.length === 1 ? 'period is' : 'periods are'} reported twice with
          different figures and {duplicateKeys.length === 1 ? 'is' : 'are'} left out.
        </p>
      ) : null}
    </section>
  )
}

export default function StockEventsResearch({
  data,
  events,
  disclosures,
}: {
  data: StockResearchData
  events: EventCalendarPayload | null
  disclosures: DisclosurePayload | null
}) {
  const isFund = data.kind === 'fund'
  const entries = collapseEvents([...(events?.rows ?? []), ...(disclosures?.rows ?? [])])
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = entries
    .filter((entry) => (entry.row.occursAt ?? '') >= today)
    .sort((left, right) => (left.row.occursAt ?? '').localeCompare(right.row.occursAt ?? ''))
  const past = entries
    .filter((entry) => (entry.row.occursAt ?? '') < today)
    .sort((left, right) => (right.row.occursAt ?? '').localeCompare(left.row.occursAt ?? ''))

  const earnings = data.summary.nextEarnings
  const nextDate = upcoming[0]?.row.occursAt ?? earnings?.earningsDate ?? null

  return (
    // No page header: the tab above already says Events. The Upcoming / Recent
    // / History tabs are gone too — they only changed the date window of the
    // request, and one of them was hiding the earnings history entirely.
    <ResearchViewShell data={data} title={isFund ? 'Fund Events' : 'Earnings & Events'} showHeader={false}>
      {nextDate ? (
        <section className={styles.next}>
          <h2>{isFund ? 'Next fund event' : 'Next earnings'}</h2>
          <p className={styles.nextDate}>{formatDate(nextDate)}</p>
          <p className={styles.nextMeta}>
            {[
              earnings?.fiscalPeriod,
              earnings?.epsEstimate === null || earnings?.epsEstimate === undefined
                ? null
                : `EPS estimate ${formatNumber(earnings.epsEstimate)}`,
              earnings?.revenueEstimate === null || earnings?.revenueEstimate === undefined
                ? null
                : `Revenue estimate ${formatCompactMoney(earnings.revenueEstimate, data.currency)}`,
            ].filter(Boolean).join(' · ')}
          </p>
        </section>
      ) : null}

      {!isFund ? <EarningsHistory data={data} /> : null}
      <Calendar title="Scheduled" entries={upcoming} />
      <Calendar title="Past" entries={past} />

      {entries.length === 0 ? (
        <p className={styles.note}>{events?.reason ?? disclosures?.reason ?? 'No events are recorded for this symbol.'}</p>
      ) : null}

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
