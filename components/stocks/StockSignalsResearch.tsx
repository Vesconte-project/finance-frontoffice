import type { CSSProperties } from 'react'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { buildTechnicalSummary, type TechnicalGaugeData, type TechnicalIndicatorRow } from '@/lib/technicalSignals'
import type { OhlcPoint } from '@/lib/ohlc-data'
import type { SignalResearchData } from '@/lib/signal-research'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import styles from './StockSignalsResearch.module.css'

const RANGE_DAYS = { '1M': 31, '3M': 93, '1Y': 366, '5Y': 1826 } as const
const SIGNAL_CHART_RANGE = '1M' as const
const SIGNAL_TECHNICAL_TIMEFRAME = '1D' as const

function formatDate(value: string | null, withYear = true): string {
  if (!value || Number.isNaN(Date.parse(value))) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(value))
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function directionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function directionClass(value: string): string {
  if (value === 'bullish') return styles.signalBullish
  if (value === 'bearish') return styles.signalBearish
  return styles.signalNeutral
}

function hasTechnicalEvidence(summary: ReturnType<typeof buildTechnicalSummary>): boolean {
  return [...summary.oscillatorRows, ...summary.movingAverageRows].some((row) => row.value !== '—')
}

function rangeRows(rows: OhlcPoint[]): OhlcPoint[] {
  const days = RANGE_DAYS[SIGNAL_CHART_RANGE]
  const sorted = rows.slice().sort((left, right) => left.date.localeCompare(right.date))
  const latest = sorted.at(-1)
  if (!latest) return []
  const cutoff = Date.parse(latest.date) - days * 24 * 60 * 60 * 1000
  return sorted.filter((row) => Date.parse(row.date) >= cutoff)
}

