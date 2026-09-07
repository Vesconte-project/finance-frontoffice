import TemporalLineChart from '@/components/charts/TemporalLineChart'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import type { MarketMetricObservation, MarketMetricsPayload } from '@/lib/canonical-research'
import { formatResearchDate } from '@/lib/research-evidence'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './StockValuationResearch.module.css'

export type ValuationMetric = 'pe' | 'ps' | 'pb' | 'pfcf' | 'ev-ebitda'

export const VALUATION_METRICS: Array<{ key: ValuationMetric; label: string; caption: string }> = [
  { key: 'pe', label: 'P/E', caption: 'Price against earnings' },
  { key: 'ps', label: 'P/S', caption: 'Price against revenue' },
  { key: 'pb', label: 'P/B', caption: 'Price against book value' },
  { key: 'pfcf', label: 'P/FCF', caption: 'Price against free cash flow' },
  { key: 'ev-ebitda', label: 'EV/EBITDA', caption: 'Enterprise value against EBITDA' },
]

export type ValuationBundle = Record<ValuationMetric, MarketMetricsPayload | null>

function formatMultiple(value: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}x`
}

type ValuationSeries = {
  key: ValuationMetric
  label: string
  caption: string
  points: Array<{ date: string; value: number; key: string; tooltipMeta: string }>
  latest: MarketMetricObservation
  low: number
  high: number
}

function readSeries(
  metric: { key: ValuationMetric; label: string; caption: string },
  payload: MarketMetricsPayload | null,
): ValuationSeries | null {
  const rows = (payload?.available ? payload.rows : [])
    .filter((row): row is MarketMetricObservation & { value: number } => row.value !== null && Number.isFinite(row.value))
  if (rows.length === 0) return null

  const ordered = [...rows].sort((left, right) => left.observationDate.localeCompare(right.observationDate))
  const values = ordered.map((row) => row.value)
  return {
    key: metric.key,
    label: metric.label,
    caption: metric.caption,
    points: ordered.map((row) => ({
      date: row.observationDate,
      value: row.value,
      key: `${row.observationDate}:${row.knownAt}`,
      tooltipMeta: `Known ${formatResearchDate(row.knownAt)}`,
    })),
    latest: ordered[ordered.length - 1],
    // The lowest and highest points of the line already on screen. Not a
    // percentile and not a rank against anything outside this window — reading
    // the axis, which is the only reference this contract can support.
    low: Math.min(...values),
    high: Math.max(...values),
  }
}

export default function StockValuationResearch({
  data,
  observations,
}: {
  data: StockResearchData
  observations: ValuationBundle
}) {
  const series = VALUATION_METRICS
    .map((metric) => readSeries(metric, observations[metric.key]))
    .filter((entry): entry is ValuationSeries => entry !== null)

  const source = series[0]?.latest.source ?? null
  const knownAt = series.reduce<string | null>(
    (latest, entry) => !latest || entry.latest.knownAt > latest ? entry.latest.knownAt : latest,
    null,
  )

  return (
    // No page header, and no metric tabs. Every multiple this contract answers
    // for is on the page at once: switching between them was a page load to
    // find out whether the next one had any observations at all, and a metric
    // with none is simply absent here rather than an empty frame.
    <ResearchViewShell data={data} title="Valuation History" showHeader={false}>
      {series.length > 0 ? (
        <>
          <div className={styles.grid}>
            {series.map((entry) => (
              <section className={styles.multiple} key={entry.key}>
                <div className={styles.multipleHead}>
                  <div>
                    <h2>{entry.label}</h2>
                    <p>{entry.caption}</p>
                  </div>
                  <strong>{formatMultiple(entry.latest.value as number)}</strong>
                </div>
                <p className={styles.multipleRange}>
                  {formatResearchDate(entry.points[0].date)} – {formatResearchDate(entry.latest.observationDate)}
                  {' · '}
                  low {formatMultiple(entry.low)} · high {formatMultiple(entry.high)}
                </p>
                <TemporalLineChart
                  className={styles.multipleChart}
                  points={entry.points}
                  ariaLabel={`${entry.label} observations for ${data.ticker}`}
                  valueFormat="multiple"
                />
              </section>
            ))}
          </div>
          <p className={styles.provenance}>
            {source ? `${source.replace(/_/g, ' ')} · ` : ''}
            {knownAt ? `known at ${formatResearchDate(knownAt)}` : ''}
          </p>
        </>
      ) : (
        <p className={styles.provenance}>
          {observations.pe?.reason ?? 'No canonical multiples are available for this symbol.'}
        </p>
      )}

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
