import type { CSSProperties } from 'react'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { buildTechnicalSummary, type TechnicalGaugeData, type TechnicalIndicatorRow } from '@/lib/technicalSignals'
import type { OhlcPoint } from '@/lib/ohlc-data'
import type { SignalResearchData } from '@/lib/signal-research'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { LeadStat } from '@/components/stocks/research/ResearchChapter'
import SignalTimelineChapter, { type TimelineSignal } from '@/components/stocks/signals/SignalTimelineChapter'
import styles from './StockSignalsResearch.module.css'

const RANGE_DAYS = { '1M': 31 } as const
const SIGNAL_CHART_RANGE = '1M' as const
const SIGNAL_TECHNICAL_TIMEFRAME = '1D' as const

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? dayFormat.format(parsed) : value
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function directionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
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

/** The model's signals, oldest first, with the price the latest one recorded. */
function timelineSignals(data: SignalResearchData): TimelineSignal[] {
  const signals: TimelineSignal[] = [...data.observations]
    .sort((left, right) => left.signalDate.localeCompare(right.signalDate))
    .map((observation) => ({ id: String(observation.id), date: observation.signalDate.slice(0, 10), direction: observation.direction, horizon: observation.horizon, price: null }))
  const current = data.currentSignal
  if (current?.signalDate) {
    const date = current.signalDate.slice(0, 10)
    const same = signals.find((signal) => signal.date === date)
    if (same) same.price = current.price
    else signals.push({ id: `current-${date}`, date, direction: current.direction, horizon: current.horizon, price: current.price })
    signals.sort((left, right) => left.date.localeCompare(right.date))
  }
  return signals
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
          <span>{gauge.counts.sell} sell</span>
          <span>{gauge.counts.neutral} neutral</span>
          <span>{gauge.counts.buy} buy</span>
        </div>
      ) : <span className={styles.trackMeta}>Not enough price history for this read yet.</span>}
      <details className={styles.trackDetails} open={open && available}>
        <summary>Each indicator</summary>
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
            <time dateTime={observation.signalDate}>{formatDay(observation.signalDate)}</time>
            <strong>{directionLabel(observation.direction)}</strong>
            {observation.horizon ? <span>{observation.horizon}-day horizon</span> : null}
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
  const stats = research.summary.marketStats
  const closes = rangeRows(data.ohlc.rows).map((row) => ({ date: row.date.slice(0, 10), close: row.close }))
  const lastPriceDate = data.ohlc.rows.reduce<string | null>((latest, row) => (!latest || row.date > latest ? row.date : latest), null)

  return (
    // No page header: the chrome above already names the company and the tab.
    <ResearchViewShell data={research} title="Signals & Indicators" showHeader={false}>
      <div className={styles.page} data-signal-research="">
        <SignalTimelineChapter ticker={research.ticker} closes={closes} signals={timelineSignals(data)} currency={research.currency} />

        <ResearchChapter
          id="technicals"
          label="Technicals"
          band
          lead={available ? (
            <LeadStat
              value={technical.gauges.summary.verdict}
              context={`all ${technical.oscillatorRows.length + technical.movingAverageRows.length} indicators · daily${lastPriceDate ? ` · prices to ${formatDay(lastPriceDate)}` : ''}`}
            />
          ) : (
            <BeingBuilt size="inline">The technical read needs at least 30 days of prices for {research.ticker}.</BeingBuilt>
          )}
        >
          <div className={styles.trackGrid}>
            <TechnicalTrack title="Summary" gauge={technical.gauges.summary} rows={[...technical.oscillatorRows, ...technical.movingAverageRows]} available={available} open={!family || family === 'summary'} />
            <TechnicalTrack title="Oscillators" gauge={technical.gauges.oscillators} rows={technical.oscillatorRows} available={available} open={family === 'oscillators'} />
            <TechnicalTrack title="Moving averages" gauge={technical.gauges.movingAverages} rows={technical.movingAverageRows} available={available} open={family === 'moving-averages'} />
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
          {stats?.asOfDate ? <p className={styles.dataDate}>As of {formatDay(stats.asOfDate)}</p> : null}
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
