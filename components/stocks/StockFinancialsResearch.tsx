import Link from 'next/link'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import SalesFlowChapter from '@/components/stocks/financials/SalesFlowChapter'
import styles from '@/components/stocks/fundamentals/Fundamentals.module.css'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import type { IncomeSeries } from '@/lib/statement-reading'
import type { StockResearchData } from '@/lib/stock-research'

export default function StockFinancialsResearch({
  data,
  series,
  years,
}: {
  data: StockResearchData
  /** Reported annual income measures, oldest first. */
  series: IncomeSeries
  /** Fiscal years with a reported result, newest first (at most five). */
  years: number[]
}) {
  return (
    // No page header: the chrome above already carries the company, the price
    // and the active tab.
    <ResearchViewShell data={data} title="Financials" showHeader={false}>
      <div className={styles.chapters} data-financials="">
        {data.kind === 'fund' ? (
          <ResearchChapter id="fund-financials" label="Fund figures">
            <p className={styles.fundNote}>
              A fund reports no sales or profit of its own. Its holdings, exposure and distributions are on{' '}
              <Link className={styles.chapterLink} href={`/stocks/${data.ticker}/fundamentals`}>Fundamentals →</Link>
            </p>
          </ResearchChapter>
        ) : (
          <SalesFlowChapter years={years} series={series} currency={data.currency} />
        )}
      </div>
      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
