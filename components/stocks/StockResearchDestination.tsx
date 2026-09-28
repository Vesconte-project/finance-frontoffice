import ResearchOverviewLink from '@/components/stocks/ResearchOverviewLink'

export const researchDestinations = {
  fundamentals: { title: 'Fundamentals', intro: 'Canonical company or fund fundamentals, with deeper coverage added progressively.' },
  financials: { title: 'Financial Statements', intro: 'Statement-level research is planned for a later phase.' },
  valuation: { title: 'Valuation History', intro: 'Historical valuation context is pending integration.' },
  ownership: { title: 'Ownership & Capital', intro: 'Ownership and capital structure coverage is pending integration.' },
  profile: { title: 'Company Profile', intro: 'Profile context is pending integration.' },
  signals: { title: 'Signal History', intro: 'Historical model signals and observed episodes.' },
  indicators: { title: 'Indicator Details', intro: 'Technical indicator detail is available as coverage permits.' },
  events: { title: 'Earnings & Events', intro: 'Earnings and catalyst coverage is pending integration.' },
  'ai-research': { title: 'AI Research', intro: 'AI-assisted research is a planned surface; no live values are shown.' },
  methodology: { title: 'Methodology', intro: 'How the research surfaces should be interpreted.' },
} as const

type DestinationKey = keyof typeof researchDestinations

export default function StockResearchDestination({ ticker, kind }: { ticker: string; kind: DestinationKey }) {
  const destination = researchDestinations[kind]
  const planned = ['financials', 'valuation', 'ownership', 'profile', 'events', 'ai-research'].includes(kind)
  const structures: Record<DestinationKey, string[]> = {
    fundamentals: ['Valuation', 'Profitability', 'Growth', 'Balance sheet', 'Income'],
    financials: ['Income statement', 'Balance sheet', 'Cash flow', 'Financial story'],
    valuation: ['Historical multiples', 'Range context', 'Peer context', 'Drivers'],
    ownership: ['Ownership', 'Capital structure', 'Shareholder return', 'Dilution context'],
    profile: ['Business description', 'Segments', 'Geographic exposure', 'Management context'],
    signals: ['Signal flow', 'Regime history', 'Observed episodes', 'Distribution'],
    indicators: ['Oscillators', 'Moving averages', 'Momentum', 'Volatility'],
    events: ['Earnings calendar', 'Catalysts', 'Guidance', 'Event context'],
    'ai-research': ['Evidence map', 'Open questions', 'Source notes', 'Research brief'],
    methodology: ['Data sources', 'Scorecard axes', 'Signal interpretation', 'Coverage states'],
  }
  return (
    <main className="space-y-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <p className="text-caption uppercase tracking-[0.18em] text-content-muted">{ticker} · Research</p>
          <h1 className="text-page-title text-content-primary">{destination.title}</h1>
          <p className="max-w-2xl text-body text-content-secondary">{destination.intro}</p>
        </div>
        <ResearchOverviewLink ticker={ticker} />
      </div>

      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--bg-surface)]">
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
          <div className="min-h-80 p-5 lg:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">{planned ? 'Preview' : 'Partial coverage'}</p>
              <span className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-caption text-content-muted">{planned ? 'Pending integration' : 'Available structure'}</span>
            </div>
            <h2 className="mt-4 max-w-xl text-[clamp(1.4rem,2.5vw,2.15rem)] font-semibold tracking-normal text-content-primary">The final research surface is already reserved.</h2>
            <p className="mt-3 max-w-2xl text-body text-content-secondary">{planned ? 'The layout will receive canonical data without changing the page hierarchy. No values, series or conclusions are simulated in this preview.' : 'This destination will progressively combine the currently covered evidence with its deeper research controls.'}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
              <div className="min-h-36 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--bg-surface-raised)] p-4">
                <p className="text-caption uppercase tracking-[0.12em] text-content-muted">Primary research canvas</p>
                <p className="mt-3 text-body-sm text-content-secondary">Chart, interpretation or detailed table area</p>
              </div>
              <div className="grid content-between rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--bg-surface-raised)] p-4">
                <p className="text-caption uppercase tracking-[0.12em] text-content-muted">Research context</p>
                <p className="text-body-sm text-content-secondary">Sources, controls and methodology</p>
              </div>
            </div>
          </div>
          <aside className="border-t border-[var(--color-border)] bg-[var(--bg-surface-raised)] p-5 lg:border-l lg:border-t-0 lg:p-6">
            <p className="text-caption uppercase tracking-[0.14em] text-content-muted">Planned chapters</p>
            <ol className="mt-4 grid gap-0">
              {structures[kind].map((item, index) => (
                <li key={item} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-[var(--color-border-light)] py-3 text-body-sm text-content-secondary">
                  <span className="font-mono text-caption text-content-muted">0{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-5 py-4 text-body-sm sm:flex-row sm:items-center sm:justify-between lg:px-7">
          <strong className="text-content-primary">{planned ? 'Pending integration' : 'Partial coverage'}</strong>
          <span className="text-content-muted">No invented data or simulated API response.</span>
        </div>
      </section>
    </main>
  )
}
