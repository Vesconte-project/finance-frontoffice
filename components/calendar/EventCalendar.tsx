import Link from 'next/link'
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react'
import { CALENDAR_CATEGORIES, calendarDay, humanDate, monthBounds, shiftMonth, type CalendarCategory, type CalendarEvent } from '@/lib/calendar-model'
import styles from './EventCalendar.module.css'

type Props = {
  month: string
  selectedDay?: string | null
  category: CalendarCategory
  events: CalendarEvent[]
  scope: 'global' | 'ticker'
  basePath: string
  available: boolean
  reason?: string | null
  unavailableDomains?: string[]
  truncated?: boolean
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthDays(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const count = Math.ceil((offset + last) / 7) * 7
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), index - offset + 1)).toISOString().slice(0, 10))
}

export default function EventCalendar({ month, selectedDay, category, events, scope, basePath, available, reason, unavailableDomains = [], truncated = false }: Props) {
  const bounds = monthBounds(month)
  const today = new Date().toISOString().slice(0, 10)
  const selected = calendarDay(selectedDay, month) ?? (today.startsWith(month) ? today : events[0]?.date ?? bounds.start)
  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])
  const agenda = byDay.get(selected) ?? []
  const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
  const href = (targetMonth: string, day?: string, targetCategory = category) => {
    const path = scope === 'global' ? `/calendar${targetCategory === 'all' ? '' : `/${targetCategory}`}` : basePath
    const params = new URLSearchParams({ month: targetMonth })
    if (day) params.set('day', day)
    if (scope === 'ticker' && targetCategory !== 'all') params.set('type', targetCategory)
    return `${path}?${params}`
  }
  const categories = scope === 'ticker' ? CALENDAR_CATEGORIES.filter((item) => !['macro', 'holidays'].includes(item.key)) : CALENDAR_CATEGORIES

  return (
    <section className={styles.calendar} aria-label="Event calendar">
      <div className={styles.toolbar}>
        <div>
          <h2>{monthTitle}</h2>
          <p>{events.length} {events.length === 1 ? 'event' : 'events'} in this view</p>
        </div>
        <div className={styles.monthControls} aria-label="Change month">
          <Link href={href(shiftMonth(month, -1))} aria-label="Previous month"><ArrowLeft size={17} /></Link>
          <Link href={href(today.slice(0, 7))}>Today</Link>
          <Link href={href(shiftMonth(month, 1))} aria-label="Next month"><ArrowRight size={17} /></Link>
        </div>
      </div>

      <nav className={styles.categories} aria-label="Event type">
        {categories.map((item) => (
          <Link key={item.key} href={href(month, undefined, item.key)} aria-current={item.key === category ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>

      {unavailableDomains.length > 0 && available ? (
        <p className={styles.coverage}>Partial coverage: some event sources are unavailable for this month.</p>
      ) : null}
      {truncated ? <p className={styles.coverage}>Showing the first 500 events. Narrow the type or ticker to see more.</p> : null}

      <div className={styles.layout}>
        <div className={styles.gridWrap}>
          <div className={styles.grid} aria-label={monthTitle}>
            {weekdays.map((day) => <div key={day} className={styles.weekday}>{day}</div>)}
            {monthDays(month).map((date) => {
              const dayEvents = byDay.get(date) ?? []
              const inMonth = date.startsWith(month)
              return (
                <Link
                  key={date}
                  href={href(date.slice(0, 7), date)}
                  className={styles.day}
                  data-outside={!inMonth || undefined}
                  data-selected={date === selected || undefined}
                  aria-label={`${humanDate(date)}; ${dayEvents.length} events`}
                  aria-current={date === today ? 'date' : undefined}
                >
                  <time dateTime={date}>{Number(date.slice(8))}</time>
                  {dayEvents.length > 0 ? <span className={styles.count}>{dayEvents.length}</span> : null}
                  <span className={styles.dayEvents}>
                    {dayEvents.slice(0, 2).map((event) => <span key={event.id} className={styles.dayEvent} data-category={event.category}>{event.symbol ? `${event.symbol} · ` : ''}{event.title}</span>)}
                    {dayEvents.length > 2 ? <span className={styles.more}>+{dayEvents.length - 2} more</span> : null}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        <aside className={styles.agenda} aria-label={`Events on ${humanDate(selected)}`}>
          <div className={styles.agendaHeader}><CalendarDays size={19} strokeWidth={1.5} /><h3>{humanDate(selected)}</h3></div>
          {agenda.length ? (
            <ol>{agenda.map((event) => (
              <li key={event.id}>
                <span className={styles.eventType} data-category={event.category}>{CALENDAR_CATEGORIES.find((item) => item.key === event.category)?.label}</span>
                <strong>{event.title}</strong>
                {event.symbol ? <Link href={`/stocks/${encodeURIComponent(event.symbol)}/events`}>{event.symbol} <ArrowRight size={14} /></Link> : null}
                {event.detail ? <p>{event.detail}</p> : null}
                {event.source ? <p>Source: {event.source.replaceAll('_', ' ')}</p> : null}
              </li>
            ))}</ol>
          ) : <p className={styles.empty}>{available ? 'No recorded events on this day.' : reason ?? 'This calendar source is unavailable.'}</p>}
        </aside>
      </div>
    </section>
  )
}
