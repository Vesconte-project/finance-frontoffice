import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Bookmark, BrainCircuit, GitBranch, History, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Inter, JetBrains_Mono, Sora } from 'next/font/google'
import { SiteHeader, sharedHeaderSpacerClass } from '@/components/marketing/site-chrome'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

const productThemeStyle = {
  ['--page-bg' as never]: '#f3efe6',
  ['--background' as never]: '#f3efe6',
  ['--foreground' as never]: '#142943',
  ['--content-primary' as never]: '#142943',
  ['--content-secondary' as never]: '#53657b',
  ['--content-muted' as never]: '#7c8994',
  ['--brand-spark' as never]: '#0b8178',
  ['--brand-spark-soft' as never]: '#1ba69a',
  ['--brand-spark-on' as never]: '#04201d',
  ['--border' as never]: 'rgba(20, 41, 67, 0.14)',
  ['--surface-card' as never]: 'rgba(255, 255, 255, 0.62)',
  ['--surface-hover' as never]: 'rgba(20, 41, 67, 0.055)',
  ['--glass-bg' as never]: 'rgba(255, 255, 255, 0.72)',
  ['--glass-border' as never]: 'rgba(20, 41, 67, 0.13)',
  ['--glass-highlight' as never]: 'rgba(255, 255, 255, 0.9)',
  ['--glass-shadow' as never]: '0 16px 56px rgba(25, 40, 53, 0.1)',
  ['--font-display' as never]: sora.style.fontFamily,
  ['--font-body' as never]: inter.style.fontFamily,
  ['--font-mono' as never]: mono.style.fontFamily,
  fontFamily: 'var(--font-body)',
}

const productPath = [
  { label: 'Search', body: 'Find a ticker or company by symbol, name, or exchange.', icon: Search },
  { label: 'Understand', body: 'Read price, market context, signals, history, and scorecards together.', icon: GitBranch },
  { label: 'Compare', body: 'Use the screener and relationship views to widen or narrow the list.', icon: SlidersHorizontal },
  { label: 'Save', body: 'Keep the names that matter in a watchlist tied to your account.', icon: Bookmark },
  { label: 'Monitor', body: 'Return to saved names, recent signal changes, and research runs.', icon: History },
] as const

const tickerAreas = [
  { label: 'Market view', body: 'Price, daily move, historical chart, key stats, and technical summaries.' },
  { label: 'Signal view', body: 'Direction, conviction, prediction horizon, signal date, and signal history.' },
  { label: 'Scorecard', body: 'Overall score plus Value, Potential, Health, Income, and Momentum axes when available.' },
  { label: 'Research context', body: 'Fundamentals, related assets, relationships, and the AI research copilot.' },
] as const

const signalReading = [
  { label: 'Direction', body: 'Bullish, bearish, or neutral describes the current model stance.' },
  { label: 'Conviction', body: 'A percentage-like probability field showing how strongly the model leans.' },
  { label: 'Horizon', body: 'The prediction horizon tells you the intended window for interpreting the signal.' },
  { label: 'Scorecard', body: 'A separate company-oriented view; missing inputs are shown instead of hidden.' },
] as const

