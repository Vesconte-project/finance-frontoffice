import Link from 'next/link'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './AiMethodologyResearch.module.css'

export default function StockMethodologyResearch({ data }: { data: StockResearchData }) {
  return (
    <ResearchViewShell data={data} title="Methodology">
      <main className={styles.methodology}>
        <aside className={styles.index} aria-label="Methodology contents">
          <span className={styles.kicker}>On this page</span>
          <nav>
            <a href="#evidence">Score, signal and technical read</a>
            <a href="#data">Data and timestamps</a>
            <a href="#coverage">Coverage states</a>
            <a href="#limits">Limitations</a>
            <a href="#assets">Equities and funds</a>
            <a href="#disclosures">Disclosures</a>
          </nav>
        </aside>
        <article className={styles.editorial}>
          <p className={styles.kicker}>How to read Vesconte</p>
          <p className={styles.intro}>Vesconte presents market, company and fund evidence in separate layers. The page does not turn these layers into a trading instruction.</p>

          <section id="evidence" className={styles.methodSection}>
            <div className={styles.sectionLabel}>01</div><div>
              <h2>Score, signal and technical read</h2>
              <div className={styles.definitionList}>
                <div><strong>Score</strong><p>The canonical scorecard summary, built from the product’s defined evidence axes.</p></div>
                <div><strong>Signal</strong><p>A model state reported for an asset, with the date and horizon supplied by the product data.</p></div>
                <div><strong>Technical read</strong><p>Market evidence derived from available price history, including Summary, Oscillators and Moving Averages.</p></div>
              </div>
            </div>
          </section>

          <section id="data" className={styles.methodSection}>
            <div className={styles.sectionLabel}>02</div><div>
              <h2>Data and timestamps</h2>
              <p className={styles.sectionCopy}>Product data is requested server-side from finance-backend. The frontend presents the fields and periods returned by those contracts.</p>
              <dl className={styles.factList}>
                <div><dt>Source</dt><dd>finance-backend</dd></div>
                <div><dt>As of</dt><dd>Shown when supplied by the payload</dd></div>
                <div><dt>Frequency</dt><dd>Follows the field or series contract</dd></div>
                <div><dt>Missing data</dt><dd>Kept as a coverage state, never filled from another source</dd></div>
              </dl>
            </div>
          </section>

          <section id="coverage" className={styles.methodSection}>
            <div className={styles.sectionLabel}>03</div><div>
              <h2>Coverage states</h2>
              <div className={styles.statusList}>
                <div><strong>Available</strong><span>Usable fields are present.</span></div>
                <div><strong>Partial coverage</strong><span>Some fields or periods are missing.</span></div>
                <div><strong>Preview</strong><span>The final geometry is reserved for a future capability.</span></div>
                <div><strong>Unavailable</strong><span>No safe data is available for this view.</span></div>
                <div><strong>Plan required</strong><span>The capability requires an eligible account or plan.</span></div>
              </div>
            </div>
          </section>

          <section id="limits" className={styles.methodSection}>
            <div className={styles.sectionLabel}>04</div><div>
              <h2>Limitations</h2>
              <ul className={styles.limitList}>
                <li>Coverage varies by asset, field and reporting period.</li>
                <li>Signals and technical evidence are research context, not financial advice.</li>
                <li>Missing history is not replaced with external data or inferred values.</li>
                <li>Historical performance or event impact is not implied without an approved methodology.</li>
              </ul>
            </div>
          </section>

          <section id="assets" className={styles.methodSection}>
            <div className={styles.sectionLabel}>05</div><div>
              <h2>Equities and funds</h2>
              <p className={styles.sectionCopy}>The language and applicable evidence adapt to {data.kind === 'fund' ? 'funds and ETFs' : 'equities'}. Corporate fundamentals, ownership and earnings do not automatically apply to ETFs or funds.</p>
            </div>
          </section>

          <section id="disclosures" className={styles.methodSection}>
            <div className={styles.sectionLabel}>06</div><div>
              <h2>Disclosures</h2>
              <p className={styles.sectionCopy}>Review the product limits and the questions commonly covered by the platform.</p>
              <div className={styles.linkRow}><Link href="/product#limits">Product limits</Link><Link href="/faq">FAQ</Link></div>
            </div>
          </section>
        </article>
      </main>
    </ResearchViewShell>
  )
}
