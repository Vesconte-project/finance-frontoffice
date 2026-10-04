'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Suspense, use, useMemo, useRef, useState } from 'react'
import { ChartCandlestick, ChartLine, Maximize2 } from 'lucide-react'
import SegmentedControl from '@/components/ui/SegmentedControl'
import TemporalLineChart, { type TemporalLinePoint } from '@/components/charts/TemporalLineChart'
import type { OhlcPoint, PricePoint } from '@/lib/finance'
import type { Scorecard } from '@/lib/scorecard-types'
import type { ReadingVerdict } from '@/lib/ticker-readings'
import {
  buildTechnicalSummary,
  distanceFromAverage,
  type TechnicalAction,
  type TechnicalGaugeData,
  type TechnicalTimeframe,
} from '@/lib/technicalSignals'
import type { EventMarker } from '@/lib/event-markers'
import { SCORECARD_AXIS_LABELS, SCORECARD_AXIS_ORDER, scoreColor, type ScorecardAxis } from '@/lib/scorecard-types'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
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

type OverviewFundDetail = {
  label: string
  value: string
}

type OverviewFundGroup = {
  key: string
  label: string
  rows: OverviewFundDetail[]
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
  keyStats: OverviewStat[]
  fundamentalGroups: OverviewFundGroup[]
  holdings: OverviewHolding[]
  sectorWeights: OverviewSectorWeight[]
  nextEarnings: OverviewEarnings | null
  relatedAssets: Promise<OverviewRelatedAsset[]>
  /** Company events for the expanded chart; resolves to null when unavailable. */
  chartEvents: Promise<EventMarker[] | null>
  regimeSignals: OverviewRegimePoint[]
  scorecard: Scorecard
  /** Built on the server per viewer tier; empty when unavailable. */
  readingVerdicts: ReadingVerdict[]
}

const HERO_TIMEFRAMES: ChartTimeframe[] = ['1D', '5D', '1M', '3M', 'YTD', '1Y', '5Y', '10Y', 'ALL']
const SIGNAL_TIMEFRAMES: TechnicalTimeframe[] = ['1D', '1W', '1M']

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  })
}

function formatCompactPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatConviction(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const scaled = Math.abs(value) <= 1 ? value * 100 : value
  return `${scaled.toFixed(0)}%`
}

