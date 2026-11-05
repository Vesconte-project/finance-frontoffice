import Link from 'next/link'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import type { CanonicalEvent, DisclosurePayload, EventCalendarPayload } from '@/lib/canonical-research'
import { eventCategory, readableTitle } from '@/lib/calendar-model'
import { normalizeEarningsHistory, selectNextResearchEvent } from '@/lib/event-research'
import { buildEventMarkers } from '@/lib/event-markers'
import type { TimelineClose, TimelineEvent } from '@/lib/event-timeline'
import { daysBetween } from '@/lib/event-timeline'
import { earningsChart } from '@/lib/earnings-chart'
import { describeFiling } from '@/lib/filing-labels'
import { formatCompactMoney } from '@/lib/currency'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import EventTimeline from '@/components/stocks/events/EventTimeline'
import EarningsAgainstEstimate from '@/components/stocks/events/EarningsAgainstEstimate'
import FilingsList, { type Filing } from '@/components/stocks/events/FilingsList'
import type { StockResearchIdentity } from '@/lib/stock-research'
import styles from './StockEventsResearch.module.css'

function formatDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
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

/** The last quarters' EPS, reported against estimate, small: beside the next date. */
function RecentQuarters({ data }: { data: StockResearchIdentity }) {
  const { rows } = normalizeEarningsHistory(data.summary.earningsHistory)
  const chart = earningsChart(rows, 'eps', { width: 240, height: 90 }, 8)
  const drawn = chart.quarters.filter((quarter) => quarter.actualY !== null || quarter.estimateY !== null)
  if (drawn.length < 2) return null
  return (
    <figure className={styles.recent} aria-label={`Earnings per share against the estimate, last ${chart.quarters.length} quarters`}>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} aria-hidden="true" focusable="false">
        {chart.quarters.map((quarter) => (
          <g key={quarter.key} data-direction={quarter.direction ?? undefined} className={styles.recentQuarter}>
            {quarter.actualY !== null && quarter.estimateY !== null ? (
              <line x1={quarter.x} x2={quarter.x} y1={quarter.estimateY} y2={quarter.actualY} />
            ) : null}
            {quarter.estimateY !== null ? <circle cx={quarter.x} cy={quarter.estimateY} r={4.5} data-mark="estimate" /> : null}
            {quarter.actualY !== null ? <circle cx={quarter.x} cy={quarter.actualY} r={5} data-mark="actual" /> : null}
          </g>
        ))}
      </svg>
      <figcaption>EPS against the estimate, last {chart.quarters.length} quarters</figcaption>
    </figure>
  )
}

function timelineEvent(row: CanonicalEvent, key: string): TimelineEvent | null {
  if (!row.occursAt || !/^\d{4}-\d{2}-\d{2}/.test(row.occursAt) || !row.title?.trim()) return null
  const category = row.domain === 'guidance' ? 'guidance' : eventCategory(row.domain, row.eventType, row.title)
  if (category === 'macro') return null
  return { id: key, date: row.occursAt.slice(0, 10), category, title: readableTitle(row.title) }
}

function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

