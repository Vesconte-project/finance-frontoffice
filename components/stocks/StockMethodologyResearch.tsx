import Link from 'next/link'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './AiMethodologyResearch.module.css'

/**
 * Methodology, one research chapter per subject (Spec PRD-78, global rules):
 * short labels, no numbering and no summary sentences. A fund is not scored,
 * so its page does not define the score.
 */
export default function StockMethodologyResearch({ data }: { data: StockResearchData }) {
  const isFund = data.kind === 'fund'
  return (
    <ResearchViewShell data={data} title="Methodology" showHeader={false}>
      <div className={styles.methodology}>
        <ResearchChapter id="evidence" label={isFund ? 'Signal and technical read' : 'Score, signal and technical read'}>
          <div className={styles.definitionList}>
            {isFund ? null : <div><strong>Score</strong><p>The Vesconte scorecard summary, built from its defined evidence axes.</p></div>}
            <div><strong>Signal</strong><p>A model state reported for an asset, with the date and horizon supplied by the product data.</p></div>
            <div><strong>Technical read</strong><p>Market evidence derived from available price history, including Summary, Oscillators and Moving averages.</p></div>
          </div>
        </ResearchChapter>

        <ResearchChapter id="relationships" label="Relationships" band>
          <div className={styles.definitionList}>
            <div><strong>Observed association</strong><p>Two prices that moved together over the window measured. An association does not establish causality, influence, prediction, or a business relationship.</p></div>
            <div><strong>Moves independently</strong><p>Companies whose movement remained connected after broad-market effects were filtered out.</p></div>
            <div><strong>Moves before / after</strong><p>Companies observed moving before or after; this indicates timing, not causality.</p></div>
            <div><strong>Same investment theme</strong><p>Companies returned with a shared investment theme.</p></div>
            <div><strong>Moves with the market</strong><p>Companies whose prices moved together as part of the wider market.</p></div>
            <div><strong>Window</strong><p>The number of trading days measured: 126 or 252.</p></div>
          </div>
        </ResearchChapter>

        <ResearchChapter id="data" label="Data and timestamps">
          <dl className={styles.factList}>
            <div><dt>Source</dt><dd>Vesconte research data</dd></div>
            <div><dt>As of</dt><dd>Shown when the source dates the figure</dd></div>
            <div><dt>Frequency</dt><dd>Follows each field or series</dd></div>
            <div><dt>Missing data</dt><dd>Kept as a coverage state, never filled from another source</dd></div>
          </dl>
        </ResearchChapter>

        <ResearchChapter id="coverage" label="Coverage states" band>
          <div className={styles.statusList}>
            <div><strong>Available</strong><span>Usable fields are present.</span></div>
            <div><strong>Partial coverage</strong><span>Some fields or periods are missing.</span></div>
            <div><strong>Being built</strong><span>The block is in its final place; its data is being added.</span></div>
            <div><strong>Unavailable</strong><span>No safe data is available for this view.</span></div>
            <div><strong>Plan required</strong><span>The capability requires an eligible account or plan.</span></div>
          </div>
        </ResearchChapter>

        <ResearchChapter id="limits" label="Limitations">
          <ul className={styles.limitList}>
            <li>Coverage varies by asset, field and reporting period.</li>
            <li>Signals and technical evidence are research context, not financial advice.</li>
            <li>Missing history is not replaced with external data or inferred values.</li>
            <li>Historical performance or event impact is not implied without an approved methodology.</li>
          </ul>
        </ResearchChapter>

        <ResearchChapter id="assets" label="Equities and funds" band>
          <p className={styles.sectionCopy}>
            The language and applicable evidence adapt to {isFund ? 'funds and ETFs' : 'equities'}. Corporate fundamentals, ownership and earnings do not automatically apply to ETFs or funds.
          </p>
        </ResearchChapter>

        <ResearchChapter id="disclosures" label="Disclosures">
          <div className={styles.linkRow}><Link href="/product#limits">Product limits</Link><Link href="/faq">FAQ</Link></div>
        </ResearchChapter>
      </div>
    </ResearchViewShell>
  )
}
