/**
 * What a chosen event on the Events timeline can say beyond its kind, date and
 * title, from reads the page already has: the quarter's reported results for an
 * earnings date, the dividend's amount and dates, a split's ratio, the day's
 * close, and documents filed that day. Values are shown as reported; nothing is
 * computed except the next session's move, which the timeline already gives.
 */
import type { CorporateActionRow } from './canonical-research'
import type { EarningsObservation } from './earnings-chart'
import type { TimelineClose, TimelineEvent } from './event-timeline'
import { markerBarIndex } from './event-markers'

export type EventFact = { label: string; value: string }
export type EventDocument = { label: string; url: string }
export type EventDetail = { facts: EventFact[]; documents: EventDocument[] }

export type NextEarningsFacts = {
  date: string
  fiscalPeriod: string | null
  epsEstimate: number | null
  revenueEstimate: number | null
}

const DAY_MS = 86_400_000
const dayGap = (a: string, b: string) => Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / DAY_MS

function nearest<T>(rows: readonly T[], date: string, dateOf: (row: T) => string | null, within: number): T | null {
  let best: T | null = null
  let bestGap = Infinity
  for (const row of rows) {
    const day = dateOf(row)
    if (!day) continue
    const gap = dayGap(day, date)
    if (gap <= within && gap < bestGap) {
      best = row
      bestGap = gap
    }
  }
  return best
}

export function formatAmount(value: number, currency: string | null): string {
  const digits = Math.abs(value) < 1 ? 4 : 2
  try {
    return new Intl.NumberFormat('en-US', {
      style: currency ? 'currency' : 'decimal',
      ...(currency ? { currency } : {}),
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    }).format(value)
  } catch {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })}${currency ? ` ${currency}` : ''}`
  }
}

function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })
const surprise = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
const capital = (text: string) => text ? text[0].toUpperCase() + text.slice(1).replace(/_/g, ' ') : text

export function eventDetails(events: readonly TimelineEvent[], context: {
  today: string
  earnings: readonly EarningsObservation[]
  next: NextEarningsFacts | null
  actions: readonly CorporateActionRow[]
  documents: ReadonlyArray<{ date: string; label: string; url: string }>
  closes: readonly TimelineClose[]
  currency: string
  /** Formats a large reported amount (revenue) in the listing currency. */
  compactMoney: (value: number) => string
}): Record<string, EventDetail> {
  const dates = context.closes.map((point) => point.date)
  const details: Record<string, EventDetail> = {}
  for (const event of events) {
    const facts: EventFact[] = []
    const upcoming = event.date > context.today
    if (event.category === 'earnings') {
      if (upcoming) {
        const next = context.next && dayGap(context.next.date, event.date) <= 3 ? context.next : null
        if (next?.fiscalPeriod) facts.push({ label: 'Period', value: next.fiscalPeriod })
        if (next?.epsEstimate != null) facts.push({ label: 'EPS estimate', value: number(next.epsEstimate) })
        if (next?.revenueEstimate != null) facts.push({ label: 'Revenue estimate', value: context.compactMoney(next.revenueEstimate) })
      } else {
        const row = nearest(context.earnings, event.date, (item) => item.earningsDate, 3)
        if (row?.fiscalPeriod) facts.push({ label: 'Period', value: row.fiscalPeriod })
        if (row?.epsActual != null) facts.push({ label: 'EPS reported', value: number(row.epsActual) })
        if (row?.epsEstimate != null) facts.push({ label: 'EPS estimate', value: number(row.epsEstimate) })
        if (row?.epsSurprisePct != null) facts.push({ label: 'EPS surprise', value: surprise(row.epsSurprisePct) })
        if (row?.revenueActual != null) facts.push({ label: 'Revenue reported', value: context.compactMoney(row.revenueActual) })
        if (row?.revenueEstimate != null) facts.push({ label: 'Revenue estimate', value: context.compactMoney(row.revenueEstimate) })
        if (row?.revenueSurprisePct != null) facts.push({ label: 'Revenue surprise', value: surprise(row.revenueSurprisePct) })
      }
    }
    if (event.category === 'dividends') {
      const action = nearest(context.actions.filter((row) => (row.actionType ?? '').toLowerCase().includes('dividend')), event.date, (row) => row.exDate, 1)
      if (action?.cashAmount != null) facts.push({ label: 'Amount per share', value: formatAmount(action.cashAmount, action.currency) })
      if (action?.recordDate) facts.push({ label: 'Record date', value: formatDay(action.recordDate) })
      if (action?.paymentDate) facts.push({ label: 'Paid', value: formatDay(action.paymentDate) })
      if (action?.declarationDate) facts.push({ label: 'Declared', value: formatDay(action.declarationDate) })
      if (action?.frequency) facts.push({ label: 'Frequency', value: capital(action.frequency) })
    }
    if (event.category === 'company') {
      const split = nearest(context.actions.filter((row) => (row.actionType ?? '').toLowerCase().includes('split')), event.date, (row) => row.exDate, 1)
      if (split?.splitRatioText) facts.push({ label: 'Split ratio', value: split.splitRatioText })
    }
    if (!upcoming) {
      const bar = markerBarIndex(dates, event.date)
      if (bar !== null) facts.push({ label: 'Close that day', value: formatAmount(context.closes[bar].close, context.currency) })
    }
    const documents = context.documents
      .filter((document) => document.date === event.date)
      .slice(0, 3)
      .map((document) => ({ label: document.label, url: document.url }))
    details[event.id] = { facts, documents }
  }
  return details
}
