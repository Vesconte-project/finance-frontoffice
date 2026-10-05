'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Suspense, use, useMemo, useRef, useState } from 'react'
import { ChartCandlestick, ChartLine, Maximize2 } from 'lucide-react'
import SegmentedControl from '@/components/ui/SegmentedControl'
import TemporalLineChart, { type TemporalLinePoint } from '@/components/charts/TemporalLineChart'
import type { OhlcPoint, PricePoint } from '@/lib/finance'
import type { Scorecard } from '@/lib/scorecard-types'
import {
  buildTechnicalSummary,
  distanceFromAverage,
  type TechnicalAction,
  type TechnicalGaugeData,
  type TechnicalTimeframe,
} from '@/lib/technicalSignals'
import type { EventMarker } from '@/lib/event-markers'
import type { ScorecardAxis } from '@/lib/scorecard-types'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import MiniBars from '@/components/stocks/research/MiniBars'
import { formatCompactMoney } from '@/lib/currency'
import { shortYear, type ReportedPoint } from '@/lib/statement-reading'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import { hasUsableMaterializedScorecard } from '@/lib/ticker-page-scorecard'
import { cn } from '@/lib/utils'
import styles from './StockOverviewClient.module.css'
import expandedChartStyles from './ExpandedChart.module.css'
import ScorecardDisc from './ScorecardDisc'
import type { ExpandedChartDialogProps } from './ExpandedChartDialog'

// The expanded chart's code loads only when a reader opens it.
const ExpandedChartDialog = dynamic(() => import('./ExpandedChartDialog'), { ssr: false })

type SignalDirection = 'bullish' | 'neutral' | 'bearish'
type ChartTimeframe = '1D' | '5D' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | '10Y' | 'ALL'
type HistoricalChartState = 'loaded' | 'empty' | 'error'
type FullHistoryState = 'idle' | 'loading' | 'loaded' | 'error'

type OverviewStat = {
  label: string
  value: string
}

type OverviewRelatedAsset = {
  symbol: string
  name: string | null
  price: number | null
  changePercent: number | null
  relation: string
  strength: number | null
  confidence: number | null
}

/** A latest reported figure and the date it refers to. */
type OverviewFigure = {
  value: number
  asOf: string | null
}

type OverviewHolding = {
  symbol: string
  name: string
  weightPercent: number | null
}

type OverviewSectorWeight = {
  sector: string
  weightPercent: number | null
}

type OverviewEarnings = {
  date: string | null
  time: string | null
  fiscalPeriod: string | null
}

type OverviewSignal = {
  direction: SignalDirection
  conviction: number | null
  horizon: number | null
  signalDate: string | null
}

type OverviewRegimePoint = {
  signal_date: string
  direction: SignalDirection
  prob_side: number | null
  prediction_horizon: number
  episode_return: number | null
  episode_status: string | null
}

type StockOverviewClientProps = {
  ticker: string
  currency: string
  /** From the registry's instrument type (Spec "Instrument type as the single source V1"). */
  isFund: boolean
  latestSignal: OverviewSignal | null
  historicalData: PricePoint[]
  historicalChartState: HistoricalChartState
  ohlcData: OhlcPoint[]
  /** Formatted market cap, or null when the summary has none. */
  marketCap: string | null
  holdings: OverviewHolding[]
  sectorWeights: OverviewSectorWeight[]
  nextEarnings: OverviewEarnings | null
  relatedAssets: Promise<OverviewRelatedAsset[]>
  /** Company events for the expanded chart; resolves to null when unavailable. */
  chartEvents: Promise<EventMarker[] | null>
  regimeSignals: OverviewRegimePoint[]
  scorecard: Scorecard
  /** Reported annual revenue, oldest first, the same series the Fundamentals tab draws; null when unavailable. */
  revenue: Promise<ReportedPoint[] | null>
  /** The same latest figures the Fundamentals tab shows. */
  operatingMargin: OverviewFigure | null
  netCash: OverviewFigure | null
}

const HERO_TIMEFRAMES: ChartTimeframe[] = ['1D', '5D', '1M', '3M', 'YTD', '1Y', '5Y', '10Y', 'ALL']
const SIGNAL_TIMEFRAMES: TechnicalTimeframe[] = ['1D', '1W', '1M']

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions): string | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  })
}

