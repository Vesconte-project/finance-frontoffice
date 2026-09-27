'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { Lock } from 'lucide-react'
import StatementChart, { type StatementSeries } from '@/components/stocks/StatementChart'
import {
  WIDE_WINDOW_MIN_WIDTH,
  clampStart,
  latestStart,
  startCentredOn,
  startForKey,
  windowSize,
  windowValueText,
  type HistoryPeriod,
  type LockedHistoryCopy,
} from '@/lib/statement-history'
import styles from './ResearchViews.module.css'

export type StatementTableRow = {
  key: string
  label: string
  /** Formatted on the server, one per allowed period, oldest first. */
  cells: string[]
}

const WIDE_QUERY = `(min-width: ${WIDE_WINDOW_MIN_WIDTH}px)`

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

// The server renders the wide window; a narrow screen narrows it on hydration,
// and without JavaScript the table stays natively scrollable (§4.5).
function useWideWindow(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true)
}

// Horizontal wheel travel that moves the window one period. Discrete steps, no
// inertia (§4.3).
const WHEEL_STEP_PX = 48

/**
 * One statement's chart and table, showing a fixed window of periods, with the
 * scrubber that moves it and — at the oldest allowed period — the locked zone.
 *
 * Everything this receives was already cut to the reader's plan on the server
 * (`lib/statement-history.ts`). The withheld periods arrive as a count; the
 * locked zone is drawn from nothing else.
 */
