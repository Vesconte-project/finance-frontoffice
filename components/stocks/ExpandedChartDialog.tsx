'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import MeasureSummary, { describeMeasurement } from '@/components/charts/MeasureSummary'
import Dialog from '@/components/ui/Dialog'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { measureBetween } from '@/lib/chart-measure'
import { formatMoney, formatSignedMoney } from '@/lib/currency'
import { EVENT_CATEGORY_LABEL, markerBarIndex, nextSessionChange, type EventMarker } from '@/lib/event-markers'
import { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import {
  INTRADAY_RANGES,
  availableRanges,
  panView,
  summarizeVisible,
  viewForRange,
  type ChartView,
  type ExpandedChartRange,
} from '@/lib/expanded-chart'
import type { OhlcPoint } from '@/lib/ohlc-data'
import { cn } from '@/lib/utils'
import ExpandedPriceCanvas, {
  type ChartAnchor,
  type ChartDrawing,
  type ChartEvent,
  type ChartKind,
  type ChartMeasure,
  type DrawingTool,
} from './ExpandedPriceCanvas'
import styles from './ExpandedChart.module.css'

type Indicator = 'moving-averages' | 'bollinger' | 'rsi'

type Status =
  | { kind: 'info'; title: string; body: string }
  | { kind: 'error'; title: string; body: string; reference: string }

const KIND_OPTIONS = ['Candles', 'Line'] as const
type KindLabel = (typeof KIND_OPTIONS)[number]

const INDICATORS: Array<{ key: Indicator; label: string; missing: string; about: string }> = [
  { key: 'moving-averages', label: 'Moving averages', missing: 'Moving averages are not available yet.', about: 'The average of the last 20, 50 and 200 closes.' },
  { key: 'bollinger', label: 'Bollinger bands', missing: 'Bollinger bands are not available yet.', about: 'A band two typical deviations either side of the 20-day average.' },
  { key: 'rsi', label: 'RSI', missing: 'RSI is not available yet.', about: 'Compares recent gains with recent losses on a 0 to 100 scale over 14 days.' },
]

const DRAWING_HELP: Record<DrawingTool, Status> = {
  fibonacci: {
    kind: 'info',
    title: 'Fibonacci',
    body: 'Pick a low and a high. Levels at 23.6%, 38.2%, 50%, 61.8% and 78.6% appear between them.',
  },
  trend: { kind: 'info', title: 'Trend line', body: 'Pick two points to draw a line between them.' },
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const VOLUME_FORMAT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function formatDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`))
}

export type ExpandedChartDialogProps = {
  open: boolean
  onClose: () => void
  ticker: string
  currency: string
  bars: readonly OhlcPoint[]
  /** Line or candles, shared with the hero chart. */
  kind: ChartKind
  onKindChange: (kind: ChartKind) => void
  returnFocusRef: RefObject<HTMLElement | null>
  /** Company events for the Events layer; `null` when they could not be loaded. */
  events?: readonly EventMarker[] | null
}

/**
 * Mount only while open: each opening starts fresh at the default range.
 *
 * Full-screen price chart for one ticker: candles or a close line, volume,
 * zoom and pan, a reading crosshair, and two reader-drawn tools. Indicator
 * series and intraday ranges are listed but answer with an explicit error
 * until the backend supplies them (ENG-152, ENG-153); nothing is approximated.
 */
export default function ExpandedChartDialog({ open, onClose, ticker, currency, bars, kind, onKindChange, returnFocusRef, events = [] }: ExpandedChartDialogProps) {
  const ranges = useMemo(() => availableRanges(bars), [bars])
  const [range, setRange] = useState<ExpandedChartRange>('1Y')
  const [viewRequest, setViewRequest] = useState(() => ({ view: viewForRange(bars, '1Y'), id: 0 }))
  const [measure, setMeasure] = useState<ChartMeasure | null>(null)
  const [measuring, setMeasuring] = useState(false)
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const [showVolume, setShowVolume] = useState(true)
  const [drawTool, setDrawTool] = useState<DrawingTool | null>(null)
  const [pending, setPending] = useState<ChartAnchor | null>(null)
  const [drawings, setDrawings] = useState<ChartDrawing[]>([])
  const [inspected, setInspected] = useState<number | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [summary, setSummary] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const canvasFocusRef = useRef<HTMLCanvasElement | null>(null)
  const [showEvents, setShowEvents] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const currentViewRef = useRef<ChartView>(viewRequest.view)
  // Each event on its trading day; events outside the loaded prices are left out.
  const placedEvents = useMemo(() => {
    const dates = bars.map((item) => item.date)
    return (events ?? []).flatMap((event) => {
      const index = markerBarIndex(dates, event.date)
      return index === null ? [] : [{ ...event, index }]
    })
  }, [bars, events])
  const chartEvents = useMemo<ChartEvent[]>(
    () => placedEvents.map(({ id, index, category }) => ({ id, index, category })),
    [placedEvents],
  )
  const selectedPosition = placedEvents.findIndex((event) => event.id === selectedEvent)
  const selected = selectedPosition >= 0 ? placedEvents[selectedPosition] : null
  // The close-to-close change on the session after the event's day (Spec: "efeito no dia seguinte").
  const selectedNextDay = selected ? nextSessionChange(bars.map((item) => item.close), selected.index) : null
  const closes = useMemo(() => bars.map((bar) => ({ date: bar.date, value: bar.close })), [bars])
  const measurement = measure ? measureBetween(closes, measure.first, measure.second) : null
  const formatChange = (value: number) => formatSignedMoney(value, currency)

  const onMeasure = useCallback((next: ChartMeasure | null, done: boolean) => {
    setMeasuring(!done && next !== null)
    if (done && (!next || Math.round(next.first) === Math.round(next.second))) {
      setMeasure(null)
      return
    }
    setMeasure(next)
  }, [])

  // A finished measurement stays until a tap outside the chart (or Escape on it).
  useEffect(() => {
    if (!measure || measuring) return
    const dismiss = (event: PointerEvent) => {
      if (chartAreaRef.current?.contains(event.target as Node)) return
      setMeasure(null)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [measure, measuring])
  const summaryTimer = useRef<number | null>(null)

  const requestRange = useCallback((next: ExpandedChartRange) => {
    setRange(next)
    setViewRequest((current) => ({ view: viewForRange(bars, next), id: current.id + 1 }))
  }, [bars])

  useEffect(() => () => {
    if (summaryTimer.current !== null) window.clearTimeout(summaryTimer.current)
  }, [])

  const onViewChange = useCallback((view: ChartView) => {
    currentViewRef.current = view
    if (summaryTimer.current !== null) window.clearTimeout(summaryTimer.current)
    summaryTimer.current = window.setTimeout(() => {
      const facts = summarizeVisible(bars, view)
      setSummary(
        facts
          ? `From ${formatDate(facts.firstDate)} to ${formatDate(facts.lastDate)}: close from ${formatMoney(facts.firstClose, currency)} to ${formatMoney(facts.lastClose, currency)}, high ${formatMoney(facts.high, currency)}, low ${formatMoney(facts.low, currency)}.`
          : '',
      )
    }, 400)
  }, [bars, currency])

  const chooseDrawTool = (tool: DrawingTool) => {
    const next = drawTool === tool ? null : tool
    setDrawTool(next)
    setPending(null)
    setStatus(next ? DRAWING_HELP[next] : null)
  }

  const onPick = useCallback((anchor: ChartAnchor) => {
    if (!drawTool) return
    if (!pending) {
      setPending(anchor)
      return
    }
    setDrawings((current) => [...current, { tool: drawTool, first: pending, second: anchor }])
    setAnnouncement(drawTool === 'fibonacci' ? 'Fibonacci levels drawn.' : 'Trend line drawn.')
    setPending(null)
    setDrawTool(null)
    setStatus(null)
  }, [drawTool, pending])

  const showIndicatorError = (indicator: (typeof INDICATORS)[number]) => {
    setStatus({
      kind: 'error',
      title: indicator.missing,
      body: `${indicator.about} The data for this indicator does not reach the site yet, so nothing is drawn rather than an approximation.`,
      reference: 'ENG-152',
    })
  }

  const showIntradayError = (label: string) => {
    setStatus({
      kind: 'error',
      title: `Intraday prices are missing for ${label}.`,
      body: 'There is one price per day, so this range stays blocked rather than showing an approximation.',
      reference: 'ENG-153',
    })
  }

  // Choosing an event from the card brings it into view if it is off screen.
  const selectEventAt = (position: number) => {
    const event = placedEvents[position]
    if (!event) return
    setSelectedEvent(event.id)
    const view = currentViewRef.current
    if (event.index < view.from + 0.5 || event.index > view.to - 0.5) {
      setViewRequest((current) => ({ view: panView(view, event.index - (view.from + view.to) / 2, bars.length), id: current.id + 1 }))
    }
  }

  const toggleEvents = () => {
    if (events === null) {
      setStatus({ kind: 'error', title: 'Events could not be loaded.', body: 'The company events for this chart are unavailable right now, so none are marked.', reference: 'ENG-156' })
      return
    }
    const next = !showEvents
    setShowEvents(next)
    if (next && !selected && placedEvents.length) {
      // Start from the latest event inside the current view, or the latest one.
      const view = currentViewRef.current
      const inView = placedEvents.map((event, position) => ({ event, position })).filter(({ event }) => event.index >= view.from && event.index <= view.to)
      selectEventAt((inView.at(-1) ?? { position: placedEvents.length - 1 }).position)
    }
  }

  const handleClose = () => {
    setDrawTool(null)
    setPending(null)
    setStatus(null)
    setInspected(null)
    onClose()
  }

  const shown = inspected ?? bars.length - 1
  const bar = bars[shown]
  const closeTone = !bar || bar.open === null ? undefined : bar.close >= bar.open ? styles.up : styles.down

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      labelledBy="expanded-chart-title"
      describedBy="expanded-chart-summary"
      initialFocusRef={canvasFocusRef}
      returnFocusRef={returnFocusRef}
      className={styles.dialog}
    >
      <div className={styles.layout}>
        <header className={styles.header}>
          <h2 id="expanded-chart-title" className={styles.title}>{ticker}</h2>
          <p className={styles.subtitle}>Price chart · daily · {currency}</p>
        </header>

        {measurement ? (
          <div className={styles.legend}>
            <MeasureSummary measurement={measurement} formatChange={formatChange} inline />
          </div>
        ) : bar ? (
          <p className={styles.legend} data-expanded-chart-legend="">
            <span>{formatDate(bar.date)}</span>
            {bar.open !== null ? <span>O <b>{formatMoney(bar.open, currency)}</b></span> : null}
            {bar.high !== null ? <span>H <b>{formatMoney(bar.high, currency)}</b></span> : null}
            {bar.low !== null ? <span>L <b>{formatMoney(bar.low, currency)}</b></span> : null}
            <span>C <b className={closeTone}>{formatMoney(bar.close, currency)}</b></span>
            {showVolume && bar.volume !== null ? <span>Vol <b>{VOLUME_FORMAT.format(bar.volume)}</b></span> : null}
          </p>
        ) : null}

        <div ref={chartAreaRef} className={styles.chartArea} data-expanded-chart-canvas="">
          <ExpandedPriceCanvas
            focusRef={canvasFocusRef}
            bars={bars}
            currency={currency}
            kind={kind}
            showVolume={showVolume}
            viewRequest={viewRequest}
            drawTool={drawTool}
            drawings={drawings}
            pending={pending}
            onPick={onPick}
            measure={measure}
            onMeasure={onMeasure}
            onInspect={setInspected}
            onViewChange={onViewChange}
            onReset={() => requestRange(range)}
            events={chartEvents}
            showEvents={showEvents}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            ariaLabel={`${ticker} daily price chart. Use plus and minus to zoom and the arrow keys to move.`}
            describedBy="expanded-chart-summary"
          />
          {drawTool ? (
            <span className={styles.hint} aria-hidden="true">{pending ? 'Tap the second point' : 'Tap the first point'}</span>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {measurement && !measuring ? describeMeasurement(measurement, formatChange) : ''}
          </p>
          <p id="expanded-chart-summary" className="sr-only" aria-live="polite">{summary}</p>
          <p className="sr-only" aria-live="polite">{announcement}</p>
        </div>

        {showEvents ? (
          <div className={styles.eventCard} data-event-card="" aria-live="polite">
            {selected ? (
              <>
                <div className={styles.eventText}>
                  <p className={styles.eventMeta}>
                    <span className={styles.eventCategory} data-category={selected.category}>{EVENT_CATEGORY_LABEL[selected.category]}</span>
                    <time dateTime={selected.date}>{formatDate(selected.date)}</time>
                    <span data-event-next-day="" data-tone={selectedNextDay === null || selectedNextDay === 0 ? undefined : selectedNextDay > 0 ? 'up' : 'down'}>
                      {selectedNextDay === null
                        ? 'Next day: not traded yet'
                        : `Next day ${selectedNextDay > 0 ? '+' : selectedNextDay < 0 ? '−' : ''}${Math.abs(selectedNextDay).toFixed(1)}%`}
                    </span>
                  </p>
                  <p className={styles.eventTitle}>{selected.title}</p>
                </div>
                <div className={styles.eventNav}>
                  <button type="button" className={styles.tool} onClick={() => selectEventAt(selectedPosition - 1)} disabled={selectedPosition <= 0} aria-label="Previous event">←</button>
                  <span className={styles.eventCount}>{selectedPosition + 1} / {placedEvents.length}</span>
                  <button type="button" className={styles.tool} onClick={() => selectEventAt(selectedPosition + 1)} disabled={selectedPosition >= placedEvents.length - 1} aria-label="Next event">→</button>
                </div>
              </>
            ) : (
              <p className={styles.eventTitle}>No company events are recorded for these prices.</p>
            )}
            <p className={styles.eventPending} data-events-pending=""><BeingBuiltBadge /> Insider trades are being added to this layer.</p>
          </div>
        ) : null}

        <div className={styles.controls}>
          <div className={styles.rangeGroup} role="group" aria-label="Chart range">
            {INTRADAY_RANGES.map((label) => (
              <button
                key={label}
                type="button"
                className={styles.unavailableRange}
                aria-label={`${label}, intraday prices missing`}
                onClick={() => showIntradayError(label)}
              >
                {label}
              </button>
            ))}
            <SegmentedControl
              options={ranges}
              value={range}
              onChange={requestRange}
              ariaLabel="Daily range"
              analyticsId="ticker_expanded_chart_range"
            />
          </div>
          <SegmentedControl<KindLabel>
            options={KIND_OPTIONS}
            value={kind === 'candles' ? 'Candles' : 'Line'}
            onChange={(label) => onKindChange(label === 'Candles' ? 'candles' : 'line')}
            ariaLabel="Chart type"
            analyticsId="ticker_expanded_chart_type"
          />
        </div>

        {status ? (
          <div
            className={cn(styles.status, status.kind === 'error' ? styles.statusError : styles.statusInfo)}
            role={status.kind === 'error' ? 'alert' : 'status'}
          >
            <div>
              <strong>{status.title}</strong> {status.body}
              {status.kind === 'error' ? <span className={styles.reference}> ({status.reference})</span> : null}
            </div>
            {!drawTool ? (
              <button type="button" className={styles.statusClose} onClick={() => setStatus(null)}>OK</button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.tools} role="toolbar" aria-label="Chart tools">
          <button
            type="button"
            className={styles.tool}
            aria-pressed={showVolume}
            onClick={() => setShowVolume((value) => !value)}
          >
            <span className={styles.toolDot} aria-hidden="true" />Volume
          </button>
          <button
            type="button"
            className={cn(styles.tool, events === null && styles.unavailableTool)}
            aria-pressed={events === null ? undefined : showEvents}
            aria-label={events === null ? 'Events, not available right now' : undefined}
            data-events-toggle=""
            onClick={toggleEvents}
          >
            <span className={styles.toolDot} aria-hidden="true" />Events
          </button>
          <button type="button" className={cn(styles.tool, styles.drawTool)} aria-pressed={drawTool === 'fibonacci'} onClick={() => chooseDrawTool('fibonacci')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 5h18M3 10h18M3 14h18M3 19h18" /></svg>
            Fibonacci
          </button>
          <button type="button" className={cn(styles.tool, styles.drawTool)} aria-pressed={drawTool === 'trend'} onClick={() => chooseDrawTool('trend')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 19L20 5" /><circle cx="4" cy="19" r="2" /><circle cx="20" cy="5" r="2" /></svg>
            Trend line
          </button>
          {INDICATORS.map((indicator) => (
            <button
              key={indicator.key}
              type="button"
              className={cn(styles.tool, styles.unavailableTool)}
              aria-label={`${indicator.label}, not available yet`}
              data-indicator={indicator.key}
              onClick={() => showIndicatorError(indicator)}
            >
              <span className={styles.toolDot} aria-hidden="true" />{indicator.label}
            </button>
          ))}
          {drawings.length > 0 ? (
            <button
              type="button"
              className={styles.tool}
              onClick={() => {
                setDrawings([])
                setAnnouncement('Drawings cleared.')
              }}
            >
              Clear drawings
            </button>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
