import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { CALENDAR_CATEGORIES, humanDate, readableTitle, weekDays, type CalendarCategory, type CalendarEvent } from '@/lib/calendar-model'
import styles from './CalendarWeek.module.css'

type EventKind = CalendarEvent['category']

const GROUP_ORDER: EventKind[] = ['earnings', 'dividends', 'company', 'macro']
const TILES_SHOWN = 14
const ROWS_SHOWN = 5

const groupLabel = (kind: EventKind) => CALENDAR_CATEGORIES.find((item) => item.key === kind)?.label ?? kind

function bySymbol(a: CalendarEvent, b: CalendarEvent) {
  return (a.symbol ?? a.title).localeCompare(b.symbol ?? b.title)
}

function EarningsTile({ event, name, index }: { event: CalendarEvent; name?: string; index: number }) {
  const symbol = event.symbol ?? ''
  const label = `${symbol}${name ? `, ${name}` : ''}: ${readableTitle(event.title)}`
  return (
    <li style={{ '--i': index } as CSSProperties}>
      <Link className={styles.entry} href={`/stocks/${encodeURIComponent(symbol)}/events`} title={label} aria-label={label}>
        <span className={styles.entryNode} aria-hidden="true" />
        <span className={styles.entrySymbol}>{symbol}</span>
        {name ? <span className={styles.entryName}>{name}</span> : null}
      </Link>
    </li>
  )
}

function EventRow({ event, name }: { event: CalendarEvent; name?: string }) {
  const title = readableTitle(event.title)
  const body = (
    <>
      {event.symbol ? <span className={styles.rowSymbol}>{event.symbol}</span> : null}
      <span className={styles.rowTitle}>{title}{name ? <span className={styles.rowName}> · {name}</span> : null}</span>
      {event.detail ? <span className={styles.rowDetail}>{event.detail}</span> : null}
    </>
  )
  return (
    <li>
      {event.symbol
        ? <Link className={styles.row} href={`/stocks/${encodeURIComponent(event.symbol)}/events`}>{body}</Link>
        : <span className={styles.row}>{body}</span>}
    </li>
  )
}

function Group({ kind, events, names }: { kind: EventKind; events: CalendarEvent[]; names: Record<string, string> }) {
  const tiles = kind === 'earnings' && events.every((event) => event.symbol)
  const shown = tiles ? TILES_SHOWN : ROWS_SHOWN
  const render = (event: CalendarEvent, index: number) => tiles
    ? <EarningsTile key={event.id} event={event} index={index} name={event.symbol ? names[event.symbol.toUpperCase()] : undefined} />
    : <EventRow key={event.id} event={event} name={event.symbol ? names[event.symbol.toUpperCase()] : undefined} />
  const listClass = tiles ? styles.entries : styles.rows
  return (
    <section className={styles.group} data-kind={kind}>
      <h4 className={styles.groupLabel}>{groupLabel(kind)} <span>{events.length}</span></h4>
      <ul className={listClass}>{events.slice(0, shown).map(render)}</ul>
      {events.length > shown ? (
        <details className={styles.moreDetails}>
          <summary>Show all {events.length} {groupLabel(kind).toLowerCase()}</summary>
          <ul className={listClass}>{events.slice(shown).map(render)}</ul>
        </details>
      ) : null}
    </section>
  )
}

/** Silhouette of a week the viewer cannot read yet: built from nothing, no events behind it. */
export function WeekSilhouette({ children }: { children: ReactNode }) {
  return (
    <div className={styles.locked}>
      <div className={styles.board} style={{ '--days': 5 } as CSSProperties} aria-hidden="true">
        {Array.from({ length: 5 }, (_, day) => (
          <div key={day} className={styles.column}>
            <div className={styles.columnHead}><span className={styles.ghostBar} style={{ width: '2rem' }} /><span className={styles.ghostBar} style={{ width: '1.5rem', height: '1.25rem' }} /></div>
            <ul className={styles.entries}>
              {Array.from({ length: 4 + ((day * 3) % 7) }, (_, entry) => (
                <li key={entry} className={styles.ghostEntry}><span className={styles.entryNode} /><span className={styles.ghostBar} style={{ width: `${2 + ((entry + day) % 3) * 0.6}rem` }} /></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

export default function WeekBoard({ week, today, events, names, category, available, reason }: {
  week: string
  today: string
  events: CalendarEvent[]
  names: Record<string, string>
  category: CalendarCategory
  available: boolean
  reason?: string | null
}) {
  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])
  // Weekdays always; a weekend day only when something falls on it.
  const days = weekDays(week).filter((date, index) => index < 5 || byDay.has(date))

  if (!available) return <p className={styles.unavailable}>{reason ?? 'This calendar source is unavailable.'}</p>

  return (
    <div className={styles.board} style={{ '--days': days.length } as CSSProperties}>
      {days.map((date) => {
        const dayEvents = byDay.get(date) ?? []
        const groups = GROUP_ORDER.flatMap((kind) => {
          const items = dayEvents.filter((event) => event.category === kind).sort(bySymbol)
          return items.length ? [{ kind, items }] : []
        })
        const isToday = date === today
        return (
          <section key={date} className={styles.column} data-today={isToday || undefined} aria-label={`${humanDate(date, { weekday: 'long' })}; ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`}>
            <h3 className={styles.columnHead}>
              <span className={styles.weekday}>{new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</span>
              <time dateTime={date} className={styles.date}>{Number(date.slice(8))}</time>
              {isToday ? <span className={styles.todayMark}><span className={styles.stampDot} aria-hidden="true" />Today</span> : null}
            </h3>
            {groups.length
              ? groups.map(({ kind, items }) => <Group key={kind} kind={kind} events={items} names={names} />)
              : <p className={styles.none}>{category === 'all' ? 'No events' : `No ${groupLabel(category as EventKind).toLowerCase()}`}</p>}
          </section>
        )
      })}
    </div>
  )
}