export default function StatementHistoryWindow({
  periodLabels,
  series,
  rows,
  currency,
  accentColor,
  caption,
  period,
  withheld,
  locked,
}: {
  periodLabels: string[]
  series: StatementSeries[]
  rows: StatementTableRow[]
  currency: string
  accentColor: string
  caption: string
  period: HistoryPeriod
  withheld: number
  locked: LockedHistoryCopy | null
}) {
  const wide = useWideWindow()
  const total = periodLabels.length
  const size = Math.min(total, windowSize(period, wide))
  // `null` is "the most recent periods", so a window that has not been moved
  // stays anchored at the newest period when the viewport changes its size.
  const [chosenStart, setChosenStart] = useState<number | null>(null)
  const start = chosenStart === null ? latestStart(total, size) : clampStart(chosenStart, total, size)
  const end = start + size
  const scrollable = total > size
  const showLocked = locked !== null && start === 0

  const move = (next: number) => setChosenStart(clampStart(next, total, size))

  // Horizontal trackpad scroll over the chart. Registered by hand because React
  // attaches wheel listeners as passive, and a horizontal gesture that moves the
  // window must not also scroll the page sideways. Vertical scrolling is left
  // entirely alone.
  const chartRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ start, total, size, travel: 0 })
  useEffect(() => {
    stateRef.current.start = start
    stateRef.current.total = total
    stateRef.current.size = size
  }, [start, total, size])
  useEffect(() => {
    const node = chartRef.current
    if (!node || !scrollable) return
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      event.preventDefault()
      const state = stateRef.current
      state.travel += event.deltaX
      const steps = Math.trunc(state.travel / WHEEL_STEP_PX)
      if (steps === 0) return
      state.travel -= steps * WHEEL_STEP_PX
      setChosenStart(clampStart(state.start + steps, state.total, state.size))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [scrollable])

  // Touch swipe over the chart: the periods follow the finger, one slot at a time.
  const swipe = useRef<{ id: number; x: number; start: number; slot: number } | null>(null)
  const onChartPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrollable || event.pointerType !== 'touch') return
    const slot = event.currentTarget.getBoundingClientRect().width / Math.max(1, size)
    swipe.current = { id: event.pointerId, x: event.clientX, start, slot }
  }
  const onChartPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = swipe.current
    if (!active || active.id !== event.pointerId) return
    move(active.start - Math.round((event.clientX - active.x) / active.slot))
  }
  const endSwipe = () => {
    swipe.current = null
  }

  const windowSeries = series.map((entry) => ({ ...entry, values: entry.values.slice(start, end) }))
  const windowLabels = periodLabels.slice(start, end)
  const hasChart = windowSeries.some((entry) => entry.values.some((value) => value !== null))

  return (
    <div className={styles.statementBody}>
      <div className={styles.statementChartColumn}>
        <div
          ref={chartRef}
          className={styles.statementChartArea}
          data-lenis-prevent-horizontal
          data-scrollable={scrollable || undefined}
          onPointerDown={onChartPointerDown}
          onPointerMove={onChartPointerMove}
          onPointerUp={endSwipe}
          onPointerCancel={endSwipe}
        >
          {showLocked ? <LockedChartZone copy={locked} /> : null}
          {hasChart ? (
            <div className={styles.statementChartSlot}>
              <StatementChart
                periods={windowLabels}
                series={windowSeries}
                currency={currency}
                accentColor={accentColor}
                caption={caption}
              />
            </div>
          ) : null}
        </div>
        {scrollable ? (
          <HistoryScrubber
            labels={periodLabels}
            start={start}
            size={size}
            withheld={withheld}
            onMove={move}
          />
        ) : null}
      </div>

      <div className={styles.statementTableWrap}>
        <table className={styles.statementTable}>
          <thead>
            <tr>
              <th scope="col">Line item</th>
              {showLocked ? <td className={styles.statementLockedCell} aria-hidden="true"><Lock /></td> : null}
              {windowLabels.map((label, index) => <th scope="col" key={start + index}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {showLocked ? <td className={styles.statementLockedCell} aria-hidden="true"><span /></td> : null}
                {row.cells.slice(start, end).map((cell, index) => <td key={start + index}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Generic bars under a glass layer, with the copy and one link.
 *
 * The bars are fixed shapes, not scaled from anything: blurring real figures
 * would still ship them to the browser, and there are none here to blur.
 */
const PLACEHOLDER_BARS = [58, 72, 64, 80]

function LockedChartZone({ copy }: { copy: LockedHistoryCopy }) {
  return (
    <aside className={styles.statementLockedZone} aria-label={copy.heading}>
      <div className={styles.statementLockedBars} aria-hidden="true">
        {PLACEHOLDER_BARS.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
      </div>
      <div className={styles.statementLockedGlass}>
        <Lock className={styles.statementLockedIcon} aria-hidden="true" />
        <p className={styles.statementLockedHeading}>{copy.heading}</p>
        <p className={styles.statementLockedBody}>{copy.body}</p>
        <Link
          href={copy.href}
          className={styles.statementLockedLink}
          {...(copy.analyticsId
            ? { 'data-analytics-id': copy.analyticsId, 'data-analytics-event': 'auth_start', 'data-analytics-intent': 'sign_up' }
            : {})}
        >
          {copy.linkLabel}
        </Link>
      </div>
    </aside>
  )
}

/**
 * A thin track and one glass thumb (§4.3).
 *
 * The track is the whole history that exists: the withheld periods, if any, as a
 * muted segment at its left, then the allowed ones. The thumb is the window and
 * never enters the muted segment. It snaps to whole periods and moves without
 * inertia; its transition is dropped while dragging and under reduced motion.
 */
function HistoryScrubber({
  labels,
  start,
  size,
  withheld,
  onMove,
}: {
  labels: string[]
  start: number
  size: number
  withheld: number
  onMove: (start: number) => void
}) {
  const total = labels.length
  const units = withheld + total
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; start: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const unitWidth = () => (trackRef.current?.getBoundingClientRect().width ?? 1) / units

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, start }
    setDragging(true)
  }
  const onThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    onMove(active.start + Math.round((event.clientX - active.x) / unitWidth()))
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const unit = Math.floor(((event.clientX - box.left) / box.width) * units)
    onMove(startCentredOn(unit - withheld, total, size))
  }

  return (
    <div
      ref={trackRef}
      className={styles.historyTrack}
      onPointerDown={onTrackPointerDown}
      style={{
        ['--muted-share' as string]: `${(withheld / units) * 100}%`,
        ['--thumb-left' as string]: `${((withheld + start) / units) * 100}%`,
        ['--thumb-width' as string]: `${(size / units) * 100}%`,
      }}
    >
      {withheld > 0 ? <span className={styles.historyTrackMuted} aria-hidden="true" /> : null}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Periods shown"
        aria-valuemin={0}
        aria-valuemax={total - size}
        aria-valuenow={start}
        aria-valuetext={windowValueText(labels, start, size)}
        className={styles.historyThumb}
        data-dragging={dragging || undefined}
        onPointerDown={onThumbPointerDown}
        onPointerMove={onThumbPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const next = startForKey(event.key, start, total, size)
          if (next === null) return
          event.preventDefault()
          onMove(next)
        }}
      />
    </div>
  )
}
