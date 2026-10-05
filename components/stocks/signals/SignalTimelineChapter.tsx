'use client'

import { useState, type KeyboardEvent } from 'react'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import { labelPosition, type PlotBox } from '@/lib/chart-labels'
import { formatMoney } from '@/lib/currency'
import styles from './Signals.module.css'

export type TimelineClose = { date: string; close: number }

export type TimelineSignal = {
  id: string
  date: string
  direction: 'bullish' | 'bearish' | 'neutral'
  horizon: number | null
  /** The price the model recorded with the signal, when it gives one. */
  price: number | null
}

const WIDE: PlotBox = { width: 720, height: 260 }
const COMPACT: PlotBox = { width: 320, height: 230 }

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function formatDay(value: string, short = false): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? (short ? shortDay : dayFormat).format(parsed) : value
}

function directionLabel(value: TimelineSignal['direction']): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Plot({
  closes,
  markers,
  box,
  variant,
  currency,
  selected,
  onSelect,
  onKey,
}: {
  closes: readonly TimelineClose[]
  markers: ReadonlyArray<TimelineSignal & { index: number }>
  box: PlotBox
  variant: 'wide' | 'compact'
  currency: string
  selected: string | null
  onSelect: (id: string) => void
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  const top = 16
  const bottom = 30
  const side = 6
  const values = closes.map((point) => point.close)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max((high - low) * 0.12, Math.abs(high) * 0.002, 0.01)
  const floor = low - pad
  const ceiling = high + pad
  const x = (index: number) => side + (index / Math.max(1, closes.length - 1)) * (box.width - side * 2)
  const y = (value: number) => top + (1 - (value - floor) / (ceiling - floor)) * (box.height - top - bottom)
  const path = closes.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.close).toFixed(1)}`).join(' ')
  const area = `${path} L${x(closes.length - 1).toFixed(1)},${box.height - bottom} L${x(0).toFixed(1)},${box.height - bottom} Z`
  // Two gridlines with their value written on them: the period's high and low closes.
  const grid = [high, low]
  const last = closes.length - 1

  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          {grid.map((value) => (
            <ChartLabel key={value} box={box} x={side} y={y(value) - 3} anchor="start" baseline="end" tone="muted">
              {formatMoney(value, currency)}
            </ChartLabel>
          ))}
          <ChartLabel box={box} x={x(0)} y={box.height - 12} anchor="start" tone="muted">{formatDay(closes[0].date, true)}</ChartLabel>
          <ChartLabel box={box} x={x(last)} y={box.height - 12} anchor="end" tone="muted">{formatDay(closes[last].date, true)}</ChartLabel>
          <div className={styles.markers} role="group" aria-label="Signals on the price">
            {markers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className={styles.marker}
                data-direction={marker.direction}
                aria-pressed={selected === marker.id}
                aria-label={`${directionLabel(marker.direction)} signal, ${formatDay(marker.date)}`}
                tabIndex={selected === marker.id ? 0 : -1}
                style={labelPosition(box, x(marker.index), y(closes[marker.index].close))}
                onClick={() => onSelect(marker.id)}
                onKeyDown={onKey}
              />
            ))}
          </div>
        </>
      )}
    >
      {grid.map((value) => (
        <line key={value} className={styles.gridLine} x1={0} x2={box.width} y1={y(value)} y2={y(value)} />
      ))}
      <path className={styles.area} d={area} />
      <path className={styles.line} d={path} />
    </ChartPlot>
  )
}

/**
 * The model's signals on the last month of prices (Spec PRD-78, global rules):
 * names and numbers on the chart, each signal a point the reader can pick, and
 * the picked signal in the card beside it.
 */
export default function SignalTimelineChapter({
  ticker,
  closes,
  signals,
  currency,
}: {
  ticker: string
  closes: TimelineClose[]
  /** Oldest first. */
  signals: TimelineSignal[]
  currency: string
}) {
  const dates = closes.map((point) => point.date.slice(0, 10))
  const markers = signals.flatMap((signal) => {
    const index = dates.indexOf(signal.date.slice(0, 10))
    return index < 0 ? [] : [{ ...signal, index }]
  })
  const [picked, setPicked] = useState<string | null>(null)
  const latest = signals.at(-1) ?? null
  const shown = signals.find((signal) => signal.id === picked) ?? latest
  const selectedMarker = markers.some((marker) => marker.id === shown?.id) ? shown!.id : markers.at(-1)?.id ?? null

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const position = markers.findIndex((marker) => marker.id === selectedMarker)
    const moves: Record<string, number> = { ArrowLeft: position - 1, ArrowRight: position + 1, Home: 0, End: markers.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = markers[Math.max(0, Math.min(markers.length - 1, moves[event.key]))]
    if (!next) return
    setPicked(next.id)
    const group = event.currentTarget.parentElement
    window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus())
  }

  return (
    <ResearchChapter
      id="signal-timeline"
      label="Model signal"
      aside={shown ? (
        <ChapterCard title={shown === latest ? 'Latest signal' : 'Signal'} meta={formatDay(shown.date)}>
          <div className={styles.signalCard} data-direction={shown.direction} data-signal-card="">
            <p className={styles.signalDirection}><span className={styles.signalDot} aria-hidden="true" />{directionLabel(shown.direction)}</p>
            <dl className={styles.signalFacts}>
              {shown.horizon ? <div><dt>Horizon</dt><dd>{shown.horizon} days</dd></div> : null}
              {shown.price !== null ? <div><dt>Price at signal</dt><dd>{formatMoney(shown.price, currency)}</dd></div> : null}
            </dl>
          </div>
        </ChapterCard>
      ) : (
        <BeingBuilt label="Latest signal">The model’s latest signal for {ticker}, with its date and horizon, is being added.</BeingBuilt>
      )}
    >
      {closes.length >= 2 ? (
        <ChartFrame
          ariaLabel={`${ticker} closing price from ${formatDay(closes[0].date)} to ${formatDay(closes.at(-1)!.date)}, with ${markers.length} model ${markers.length === 1 ? 'signal' : 'signals'} on it`}
          className={styles.timelineFrame}
        >
          <Plot closes={closes} markers={markers} box={WIDE} variant="wide" currency={currency} selected={selectedMarker} onSelect={setPicked} onKey={onKey} />
          <Plot closes={closes} markers={markers} box={COMPACT} variant="compact" currency={currency} selected={selectedMarker} onSelect={setPicked} onKey={onKey} />
        </ChartFrame>
      ) : (
        <BeingBuilt size="chart">The last month of {ticker}’s price, with the model’s signals on it, is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}
