'use client'

import Link from 'next/link'
import { Suspense, use, useMemo, useRef, useState } from 'react'
import SegmentedControl from '@/components/ui/SegmentedControl'
import TemporalLineChart from '@/components/charts/TemporalLineChart'
import type { OhlcPoint, PricePoint } from '@/lib/finance'
import type { Scorecard } from '@/lib/scorecard-types'
import {
  buildTechnicalSummary,
  type TechnicalAction,
  type TechnicalTimeframe,
} from '@/lib/technicalSignals'
import { hasUsableMaterializedScorecard } from '@/lib/ticker-page-scorecard'
import { cn } from '@/lib/utils'
import styles from './StockOverviewClient.module.css'
import ScorecardDisc from './ScorecardDisc'

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
  assetBadgeLabel: string
  latestSignal: OverviewSignal | null
  historicalData: PricePoint[]
  historicalChartState: HistoricalChartState
  ohlcData: OhlcPoint[]
  keyStats: OverviewStat[]
  fundamentalGroups: OverviewFundGroup[]
  holdings: OverviewHolding[]
  sectorWeights: OverviewSectorWeight[]
  nextEarnings: OverviewEarnings | null
  volatility30d: number | null
  relatedAssets: Promise<OverviewRelatedAsset[]>
  regimeSignals: OverviewRegimePoint[]
  scorecard: Scorecard
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

function regimeTone(direction: SignalDirection | null): 'bullish' | 'bearish' | 'neutral' {
  if (direction === 'bullish') return 'bullish'
  if (direction === 'bearish') return 'bearish'
  return 'neutral'
}

function scorecardReadinessMessage(scorecard: Scorecard): string | null {
  if (hasUsableMaterializedScorecard(scorecard)) return null
  if (scorecard.readiness === 'pending_build') return 'Data pending'
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

function filterChartData(data: PricePoint[], timeframe: ChartTimeframe): PricePoint[] {
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

function Gauge({
  title,
  position,
  verdict,
  verdictAction,
  counts,
}: {
  title: string
  position: number
  verdict: string
  verdictAction: TechnicalAction
  counts: {
    buy: number
    neutral: number
    sell: number
  }
}) {
  const clamped = Math.max(0, Math.min(100, position))
  const needleAngle = (clamped / 100) * 180 - 90
  const toneClass =
    verdictAction === 'Buy'
      ? styles.gaugePanelBuy
      : verdictAction === 'Sell'
        ? styles.gaugePanelSell
        : styles.gaugePanelNeutral

  return (
    <div className={cn(styles.gaugeItem, toneClass)}>
      <svg viewBox="0 0 120 70" className={styles.gaugeDial} aria-hidden="true">
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

      <div className={styles.gaugeInfo}>
        <div className={styles.gaugeLabel}>{title}</div>
        <div className={cn(styles.gaugeVerdict, actionTone(verdictAction))}>{verdict}</div>
      </div>

      <div className={styles.gaugeRight}>
        <div className={styles.gaugeScore}>{Math.round(clamped)}</div>
        <div className={styles.gaugeCounts}>
          <span>
            <span className={styles.gaugeCountDotSell} /> {counts.sell}
          </span>
          <span>
            <span className={styles.gaugeCountDotNeutral} /> {counts.neutral}
          </span>
          <span>
            <span className={styles.gaugeCountDotBuy} /> {counts.buy}
          </span>
        </div>
      </div>
    </div>
  )
}

function HeroPriceChart({
  data,
  state,
  className,
  currency,
}: {
  data: PricePoint[]
  state: HistoricalChartState
  className?: string
  currency: string
}) {
  return (
    <TemporalLineChart
      className={cn(styles.heroChart, className)}
      points={data.map((point) => ({ date: point.date, value: point.close }))}
      ariaLabel="Historical closing price"
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
        <div className={styles.inlineDataState}><span>Relationships</span><strong>Data pending</strong></div>
      )}
    </article>
  )
}