function formatRelationshipStrength(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatConfidence(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const scaled = Math.abs(value) <= 1 ? value * 100 : value
  return `${Math.max(0, Math.min(100, scaled)).toFixed(0)}%`
}

function regimeCopy(direction: SignalDirection | null): string {
  if (direction === 'bullish') return 'Bullish regime'
  if (direction === 'bearish') return 'Bearish regime'
  return 'Neutral regime'
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

function RelatedAssetsContent({
  ticker,
  relatedAssetsPromise,
}: {
  ticker: string
  relatedAssetsPromise: Promise<OverviewRelatedAsset[]>
}) {
  const relatedAssets = use(relatedAssetsPromise)
  const rankedAssets = [...relatedAssets].sort(
    (left, right) => Math.abs(right.strength ?? 0) - Math.abs(left.strength ?? 0),
  )

  return (
    <article id="relationships" className={styles.relationshipEditorial}>
      <div className={styles.chapterHeader}>
        <div>
          <h2 className={styles.chapterTitle}>Relationships</h2>
          <p className={styles.chapterDescription}>The strongest observed associations, ranked by relationship strength.</p>
        </div>
        <Link href={`/stocks/${ticker}/relationships`} className={styles.inlineArrow}>View all →</Link>
      </div>
      {rankedAssets.length > 0 ? (
        <div className={styles.relationshipPreviewGrid}>
          <div className={styles.relationshipTopology} data-relationship-topology="" aria-hidden="true">
            <svg viewBox="0 0 760 300" preserveAspectRatio="xMidYMid meet">
              <circle cx="286" cy="150" r="92" className={styles.topologyHalo} />
              {rankedAssets.slice(0, 4).map((asset, index) => {
                const coordinates = [
                  { x: 92, y: 64 },
                  { x: 552, y: 55 },
                  { x: 676, y: 176 },
                  { x: 474, y: 252 },
                ][index]
                const strength = Math.max(0.12, Math.min(1, Math.abs(asset.strength ?? 0.28)))
                if (!coordinates) return null
                return (
                  <g key={asset.symbol}>
                    <line
                      x1="286"
                      y1="150"
                      x2={coordinates.x}
                      y2={coordinates.y}
                      className={styles.topologyLink}
                      strokeWidth={0.8 + strength * 2.4}
                      strokeOpacity={0.18 + strength * 0.5}
                    />
                    <circle cx={coordinates.x} cy={coordinates.y} r="29" className={styles.topologyNode} />
                    <text x={coordinates.x} y={coordinates.y + 4} className={styles.topologyLabel}>{asset.symbol}</text>
                  </g>
                )
              })}
              <circle cx="286" cy="150" r="38" className={styles.topologyCenter} />
              <circle cx="286" cy="150" r="48" className={styles.topologyCenterRing} />
              <text x="286" y="155" className={styles.topologyCenterLabel}>{ticker}</text>
            </svg>
          </div>
          <div className={styles.relatedAssets}>
            {rankedAssets.slice(0, 5).map((asset) => (
              <Link key={asset.symbol} href={`/stocks/${asset.symbol}`} className={styles.relatedChip}>
                <span className={styles.relatedIdentity}>
                  <span className={styles.chipTicker}>{asset.symbol}</span>
                  <span className={styles.relatedName}>{asset.name ?? asset.relation}</span>
                </span>
                <span className={styles.relationshipMagnitude}>
                  <strong>{formatRelationshipStrength(asset.strength)}</strong>
                  <span>Strength</span>
                  {asset.strength !== null && Number.isFinite(asset.strength) ? (
                    <span className={styles.strengthBar} aria-hidden="true" data-strength-bar="">
                      <span style={{ width: `${Math.max(0, Math.min(1, Math.abs(asset.strength))) * 100}%` }} />
                    </span>
                  ) : null}
                </span>
                <span className={styles.relatedSemantics}>
                  <span>{asset.relation}</span>
                  <span>Confidence {formatConfidence(asset.confidence)}</span>
                  <span className={directionToneClass(asset.changePercent)}>Today {formatCompactPercent(asset.changePercent)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.inlineDataState}><span>Relationships</span><strong>Not available yet</strong></div>
      )}
    </article>
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
  keyStats,
  fundamentalGroups,
  holdings,
  sectorWeights,
  nextEarnings,
  relatedAssets: relatedAssetsPromise,
  chartEvents,
  scorecard,
  readingVerdicts,
}: StockOverviewClientProps) {
  const [heroTimeframe, setHeroTimeframe] = useState<ChartTimeframe>('1M')
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
  const marketCapReference = keyStats.find((stat) => stat.label === 'Market Cap')
  const orderedFundamentalGroups = isFund
    ? [...fundamentalGroups].sort((left, right) => Number(right.key === 'fund') - Number(left.key === 'fund'))
    : fundamentalGroups
  const visibleFundamentalGroups = orderedFundamentalGroups.slice(0, 6)
  const availableScorecardAxes = scorecard.axes.filter((axis) => axis.available && axis.score !== null).length
  const selectedAxisData = selectedAxis ? scorecard.axes.find((axis) => axis.key === selectedAxis) ?? null : null
  const orderedAxes = SCORECARD_AXIS_ORDER.map((key) => scorecard.axes.find((axis) => axis.key === key) ?? {
    key,
    label: SCORECARD_AXIS_LABELS[key],
    score: null,
    available: false,
  })
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
      value: latestSignal ? regimeCopy(latestSignal.direction) : 'Unavailable',
      detail: latestSignal?.conviction !== null
        && latestSignal?.conviction !== undefined
        && Number.isFinite(latestSignal.conviction)
        ? `${formatConviction(latestSignal.conviction)} conviction`
        : null,
    },
    {
      label: `Technical · ${signalTimeframe}`,
      value: hasTechnicalData ? technicalSummary.gauges.summary.verdict : 'Not enough price history',
      detail: hasTechnicalData ? `${Math.round(technicalSummary.gauges.summary.position)} / 100` : null,
    },
  ]
  const nextEarningsReference = nextEarnings?.date
    ? formatDate(nextEarnings.date, { month: 'short', day: 'numeric' })
    : null
  const referenceFacts = [
    marketCapReference ? { label: 'Market cap', value: marketCapReference.value } : null,
    nextEarningsReference && nextEarningsReference !== '—'
      ? { label: 'Next earnings', value: nextEarningsReference }
      : null,
  ].filter((fact): fact is OverviewStat => fact !== null)

  const summaryGauge = technicalSummary.gauges.summary
  const readings = technicalSummary.readings
  const periodUnit = signalTimeframe === '1D' ? 'day' : signalTimeframe === '1W' ? 'week' : 'month'
  const keyReadings = [
    { label: 'RSI (14)', value: readings.rsi14 === null ? null : readings.rsi14.toFixed(0), tone: undefined },
    ...([50, 200] as const).map((period) => {
      const distance = distanceFromAverage(readings.close, period === 50 ? readings.sma50 : readings.sma200)
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
    </ResearchChapter>
  )

  const allFundamentalRows = visibleFundamentalGroups.flatMap((group) => group.rows)
  const fundamentalValue = (pattern: RegExp) => allFundamentalRows.find((row) => pattern.test(row.label))?.value ?? null
  const fundamentalCards = isFund
    ? [
        { key: 'holdings', label: 'Holdings', value: holdings.length ? String(holdings.length) : null, context: 'holdings covered' },
        { key: 'exposures', label: 'Sector exposure', value: sectorWeights.length ? String(sectorWeights.length) : null, context: 'sectors covered' },
      ]
    : [
        { key: 'revenue', label: 'Revenue', value: fundamentalValue(/^(total\s+)?(revenue|sales)\b/i), context: 'latest reported' },
        { key: 'operating-margin', label: 'Operating margin', value: fundamentalValue(/operating\s+margin/i), context: 'operating profit per dollar of sales' },
        { key: 'net-cash', label: 'Net cash', value: fundamentalValue(/^net\s+cash\b/i), context: 'cash minus debt' },
      ]

  const fundamentalsSection = (
    <ResearchChapter
      id="fundamentals"
      label="Fundamentals"
      actions={<Link href={`/stocks/${ticker}/fundamentals`} className={styles.inlineArrow}>Full fundamentals →</Link>}
    >
      <div className={styles.fundamentalCards} data-fundamental-cards="">
        {fundamentalCards.map((card) => (
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
              {card.value ? <><BeingBuiltBadge />{' '}</> : null}
              {card.value
                ? isFund ? 'How this changed over time is being added.' : 'Ten years of history is being added.'
                : isFund ? `The ${card.label.toLowerCase()} and how it changed over time are being added.` : `The latest ${card.label.toLowerCase()} and ten years of its history are being added.`}
            </p>
          </div>
        ))}
      </div>
      <div className={styles.contextualLinks}>
        <Link href={`/stocks/${ticker}/financials`}>Financial statements →</Link>
        <Link href={`/stocks/${ticker}/valuation`}>Valuation history →</Link>
        <Link href={`/stocks/${ticker}/ownership`}>Ownership & capital →</Link>
      </div>
    </ResearchChapter>
  )

  const relationshipsSection = (
    <Suspense fallback={<div className={styles.relationshipEditorial}><div className={styles.inlineDataState}><span>Relationships</span><strong>Loading</strong></div></div>}>
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
                  <ScorecardDisc
                    scorecard={scorecard}
                    size={132}
                    compact
                    className={styles.overviewScorecardDisc}
                    selectedAxis={selectedAxis}
                    onSelectAxis={toggleAxis}
                    showLabels={false}
                    slicesFocusable={false}
                  />
                  <div className={styles.snapshotSummary}>
                    <span>Research score</span>
                    <strong>{scorecardMessage ?? scorecard.overall.label}</strong>
                    <p>{availableScorecardAxes} of {scorecard.axes.length} dimensions observed</p>
                  </div>
                </div>
                {/* The axis names as page text: always readable, one button per axis. */}
                <div className={styles.axisList} role="group" aria-label="Score dimensions" data-axis-list="">
                  {orderedAxes.map((axis) => {
                    const scored = axis.available && axis.score !== null
                    return (
                      <button
                        key={axis.key}
                        type="button"
                        className={styles.axisChip}
                        aria-pressed={selectedAxis === axis.key}
                        data-scorecard-axis={axis.key}
                        onClick={() => toggleAxis(axis.key)}
                      >
                        <span className={styles.axisSwatch} style={{ background: scored ? scoreColor(axis.score) : 'transparent' }} aria-hidden="true" />
                        <span>{axis.label}</span>
                        <strong>{scored ? Math.round(axis.score as number) : '–'}</strong>
                      </button>
                    )
                  })}
                </div>
                {selectedAxisData ? (
                  <div className={styles.axisCard} data-axis-card={selectedAxisData.key}>
                    <div className={styles.axisCardHead}>
                      <h3>{selectedAxisData.label}</h3>
                      <span>{selectedAxisData.available && selectedAxisData.score !== null ? `${Math.round(selectedAxisData.score)}/100` : 'Not scored'}</span>
                      <button type="button" className={styles.axisCardClose} aria-label={`Close ${selectedAxisData.label}`} onClick={() => setSelectedAxis(null)}>×</button>
                    </div>
                    <BeingBuilt size="inline">What this score means, and the three measures behind it, are being added.</BeingBuilt>
                  </div>
                ) : null}
                <Link href={`/stocks/${ticker}/methodology`} className={styles.inlineArrow}>How the score works →</Link>
              </div>
            )}
            <dl className={styles.snapshotVerdicts} aria-label="Current research snapshot">
              {researchVerdicts.map((verdict) => (
                <div key={verdict.label} className={styles.snapshotVerdict}>
                  <dt>{verdict.label}</dt>
                  <dd>{verdict.value}</dd>
                  {verdict.detail ? <p>{verdict.detail}</p> : null}
                </div>
              ))}
              {/* Reading standings (Spec "Ticker reading standings V1"): built on the server per tier. */}
              {readingVerdicts.map((verdict) => (
                <div key={verdict.key} className={styles.snapshotVerdict} data-overview-reading={verdict.key}>
                  <dt>{verdict.label}</dt>
                  <dd>
                    {verdict.href ? (
                      <Link
                        href={verdict.href}
                        className={styles.snapshotVerdictLink}
                        {...(verdict.analyticsId
                          ? {
                              'data-analytics-id': verdict.analyticsId,
                              'data-analytics-event': 'auth_start',
                              'data-analytics-intent': 'sign_up',
                            }
                          : {})}
                      >
                        {verdict.value}
                      </Link>
                    ) : (
                      verdict.value
                    )}
                  </dd>
                  {verdict.detail ? <p>{verdict.detail}</p> : null}
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
        <div className={cn(styles.editorialSlot, styles.relationshipsSlot)}>
          {relationshipsSection}
        </div>
      </div>

      {process.env.NODE_ENV !== 'production' ? <aside className={styles.adPlacement} aria-label="Advertisement placement preview">Advertisement placement <span>Preview · zero runtime space without a campaign</span></aside> : null}

    </div>
  )
}
