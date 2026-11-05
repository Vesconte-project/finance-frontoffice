'use client'

import { useMemo, useState } from 'react'
import ChartFrame, { ChartPlot } from '@/components/stocks/research/ChartFrame'
import FilterChip from '@/components/ui/FilterChip'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { labelPosition } from '@/lib/chart-labels'
import { EVENT_CATEGORY_LABEL, type EventMarkerCategory } from '@/lib/event-markers'
import {
  TIMELINE_RANGES,
  laneY,
  timelineGeometry,
  type PlacedEvent,
  type TimelineClose,
  type TimelineEvent,
  type TimelineGeometry,
  type TimelineRange,
} from '@/lib/event-timeline'
import styles from './EventTimeline.module.css'

const WIDE = { width: 1000, height: 360 }
const COMPACT = { width: 600, height: 460 }
/** Two markers closer than this many CSS pixels stack instead of overlapping. */
const MARKER_GAP_PX = 22
const CATEGORIES: EventMarkerCategory[] = ['earnings', 'dividends', 'guidance', 'company']

function formatDate(date: string, weekday = false): string {
  return new Intl.DateTimeFormat('en-US', {
    ...(weekday ? { weekday: 'short' as const } : {}),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function formatMove(value: number): string {
  const rounded = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(value))
  return `${value >= 0 ? '+' : '−'}${rounded}%`
}

function inDays(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/**
 * The company's price over a chosen window with its events on the days they
 * happened, and what is scheduled after today. A marker is a button: choosing
 * one reads it below the chart, with the next session's move for a past event.
 */
export default function EventTimeline({
  ticker,
  closes,
  past,
  upcoming,
  today,
}: {
  ticker: string
  closes: TimelineClose[]
  past: TimelineEvent[]
  upcoming: TimelineEvent[]
  today: string
}) {
  const [range, setRange] = useState<TimelineRange>('2Y')
  const [shown, setShown] = useState<EventMarkerCategory | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const shownPast = useMemo(() => (shown === 'all' ? past : past.filter((event) => event.category === shown)), [past, shown])
  const shownUpcoming = useMemo(() => (shown === 'all' ? upcoming : upcoming.filter((event) => event.category === shown)), [upcoming, shown])
  const geometries = useMemo(() => {
    const build = (box: { width: number; height: number }, pixels: number) => timelineGeometry({
      closes,
      past: shownPast,
      upcoming: shownUpcoming,
      range,
      today,
      width: box.width,
      height: box.height,
      gap: MARKER_GAP_PX * (box.width / pixels),
    })
    return { wide: build(WIDE, 900), compact: build(COMPACT, 360) }
  }, [closes, shownPast, shownUpcoming, range, today])
  const { wide, compact } = geometries

  // Counts per kind in the chosen window, whatever kind is shown.
  const counts = useMemo(() => {
    const all = timelineGeometry({ closes: [], past, upcoming, range, today, width: 1, height: 1, gap: 0 }).events
    const byCategory = new Map<EventMarkerCategory, number>()
    for (const event of all) byCategory.set(event.category, (byCategory.get(event.category) ?? 0) + 1)
    return { total: all.length, byCategory }
  }, [past, upcoming, range, today])

  const events = wide.events
  // Default reading: the next scheduled event, else the latest one that happened.
  const fallback = events.find((event) => event.upcoming) ?? [...events].reverse().find((event) => !event.upcoming) ?? null
  const selected = events.find((event) => event.id === selectedId) ?? fallback

  const plot = (geometry: TimelineGeometry, variant: 'wide' | 'compact') => (
    <ChartPlot
      box={{ width: geometry.width, height: geometry.height }}
      variant={variant}
      labels={<Labels geometry={geometry} selectedId={selected?.id ?? null} onSelect={setSelectedId} />}
    >
      <Drawing geometry={geometry} selectedId={selected?.id ?? null} />
    </ChartPlot>
  )

  return (
    <div className={styles.timeline} data-event-timeline="">
      <div className={styles.controls}>
        <div className={styles.chips} role="group" aria-label="Kinds of event shown">
          <FilterChip label="All" active={shown === 'all'} onClick={() => setShown('all')} trailing={<span className={styles.count}>{counts.total}</span>} />
          {CATEGORIES.filter((category) => counts.byCategory.get(category)).map((category) => (
            <FilterChip
              key={category}
              label={EVENT_CATEGORY_LABEL[category]}
              active={shown === category}
              onClick={() => setShown(shown === category ? 'all' : category)}
              leading={<i className={styles.dot} data-category={category} aria-hidden="true" />}
              trailing={<span className={styles.count}>{counts.byCategory.get(category)}</span>}
            />
          ))}
        </div>
        <SegmentedControl options={TIMELINE_RANGES} value={range} onChange={setRange} ariaLabel="Time shown" analyticsId="events-timeline-range" />
      </div>
      <ChartFrame ariaLabel={`${ticker}'s price with its events, ${range === '1Y' ? 'over the last year' : `over the last ${range.slice(0, -1)} years`}, and what is scheduled`}>
        {plot(wide, 'wide')}
        {plot(compact, 'compact')}
      </ChartFrame>
      {selected ? <Reading event={selected} /> : (
        <p className={styles.empty}>No {shown === 'all' ? '' : `${EVENT_CATEGORY_LABEL[shown].toLowerCase()} `}events in this window.</p>
      )}
    </div>
  )
}

function Drawing({ geometry, selectedId }: { geometry: TimelineGeometry; selectedId: string | null }) {
  const { width, height, plotTop, todayX } = geometry
  const bottom = height - 22
  return (
    <>
      <defs>
        <linearGradient id={`fill-${width}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className={styles.fillTop} />
          <stop offset="100%" className={styles.fillBottom} />
        </linearGradient>
      </defs>
      {/* Lanes for the markers, above the price. */}
      <line x1={0} x2={width} y1={plotTop - 4} y2={plotTop - 4} className={styles.laneRule} />
      {/* What is scheduled: right of today. */}
      <rect x={todayX} y={0} width={Math.max(0, width - todayX)} height={bottom} className={styles.future} />
      {geometry.ticks.map((tick) => (
        <line key={`${tick.x}-${tick.label}`} x1={tick.x} x2={tick.x} y1={plotTop} y2={bottom} className={styles.tick} />
      ))}
      {geometry.area ? <path d={geometry.area} fill={`url(#fill-${width})`} className={styles.area} /> : null}
      {geometry.line ? <path d={geometry.line} className={styles.line} /> : null}
      <line x1={todayX} x2={todayX} y1={0} y2={bottom} className={styles.today} />
      <line x1={0} x2={width} y1={bottom} y2={bottom} className={styles.base} />
      {geometry.events.map((event) => (
        <line
          key={event.id}
          x1={event.x}
          x2={event.x}
          y1={laneY(geometry, event.level)}
          y2={event.y ?? bottom}
          className={styles.stem}
          data-category={event.category}
          data-selected={event.id === selectedId ? 'true' : undefined}
          data-upcoming={event.upcoming ? 'true' : undefined}
        />
      ))}
      {geometry.events.filter((event) => event.y !== null).map((event) => (
        <circle key={`${event.id}-at`} cx={event.x} cy={event.y!} r={3} className={styles.touch} data-category={event.category} data-selected={event.id === selectedId ? 'true' : undefined} />
      ))}
    </>
  )
}

function Labels({ geometry, selectedId, onSelect }: { geometry: TimelineGeometry; selectedId: string | null; onSelect: (id: string) => void }) {
  const box = { width: geometry.width, height: geometry.height }
  return (
    <>
      {geometry.ticks.map((tick) => (
        <span key={`${tick.x}-${tick.label}`} className={styles.tickLabel} style={labelPosition(box, tick.x, geometry.height - 10, 'middle', 'middle')}>
          {tick.label}
        </span>
      ))}
      <span className={styles.todayLabel} style={labelPosition(box, geometry.todayX, geometry.plotTop + 4, 'start', 'start')}>Today</span>
      {geometry.events.map((event) => (
        <button
          key={event.id}
          type="button"
          className={styles.marker}
          data-category={event.category}
          data-upcoming={event.upcoming ? 'true' : undefined}
          data-selected={event.id === selectedId ? 'true' : undefined}
          aria-pressed={event.id === selectedId}
          style={labelPosition(box, event.x, laneY(geometry, event.level), 'middle', 'middle')}
          onClick={() => onSelect(event.id)}
          aria-label={`${EVENT_CATEGORY_LABEL[event.category]}, ${formatDate(event.date)}${event.upcoming ? ', scheduled' : ''}: ${event.title}`}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </>
  )
}

function Reading({ event }: { event: PlacedEvent }) {
  return (
    <div className={styles.reading} data-category={event.category} data-timeline-reading="" aria-live="polite">
      <div className={styles.readingHead}>
        <i className={styles.dot} data-category={event.category} aria-hidden="true" />
        <span className={styles.readingKind}>{EVENT_CATEGORY_LABEL[event.category]}</span>
        <time dateTime={event.date}>{formatDate(event.date, true)}</time>
        {event.upcoming && event.daysAway !== null ? <span className={styles.badge}>Scheduled · {inDays(event.daysAway)}</span> : null}
      </div>
      <p className={styles.readingTitle}>{event.title}</p>
      {!event.upcoming ? (
        event.nextSession === null ? (
          <p className={styles.readingNote}>No next-session close yet.</p>
        ) : (
          <p className={styles.readingMove}>
            Next session <strong data-tone={event.nextSession >= 0 ? 'up' : 'down'}>{formatMove(event.nextSession)}</strong>
            <span>close against the event day&rsquo;s close</span>
          </p>
        )
      ) : null}
    </div>
  )
}