function PriceSignalTimeline({ data }: { data: SignalResearchData }) {
  const rows = rangeRows(data.ohlc.rows)
  if (rows.length < 2) {
    return (
      <div className={styles.chartFallback} role="status">
        <BeingBuilt size="chart">Prices for the signal timeline are being added.</BeingBuilt>
      </div>
    )
  }

  const width = 820
  const height = 286
  const left = 24
  const right = 58
  const top = 22
  const bottom = 28
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const closes = rows.map((row) => row.close)
  const minimum = Math.min(...closes)
  const maximum = Math.max(...closes)
  const padding = Math.max((maximum - minimum) * 0.08, Math.abs(maximum) * 0.002, 0.01)
  const floor = minimum - padding
  const ceiling = maximum + padding
  const pointFor = (row: OhlcPoint, index: number) => ({
    x: left + (index / Math.max(1, rows.length - 1)) * innerWidth,
    y: top + (1 - (row.close - floor) / Math.max(0.0001, ceiling - floor)) * innerHeight,
  })
  const points = rows.map(pointFor)
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${points.at(-1)!.x.toFixed(2)} ${(top + innerHeight).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(top + innerHeight).toFixed(2)} Z`
  const markerPoints = data.observations.flatMap((observation) => {
    const index = rows.findIndex((row) => row.date.slice(0, 10) === observation.signalDate.slice(0, 10))
    if (index < 0) return []
    return [{ ...pointFor(rows[index]!, index), direction: observation.direction, date: observation.signalDate }]
  })
  const axisValues = [ceiling, (ceiling + floor) / 2, floor]

  return (
    <div className={styles.chartFrame}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="signal-chart-title signal-chart-description">
        <title id="signal-chart-title">Price and signal timeline</title>
        <desc id="signal-chart-description">OHLC close prices for the selected chart range with dated signal observations where dates match the available price history.</desc>
        {axisValues.map((value, index) => {
          const y = top + (index / (axisValues.length - 1)) * innerHeight
          return (
            <g key={value}>
              <line className={styles.chartGrid} x1={left} x2={left + innerWidth} y1={y} y2={y} />
              <text className={styles.chartAxis} x={width - 8} y={y + 4} textAnchor="end">{formatNumber(value)}</text>
            </g>
          )
        })}
        <path className={styles.chartArea} d={areaPath} />
        <path className={styles.chartLine} d={linePath} />
        {markerPoints.map((point) => (
          <circle
            key={`${point.date}-${point.x}`}
            className={`${styles.signalMarker} ${directionClass(point.direction)}`}
            cx={point.x}
            cy={point.y}
            r="4.5"
          />
        ))}
        <text className={styles.chartAxis} x={left} y={height - 8}>{formatDate(rows[0]!.date, false)}</text>
        <text className={styles.chartAxis} x={left + innerWidth} y={height - 8} textAnchor="end">{formatDate(rows.at(-1)!.date, false)}</text>
      </svg>
    </div>
  )
}

function TechnicalTrack({
  title,
  gauge,
  rows,
  available,
  open,
}: {
  title: string
  gauge: TechnicalGaugeData
  rows: TechnicalIndicatorRow[]
  available: boolean
  open: boolean
}) {
  return (
    <section className={styles.track} aria-labelledby={`technical-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <div className={styles.trackHeader}>
        <h3 id={`technical-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{title}</h3>
        <span className={available ? `${styles.action} ${gauge.verdictAction === 'Buy' ? styles.bullish : gauge.verdictAction === 'Sell' ? styles.bearish : styles.neutral}` : styles.pending}>
          {available ? gauge.verdict : 'Not enough price history'}
        </span>
      </div>
      <div className={styles.scale} aria-hidden="true" style={{ '--technical-position': `${available ? gauge.position : 50}%` } as CSSProperties}>
        <span className={styles.scaleMarker} />
      </div>
      {available ? (
        <div className={styles.distribution} aria-label={`${title} distribution`}>
          <span>Buy {gauge.counts.buy}</span>
          <span>Neutral {gauge.counts.neutral}</span>
          <span>Sell {gauge.counts.sell}</span>
        </div>
      ) : <span className={styles.trackMeta}>Not enough price history for this read yet.</span>}
      <details className={styles.trackDetails} open={open && available}>
        <summary>Indicator details</summary>
        <dl className={styles.indicatorRows}>
          {rows.slice(0, title === 'Summary' ? 6 : 10).map((row) => (
            <div className={styles.metricRow} key={row.name}>
              <dt>{row.name}</dt>
              <dd>{row.value === '—' ? 'Not enough history' : `${row.value} · ${row.action}`}</dd>
            </div>
          ))}
        </dl>
        {rows.length === 0 ? <span className={styles.pending}>No indicator readings for this window.</span> : null}
      </details>
    </section>
  )
}

function SignalHistory({ data }: { data: SignalResearchData }) {
  if (data.observations.length === 0) {
    return <BeingBuilt>Earlier signals for this stock, each with its date and horizon, are being added.</BeingBuilt>
  }
  return (
    <details className={styles.historyDetails}>
      <summary className={styles.historySummary}>{data.observations.length} earlier signals</summary>
      <div className={styles.historyList}>
        {data.observations.slice(0, 18).map((observation) => (
          <div className={styles.historyRow} key={observation.id}>
            <time dateTime={observation.signalDate}>{formatDate(observation.signalDate)}</time>
            <strong>{directionLabel(observation.direction)}</strong>
            {observation.horizon ? <span>Horizon {observation.horizon}</span> : null}
          </div>
        ))}
      </div>
    </details>
  )
}

/** A reported figure, or the Being built badge in its place — never a dash. */
function Figure({ value, suffix = '' }: { value: number | null | undefined; suffix?: string }) {
  return value === null || value === undefined || !Number.isFinite(value) ? <BeingBuiltBadge /> : <>{formatNumber(value)}{suffix}</>
}

export default function StockSignalsResearch({ data, family }: { data: SignalResearchData; family?: string }) {
  const research = data.research
  const technicalFrame = SIGNAL_TECHNICAL_TIMEFRAME
  const technical = buildTechnicalSummary(data.ohlc.rows, technicalFrame)
  const available = hasTechnicalEvidence(technical) && data.ohlc.rows.length >= 30
  const current = data.currentSignal
  const stats = research.summary.marketStats
  const currentSignalClass = current ? styles[current.direction] : styles.neutral

  return (
    // No page header: the chrome above already names the company and the tab.
    <ResearchViewShell data={research} title="Signals & Indicators" showHeader={false}>
      <div className={styles.page} data-signal-research="">
        <ResearchChapter
          id="signal-timeline"
          label="Model signal"
          actions={<span className={styles.timelineRange}>{SIGNAL_CHART_RANGE}</span>}
          aside={current ? (
            <ChapterCard title="Current signal" meta={formatDate(current.signalDate)}>
              <div className={`${styles.currentSignal} ${currentSignalClass}`}>
                <div className={styles.direction}><span className={styles.directionDot} />{directionLabel(current.direction)}</div>
                <dl className={styles.facts}>
                  {current.horizon ? <div className={styles.factRow}><dt>Horizon</dt><dd>{current.horizon}</dd></div> : null}
                  {current.price !== null ? <div className={styles.factRow}><dt>Price at signal</dt><dd>{formatNumber(current.price)}</dd></div> : null}
                </dl>
              </div>
            </ChapterCard>
          ) : (
            <BeingBuilt label="Current signal">The model’s latest signal for {research.ticker}, with its date and horizon, is being added.</BeingBuilt>
          )}
        >
          <PriceSignalTimeline data={data} />
          <div className={styles.timelineNotes} aria-label="Signal direction legend">
            <span><i className={`${styles.legendDot} ${styles.signalBullish}`} />Bullish</span>
            <span><i className={`${styles.legendDot} ${styles.signalNeutral}`} />Neutral</span>
            <span><i className={`${styles.legendDot} ${styles.signalBearish}`} />Bearish</span>
          </div>
        </ResearchChapter>

        <ResearchChapter
          id="technicals"
          label="Technicals"
          band
          lead={available ? (
            <LeadStat value={technical.gauges.summary.verdict} context={`Summary of ${technical.oscillatorRows.length + technical.movingAverageRows.length} indicators · ${technicalFrame}`} />
          ) : (
            <BeingBuilt size="inline">The technical read needs at least 30 days of prices for {research.ticker}.</BeingBuilt>
          )}
        >
          <div className={styles.trackGrid}>
            <TechnicalTrack title="Summary" gauge={technical.gauges.summary} rows={[...technical.oscillatorRows, ...technical.movingAverageRows]} available={available} open={!family || family === 'summary'} />
            <TechnicalTrack title="Oscillators" gauge={technical.gauges.oscillators} rows={technical.oscillatorRows} available={available} open={family === 'oscillators'} />
            <TechnicalTrack title="Moving Averages" gauge={technical.gauges.movingAverages} rows={technical.movingAverageRows} available={available} open={family === 'moving-averages'} />
          </div>
        </ResearchChapter>

        <ResearchChapter id="market-context" label="Momentum, volume and volatility">
          <div className={styles.secondaryGrid}>
            <dl className={styles.metricList} aria-label="Price change">
              <div className={styles.metricRow}><dt>1D change</dt><dd><Figure value={stats?.change1D} suffix="%" /></dd></div>
              <div className={styles.metricRow}><dt>1M change</dt><dd><Figure value={stats?.change1M} suffix="%" /></dd></div>
              <div className={styles.metricRow}><dt>1Y change</dt><dd><Figure value={stats?.change1Y} suffix="%" /></dd></div>
            </dl>
            <dl className={styles.metricList} aria-label="Volume and volatility">
              <div className={styles.metricRow}><dt>Latest volume</dt><dd>{stats?.volume === null || stats?.volume === undefined ? <BeingBuiltBadge /> : stats.volume.toLocaleString()}</dd></div>
              <div className={styles.metricRow}><dt>30-day volatility</dt><dd><Figure value={stats?.vol30dPct} suffix="%" /></dd></div>
              <div className={styles.metricRow}><dt>Liquidity</dt><dd><BeingBuiltBadge /></dd></div>
            </dl>
          </div>
        </ResearchChapter>

        <ResearchChapter id="regime-history" label="Regime history" band>
          <BeingBuilt>When the market regime for this stock changed, and for how long each lasted, is being added.</BeingBuilt>
        </ResearchChapter>

        <ResearchChapter id="signal-history" label="Signal history">
          <SignalHistory data={data} />
        </ResearchChapter>

        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
