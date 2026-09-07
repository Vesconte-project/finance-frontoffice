import Link from 'next/link'
import MeasurePeriods from '@/components/stocks/MeasurePeriods'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { formatCompactMoney } from '@/lib/currency'
import type { FundamentalMeasure, FundamentalsView } from '@/lib/stock-fundamentals-view'
import type { ResearchMetric, StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'

function formatMeasure(measure: FundamentalMeasure, value: number): string {
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

function Measure({ measure }: { measure: FundamentalMeasure }) {
  return (
    <article className={styles.measure}>
      <div className={styles.measureHead}>
        <h3>{measure.label}</h3>
        <p className={styles.measureValue}>{formatMeasure(measure, measure.latest.value)}</p>
        {measure.changePct !== null && measure.previous ? (
          <p className={styles.measureChange} data-direction={measure.changePct >= 0 ? 'up' : 'down'}>
            {formatChange(measure.changePct)} <span>vs {measure.previous.label}</span>
          </p>
        ) : null}
      </div>
      <MeasurePeriods
        format={measure.format}
        points={measure.series.map((point) => ({
          label: point.label,
          value: point.value,
          display: formatMeasure(measure, point.value),
        }))}
      />
    </article>
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
  const { chapters, valuationTail, additionalTail } = view

  return (
    // No page header. The ticker chrome above already carries the company, the
    // price and the active tab, so an <h1> repeating the tab and a coverage
    // badge beside it were two lines that told the reader nothing.
    <ResearchViewShell data={data} title="Fundamentals" showHeader={false}>
      <div className={styles.chapters}>
        {chapters.map((chapter) => (
          <section className={styles.chapter} id={chapter.key} key={chapter.key}>
            <h2 className={styles.chapterHead}>{chapter.label}</h2>
            {chapter.measures.length > 0 ? (
              <div className={styles.measureGrid}>
                {chapter.measures.map((measure) => <Measure key={measure.key} measure={measure} />)}
              </div>
            ) : null}
            <TailList metrics={chapter.tail} />
          </section>
        ))}
      </div>

      {valuationTail.length > 0 ? (
        <section className={styles.handoff}>
          <div>
            <h2>Valuation</h2>
            <p>What the market pays for all of this, charted against its own history.</p>
          </div>
          <div>
            <TailList metrics={valuationTail} />
            <Link className="action-link inline-flex" href={`/stocks/${data.ticker}/valuation`}>Open Valuation history →</Link>
          </div>
        </section>
      ) : null}

      {additionalTail.length > 0 ? (
        <section className={styles.chapter}>
          <h2 className={styles.chapterHead}>{data.kind === 'fund' ? 'Fund details' : 'Additional evidence'}</h2>
          <TailList metrics={additionalTail} />
        </section>
      ) : null}

      <section className={styles.handoff}>
        <div>
          <h2>Financial statements</h2>
          <p>Every reported line item, period by period.</p>
        </div>
        <div>
          <Link className="action-link inline-flex" href={`/stocks/${data.ticker}/financials`}>Open Financial Statements →</Link>
        </div>
      </section>

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