export default function StockEventsResearch({
  data,
  events,
  disclosures,
  closes,
}: {
  data: StockResearchIdentity
  events: EventCalendarPayload | null
  disclosures: DisclosurePayload | null
  /** Reported daily closes, oldest first; empty when prices are unavailable. */
  closes: TimelineClose[]
}) {
  const isFund = data.kind === 'fund'
  const entries = collapseEvents([...(events?.rows ?? []), ...(disclosures?.rows ?? [])])
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = entries
    .filter((entry) => (entry.row.occursAt ?? '') >= today)
    .sort((left, right) => (left.row.occursAt ?? '').localeCompare(right.row.occursAt ?? ''))

  const earnings = data.summary.nextEarnings
  const { entry: next, date: nextDate } = selectNextResearchEvent(isFund, earnings?.earningsDate ?? null, upcoming)
  const facts = [
    earnings?.fiscalPeriod ? { label: 'Period', value: earnings.fiscalPeriod } : null,
    earnings?.epsEstimate === null || earnings?.epsEstimate === undefined ? null : { label: 'EPS estimate', value: formatNumber(earnings.epsEstimate) },
    earnings?.revenueEstimate === null || earnings?.revenueEstimate === undefined ? null : { label: 'Revenue estimate', value: formatCompactMoney(earnings.revenueEstimate, data.currency) },
  ].filter((fact): fact is { label: string; value: string } => fact !== null)
  const days = nextDate ? daysBetween(today, nextDate.slice(0, 10)) : null

  // The timeline: events that happened (one per event, at its own date) and the scheduled ones.
  const guidance = (disclosures?.rows ?? []).filter((row) => row.domain === 'guidance')
  const past: TimelineEvent[] = buildEventMarkers([...(events?.rows ?? []), ...guidance], today)
    .map((marker) => ({ ...marker, title: readableTitle(marker.title) }))
  const scheduled = upcoming
    .map((entry) => timelineEvent(entry.row, entry.key))
    .filter((event): event is TimelineEvent => event !== null && event.date > today)
  if (!isFund && nextDate && nextDate.slice(0, 10) > today && !scheduled.some((event) => event.category === 'earnings' && event.date === nextDate.slice(0, 10))) {
    scheduled.push({ id: 'next-earnings', date: nextDate.slice(0, 10), category: 'earnings', title: `Results${earnings?.fiscalPeriod ? ` for ${earnings.fiscalPeriod}` : ''}` })
  }

  // Filed documents, newest first, with plain names.
  const filings: Filing[] = entries
    .filter((entry) => entry.row.documentUrl && entry.row.occursAt && entry.row.occursAt.slice(0, 10) <= today)
    .sort((left, right) => (right.row.occursAt ?? '').localeCompare(left.row.occursAt ?? ''))
    .slice(0, 60)
    .map((entry) => ({
      key: entry.key,
      date: entry.row.occursAt!.slice(0, 10),
      url: entry.row.documentUrl!,
      ...describeFiling(entry.row.documentType, entry.row.title),
    }))

  const history = normalizeEarningsHistory(data.summary.earningsHistory).rows

  return (
    // No page header: the tab above already says Events.
    <ResearchViewShell title={isFund ? 'Fund Events' : 'Earnings & Events'} showHeader={false}>
      <div className={styles.page} data-events-research="">
        <ResearchChapter id="next-event" label={isFund ? 'Next fund event' : 'Next earnings'}>
          {nextDate && days !== null ? (
            <div className={styles.next} data-next-event="">
              <div className={styles.countdown} aria-hidden="true">
                <strong>{days}</strong>
                <span>{days === 1 ? 'day' : 'days'}</span>
              </div>
              <div className={styles.when}>
                <p className={styles.date}>
                  <time dateTime={nextDate.slice(0, 10)}>{formatDate(nextDate)}</time>
                </p>
                <p className={styles.weekday}>
                  {formatDay(nextDate)} · {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                  {next?.movedFrom ? <span className={styles.moved}> · moved from {formatDate(next.movedFrom)}</span> : null}
                </p>
                {facts.length ? (
                  <dl className={styles.facts}>
                    {facts.map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : isFund && next ? <p className={styles.weekday}>{readableTitle(next.row.title)}</p> : null}
              </div>
              {!isFund ? <RecentQuarters data={data} /> : null}
            </div>
          ) : (
            <BeingBuilt size="inline">The date of {data.ticker}’s next {isFund ? 'fund event' : 'results'} is being added.</BeingBuilt>
          )}
        </ResearchChapter>

        <ResearchChapter
          id="timeline"
          label="Events on the price"
          band
          actions={<Link href="/calendar" className={styles.action}>Open the full calendar →</Link>}
        >
          {past.length || scheduled.length ? (
            <EventTimeline ticker={data.ticker} closes={closes} past={past} upcoming={scheduled} today={today} />
          ) : (
            <BeingBuilt size="chart">{data.ticker}’s results, dividends and company events are being added.</BeingBuilt>
          )}
        </ResearchChapter>

        {!isFund ? (
          <ResearchChapter id="reported-against-estimate" label="Reported against estimate">
            <EarningsAgainstEstimate rows={history} currency={data.currency} />
          </ResearchChapter>
        ) : null}

        {filings.length > 0 ? (
          <ResearchChapter id="documents" label="Filings and documents" band={!isFund}>
            <FilingsList filings={filings} />
          </ResearchChapter>
        ) : null}

        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
