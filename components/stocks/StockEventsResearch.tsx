import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import EventCalendar from '@/components/calendar/EventCalendar'
import type { CanonicalEvent, DisclosurePayload, EventCalendarPayload } from '@/lib/canonical-research'
import type { CalendarResult } from '@/lib/calendar-events'
import type { CalendarCategory } from '@/lib/calendar-model'
import { normalizeEarningsHistory } from '@/lib/event-research'
import { formatCompactMoney } from '@/lib/currency'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { LeadStat } from '@/components/stocks/research/ResearchChapter'
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

/** Filings and announcements with their document: the one thing the calendar does not carry. */
function Documents({ entries }: { entries: CalendarEntry[] }) {
  return (
    <ol className={styles.calendar} data-event-documents="">
      {entries.map((entry) => (
        <li key={entry.key}>
          <time dateTime={entry.row.occursAt ?? undefined}>{formatDate(entry.row.occursAt)}</time>
          <strong>{entry.row.title}</strong>
          <a href={entry.row.documentUrl!} target="_blank" rel="noreferrer">
            {entry.row.documentType ? entry.row.documentType.replace(/_/g, ' ') : 'Document'} ↗
          </a>
        </li>
      ))}
    </ol>
  )
}

/** A reported figure, or a plain "Not reported" — never a blank cell or a dash. */
function Cell({ value }: { value: string }) {
  return value ? <>{value}</> : <span className={styles.notReported}>Not reported</span>
}

function EarningsHistory({ data }: { data: StockResearchData }) {
  const { rows } = normalizeEarningsHistory(data.summary.earningsHistory)
  if (rows.length === 0) {
    return <BeingBuilt size="chart">Each quarter’s reported earnings and revenue against what was expected are being added.</BeingBuilt>
  }

  return (
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
              <td><Cell value={formatDate(row.earningsDate)} /></td>
              <td><Cell value={formatNumber(row.epsActual)} /></td>
              <td><Cell value={formatNumber(row.epsEstimate)} /></td>
              <td data-direction={row.epsSurprisePct === null ? undefined : row.epsSurprisePct >= 0 ? 'up' : 'down'}>
                <Cell value={formatSurprise(row.epsSurprisePct)} />
              </td>
              <td><Cell value={row.revenueActual === null ? '' : formatCompactMoney(row.revenueActual, data.currency)} /></td>
              <td><Cell value={row.revenueEstimate === null ? '' : formatCompactMoney(row.revenueEstimate, data.currency)} /></td>
              <td data-direction={row.revenueSurprisePct === null ? undefined : row.revenueSurprisePct >= 0 ? 'up' : 'down'}>
                <Cell value={formatSurprise(row.revenueSurprisePct)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StockEventsResearch({
  data,
  events,
  disclosures,
  calendar,
  month,
  category,
  selectedDay,
}: {
  data: StockResearchData
  events: EventCalendarPayload | null
  disclosures: DisclosurePayload | null
  calendar: CalendarResult
  month: string
  category: CalendarCategory
  selectedDay?: string
}) {
  const isFund = data.kind === 'fund'
  const entries = collapseEvents([...(events?.rows ?? []), ...(disclosures?.rows ?? [])])
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = entries
    .filter((entry) => (entry.row.occursAt ?? '') >= today)
    .sort((left, right) => (left.row.occursAt ?? '').localeCompare(right.row.occursAt ?? ''))
  // Documents are what the calendar does not show; the events themselves live in the calendar.
  const documents = entries
    .filter((entry) => entry.row.documentUrl && (entry.row.occursAt ?? '') < today)
    .sort((left, right) => (right.row.occursAt ?? '').localeCompare(left.row.occursAt ?? ''))
    .slice(0, 12)

  const earnings = data.summary.nextEarnings
  const next = upcoming[0] ?? null
  const nextDate = next?.row.occursAt ?? earnings?.earningsDate ?? null
  const nextContext = [
    earnings?.fiscalPeriod,
    earnings?.epsEstimate === null || earnings?.epsEstimate === undefined ? null : `EPS estimate ${formatNumber(earnings.epsEstimate)}`,
    earnings?.revenueEstimate === null || earnings?.revenueEstimate === undefined ? null : `revenue estimate ${formatCompactMoney(earnings.revenueEstimate, data.currency)}`,
    next?.movedFrom ? `moved from ${formatDate(next.movedFrom)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    // No page header: the tab above already says Events.
    <ResearchViewShell data={data} title={isFund ? 'Fund Events' : 'Earnings & Events'} showHeader={false}>
      <div className={styles.page} data-events-research="">
        <ResearchChapter
          id="next-event"
          label={isFund ? 'Next fund event' : 'Next earnings'}
          lead={nextDate ? (
            <LeadStat value={formatDate(nextDate)} context={nextContext || (next ? next.row.title : undefined)} />
          ) : (
            <BeingBuilt size="inline">The date of {data.ticker}’s next {isFund ? 'fund event' : 'results'} is being added.</BeingBuilt>
          )}
        >
          {null}
        </ResearchChapter>

        <ResearchChapter id="calendar" label="Calendar" band>
          <EventCalendar month={month} selectedDay={selectedDay} category={category}
            events={calendar.events} scope="ticker" basePath={`/stocks/${encodeURIComponent(data.ticker)}/events`}
            available={calendar.available} reason={calendar.available ? null : 'The event calendar is unavailable for this symbol right now.'}
            unavailableDomains={calendar.unavailableDomains} truncated={calendar.truncated} />
        </ResearchChapter>

        {!isFund ? (
          <ResearchChapter id="reported-against-estimate" label="Reported against estimate">
            <EarningsHistory data={data} />
          </ResearchChapter>
        ) : null}

        {documents.length > 0 ? (
          <ResearchChapter id="documents" label="Filings and documents" band={!isFund}>
            <Documents entries={documents} />
          </ResearchChapter>
        ) : null}

        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