function formatCompactPercent(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`
}

function formatConviction(value: number): string {
  const scaled = Math.abs(value) <= 1 ? value * 100 : value
  return `${scaled.toFixed(0)}%`
}

/** The model signal's direction, as the prototype writes it: "Bearish · 62% conviction". */
function directionCopy(direction: SignalDirection): string {
  if (direction === 'bullish') return 'Bullish'
  if (direction === 'bearish') return 'Bearish'
  return 'Neutral'
}

function directionTone(direction: SignalDirection | undefined): string | undefined {
  if (direction === 'bullish') return styles.positiveText
  if (direction === 'bearish') return styles.negativeText
  return undefined
}

function scorecardReadinessMessage(scorecard: Scorecard): string | null {
  if (hasUsableMaterializedScorecard(scorecard)) return null
  if (scorecard.readiness === 'pending_build') return 'Being built'
  if (scorecard.readiness === 'unavailable_missing_inputs') return 'Partial coverage'
  return 'Unavailable'
}

function actionTone(action: TechnicalAction): string {
  if (action === 'Buy') return styles.positiveText
  if (action === 'Sell') return styles.negativeText
  return styles.neutralText
}

function directionToneClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return styles.deltaNeutral
  if (value > 0) return styles.deltaPositive
  if (value < 0) return styles.deltaNegative
  return styles.deltaNeutral
}

function parseChartDate(value: string): number {
  return new Date(`${value}T00:00:00Z`).getTime()
}

function startDateForHeroTimeframe(timeframe: ChartTimeframe, latestDate: Date): number | null {
  if (timeframe === 'ALL') return null
  if (timeframe === '1D') return latestDate.getTime() - 1 * 24 * 60 * 60 * 1000
  if (timeframe === '5D') return latestDate.getTime() - 5 * 24 * 60 * 60 * 1000
  if (timeframe === '1M') return latestDate.getTime() - 30 * 24 * 60 * 60 * 1000
  if (timeframe === '3M') return latestDate.getTime() - 90 * 24 * 60 * 60 * 1000
  if (timeframe === 'YTD') return Date.UTC(latestDate.getUTCFullYear(), 0, 1)
  if (timeframe === '1Y') return latestDate.getTime() - 365 * 24 * 60 * 60 * 1000
  if (timeframe === '5Y') return latestDate.getTime() - 1825 * 24 * 60 * 60 * 1000
  return latestDate.getTime() - 3650 * 24 * 60 * 60 * 1000
}

function filterChartData<T extends { date: string }>(data: T[], timeframe: ChartTimeframe): T[] {
  if (timeframe === 'ALL') return data
  if (data.length <= 2) return data
  if (timeframe === '1D') return data.slice(-2)
  if (timeframe === '5D') return data.slice(-5)

  const latest = data[data.length - 1]
  if (!latest) return data
  const start = startDateForHeroTimeframe(timeframe, new Date(`${latest.date}T00:00:00Z`))
  if (start === null) return data

  const filtered = data.filter((point) => parseChartDate(point.date) >= start)
  return filtered.length >= 2 ? filtered : data
}

function gaugeArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toPoint = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const start = toPoint(startDeg)
  const end = toPoint(endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

// The expand and candle buttons over the chart's top-left corner, with a margin.
const HERO_TOOLS_CORNER = { width: 102, height: 54 }

function HeroPriceChart({
  points,
  mode,
  state,
  className,
  currency,
  onMeasureActiveChange,
  reservedCorner,
}: {
  points: TemporalLinePoint[]
  mode: 'line' | 'candles'
  onMeasureActiveChange: (active: boolean) => void
  reservedCorner?: { width: number; height: number }
  state: HistoricalChartState
  className?: string
  currency: string
}) {
  return (
    <TemporalLineChart
      className={cn(styles.heroChart, className)}
      points={points}
      mode={mode}
      measurable
      onMeasureActiveChange={onMeasureActiveChange}
      reservedCorner={reservedCorner}
      ariaLabel={mode === 'candles' ? 'Daily price candles' : 'Historical closing price'}
      valueFormat="currency"
      currency={currency}
      showRangeChange
      emptyState={
        <div className={styles.emptyState}>
          {state === 'error' ? 'Historical price data could not be loaded.' : 'Historical price data is unavailable.'}
        </div>
      }
    />
  )
}

/** "Moves with it" for a positive association; a negative one moves the other way. */
function movesCopy(strength: number | null): string | null {
  if (strength === null || !Number.isFinite(strength) || strength === 0) return null
  return strength > 0 ? 'Moves with it' : 'Moves against it'
}

/**
 * Relationships (Spec PRD-78): one row per company with its ticker, name,
 * "Moves with it", the strength as a bar and the day's change.
 */
function RelatedAssetsContent({
  ticker,
  relatedAssetsPromise,
}: {
  ticker: string
  relatedAssetsPromise: Promise<OverviewRelatedAsset[]>
}) {
  const relatedAssets = use(relatedAssetsPromise)
  const rankedAssets = [...relatedAssets]
    .sort((left, right) => Math.abs(right.strength ?? 0) - Math.abs(left.strength ?? 0))
    .slice(0, 5)

  return (
    <ResearchChapter
      id="relationships"
      label="Relationships"
      band
      actions={<Link href={`/stocks/${ticker}/relationships`} className={styles.inlineArrow}>View all →</Link>}
    >
      {rankedAssets.length > 0 ? (
        <ul className={styles.relatedAssets} aria-label={`Companies related to ${ticker}`}>
          {rankedAssets.map((asset) => {
            const strength = asset.strength !== null && Number.isFinite(asset.strength) ? asset.strength : null
            const change = asset.changePercent !== null && Number.isFinite(asset.changePercent) ? asset.changePercent : null
            const moves = movesCopy(strength)
            return (
              <li key={asset.symbol}>
                <Link href={`/stocks/${asset.symbol}`} className={styles.relatedRow} data-related-row="">
                  <span className={styles.relatedIdentity}>
                    <span className={styles.chipTicker}>{asset.symbol}</span>
                    {asset.name ? <span className={styles.relatedName}>{asset.name}</span> : null}
                  </span>
                  {moves ? <span className={styles.relatedMoves}>{moves}</span> : <span />}
                  {strength !== null ? (
                    <span className={styles.relationshipMagnitude}>
                      <span className={styles.strengthBar} aria-hidden="true" data-strength-bar="">
                        <span style={{ width: `${Math.max(0, Math.min(1, Math.abs(strength))) * 100}%` }} />
                      </span>
                      <strong aria-label={`Strength ${Math.abs(strength).toFixed(2)}`}>{Math.abs(strength).toFixed(2)}</strong>
                    </span>
                  ) : (
                    <span className={styles.relationshipMagnitude}><BeingBuiltBadge /></span>
                  )}
                  {change !== null ? (
                    <span className={cn(styles.relatedChange, directionToneClass(change))}>Today {formatCompactPercent(change)}</span>
                  ) : <span />}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <BeingBuilt size="inline">The companies that move most closely with {ticker} are being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}

/** Sell, neutral and buy counts in words, for the split bar and its rows. */
function countsLabel(counts: TechnicalGaugeData['counts']): string {
  return `${counts.sell} sell · ${counts.neutral} neutral · ${counts.buy} buy`
}

/** The technical summary: a dial, the verdict with its position, and every indicator's vote. */
function TechnicalSummaryPanel({ gauge }: { gauge: TechnicalGaugeData }) {
  const clamped = Math.max(0, Math.min(100, gauge.position))
  const needleAngle = (clamped / 100) * 180 - 90
  const total = gauge.counts.sell + gauge.counts.neutral + gauge.counts.buy
  const share = (count: number) => (total ? `${(count / total) * 100}%` : '0%')
  return (
    <div className={styles.technicalSummary} data-technical-summary="">
      <div className={styles.dialFrame}>
      <svg viewBox="0 0 120 70" className={styles.technicalDial} role="img" aria-label={`${gauge.verdict}, ${Math.round(clamped)} of 100`}>
        <path d={gaugeArcPath(60, 62, 46, -90, 90)} className={styles.gaugeArcTrack} />
        <path d={gaugeArcPath(60, 62, 46, -90, -34)} className={styles.gaugeArcSell} />
        <path d={gaugeArcPath(60, 62, 46, -30, 30)} className={styles.gaugeArcNeutral} />
        <path d={gaugeArcPath(60, 62, 46, 34, 90)} className={styles.gaugeArcBuy} />
        <g className={styles.gaugeNeedle} style={{ transform: `rotate(${needleAngle}deg)` }}>
          <path d="M 57.8 62 L 60 24.5 L 62.2 62 Z" />
        </g>
        <circle cx={60} cy={62} r={5.5} className={styles.gaugeHub} />
        <circle cx={60} cy={62} r={2.2} className={styles.gaugeHubCore} />
      </svg>
        {/* The dial runs from "Strong sell" to "Strong buy", written at its ends. */}
        <span className={styles.dialEnd} data-end="sell" aria-hidden="true">Strong sell</span>
        <span className={styles.dialEnd} data-end="buy" aria-hidden="true">Strong buy</span>
      </div>
      <div className={styles.technicalVerdict}>
        <span className={styles.technicalCaption}>All {total} indicators</span>
        <p>
          <strong className={actionTone(gauge.verdictAction)}>{gauge.verdict}</strong>
          <span>{Math.round(clamped)}/100</span>
        </p>
        <div className={styles.technicalSplit} aria-hidden="true">
          <span data-vote="sell" style={{ width: share(gauge.counts.sell) }} />
          <span data-vote="neutral" style={{ width: share(gauge.counts.neutral) }} />
          <span data-vote="buy" style={{ width: share(gauge.counts.buy) }} />
        </div>
        <p className={styles.technicalCounts}>{countsLabel(gauge.counts)}</p>
      </div>
    </div>
  )
}

const TAKES = ['Overdone', 'Fair', 'Not sure yet'] as const

/**
 * "What do you make of it?" (Spec PRD-78, founder decision 10): the take
 * buttons are visible and answer with an explicit message. Nothing is saved.
 */
function TakeButtons() {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.takes} data-takes="">
      <span className={styles.takesLabel} id="takes-label">What do you make of it?</span>
      <div className={styles.takeButtons} role="group" aria-labelledby="takes-label">
        {TAKES.map((take) => (
          <button key={take} type="button" className={styles.takeButton} onClick={() => setOpen(true)}>{take}</button>
        ))}
      </div>
      {open ? (
        <div className={styles.takeMessage} role="status" data-take-message="">
          <p>Opinions can’t be saved yet. Saving your take and following how the evidence changes is coming in a later version.</p>
          <button type="button" className={styles.takeOk} onClick={() => setOpen(false)}>OK</button>
        </div>
      ) : null}
    </div>
  )
}

/** One family of indicators (oscillators, moving averages) as a compact row. */
function TechnicalRow({ label, gauge }: { label: string; gauge: TechnicalGaugeData }) {
  const clamped = Math.max(0, Math.min(100, gauge.position))
  return (
    <div className={styles.technicalRow} data-technical-row="">
      <span className={styles.technicalRowLabel}>{label}</span>
      <span className={styles.technicalTrack} aria-hidden="true">
        <span className={styles.technicalMarker} style={{ left: `${clamped}%` }} />
      </span>
      <strong className={cn(styles.technicalRowVerdict, actionTone(gauge.verdictAction))}>{gauge.verdict}</strong>
      <span className={styles.technicalRowCounts} aria-label={countsLabel(gauge.counts)}>
        {gauge.counts.sell} · {gauge.counts.neutral} · {gauge.counts.buy}
      </span>
    </div>
  )
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? dayFormat.format(parsed) : value
}

/**
 * One Fundamentals card (Spec PRD-78): the value, a short line and ten years of
 * bars. What has not arrived carries the badge and no value.
 */
function FundamentalCard({
  label,
  figure,
  context,
  tone,
  bars,
  pending,
}: {
  label: string
  figure: string | null
  context: string
  tone?: 'down'
  bars?: React.ReactNode
  /** The sentence for the part that is still being built, if any. */
  pending?: string | null
}) {
  return (
    <div className={styles.fundamentalCard} data-fundamental-card={label.toLowerCase().replace(/\s+/g, '-')}>
      <div className={styles.fundamentalHead}>
        <h3>{label}</h3>
        {figure ? null : <BeingBuiltBadge />}
      </div>
      {figure ? (
        <p className={styles.fundamentalValue}>
          <strong data-tone={tone}>{figure}</strong>
          <span>{context}</span>
        </p>
      ) : null}
      {bars ?? null}
      {pending ? (
        <p className={styles.fundamentalNote}>
          {figure ? <><BeingBuiltBadge />{' '}</> : null}
          {pending}
        </p>
      ) : null}
    </div>
  )
}

/** Revenue: the latest reported year and ten years of bars, the last one highlighted. */
function RevenueCard({ revenuePromise, currency }: { revenuePromise: Promise<ReportedPoint[] | null>; currency: string }) {
  const points = (use(revenuePromise) ?? []).slice(-10)
  const latest = points.at(-1) ?? null
  if (!latest) {
    return <FundamentalCard label="Revenue" figure={null} context="" pending="The latest revenue and ten years of its history are being added." />
  }
  return (
    <FundamentalCard
      label="Revenue"
      figure={formatCompactMoney(latest.value, latest.currency ?? currency)}
      context={`reported for FY${latest.year}`}
      bars={points.length >= 2 ? (
        <MiniBars
          bars={points.map((point) => ({ key: point.periodEnd, value: point.value }))}
          firstLabel={shortYear(points[0].year)}
          lastLabel={shortYear(latest.year)}
          ariaLabel={`Reported revenue by fiscal year, ${points[0].year} to ${latest.year}`}
        />
      ) : null}
      pending={points.length < 10 ? 'Earlier years are being added.' : null}
    />
  )
}

/** The expanded chart, with the company events once they have arrived. */
function ExpandedChartWithEvents({
  eventsPromise,
  ...props
}: Omit<ExpandedChartDialogProps, 'events'> & { eventsPromise: Promise<EventMarker[] | null> }) {
  const events = use(eventsPromise)
  return <ExpandedChartDialog {...props} events={events} />
}

export default function StockOverviewClient({
  ticker,
  currency,
  isFund,
  latestSignal,
  historicalData,
  historicalChartState,
  ohlcData,
  marketCap,
  holdings,
  sectorWeights,
  nextEarnings,
  relatedAssets: relatedAssetsPromise,
  chartEvents,
  scorecard,
  revenue: revenuePromise,
  operatingMargin,
  netCash,
}: StockOverviewClientProps) {
  const [heroTimeframe, setHeroTimeframe] = useState<ChartTimeframe>('1Y')
  const [fullHistoricalData, setFullHistoricalData] = useState<PricePoint[] | null>(null)
  const [fullHistoryState, setFullHistoryState] = useState<FullHistoryState>('idle')
  const fullHistoryRequested = useRef(false)
  const [signalTimeframe, setSignalTimeframe] = useState<TechnicalTimeframe>('1D')
  const [selectedAxis, setSelectedAxis] = useState<ScorecardAxis['key'] | null>(null)
  const [chartExpanded, setChartExpanded] = useState(false)
  // Line or candles, shared by the hero and the expanded chart for this visit.
  const [chartKind, setChartKind] = useState<'line' | 'candles'>('line')
  // The corner buttons step aside while a measurement is on the chart.
  const [heroMeasuring, setHeroMeasuring] = useState(false)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  // Never offer an empty expanded chart: it opens only over loaded backend OHLC.
  const canExpandChart = historicalChartState === 'loaded' && ohlcData.length >= 2
  const scorecardMessage = scorecardReadinessMessage(scorecard)

  const chartHistory = (heroTimeframe === '10Y' || heroTimeframe === 'ALL') && fullHistoricalData
    ? fullHistoricalData
    : historicalData
  const filteredChartData = useMemo(
    () => filterChartData(chartHistory, heroTimeframe),
    [chartHistory, heroTimeframe],
  )
  const showCandles = chartKind === 'candles' && canExpandChart
  const heroPoints = useMemo<TemporalLinePoint[]>(
    () => showCandles
      ? filterChartData(ohlcData, heroTimeframe).map((bar) => ({
        date: bar.date,
        value: bar.close,
        open: bar.open,
        high: bar.high,
        low: bar.low,
      }))
      : filteredChartData.map((point) => ({ date: point.date, value: point.close })),
    [showCandles, ohlcData, heroTimeframe, filteredChartData],
  )
  // Candles exist only for the loaded OHLC window; say so when "ALL" reaches further back.
  const candlesFrom = showCandles && heroTimeframe === 'ALL' && ohlcData[0] && chartHistory[0] && chartHistory[0].date < ohlcData[0].date
    ? ohlcData[0].date
    : null
  const technicalSummary = useMemo(
    () => buildTechnicalSummary(ohlcData, signalTimeframe),
    [ohlcData, signalTimeframe]
  )
  const hasTechnicalData =
    ohlcData.length >= 30 &&
    [...technicalSummary.oscillatorRows, ...technicalSummary.movingAverageRows].some((row) => row.value !== '—')
  const technicalGauges = [
    { key: 'summary', label: 'Summary', gauge: technicalSummary.gauges.summary },
    { key: 'oscillators', label: 'Oscillators', gauge: technicalSummary.gauges.oscillators },
    { key: 'moving-averages', label: 'Moving averages', gauge: technicalSummary.gauges.movingAverages },
  ] as const
  const availableScorecardAxes = scorecard.axes.filter((axis) => axis.available && axis.score !== null).length
  const selectedAxisData = selectedAxis ? scorecard.axes.find((axis) => axis.key === selectedAxis) ?? null : null
  const toggleAxis = (key: ScorecardAxis['key']) => setSelectedAxis((current) => (current === key ? null : key))

  const selectHeroTimeframe = (timeframe: ChartTimeframe) => {
    const needsFullHistory = timeframe === '10Y' || timeframe === 'ALL'
    if (!needsFullHistory) {
      setHeroTimeframe(timeframe)
      return
    }

    if (fullHistoricalData) {
      setHeroTimeframe(timeframe)
      return
    }
    if (fullHistoryRequested.current) {
      setHeroTimeframe(fullHistoryState === 'error' ? '5Y' : timeframe)
      return
    }

    fullHistoryRequested.current = true
    setHeroTimeframe(timeframe)
    setFullHistoryState('loading')

    void fetch(`/api/stocks/${encodeURIComponent(ticker)}/history`)
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) throw new Error('Full history request failed.')

        const points = payload.filter((point): point is PricePoint => {
          if (!point || typeof point !== 'object') return false
          const candidate = point as Partial<PricePoint>
          return typeof candidate.date === 'string'
            && typeof candidate.close === 'number'
            && Number.isFinite(candidate.close)
        })
        if (points.length < 2) throw new Error('Full history is empty.')

        setFullHistoricalData(points)
        setFullHistoryState('loaded')
      })
      .catch(() => {
        setFullHistoryState('error')
        setHeroTimeframe((current) => current === '10Y' || current === 'ALL' ? '5Y' : current)
      })
  }

  const researchVerdicts = [
    {
      label: 'Model signal',
      value: latestSignal ? directionCopy(latestSignal.direction) : 'Unavailable',
      tone: directionTone(latestSignal?.direction),
      detail: latestSignal?.conviction !== null
        && latestSignal?.conviction !== undefined
        && Number.isFinite(latestSignal.conviction)
        ? `${formatConviction(latestSignal.conviction)} conviction`
        : null,
    },
    {
      label: `Technical · ${signalTimeframe}`,
      value: hasTechnicalData ? technicalSummary.gauges.summary.verdict : 'Not enough price history',
      tone: hasTechnicalData ? actionTone(technicalSummary.gauges.summary.verdictAction) : undefined,
      detail: hasTechnicalData ? `${Math.round(technicalSummary.gauges.summary.position)}/100` : null,
    },
  ]
  const nextEarningsReference = nextEarnings?.date
    ? formatDate(nextEarnings.date, { month: 'short', day: 'numeric' })
    : null
  const referenceFacts = [
    marketCap ? { label: 'Market cap', value: marketCap } : null,
    nextEarningsReference
      ? { label: 'Next earnings', value: nextEarningsReference }
      : null,
  ].filter((fact): fact is OverviewStat => fact !== null)

  const summaryGauge = technicalSummary.gauges.summary
  const readings = technicalSummary.readings
  const periodUnit = signalTimeframe === '1D' ? 'day' : signalTimeframe === '1W' ? 'week' : 'month'
  const keyReadings = [
    { label: 'RSI (14)', value: readings.rsi14 === null ? null : readings.rsi14.toFixed(0), tone: undefined },
    ...readings.averagePeriods.map((period, index) => {
      const distance = distanceFromAverage(readings.close, index === 0 ? readings.shortAverage : readings.longAverage)
      return {
        label: `vs ${period}-${periodUnit} average`,
        value: distance === null ? null : `${distance > 0 ? '+' : distance < 0 ? '−' : ''}${Math.abs(distance).toFixed(1)}%`,
        tone: distance === null || distance === 0 ? undefined : distance > 0 ? 'up' : 'down',
      }
    }),
    {
      label: 'MACD',
      value: readings.macd === null || readings.macdSignal === null
        ? null
        : readings.macd > readings.macdSignal ? 'above signal' : readings.macd < readings.macdSignal ? 'below signal' : 'on signal',
      tone: readings.macd === null || readings.macdSignal === null || readings.macd === readings.macdSignal
        ? undefined
        : readings.macd > readings.macdSignal ? 'up' : 'down',
    },
  ]

  const timingSection = (
    <ResearchChapter
      id="signals"
      label="Technicals"
      actions={(
        <SegmentedControl
          options={SIGNAL_TIMEFRAMES}
          value={signalTimeframe}
          onChange={setSignalTimeframe}
          ariaLabel="Technical timeframe"
          analyticsId="ticker_technical_timeframe"
        />
      )}
      aside={(
        <ChapterCard title={`Key readings · ${signalTimeframe}`}>
          <dl className={styles.keyReadings} data-key-readings="">
            {keyReadings.map((reading) => (
              <div key={reading.label}>
                <dt>{reading.label}</dt>
                <dd data-tone={reading.tone}>{reading.value ?? 'Not enough history'}</dd>
              </div>
            ))}
          </dl>
          <Link href={`/stocks/${ticker}/signals`} className={styles.inlineArrow}>Indicator details →</Link>
        </ChapterCard>
      )}
    >
      {hasTechnicalData ? (
        <div className={styles.technicalBoard} data-technical-board="">
          <TechnicalSummaryPanel gauge={summaryGauge} />
          {technicalGauges.slice(1).map(({ key, label, gauge }) => (
            <TechnicalRow key={key} label={label} gauge={gauge} />
          ))}
        </div>
      ) : (
        <div className={styles.inlineDataState}><span>Technicals</span><strong>Not enough price history</strong></div>
      )}
    </ResearchChapter>
  )

  const sinceSection = (
    <ResearchChapter id="since-last-visit" label="Since your last visit" band>
      <BeingBuilt size="inline">
        What changed for {ticker} since you last looked — results, its standing in each reading, insider trades and how it moved against its sector — is being added.
      </BeingBuilt>
    </ResearchChapter>
  )

  const questionsSection = (
    <ResearchChapter id="questions" label="Questions worth asking" band>
      <BeingBuilt>
        The questions a careful reader would ask about {ticker} right now, each with its evidence and the other side, are being added.
      </BeingBuilt>
      <TakeButtons />
    </ResearchChapter>
  )

  const fundCards = [
    { key: 'holdings', label: 'Holdings', value: holdings.length ? String(holdings.length) : null, context: 'holdings covered' },
    { key: 'exposures', label: 'Sector exposure', value: sectorWeights.length ? String(sectorWeights.length) : null, context: 'sectors covered' },
  ]

  const fundamentalsSection = (
    <ResearchChapter
      id="fundamentals"
      label="Fundamentals"
      actions={<Link href={`/stocks/${ticker}/fundamentals`} className={styles.inlineArrow}>Full fundamentals →</Link>}
    >
      <div className={styles.fundamentalCards} data-fundamental-cards="">
        {isFund ? fundCards.map((card) => (
          <div key={card.key} className={styles.fundamentalCard} data-fundamental-card={card.key}>
            <div className={styles.fundamentalHead}>
              <h3>{card.label}</h3>
              {card.value ? null : <BeingBuiltBadge />}
            </div>
            {card.value ? (
              <p className={styles.fundamentalValue}>
                <strong>{card.value}</strong>
                <span>{card.context}</span>
              </p>
            ) : null}
            <p className={styles.fundamentalNote}>
              {card.value ? <><BeingBuiltBadge />{' '}How this changed over time is being added.</> : `The ${card.label.toLowerCase()} and how it changed over time are being added.`}
            </p>
          </div>
        )) : (
          <>
            <Suspense fallback={<FundamentalCard label="Revenue" figure={null} context="" pending="Ten years of reported revenue is being added." />}>
              <RevenueCard revenuePromise={revenuePromise} currency={currency} />
            </Suspense>
            <FundamentalCard
              label="Operating margin"
              figure={operatingMargin ? `${Math.round(operatingMargin.value)}%` : null}
              tone={operatingMargin && operatingMargin.value < 0 ? 'down' : undefined}
              context={`operating profit per dollar of sales${operatingMargin?.asOf ? ` · as of ${formatDay(operatingMargin.asOf)}` : ''}`}
              pending={operatingMargin ? 'Ten years of the margin is being added.' : 'The operating margin and ten years of its history are being added.'}
            />
            <FundamentalCard
              label="Net cash"
              figure={netCash ? formatCompactMoney(netCash.value, currency) : null}
              tone={netCash && netCash.value < 0 ? 'down' : undefined}
              context={`cash minus debt${netCash?.asOf ? ` · as of ${formatDay(netCash.asOf)}` : ''}`}
              pending={netCash ? 'Ten years of cash and debt is being added.' : 'Net cash and ten years of cash and debt are being added.'}
            />
          </>
        )}
      </div>
    </ResearchChapter>
  )

  const relationshipsSection = (
    <Suspense fallback={<ResearchChapter id="relationships" label="Relationships" band><p className={styles.chartStatus} role="status">Loading related companies.</p></ResearchChapter>}>
      <RelatedAssetsContent ticker={ticker} relatedAssetsPromise={relatedAssetsPromise} />
    </Suspense>
  )

  return (
    <div className={styles.page}>
      <section className={styles.overviewLead}>
        <div className={styles.heroBody}>
          <div className={styles.heroChartColumn}>
            <h2 className="sr-only">Quick Read</h2>
            <div className={styles.heroChartWrap} aria-busy={fullHistoryState === 'loading'}>
              <HeroPriceChart
                points={heroPoints}
                mode={showCandles ? 'candles' : 'line'}
                onMeasureActiveChange={setHeroMeasuring}
                reservedCorner={canExpandChart ? HERO_TOOLS_CORNER : undefined}
                state={fullHistoryState === 'error' ? 'error' : historicalChartState}
                currency={currency}
              />
              {canExpandChart ? (
                <div className={expandedChartStyles.heroTools} hidden={heroMeasuring}>
                  <button
                    ref={expandButtonRef}
                    type="button"
                    className={expandedChartStyles.heroToolButton}
                    aria-haspopup="dialog"
                    aria-label="Expand chart"
                    data-expand-chart=""
                    onClick={() => setChartExpanded(true)}
                  >
                    <Maximize2 size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={expandedChartStyles.heroToolButton}
                    aria-pressed={showCandles}
                    aria-label={showCandles ? 'Show line' : 'Show candles'}
                    data-chart-kind-toggle=""
                    onClick={() => setChartKind((kind) => (kind === 'candles' ? 'line' : 'candles'))}
                  >
                    {showCandles ? <ChartLine size={16} aria-hidden="true" /> : <ChartCandlestick size={16} aria-hidden="true" />}
                  </button>
                </div>
              ) : null}
              {candlesFrom ? (
                <p className={styles.chartStatus} role="status" data-candles-from="">
                  Candles from {new Date(`${candlesFrom}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.
                </p>
              ) : null}
              {chartExpanded ? (
                <Suspense fallback={null}>
                  <ExpandedChartWithEvents
                    eventsPromise={chartEvents}
                    open
                    onClose={() => setChartExpanded(false)}
                    ticker={ticker}
                    currency={currency}
                    bars={ohlcData}
                    kind={chartKind}
                    onKindChange={setChartKind}
                    returnFocusRef={expandButtonRef}
                  />
                </Suspense>
              ) : null}
              {fullHistoryState === 'loading' ? <span className="sr-only" role="status">Loading full price history.</span> : null}
              {fullHistoryState === 'error' ? (
                <p className={styles.chartStatus} role="status">Historical price data could not be loaded. Showing the longest available range.</p>
              ) : null}
            </div>
            <div className={styles.chartFooter} data-chart-footer="">
              {referenceFacts.length > 0 ? (
                <dl className={styles.referenceLine} aria-label="Market reference" data-chart-facts="">
                  {referenceFacts.map((fact) => (
                    <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                  ))}
                </dl>
              ) : null}
              <div className={styles.chartFooterControl} data-chart-range="">
                <SegmentedControl
                  options={HERO_TIMEFRAMES}
                  value={heroTimeframe}
                  onChange={selectHeroTimeframe}
                  ariaLabel="Chart timeframe"
                  analyticsId="ticker_hero_timeframe"
                  fill
                />
              </div>
            </div>
          </div>

          <aside className={styles.snapshotEditorial} aria-label="Research score and verdicts" data-overview-grade="">
            {isFund ? (
              // A fund is not scored on company measures: no score, no disc, and no
              // company dimensions presented as a fund's grade.
              <div className={styles.snapshotScorecard}>
                <div className={styles.snapshotSummary}>
                  <span>Research score</span>
                  <strong>Not scored</strong>
                  <p>Funds are not scored as companies. Their composition and exposures are below.</p>
                </div>
              </div>
            ) : (
              <div className={styles.snapshotGradeBlock}>
                <div className={styles.snapshotScorecard}>
                  {/* Each slice is the button for its axis; the axis names are page text around the disc. */}
                  <div className={styles.discFrame}>
                    <ScorecardDisc
                      scorecard={scorecard}
                      size={124}
                      compact
                      className={styles.overviewScorecardDisc}
                      selectedAxis={selectedAxis}
                      onSelectAxis={toggleAxis}
                      textLabels
                    />
                  </div>
                  <div className={styles.snapshotSummary}>
                    <span>Research score</span>
                    <strong>{scorecardMessage ?? scorecard.overall.label}</strong>
                    <p>{availableScorecardAxes} of {scorecard.axes.length} dimensions observed</p>
                  </div>
                </div>
                {selectedAxisData ? (
                  <div className={styles.axisCard} data-axis-card={selectedAxisData.key}>
                    <div className={styles.axisCardHead}>
                      <h3>{selectedAxisData.label}</h3>
                      {selectedAxisData.available && selectedAxisData.score !== null ? <span>{Math.round(selectedAxisData.score)}/100</span> : <BeingBuiltBadge />}
                      <button type="button" className={styles.axisCardClose} aria-label={`Close ${selectedAxisData.label}`} onClick={() => setSelectedAxis(null)}>×</button>
                    </div>
                    <BeingBuilt size="inline">What this score means, and the three measures behind it, are being added.</BeingBuilt>
                  </div>
                ) : null}
              </div>
            )}
            <dl className={styles.snapshotVerdicts} aria-label="Current research snapshot">
              {researchVerdicts.map((verdict) => (
                <div key={verdict.label} className={styles.snapshotVerdict}>
                  <dt>{verdict.label}</dt>
                  <dd>
                    <strong className={verdict.tone}>{verdict.value}</strong>
                    {verdict.detail ? <span> · {verdict.detail}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <div className={styles.editorialSequence}>
        {sinceSection}
        {timingSection}
        {questionsSection}
        {fundamentalsSection}
        {relationshipsSection}
      </div>

      {process.env.NODE_ENV !== 'production' ? <aside className={styles.adPlacement} aria-label="Advertisement placement preview">Advertisement placement <span>Preview · zero runtime space without a campaign</span></aside> : null}

    </div>
  )
}