export default function StockOverviewClient({
  ticker,
  currency,
  assetBadgeLabel,
  latestSignal,
  historicalData,
  historicalChartState,
  ohlcData,
  keyStats,
  fundamentalGroups,
  holdings,
  sectorWeights,
  nextEarnings,
  volatility30d,
  relatedAssets: relatedAssetsPromise,
  scorecard,
}: StockOverviewClientProps) {
  const [heroTimeframe, setHeroTimeframe] = useState<ChartTimeframe>('1M')
  const [fullHistoricalData, setFullHistoricalData] = useState<PricePoint[] | null>(null)
  const [fullHistoryState, setFullHistoryState] = useState<FullHistoryState>('idle')
  const fullHistoryRequested = useRef(false)
  const [signalTimeframe, setSignalTimeframe] = useState<TechnicalTimeframe>('1D')
  const scorecardMessage = scorecardReadinessMessage(scorecard)

  const chartHistory = (heroTimeframe === '10Y' || heroTimeframe === 'ALL') && fullHistoricalData
    ? fullHistoricalData
    : historicalData
  const filteredChartData = useMemo(
    () => filterChartData(chartHistory, heroTimeframe),
    [chartHistory, heroTimeframe],
  )
  const technicalSummary = useMemo(
    () => buildTechnicalSummary(ohlcData, signalTimeframe),
    [ohlcData, signalTimeframe]
  )
  const hasTechnicalData =
    ohlcData.length >= 30 &&
    [...technicalSummary.oscillatorRows, ...technicalSummary.movingAverageRows].some((row) => row.value !== '—')
  const regimeClass =
    regimeTone(latestSignal?.direction ?? null) === 'bullish'
      ? styles.regimeBullish
      : regimeTone(latestSignal?.direction ?? null) === 'bearish'
        ? styles.regimeBearish
        : styles.regimeNeutral

  const technicalGauges = [
    { key: 'summary', label: 'Summary', gauge: technicalSummary.gauges.summary },
    { key: 'oscillators', label: 'Oscillators', gauge: technicalSummary.gauges.oscillators },
    { key: 'moving-averages', label: 'Moving averages', gauge: technicalSummary.gauges.movingAverages },
  ] as const
  const marketCapReference = keyStats.find((stat) => stat.label === 'Market Cap')
  const orderedFundamentalGroups = assetBadgeLabel === 'ETF'
    ? [...fundamentalGroups].sort((left, right) => Number(right.key === 'fund') - Number(left.key === 'fund'))
    : fundamentalGroups
  const visibleFundamentalGroups = orderedFundamentalGroups.slice(0, 6)
  const availableScorecardAxes = scorecard.axes.filter((axis) => axis.available && axis.score !== null).length

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
      value: hasTechnicalData ? technicalSummary.gauges.summary.verdict : 'Data pending',
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
    volatility30d !== null && Number.isFinite(volatility30d)
      ? { label: '30D volatility', value: `${volatility30d.toFixed(1)}%` }
      : null,
  ].filter((fact): fact is OverviewStat => fact !== null)

  const timingSection = (
    <article id="signals" className={styles.editorialChapter} aria-labelledby="timing-heading">
      <div className={styles.chapterHeader}>
        <div>
          <h2 id="timing-heading" className={styles.chapterTitle}>Technicals</h2>
          <p className={styles.chapterDescription}>Summary, oscillators, and moving averages for the selected timeframe.</p>
        </div>
        <SegmentedControl options={SIGNAL_TIMEFRAMES} value={signalTimeframe} onChange={setSignalTimeframe} ariaLabel="Technical signals timeframe" />
      </div>
      <div className={styles.timingEditorialGrid}>
        <div className={styles.technicalRead}>
          {hasTechnicalData ? (
            <div className={styles.technicalGaugeGrid}>
              {technicalGauges.map(({ key, label, gauge }) => (
                <Gauge key={key} title={label} position={gauge.position} verdict={gauge.verdict} verdictAction={gauge.verdictAction} counts={gauge.counts} />
              ))}
            </div>
          ) : (
            <div className={styles.technicalGaugeGrid}>
              {technicalGauges.map(({ key, label }) => <div key={key} className={styles.gaugeDataPending}><span>{label}</span><strong>Data pending</strong></div>)}
            </div>
          )}
          <Link href={`/stocks/${ticker}/indicators`} className={styles.inlineArrow}>Indicator details →</Link>
        </div>
        <div className={styles.modelContextEditorial}>
          <h3 className={styles.contextTitle}>Signal & events</h3>
          {latestSignal ? (
            <>
              <div className={styles.modelSignalHeader}><strong>{regimeCopy(latestSignal.direction)}</strong><span className={cn(styles.regimeBadge, regimeClass)}>{latestSignal.direction}</span></div>
              <dl className={styles.modelSignalInline}>
                <div><dt>Conviction</dt><dd>{formatConviction(latestSignal.conviction)}</dd></div>
                <div><dt>Horizon</dt><dd>{latestSignal.horizon === null ? '—' : `${latestSignal.horizon} sessions`}</dd></div>
                <div><dt>Signal date</dt><dd>{formatDate(latestSignal.signalDate, { month: 'short', day: 'numeric' })}</dd></div>
              </dl>
            </>
          ) : (
            <div className={styles.inlineDataState}><span>Model signal</span><strong>Unavailable</strong></div>
          )}
          <div className={styles.contextLines}>
            <div><span>Earnings</span><strong>{nextEarnings?.date ? formatDate(nextEarnings.date, { month: 'short', day: 'numeric' }) : 'Data pending'}</strong></div>
            <div><span>Catalysts</span><strong>Data pending</strong></div>
          </div>
          <div className={styles.contextualLinks}><Link href={`/stocks/${ticker}/signals`}>Signal history →</Link><Link href={`/stocks/${ticker}/events`}>Earnings & events →</Link></div>
        </div>
      </div>
    </article>
  )

  const fundamentalsSection = (
    <article id="fundamentals" className={styles.editorialChapter} aria-labelledby="fundamentals-heading">
      <div className={styles.chapterHeader}>
        <div>
          <h2 id="fundamentals-heading" className={styles.chapterTitle}>Fundamentals</h2>
          <p className={styles.chapterDescription}>A compact read of the latest {assetBadgeLabel === 'ETF' ? 'fund composition and exposures' : 'company financial evidence'}.</p>
        </div>
        <Link href={`/stocks/${ticker}/fundamentals`} className={styles.inlineArrow}>Full fundamentals →</Link>
      </div>
      {visibleFundamentalGroups.length > 0 ? (
        <div className={styles.fundamentalEvidenceGrid}>
          {visibleFundamentalGroups.map((group) => (
            <section key={group.key}>
              <h3>{group.label}</h3>
              {group.rows.slice(0, 3).map((row, index) => <div key={row.label} className={index === 0 ? styles.primaryFundamental : undefined}><span>{row.label}</span><strong>{row.value}</strong></div>)}
            </section>
          ))}
          {assetBadgeLabel === 'ETF' && holdings.length > 0 ? (
            <section><h3>Holdings</h3><div><span>Covered holdings</span><strong>{holdings.length}</strong></div></section>
          ) : null}
          {assetBadgeLabel === 'ETF' && sectorWeights.length > 0 ? (
            <section><h3>Exposures</h3><div><span>Covered sectors</span><strong>{sectorWeights.length}</strong></div></section>
          ) : null}
        </div>
      ) : (
        <div className={styles.inlineDataState}><span>Fundamentals</span><strong>Data pending</strong></div>
      )}
      <div className={styles.contextualLinks}>
        <Link href={`/stocks/${ticker}/financials`}>Financial statements →</Link>
        <Link href={`/stocks/${ticker}/valuation`}>Valuation history →</Link>
        <Link href={`/stocks/${ticker}/ownership`}>Ownership & capital →</Link>
      </div>
    </article>
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
                data={filteredChartData}
                state={fullHistoryState === 'error' ? 'error' : historicalChartState}
                currency={currency}
              />
              {fullHistoryState === 'loading' ? <span className="sr-only" role="status">Loading full price history.</span> : null}
              {fullHistoryState === 'error' ? (
                <p className={styles.chartStatus} role="status">Historical price data could not be loaded. Showing the longest available range.</p>
              ) : null}
            </div>
            <div className={styles.chartFooter}>
              {referenceFacts.length > 0 ? (
                <dl className={styles.referenceLine} aria-label="Market reference">
                  {referenceFacts.map((fact) => (
                    <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                  ))}
                </dl>
              ) : null}
              <div className={styles.chartFooterControl}>
                <div className={styles.chartFooterControlInner}>
                  <SegmentedControl
                    options={HERO_TIMEFRAMES}
                    value={heroTimeframe}
                    onChange={selectHeroTimeframe}
                    ariaLabel="Chart timeframe"
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className={styles.snapshotEditorial} aria-label="Research score and verdicts" data-overview-grade="">
            <Link href={`/stocks/${ticker}/methodology`} className={styles.snapshotGradeLink} aria-label="Open score breakdown">
              <div className={styles.snapshotScorecard}>
                <ScorecardDisc scorecard={scorecard} size={184} compact className={styles.overviewScorecardDisc} />
                <div className={styles.snapshotSummary}>
                  <span>Research score</span>
                  <strong>{scorecardMessage ?? scorecard.overall.label}</strong>
                  <p>{availableScorecardAxes} of {scorecard.axes.length} dimensions observed</p>
                </div>
              </div>
            </Link>
            {/* REQ-003: show no investor reading until its endpoint exists and its contract is verified. */}
            <dl className={styles.snapshotVerdicts} aria-label="Current research snapshot">
              {researchVerdicts.map((verdict) => (
                <div key={verdict.label} className={styles.snapshotVerdict}>
                  <dt>{verdict.label}</dt>
                  <dd>{verdict.value}</dd>
                  {verdict.detail ? <p>{verdict.detail}</p> : null}
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <div className={styles.editorialSequence}>
        <div className={cn(styles.editorialSlot, styles.timingSlot)}>
          {timingSection}
        </div>
        <div className={cn(styles.editorialSlot, styles.fundamentalsSlot)}>
          {fundamentalsSection}
        </div>
        <div className={cn(styles.editorialSlot, styles.relationshipsSlot)}>
          {relationshipsSection}
        </div>
      </div>

      {process.env.NODE_ENV !== 'production' ? <aside className={styles.adPlacement} aria-label="Advertisement placement preview">Advertisement placement <span>Preview · zero runtime space without a campaign</span></aside> : null}

    </div>
  )
}
