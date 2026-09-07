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
}

function readSeries(
  metric: { key: ValuationMetric; label: string; caption: string },
  payload: MarketMetricsPayload | null,
): ValuationSeries | null {
  const rows = (payload?.available ? payload.rows : [])
    .filter((row): row is MarketMetricObservation & { value: number } => row.value !== null && Number.isFinite(row.value))
  if (rows.length === 0) return null

  const ordered = [...rows].sort((left, right) => left.observationDate.localeCompare(right.observationDate))
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
  }
}

export default function StockValuationResearch({
  data,
  observations,
}: {
  data: StockResearchData
  observations: ValuationBundle
}) {
  // Every multiple this view covers, whether or not the contract answers for
  // it. Dropping the unanswered ones made four of the five vanish with no
  // account of where they went; the reader cannot tell a multiple we do not
  // track from one we track and have nothing for.
  const multiples = VALUATION_METRICS.map((metric) => ({
    metric,
    series: readSeries(metric, observations[metric.key]),
  }))
  const covered = multiples.filter((entry) => entry.series !== null)

  return (
    // No page header, and no metric tabs. Every multiple this contract answers
    // for is on the page at once: switching between them was a page load to
    // find out whether the next one had any observations at all, and a metric
    // with none is simply absent here rather than an empty frame.
    <ResearchViewShell data={data} title="Valuation History" showHeader={false}>
      <div className={styles.grid}>
        {multiples.map(({ metric, series }) => (
          <section className={styles.multiple} key={metric.key} data-covered={series !== null || undefined}>
            <div className={styles.multipleHead}>
              <div>
                <h2>{metric.label}</h2>
                <p>{metric.caption}</p>
              </div>
              {series ? <strong>{formatMultiple(series.latest.value as number)}</strong> : null}
            </div>
            {series ? (
              <TemporalLineChart
                className={styles.multipleChart}
                points={series.points}
                ariaLabel={`${metric.label} observations for ${data.ticker}`}
                valueFormat="multiple"
              />
            ) : (
              // Plain English, and no figure of any kind. The reader is told
              // this is tracked and empty, not handed a dash where a number
              // goes.
              <p className={styles.multiplePending}>Not covered for {data.ticker} yet</p>
            )}
          </section>
        ))}
      </div>
      {covered.length === 0 ? (
        <p className={styles.multiplePending}>
          {observations.pe?.reason ?? 'No canonical multiples are available for this symbol.'}
        </p>
      ) : null}

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
