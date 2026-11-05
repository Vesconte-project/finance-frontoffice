import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import { formatCompactMoney } from '@/lib/currency'
import {
  earningsChart,
  hasMeasure,
  reportedColumns,
  type EarningsChart,
  type EarningsMeasure,
  type EarningsObservation,
} from '@/lib/earnings-chart'
import styles from './EarningsAgainstEstimate.module.css'

const WIDE = { width: 1000, height: 300 }
const COMPACT = { width: 600, height: 340 }

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatSurprise(value: number): string {
  const rounded = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.abs(value))
  return `${value >= 0 ? '+' : '−'}${rounded}%`
}

/** A reported figure, or a plain "Not reported" — never a blank cell or a dash. */
function Cell({ value }: { value: string | null }) {
  return value ? <>{value}</> : <span className={styles.notReported}>Not reported</span>
}

function Dumbbells({ chart, measure, format, variant }: {
  chart: EarningsChart
  measure: EarningsMeasure
  format: (value: number) => string
  variant: 'wide' | 'compact'
}) {
  const box = { width: chart.width, height: chart.height }
  const every = variant === 'compact' && chart.quarters.length > 6 ? 2 : 1
  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          {chart.grid.map((line) => (
            <ChartLabel key={line.value} box={box} x={0} y={line.y} anchor="start" baseline="end" tone="muted">{format(line.value)}</ChartLabel>
          ))}
          {chart.quarters.map((quarter, index) => (
            <span key={quarter.key}>
              {(chart.quarters.length - 1 - index) % every === 0 ? (
                <ChartLabel box={box} x={quarter.x} y={chart.height - 12} tone="muted">{variant === 'compact' ? quarter.label.replace(/^20/, "'") : quarter.label}</ChartLabel>
              ) : null}
              {quarter.actualY !== null && quarter.actual !== null && (variant === 'wide' || index === chart.quarters.length - 1) ? (
                <ChartLabel
                  box={box}
                  x={quarter.x}
                  y={Math.min(quarter.actualY, quarter.estimateY ?? quarter.actualY) - 14}
                  strong
                >
                  {format(quarter.actual)}
                </ChartLabel>
              ) : null}
            </span>
          ))}
        </>
      )}
    >
      {chart.grid.map((line) => (
        <line key={line.value} x1={0} x2={chart.width} y1={line.y} y2={line.y} className={styles.grid} />
      ))}
      {chart.zeroY !== null ? <line x1={0} x2={chart.width} y1={chart.zeroY} y2={chart.zeroY} className={styles.zero} /> : null}
      {chart.quarters.map((quarter) => (
        <g key={quarter.key} data-direction={quarter.direction ?? undefined} data-measure={measure} className={styles.quarter}>
          {quarter.actualY !== null && quarter.estimateY !== null ? (
            <line x1={quarter.x} x2={quarter.x} y1={quarter.estimateY} y2={quarter.actualY} className={styles.join} />
          ) : null}
          {quarter.estimateY !== null ? <circle cx={quarter.x} cy={quarter.estimateY} r={6} className={styles.estimate} /> : null}
          {quarter.actualY !== null ? <circle cx={quarter.x} cy={quarter.actualY} r={6.5} className={styles.actual} /> : null}
        </g>
      ))}
    </ChartPlot>
  )
}

function MeasureChart({ rows, measure, title, format }: {
  rows: EarningsObservation[]
  measure: EarningsMeasure
  title: string
  format: (value: number) => string
}) {
  const wide = earningsChart(rows, measure, WIDE)
  const compact = earningsChart(rows, measure, COMPACT, 8)
  return (
    <figure className={styles.measure} data-earnings-measure={measure}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>{title}</span>
        <span className={styles.tally}>Last {wide.quarters.length} quarters</span>
      </figcaption>
      <ChartFrame ariaLabel={`${title}: reported against the estimate, quarter by quarter`}>
        <Dumbbells chart={wide} measure={measure} format={format} variant="wide" />
        <Dumbbells chart={compact} measure={measure} format={format} variant="compact" />
      </ChartFrame>
    </figure>
  )
}

