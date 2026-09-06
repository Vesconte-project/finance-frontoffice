import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Inter, JetBrains_Mono, Sora } from 'next/font/google'
import FaqAccordion, { type FaqGroup } from '@/components/marketing/FaqAccordion'
import { CONTACT_EMAIL } from '@/components/marketing/site-config'
import { SiteHeader, sharedHeaderSpacerClass } from '@/components/marketing/site-chrome'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

const faqGroups: readonly FaqGroup[] = [
  {
    label: 'Product',
    description: 'How to read and use Longbrunch.',
    items: [
      {
        question: 'What is Longbrunch?',
        answer: 'Longbrunch brings market signals, company research, and relationships between assets into one place to explore and compare.',
      },
      {
        question: 'What does a signal mean?',
        answer: 'A signal shows a current direction — bullish, bearish, or neutral — with conviction, a prediction horizon, and the latest signal date.',
      },
      {
        question: 'How should I use the signals?',
        answer: 'Use them as research context: compare the signal with its history, price data, and company information before making your own decision.',
      },
      {
        question: 'Is Longbrunch designed for day trading?',
        answer: 'No. The product presents daily signals, history, and market context for research and monitoring rather than intraday execution.',
      },
    ],
  },
  {
    label: 'Market data',
    description: 'Coverage, freshness, and missing data.',
    items: [
      {
        question: 'Which stocks and markets can I search?',
        answer: 'Search uses the current supported ticker index by symbol, company name, and exchange. Coverage can vary by asset and dataset.',
      },
      {
        question: 'How often is the data updated?',
        answer: 'Quotes, historical prices, fundamentals, earnings, and signals follow different update paths. Each area shows its latest available date when provided; signal history is daily.',
      },
      {
        question: 'Why is some information missing for a ticker?',
        answer: 'Coverage varies by asset, source availability, and processing state. Longbrunch marks unavailable fields instead of filling them with an estimate.',
      },
      {
        question: 'Where does the market data come from?',
        answer: 'The application reads market, company, and signal data through its finance-backend integrations. The source and timestamp can differ by dataset.',
      },
    ],
  },
  {
    label: 'Features',
    description: 'The main ways to explore the product.',
    items: [
      {
        question: 'What can I find on a ticker page?',
        answer: 'Depending on coverage, a ticker page includes price and market stats, signal summary and history, performance, financials, holdings or dividends, relationships, and AI research.',
      },
      {
        question: 'What is the screener for?',
        answer: 'Use the screener to filter and sort companies by direction, conviction, signal age, or ticker, then open a ticker page for more context.',
      },
      {
        question: 'Can I save stocks to a watchlist?',
        answer: 'Yes. Sign in on a ticker page to save it. Saved tickers and their latest stance, conviction, and signal changes appear in your dashboard.',
      },
      {
        question: 'What is the AI analysis?',
        answer: 'AI Analyst uses a ticker’s signal context and available news to produce a research response. Treat it as generated context to check against the underlying data.',
      },
    ],
  },
  {
    label: 'Account & plans',
    description: 'Access, billing, and limits.',
    items: [
      {
        question: 'Do I need an account?',
        answer: 'Public pages can be explored without an account. To save tickers and use account-only features,',
        link: { href: '/sign-up', label: 'create an account', suffix: '.' },
      },
      {
        question: 'What do I get with a paid plan?',
        answer: 'Paid access is still being prepared. Check',
        link: { href: '/pricing', label: 'pricing', suffix: 'for the current plan details.' },
      },
      {
        question: 'Can I export data?',
        answer: 'Signed-in Pro users can download signal history as a CSV from a ticker’s Signal History page when rows are available.',
      },
      {
        question: 'How do I manage or cancel my plan?',
        answer: 'There is no self-serve billing portal in the current UI. For a plan change or cancellation,',
        link: { href: `mailto:${CONTACT_EMAIL}`, label: 'email the team', suffix: '.' },
      },
      {
        question: 'Is this financial advice?',
        answer: 'No. Signals and AI analysis are research context, not personal advice or automatic instructions to buy or sell.',
      },
    ],
  },
] as const

const faqThemeStyle = {
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
} as CSSProperties

export default function FaqPage() {
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question about Longbrunch')}`

  return (
    <main
      data-theme="light"
      style={faqThemeStyle}
      className="marketing-faq relative min-h-screen overflow-x-clip bg-[var(--page-bg)] text-content-primary"
    >
      <SiteHeader activeHref="/faq" />
      <div className={sharedHeaderSpacerClass} aria-hidden="true" />

      <section id="questions" className="relative overflow-hidden bg-[var(--page-bg)]" aria-labelledby="faq-questions-heading">
        <div
          className="pointer-events-none absolute -right-48 top-28 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(11,129,120,0.1),transparent_66%)] blur-2xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-[1180px] px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <div className="max-w-2xl">
            <h2
              id="faq-questions-heading"
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-4xl font-extrabold leading-tight tracking-[-0.05em] text-brand-spark sm:text-5xl"
            >
              Find your answers.
            </h2>
          </div>

          <FaqAccordion groups={faqGroups} />
        </div>
      </section>

      <section id="contact" className="border-t border-border bg-[#ebe5da]" aria-label="FAQ contact">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-12 lg:px-14">
          <div>
            <p
              style={{ fontFamily: 'var(--font-mono)' }}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-spark"
            >
              Still stuck?
            </p>
            <p style={{ fontFamily: 'var(--font-display)' }} className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-content-primary sm:text-3xl">
              Ask us directly.
            </p>
          </div>
          <Link
            href={contactHref}
            className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-content-primary transition-colors duration-200 hover:text-brand-spark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-spark"
          >
            Email the team
            <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  )
}
