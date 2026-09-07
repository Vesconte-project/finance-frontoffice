import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { formatCompactMoney } from '@/lib/currency'
import type { FundamentalChapter, FundamentalMeasure, FundamentalsView } from '@/lib/stock-fundamentals-view'
import type { ResearchMetric, StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'

function formatLevel(measure: FundamentalMeasure, value: number): string {
  if (measure.format === 'currency') return formatCompactMoney(value, measure.currency)
  if (measure.format === 'shares') {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function formatChange(change: number): string {
  const rounded = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.abs(change))
  return `${change >= 0 ? '+' : '−'}${rounded}%`
}

function ChangeTable({ chapter }: { chapter: FundamentalChapter }) {
  if (chapter.periods.length === 0) return null

  return (
    <div className={styles.changeScroll}>
      <table className={styles.changeTable}>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {chapter.periods.map((period) => <th scope="col" key={period.periodEnd}>{period.label}</th>)}
            <th scope="col">Latest</th>
          </tr>
        </thead>
        <tbody>
          {chapter.measures.map((measure) => {
            const changes = new Map(measure.changes.map((change) => [change.periodEnd, change.changePct]))
            return (
              <tr key={measure.key}>
                <th scope="row">{measure.label}</th>
                {chapter.periods.map((period) => {
                  const change = changes.get(period.periodEnd)
                  return (
                    <td key={period.periodEnd} data-direction={change === undefined ? undefined : change >= 0 ? 'up' : 'down'}>
                      {/* A period this measure does not report is left blank.
                          A dash would read as a reported zero. */}
                      {change === undefined ? '' : formatChange(change)}
                    </td>
                  )
                })}
                <td className={styles.changeLevel}>{formatLevel(measure, measure.latest.value)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TailList({ metrics }: { metrics: ResearchMetric[] }) {
  if (metrics.length === 0) return null
  return (
    <dl className={styles.tailList}>
      {metrics.map((metric) => (
        <div key={metric.key}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function StockFundamentalsResearch({
  data,
  view,
}: {
  data: StockResearchData
  view: FundamentalsView
}) {
  return (
    // No page header: the chrome above already carries the company, the price
    // and the active tab. No handoff blocks to Financials or Valuation either
    // — that nav sits directly above this content.
    <ResearchViewShell data={data} title="Fundamentals" showHeader={false}>
      <div className={styles.chapters}>
        {view.chapters.map((chapter) => (
          <section className={styles.chapter} id={chapter.key} key={chapter.key}>
            <h2 className={styles.chapterHead}>{chapter.label}</h2>
            <ChangeTable chapter={chapter} />
            <TailList metrics={chapter.tail} />
          </section>
        ))}
      </div>
      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
