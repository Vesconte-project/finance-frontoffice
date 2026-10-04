import Link from 'next/link'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import type { StockResearchData } from '@/lib/stock-research'
import { getViewerAccess } from '@/lib/billing'
import styles from './AiMethodologyResearch.module.css'

const SUGGESTIONS = [
  'What should I investigate next?',
  'What is changing in the recent signal?',
  'What are the main business risks?',
]

export default async function StockAiResearch({ data }: { data: StockResearchData }) {
  const access = await getViewerAccess()
  const accessLabel = access.isPro ? 'Pro access' : 'Plan required'

  return (
    <ResearchViewShell data={data} title="AI Research">
      <main className={styles.aiPage} aria-label="AI Research capability preview">
        <section className={styles.context} aria-labelledby="ai-context-title">
          <div>
            <p className={styles.kicker}>Capability preview</p>
            <h2 id="ai-context-title">Research context for {data.ticker}</h2>
          </div>
          <dl className={styles.contextFacts}>
            <div><dt>Asset</dt><dd>{data.name} · {data.kind === 'fund' ? 'Fund' : 'Equity'}</dd></div>
            <div><dt>Evidence</dt><dd>Current ticker research</dd></div>
            <div><dt>Coverage</dt><dd>{data.coverageLabel}</dd></div>
          </dl>
        </section>

        <section className={styles.preview} aria-labelledby="ai-preview-title">
          <div className={styles.previewLead}>
            <p className={styles.kicker}>AI-assisted research</p>
            <h2 id="ai-preview-title">Ask about the evidence around this ticker.</h2>
            <p className={styles.previewNote}>This capability is being connected to the research sources.</p>
          </div>
          <div className={styles.questionPreview} aria-label="AI question preview">
            <label htmlFor="ai-question">Your question</label>
            <div className={styles.questionRow}>
              <input id="ai-question" type="text" disabled placeholder={`Ask about ${data.ticker}`} aria-describedby="ai-question-state" />
              <button type="button" disabled aria-disabled="true">Ask</button>
            </div>
            <p id="ai-question-state" className={styles.disabledNote}>Being built</p>
          </div>
          <div className={styles.suggestions} aria-label="Suggested questions">
            <span>Suggested questions</span>
            <div>{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" disabled>{suggestion}</button>)}</div>
          </div>
        </section>

        <section className={styles.responseGrid} aria-label="AI response preview">
          <article className={styles.response}>
            <div className={styles.sectionHead}>
              <div><p className={styles.kicker}>Response</p><h2>Evidence-led answers</h2></div>
              <span className={styles.status}>Preview</span>
            </div>
            <div className={styles.responseCanvas}>
              <span className={styles.responseLine} />
              <span className={styles.responseLineShort} />
              <p>Response content will appear here when the integration is available.</p>
            </div>
          </article>
          <aside className={styles.sources} aria-label="Sources and citations preview">
            <div className={styles.sectionHead}>
              <div><p className={styles.kicker}>Sources</p><h2>Citations</h2></div>
              <span className={styles.status}>Preview</span>
            </div>
            <p className={styles.muted}>Source links will be attached to each answer.</p>
            <div className={styles.sourceRule} aria-hidden="true" />
            <p className={styles.muted}>No citations are generated in this preview.</p>
          </aside>
        </section>

        <section className={styles.availability} aria-label="AI Research availability">
          <div><span className={styles.kicker}>Availability</span><strong>{accessLabel}</strong></div>
          <p>{access.isPro ? 'Your plan is recognised. The capability is not connected to this view yet.' : 'AI Research will be available on eligible plans when the integration is connected.'}</p>
          {!access.isPro ? <Link href="/pricing">View plans</Link> : null}
        </section>
      </main>
    </ResearchViewShell>
  )
}