export default function ProductPage() {
  return (
    <main
      data-theme="light"
      style={productThemeStyle}
      className="marketing-product relative min-h-screen overflow-x-clip bg-[var(--page-bg)] text-content-primary"
    >
      <SiteHeader activeHref="/product" />
      <div className={sharedHeaderSpacerClass} aria-hidden="true" />

      <section className="relative overflow-hidden border-b border-border" aria-labelledby="product-title">
        <div
          className="pointer-events-none absolute -right-48 -top-40 h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(11,129,120,0.13),transparent_68%)] blur-2xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-[1180px] gap-12 px-6 pb-16 pt-12 sm:px-10 sm:pb-20 sm:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-14 lg:py-24">
          <div className="max-w-2xl">
            <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-spark">
              Product
            </p>
            <h1
              id="product-title"
              style={{ fontFamily: 'var(--font-display)' }}
              className="mt-5 max-w-xl text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-6xl"
            >
              Research the market with more context.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-content-secondary">
              Longbrunch connects ticker search, market signals, company data, comparisons, saved names, and AI research in one practical flow.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/screener"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-brand-spark px-6 font-semibold text-[color:var(--brand-spark-on)] shadow-[0_18px_50px_-12px_var(--brand-spark)] transition hover:brightness-110"
              >
                Open the screener <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary transition hover:text-brand-spark">
                See access <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="relative border-y border-border py-2" aria-label="Product path">
            {productPath.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-border py-5 last:border-b-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
                  <div className="grid size-10 place-items-center rounded-full bg-brand-spark/10 text-brand-spark">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)' }} className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-spark">
                      0{index + 1} / {step.label}
                    </p>
                    <p className="mt-1 text-base font-semibold text-content-primary">{step.body}</p>
                  </div>
                  <span className="hidden text-xs text-content-muted sm:block">{index === productPath.length - 1 ? 'return' : 'next'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="flow" className="mx-auto max-w-[1180px] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24" aria-labelledby="flow-title">
        <div className="max-w-2xl">
          <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-spark">
            The flow
          </p>
          <h2 id="flow-title" style={{ fontFamily: 'var(--font-display)' }} className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
            Start with a name, not a blank dashboard.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-content-secondary">
            Search gives you an entry point. Each next step adds a different kind of context without losing the asset you started with.
          </p>
        </div>

        <div className="mt-12 divide-y divide-border border-y border-border">
          {productPath.map((step, index) => (
            <div key={step.label} className="grid gap-4 py-6 sm:grid-cols-[5rem_10rem_minmax(0,1fr)] sm:items-baseline sm:gap-6">
              <span style={{ fontFamily: 'var(--font-mono)' }} className="text-sm font-semibold tracking-[0.16em] text-brand-spark">0{index + 1}</span>
              <h3 style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold tracking-[-0.04em]">{step.label}</h3>
              <p className="max-w-2xl text-base leading-7 text-content-secondary">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="ticker-pages" className="border-y border-border bg-white/30" aria-labelledby="ticker-pages-title">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-14 lg:py-24">
          <div>
            <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-spark">
              Ticker pages
            </p>
            <h2 id="ticker-pages-title" style={{ fontFamily: 'var(--font-display)' }} className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
              One asset, one research surface.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-content-secondary">
              Open a company or asset to move from a headline price to the signal, history, scorecard, fundamentals, relationships, and research tools behind it.
            </p>
            <Link href="/markets" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-spark transition hover:gap-3">
              Explore markets <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {tickerAreas.map((area) => (
              <div key={area.label} className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                <h3 className="text-sm font-semibold text-content-primary">{area.label}</h3>
                <p className="text-base leading-7 text-content-secondary">{area.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="compare" className="mx-auto max-w-[1180px] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24" aria-labelledby="compare-title">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-spark">
              Compare
            </p>
            <h2 id="compare-title" style={{ fontFamily: 'var(--font-display)' }} className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
              Make the shortlist visible.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-content-secondary">
              The screener ranks live signal rows so you can filter by direction, conviction, freshness, ticker, or daily movement before opening the names that deserve a closer read.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
              <Link href="/screener" className="inline-flex items-center gap-2 text-brand-spark transition hover:gap-3">
                Open Signals <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/markets/network" className="inline-flex items-center gap-2 text-content-secondary transition hover:text-brand-spark">
                Explore relationships <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="border-y border-border">
            <div className="grid grid-cols-2 gap-4 border-b border-border px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-content-muted sm:grid-cols-4">
              <span>Direction</span>
              <span>Conviction</span>
              <span>Signal date</span>
              <span>Daily move</span>
            </div>
            <div className="grid gap-5 px-4 py-6 sm:grid-cols-2">
              <div className="flex gap-3">
                <SlidersHorizontal className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Filter the tape</h3>
                  <p className="mt-1 text-sm leading-6 text-content-secondary">Start with a view such as high-conviction, fresh, bearish, or biggest movers.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <GitBranch className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Follow relationships</h3>
                  <p className="mt-1 text-sm leading-6 text-content-secondary">Use ticker relationships and the correlation network to see nearby assets and co-movers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="watchlists" className="border-y border-border bg-[#ebe5da]" aria-labelledby="watchlists-title">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 lg:py-24">
          <div>
            <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-spark">
              Save and monitor
            </p>
            <h2 id="watchlists-title" style={{ fontFamily: 'var(--font-display)' }} className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
              Keep the names that matter close.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-content-secondary">
              A signed-in user can save tickers from their pages. The dashboard then brings together the saved list, current stance, conviction, and recent signal changes.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/dashboard/watchlist" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-spark transition hover:gap-3">
                Open watchlist <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/faq#contact" className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary transition hover:text-brand-spark">
                Ask about access <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="border-y border-border">
            <div className="flex items-start gap-4 border-b border-border py-5">
              <Bookmark className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Account boundary</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">Public pages can be explored without signing in. Saving tickers and dashboard views require an account.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-5">
              <History className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">History and alerts</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">Ticker pages expose signal history. Watchlist-based signal-change notifications depend on the current alert and account setup.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="methodology" className="mx-auto max-w-[1180px] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24" aria-labelledby="methodology-title">
        <div className="max-w-2xl">
          <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-spark">
            Interpretation
          </p>
          <h2 id="methodology-title" style={{ fontFamily: 'var(--font-display)' }} className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
            Read the output with its limits attached.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-content-secondary">
            Longbrunch gives you model output and research context. It does not turn a direction, score, or generated answer into a guaranteed outcome or an instruction to trade.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="divide-y divide-border border-y border-border">
            {signalReading.map((item) => (
              <div key={item.label} className="grid gap-2 py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
                <h3 className="font-semibold text-content-primary">{item.label}</h3>
                <p className="text-base leading-7 text-content-secondary">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6 border-y border-border py-5">
            <div className="flex items-start gap-4">
              <BrainCircuit className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">AI Analyst</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">Ask follow-up questions about catalysts, risks, and stance shifts. The response is generated research context; check it against the underlying ticker data.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Coverage is part of the answer</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">Quotes, histories, fundamentals, relationships, and scorecards can have different freshness and availability. Missing inputs stay visible.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Sparkles className="mt-1 size-5 shrink-0 text-brand-spark" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Research, not advice</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">Use the product to investigate and compare. Decisions remain yours, and no feature guarantees performance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="limits" className="border-t border-border" aria-labelledby="limits-title">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-6 py-14 sm:px-10 sm:py-16 lg:flex-row lg:items-end lg:justify-between lg:px-14">
          <div className="max-w-2xl">
            <p style={{ fontFamily: 'var(--font-mono)' }} className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-spark">
              Access and limits
            </p>
            <h2 id="limits-title" style={{ fontFamily: 'var(--font-display)' }} className="mt-4 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
              Explore first. Decide what you need next.
            </h2>
            <p className="mt-4 text-base leading-7 text-content-secondary">
              Public exploration is available now. Basic and Pro are planned and do not yet have checkout or live entitlements; pricing shows the current state.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/pricing" className="inline-flex items-center gap-2 text-brand-spark transition hover:gap-3">
              View pricing <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/faq" className="inline-flex items-center gap-2 text-content-secondary transition hover:text-brand-spark">
              Read the FAQ <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
