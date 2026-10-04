import Link from 'next/link'
import type { CSSProperties } from 'react'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { buildTechnicalSummary, type TechnicalGaugeData, type TechnicalIndicatorRow } from '@/lib/technicalSignals'
import type { OhlcPoint } from '@/lib/ohlc-data'
import type { SignalResearchData } from '@/lib/signal-research'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
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
        <span>{data.ohlc.status === 'empty' ? 'Price history · Unavailable' : 'Price history · Partial coverage'}</span>
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
      ) : <span className={styles.trackMeta}>The current OHLC window does not contain enough rows for this read.</span>}
      <details className={styles.trackDetails} open={open && available}>
        <summary>Indicator details</summary>
        <dl className={styles.indicatorRows}>
          {rows.slice(0, title === 'Summary' ? 6 : 10).map((row) => (
            <div className={styles.metricRow} key={row.name}>
              <dt>{row.name}</dt>
              <dd>{row.value} · {row.action}</dd>
            </div>
          ))}
        </dl>
        {rows.length === 0 ? <span className={styles.pending}>No indicator readings for this window.</span> : null}
      </details>
    </section>
  )
}

function SignalHistory({ data }: { data: SignalResearchData }) {
  return (
    <section className={styles.historySection} aria-labelledby="signal-history-heading">
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.sectionLabel}>Observed records</span>
          <h2 className={styles.sectionTitle} id="signal-history-heading">Signal History</h2>
        </div>
        <span className={styles.pending}>{data.observations.length > 0 ? `${data.observations.length} records` : 'Partial coverage'}</span>
      </div>
      {data.observations.length > 0 ? (
        <details>
          <summary className={styles.historySummary}>Open signal observations</summary>
          <div className={styles.historyList}>
            {data.observations.slice(0, 18).map((observation) => (
              <div className={styles.historyRow} key={observation.id}>
                <time dateTime={observation.signalDate}>{formatDate(observation.signalDate)}</time>
                <strong>{directionLabel(observation.direction)}</strong>
                <span>Horizon {observation.horizon ?? '—'}</span>
              </div>
            ))}
          </div>
        </details>
      ) : (
        <div className={styles.pendingLine}><strong>Signal history</strong><span className={styles.pending}>Unavailable or not covered for this ticker.</span></div>
      )}
    </section>
  )
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
    <ResearchViewShell data={research} title="Signals & Indicators">
      <div className={styles.page} data-signal-research="">
        <header className={styles.intro}>
          <span className={styles.eyebrow}>{research.ticker} · Technical evidence</span>
          <div className={styles.introMeta}>
            <span>Chart range · {SIGNAL_CHART_RANGE}</span>
            <span>Technical aggregation · {technicalFrame}</span>
            <span>{research.kind === 'fund' ? 'Fund' : 'Equity'}</span>
          </div>
        </header>

        <section className={styles.currentGrid} aria-labelledby="current-signal-heading">
          <div className={styles.timelinePanel}>
            <div className={styles.timelineHeader}>
              <div>
                <span className={styles.sectionLabel}>Price and observations</span>
                <h2 className={styles.sectionTitle}>Signal timeline</h2>
              </div>
              <span className={styles.timelineRange}>{SIGNAL_CHART_RANGE}</span>
            </div>
            <PriceSignalTimeline data={data} />
            <div className={styles.timelineNotes} aria-label="Signal direction legend">
              <span><i className={`${styles.legendDot} ${styles.signalBullish}`} />Bullish</span>
              <span><i className={`${styles.legendDot} ${styles.signalNeutral}`} />Neutral</span>
              <span><i className={`${styles.legendDot} ${styles.signalBearish}`} />Bearish</span>
              <span>Markers only appear when signal and price dates match.</span>
            </div>
          </div>

          <aside className={`${styles.currentSignal} ${currentSignalClass}`}>
            <div>
              <span className={styles.sectionLabel} id="current-signal-heading">Current Signal</span>
            </div>
            {current ? (
              <div className={styles.direction}><span className={styles.directionDot} />{directionLabel(current.direction)}</div>
            ) : <div className={styles.pendingLine}><strong>Current signal</strong><span className={styles.pending}>Unavailable</span></div>}
            {current ? (
              <dl className={styles.facts}>
                <div className={styles.factRow}><dt>Signal date</dt><dd>{formatDate(current.signalDate)}</dd></div>
                <div className={styles.factRow}><dt>Horizon</dt><dd>{current.horizon ?? '—'}</dd></div>
                <div className={styles.factRow}><dt>Price</dt><dd>{current.price === null ? '—' : formatNumber(current.price)}</dd></div>
                <div className={styles.factRow}><dt>Signal coverage</dt><dd>{current.coverage === true ? 'Available' : 'Partial coverage'}</dd></div>
              </dl>
            ) : null}
            <p className={styles.trackMeta}>Only fields with confirmed product semantics are shown. Probability, strength, returns and episode state are not interpreted here.</p>
          </aside>
        </section>

        <section className={styles.technicalSection} aria-labelledby="technical-evidence-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionLabel}>Derived from available OHLC</span>
              <h2 className={styles.sectionTitle} id="technical-evidence-heading">Technical evidence</h2>
            </div>
            <span className={styles.pending}>{available ? `OHLC rows · ${data.ohlc.rows.length}` : 'Partial coverage'}</span>
          </div>
          <div className={styles.technicalSummary}>
            <div className={styles.overallRead}>
              <span className={styles.sectionLabel}>Overall Technical Read</span>
              <strong>{available ? technical.gauges.summary.verdict : 'Not enough price history'}</strong>
              <span>Existing Overview aggregation, using the selected technical window.</span>
            </div>
            <dl className={styles.metricList}>
              <div className={styles.metricRow}><dt>Observed rows</dt><dd>{data.ohlc.rows.length || '—'}</dd></div>
              <div className={styles.metricRow}><dt>Technical source</dt><dd>OHLC</dd></div>
              <div className={styles.metricRow}><dt>Indicator history</dt><dd>Not available</dd></div>
            </dl>
          </div>
          <div className={styles.trackGrid}>
            <TechnicalTrack title="Summary" gauge={technical.gauges.summary} rows={[...technical.oscillatorRows, ...technical.movingAverageRows]} available={available} open={!family || family === 'summary'} />
            <TechnicalTrack title="Oscillators" gauge={technical.gauges.oscillators} rows={technical.oscillatorRows} available={available} open={family === 'oscillators'} />
            <TechnicalTrack title="Moving Averages" gauge={technical.gauges.movingAverages} rows={technical.movingAverageRows} available={available} open={family === 'moving-averages'} />
          </div>
        </section>

        <section className={styles.secondarySection} aria-labelledby="secondary-evidence-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionLabel}>Market context</span>
              <h2 className={styles.sectionTitle} id="secondary-evidence-heading">Momentum, trend, volume and volatility</h2>
            </div>
          </div>
          <div className={styles.secondaryGrid}>
            <section>
              <span className={styles.sectionLabel}>Momentum & Trend</span>
              <dl className={styles.metricList}>
                <div className={styles.metricRow}><dt>1D change</dt><dd>{formatNumber(stats?.change1D)}%</dd></div>
                <div className={styles.metricRow}><dt>1M change</dt><dd>{formatNumber(stats?.change1M)}%</dd></div>
                <div className={styles.metricRow}><dt>1Y change</dt><dd>{formatNumber(stats?.change1Y)}%</dd></div>
              </dl>
            </section>
            <section>
              <span className={styles.sectionLabel}>Volume, Volatility & Liquidity</span>
              <dl className={styles.metricList}>
                <div className={styles.metricRow}><dt>Latest volume</dt><dd>{stats?.volume === null || stats?.volume === undefined ? '—' : stats.volume.toLocaleString()}</dd></div>
                <div className={styles.metricRow}><dt>30D volatility</dt><dd>{stats?.vol30dPct === null || stats?.vol30dPct === undefined ? '—' : `${formatNumber(stats.vol30dPct)}%`}</dd></div>
                <div className={styles.metricRow}><dt>Liquidity fields</dt><dd>Unavailable</dd></div>
              </dl>
            </section>
          </div>
        </section>

        <section className={styles.historySection} aria-labelledby="regime-history-heading">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionLabel}>State changes</span>
              <h2 className={styles.sectionTitle} id="regime-history-heading">Regime History</h2>
            </div>
          </div>
          <BeingBuilt label="Regime transitions">When the market regime for this stock changed, and for how long each lasted, is being added.</BeingBuilt>
        </section>

        <SignalHistory data={data} />

        <section className={styles.methodology} aria-labelledby="signals-methodology-heading">
          <div className={styles.methodHeader}>
            <div>
              <span className={styles.sectionLabel}>Method and coverage</span>
              <h2 id="signals-methodology-heading">Methodology</h2>
            </div>
            <Link href={`/stocks/${research.ticker}/methodology`} className={styles.methodLink}>Open methodology →</Link>
          </div>
          <p>Summary, Oscillators and Moving Averages reuse the existing OHLC-derived implementation used by the Overview. Signal observations are shown as supplied after server-side shape and date validation. No probability, accuracy, performance or regime conclusion is calculated here.</p>
          <div className={styles.methodMeta}><span>Coverage · {research.coverageLabel}</span><span>Source · Vesconte research data</span></div>
        </section>

        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