/**
 * Each quarter's reported figure against what was expected: a hollow mark for
 * the estimate, a filled one for what was reported, green above and red below.
 * Only reported values are drawn; a measure the source does not carry yet is
 * one sentence, not a column of "Not reported".
 */
export default function EarningsAgainstEstimate({ rows, currency }: { rows: EarningsObservation[]; currency: string }) {
  if (rows.length === 0) {
    return <BeingBuilt size="chart">Each quarter’s reported earnings and revenue against what was expected are being added.</BeingBuilt>
  }
  const columns = reportedColumns(rows)
  const eps = hasMeasure(rows, 'eps')
  const revenue = hasMeasure(rows, 'revenue')
  const money = (value: number) => formatCompactMoney(value, currency)
  const noSurprise = !columns.epsSurprise && !columns.revenueSurprise
  // What the source does not carry yet, said once instead of a column of "Not reported".
  const missing = !revenue && noSurprise
    ? 'Revenue, its estimate and the surprise for each quarter are being added.'
    : !revenue ? 'Revenue and its estimate for each quarter are being added.'
      : noSurprise ? 'The surprise for each quarter is being added.' : null

  return (
    <div className={styles.wrap} data-earnings-against-estimate="">
      <div className={styles.legend} aria-hidden="true">
        <span><i className={styles.legendEstimate} /> Estimate</span>
        <span><i className={styles.legendAbove} /> Reported, above</span>
        <span><i className={styles.legendBelow} /> Reported, below</span>
      </div>
      <div className={styles.charts} data-count={eps && revenue ? 2 : 1}>
        {eps ? <MeasureChart rows={rows} measure="eps" title="Earnings per share" format={formatNumber} /> : null}
        {revenue ? <MeasureChart rows={rows} measure="revenue" title="Revenue" format={money} /> : null}
      </div>
      {missing ? <BeingBuilt size="inline">{missing}</BeingBuilt> : null}
      <details className={styles.details}>
        <summary>Every quarter, as reported</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Reported</th>
                {columns.epsActual ? <th scope="col">EPS</th> : null}
                {columns.epsEstimate ? <th scope="col">EPS estimate</th> : null}
                {columns.epsSurprise ? <th scope="col">EPS surprise</th> : null}
                {columns.revenueActual ? <th scope="col">Revenue</th> : null}
                {columns.revenueEstimate ? <th scope="col">Revenue estimate</th> : null}
                {columns.revenueSurprise ? <th scope="col">Revenue surprise</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.earningsDate}-${row.fiscalPeriod ?? 'period'}`}>
                  <th scope="row">{row.fiscalPeriod ?? formatDate(row.earningsDate)}</th>
                  <td>{formatDate(row.earningsDate)}</td>
                  {columns.epsActual ? <td><Cell value={row.epsActual === null ? null : formatNumber(row.epsActual)} /></td> : null}
                  {columns.epsEstimate ? <td><Cell value={row.epsEstimate === null ? null : formatNumber(row.epsEstimate)} /></td> : null}
                  {columns.epsSurprise ? (
                    <td data-direction={row.epsSurprisePct === null ? undefined : row.epsSurprisePct >= 0 ? 'up' : 'down'}>
                      <Cell value={row.epsSurprisePct === null ? null : formatSurprise(row.epsSurprisePct)} />
                    </td>
                  ) : null}
                  {columns.revenueActual ? <td><Cell value={row.revenueActual === null ? null : money(row.revenueActual)} /></td> : null}
                  {columns.revenueEstimate ? <td><Cell value={row.revenueEstimate === null ? null : money(row.revenueEstimate)} /></td> : null}
                  {columns.revenueSurprise ? (
                    <td data-direction={row.revenueSurprisePct === null ? undefined : row.revenueSurprisePct >= 0 ? 'up' : 'down'}>
                      <Cell value={row.revenueSurprisePct === null ? null : formatSurprise(row.revenueSurprisePct)} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
