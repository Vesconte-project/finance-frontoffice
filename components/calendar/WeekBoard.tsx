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

type Context = { names: Record<string, string>; relations: Record<string, string[]>; center: string | null }

function EarningsTile({ event, context, index }: { event: CalendarEvent; context: Context; index: number }) {
  const symbol = event.symbol ?? ''
  const name = context.names[symbol.toUpperCase()]
  const relation = context.relations[symbol.toUpperCase()]?.join(' · ')
  const isCenter = symbol.toUpperCase() === context.center
  const label = `${symbol}${name ? `, ${name}` : ''}: ${readableTitle(event.title)}${relation ? `. ${relation}` : ''}`
  return (
    <li style={{ '--i': index } as CSSProperties}>
      <Link className={styles.entry} href={`/stocks/${encodeURIComponent(symbol)}/events`} title={label} aria-label={label} data-center={isCenter || undefined}>
        <span className={styles.entryNode} aria-hidden="true" />
        <span className={styles.entrySymbol}>{symbol}</span>
        {name ? <span className={styles.entryName}>{name}</span> : null}
        {relation ? <span className={styles.entryRelation}>{relation}</span> : null}
      </Link>
    </li>
  )
}

function EventRow({ event, context }: { event: CalendarEvent; context: Context }) {
  const title = readableTitle(event.title)
  const name = event.symbol ? context.names[event.symbol.toUpperCase()] : undefined
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

function Group({ kind, events, context }: { kind: EventKind; events: CalendarEvent[]; context: Context }) {
  const tiles = kind === 'earnings' && events.every((event) => event.symbol)
  const shown = tiles ? TILES_SHOWN : ROWS_SHOWN
  const render = (event: CalendarEvent, index: number) => tiles
    ? <EarningsTile key={event.id} event={event} index={index} context={context} />
    : <EventRow key={event.id} event={event} context={context} />
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

export default function WeekBoard({ week, today, events, names, relations = {}, center = null, category, available, reason }: {
  week: string
  today: string
  events: CalendarEvent[]
  names: Record<string, string>
  /** How each company relates to `center` when the calendar is narrowed around one. */
  relations?: Record<string, string[]>
  center?: string | null
  category: CalendarCategory
  available: boolean
  reason?: string | null
}) {
  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])
  // Weekdays always; a weekend day only when something falls on it.
  const days = weekDays(week).filter((date, index) => index < 5 || byDay.has(date))

  if (!available) return <p className={styles.unavailable}>{reason ?? 'This calendar source is unavailable.'}</p>

  const weekday = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

  return (
    <>
    {/* On a narrow screen the days stack; this strip shows the whole week at a glance and jumps to a day. */}
    <nav className={styles.dayStrip} aria-label="Days of the week" style={{ '--days': days.length } as CSSProperties}>
      {days.map((date) => {
        const count = byDay.get(date)?.length ?? 0
        return (
          <a key={date} href={`#day-${date}`} data-today={date === today || undefined} data-empty={count === 0 || undefined} aria-label={`${humanDate(date, { weekday: 'long' })}: ${count} ${count === 1 ? 'event' : 'events'}`}>
            <span className={styles.stripDay}>{weekday(date)}</span>
            <span className={styles.stripDate}>{Number(date.slice(8))}</span>
            <span className={styles.stripCount}>{count || '–'}</span>
          </a>
        )
      })}
    </nav>
    <div className={styles.board} style={{ '--days': days.length } as CSSProperties}>
      {days.map((date) => {
        const dayEvents = byDay.get(date) ?? []
        const groups = GROUP_ORDER.flatMap((kind) => {
          // The company the calendar is narrowed around comes first on its day.
          const items = dayEvents.filter((event) => event.category === kind).sort((a, b) => Number(b.symbol === center) - Number(a.symbol === center) || bySymbol(a, b))
          return items.length ? [{ kind, items }] : []
        })
        const isToday = date === today
        return (
          <section key={date} id={`day-${date}`} className={styles.column} data-today={isToday || undefined} data-empty={groups.length === 0 || undefined} aria-label={`${humanDate(date, { weekday: 'long' })}; ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`}>
            <h3 className={styles.columnHead}>
              <span className={styles.weekday}>{weekday(date)}</span>
              <time dateTime={date} className={styles.date}>{Number(date.slice(8))}</time>
              {isToday ? <span className={styles.todayMark}><span className={styles.stampDot} aria-hidden="true" />Today</span> : null}
            </h3>
            {groups.length
              ? groups.map(({ kind, items }) => <Group key={kind} kind={kind} events={items} context={{ names, relations, center }} />)
              : <p className={styles.none}>{category === 'all' ? 'No events' : `No ${groupLabel(category as EventKind).toLowerCase()}`}</p>}
          </section>
        )
      })}
    </div>
    </>
  )
}
