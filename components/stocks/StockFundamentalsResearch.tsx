import Link from 'next/link'
import MeasureSparkline from '@/components/stocks/MeasureSparkline'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { formatCompactMoney } from '@/lib/currency'
import type { FundamentalMeasure, FundamentalsView } from '@/lib/stock-fundamentals-view'
import type { ResearchMetric, StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'

function formatMeasure(measure: FundamentalMeasure, value: number): string {
  if (measure.format === 'currency') return formatCompactMoney(value, measure.currency)
  if (measure.format === 'perShare') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
  if (measure.format === 'shares') {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function formatChange(change: number): string {
  const rounded = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.abs(change))
  return `${change >= 0 ? '+' : '−'}${rounded}%`
}

function MeasureCard({ measure }: { measure: FundamentalMeasure }) {
  return (
    <article className={styles.measure}>
      <h3>{measure.label}</h3>
      <p className={styles.measureValue}>{formatMeasure(measure, measure.latest.value)}</p>
      <p className={styles.measureChange}>
        {measure.changePct !== null && measure.previous ? (
          // The direction is stated in words as well as sign, because colour
          // and a glyph alone do not survive a monochrome or low-vision read.
          <span data-direction={measure.changePct >= 0 ? 'up' : 'down'}>
            {formatChange(measure.changePct)} vs {measure.previous.label}
          </span>
        ) : (
          <span data-direction="flat">{measure.latest.label}</span>
        )}
      </p>
      <MeasureSparkline
        values={measure.series.map((point) => point.value)}
        ariaLabel={`${measure.label} from ${measure.series[0].label} to ${measure.latest.label}`}
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
  const leads = chapters.flatMap((chapter) => {
    const measure = chapter.measures[0]
    return measure ? [{ chapter, measure }] : []
  })

  return (
    <ResearchViewShell data={data} title="Fundamentals">
      {leads.length > 0 ? (
        <nav className={styles.questionRow} aria-label="What this page answers">
          {leads.map(({ chapter, measure }) => (
            <a key={chapter.key} href={`#${chapter.key}`}>
              <span className={styles.questionAsk}>{chapter.question}</span>
              <strong>{formatMeasure(measure, measure.latest.value)}</strong>
              <span className={styles.questionMeta}>
                {measure.label}
                {measure.changePct !== null ? ` · ${formatChange(measure.changePct)}` : ''}
              </span>
            </a>
          ))}
        </nav>
      ) : null}

      <div className={styles.chapters}>
        {chapters.map((chapter) => (
          <section className={styles.chapter} id={chapter.key} key={chapter.key}>
            <div className={styles.chapterHead}>
              <h2>{chapter.label}</h2>
              {chapter.span ? <p>{chapter.span}</p> : null}
            </div>
            {chapter.measures.length > 0 ? (
              <div className={styles.measureGrid}>
                {chapter.measures.map((measure) => <MeasureCard key={measure.key} measure={measure} />)}
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
          <TailList metrics={valuationTail} />
          <Link className="action-link inline-flex" href={`/stocks/${data.ticker}/valuation`}>Open Valuation history →</Link>
        </section>
      ) : null}

      {additionalTail.length > 0 ? (
        <section className={styles.chapter}>
          <div className={styles.chapterHead}>
            <h2>{data.kind === 'fund' ? 'Fund details' : 'Additional evidence'}</h2>
          </div>
          <TailList metrics={additionalTail} />
        </section>
      ) : null}

      <section className={styles.handoff}>
        <div>
          <h2>Financial statements</h2>
          <p>Every reported line item, period by period.</p>
        </div>
        <Link className="action-link inline-flex" href={`/stocks/${data.ticker}/financials`}>Open Financial Statements →</Link>
      </section>

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
