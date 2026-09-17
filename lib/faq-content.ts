/**
 * The public FAQ's questions and answers.
 *
 * This is the single source for three surfaces that must never disagree: the
 * rendered accordion, the `FAQPage` structured data emitted by the route, and
 * the contract tests. Authoring the copy twice is what let the page drift from
 * the product in the first place, so the JSON-LD is serialised from this
 * constant rather than written alongside it.
 *
 * Deliberately free of `server-only` and of any React import: the route reads it
 * on the server to build structured data, the accordion renders it in a client
 * boundary, and `tests/faq-content.test.ts` imports it directly.
 *
 * The copy is transcribed from the accepted Snapshot
 * `snap-sha256-673f5b68ff27616df80d2c37b23794437fd1f91c1b31ddc5c04d43b8d281b38a`
 * (§6.1), not from the mutable Notion page. Two rules the Snapshot fixes, and
 * which `tests/faq-content.test.ts` enforces so future copy cannot quietly undo
 * them:
 *
 *  - No answer may present the screener or market-wide signal monitoring as an
 *    available surface while `app/(app)/screener/page.tsx` is `noindex`.
 *  - No answer may assert a data update frequency. The real signal-history
 *    cadence is backend semantics and is not verifiable from this repository;
 *    the decision to assert none sidesteps that gap rather than closing it.
 *  - Apostrophes are ASCII, as they are in the Snapshot. Substituting
 *    typographic ones is a copy change, not a formatting choice; see
 *    company-os#84.
 */

// Relative, not the `@/` alias: `npm test` compiles this module with a bare tsc
// invocation that carries no path mapping, the same reason lib/backend.ts and
// lib/ticker-index-proxy.ts import their neighbours relatively.
import { CONTACT_EMAIL } from '../components/marketing/site-config'

export type FaqInlineLink = {
  href: string
  label: string
  suffix?: string
}

export type FaqItem = {
  /**
   * Stable deep-link fragment, e.g. `/faq#what-is-vesconte`.
   *
   * Written out rather than derived from the question so that rewording a
   * question does not silently break links support has already sent out.
   */
  slug: string
  question: string
  answer: string
  link?: FaqInlineLink
}

export type FaqGroup = {
  label: string
  description: string
  items: readonly FaqItem[]
}

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    label: 'Product',
    description: 'How to read and use Vesconte.',
    items: [
      {
        slug: 'what-is-vesconte',
        question: 'What is Vesconte?',
        answer:
          'Vesconte brings market signals, company research, and relationships between assets into one place to explore and compare.',
      },
      {
        slug: 'what-does-a-signal-mean',
        question: 'What does a signal mean?',
        answer:
          "A signal is a directional reading for one company — bullish, bearish, or neutral — with a conviction level, a prediction horizon, and the date it was produced. You read signals on a company's Signals page, next to its price, fundamentals, and history.",
      },
      {
        slug: 'market-wide-monitoring',
        question: 'Can I monitor signals across the whole market yet?',
        answer:
          'Not yet. Market-wide signal monitoring is being rebuilt on top of the scorecard readings rather than extended from the earlier screener, so that page stays closed rather than showing numbers we do not stand behind. Per-company signal research is open today, and Top picks ranks the tracked universe now.',
      },
      {
        slug: 'how-to-use-signals',
        question: 'How should I use the signals?',
        answer:
          'Use them as research context: compare the signal with its history, price data, and company information before making your own decision.',
      },
      {
        slug: 'day-trading',
        question: 'Is Vesconte designed for day trading?',
        answer:
          'No. The product presents signals, history, and market context for research and monitoring rather than intraday execution.',
      },
    ],
  },
  {
    label: 'Market data',
    description: 'Coverage, freshness, and missing data.',
    items: [
      {
        slug: 'which-markets',
        question: 'Which stocks and markets can I search?',
        answer:
          'Search uses the current supported ticker index by symbol, company name, and exchange. Coverage can vary by asset and dataset.',
      },
      {
        slug: 'data-updates',
        question: 'How often is the data updated?',
        answer:
          'Quotes, historical prices, fundamentals, earnings, and signals follow different update paths. Each area shows its latest available date when provided.',
      },
      {
        slug: 'missing-information',
        question: 'Why is some information missing for a ticker?',
        answer:
          'Coverage varies by asset, source availability, and processing state. Vesconte marks unavailable fields instead of filling them with an estimate.',
      },
      {
        slug: 'data-sources',
        question: 'Where does the market data come from?',
        answer:
          'The application reads market, company, and signal data through its finance-backend integrations. The source and timestamp can differ by dataset.',
      },
    ],
  },
  {
    label: 'Features',
    description: 'The main ways to explore the product.',
    items: [
      {
        slug: 'company-page',
        question: 'What can I find on a company page?',
        answer:
          'Depending on coverage, a company page includes price and market stats, signals, performance, financials, fundamentals, valuation, indicators, ownership, holdings and dividends, relationships, events, profile, methodology, and AI research.',
      },
      {
        slug: 'top-picks',
        question: 'What is Top picks?',
        answer:
          'The tracked universe ranked three ways: long term, income, and short term. Signed-out readers see the first five names; creating an account opens the full ranking.',
      },
      {
        slug: 'correlations-atlas',
        question: 'What is the correlations atlas?',
        answer:
          'A map of which names move together, and where one sector actually ends. You reach it from Markets.',
      },
      {
        slug: 'watchlist',
        question: 'Can I save companies to a watchlist?',
        answer:
          'Yes. Sign in on a company page to save it. Saved tickers and their latest stance, conviction, and signal changes appear in your dashboard.',
      },
      {
        slug: 'ai-analysis',
        question: 'What is the AI analysis?',
        answer:
          "AI Analyst uses a ticker's signal context and available news to produce a research response. Treat it as generated context to check against the underlying data.",
      },
      {
        slug: 'alerts',
        question: 'Can I set up alerts?',
        answer: 'Not yet. Alerts are not available to manage in the product today.',
      },
    ],
  },
  {
    label: 'Account & plans',
    description: 'Access, billing, and limits.',
    items: [
      {
        slug: 'need-an-account',
        question: 'Do I need an account?',
        answer:
          'Public pages can be explored without an account. An account opens the full Top picks ranking, the watchlist, and your dashboard —',
        link: { href: '/sign-up', label: 'create an account', suffix: '.' },
      },
      {
        slug: 'paid-plan',
        question: 'What do I get with a paid plan?',
        answer: 'Paid tiers are still being prepared. Free is the current tier, and the plans shown on',
        link: { href: '/pricing', label: 'pricing', suffix: 'are planned direction, not current entitlements.' },
      },
      {
        slug: 'export-data',
        question: 'Can I export data?',
        answer:
          "CSV export of a company's signal history is reserved for the Pro plan. Because paid tiers are not yet available to buy, this is not something a new account can use today.",
      },
      {
        slug: 'manage-plan',
        question: 'How do I manage or cancel my plan?',
        answer:
          'There is no self-serve billing portal in the current UI. For a plan change or cancellation,',
        link: { href: `mailto:${CONTACT_EMAIL}`, label: 'email the team', suffix: '.' },
      },
      {
        slug: 'financial-advice',
        question: 'Is this financial advice?',
        answer:
          'No. Signals and AI analysis are research context, not personal advice or automatic instructions to buy or sell.',
      },
    ],
  },
] as const

/** Every item, flattened, in the order the page renders them. */
export const FAQ_ITEMS: readonly FaqItem[] = FAQ_GROUPS.flatMap((group) => group.items)

/**
 * Joins the suffix to the inline link that precedes it.
 *
 * The suffix continues the sentence the link sits inside, so it takes a leading
 * space only when it does not open with punctuation. The page rendered
 * "create an account ." and "email the team ." — a space before the full stop —
 * because the suffix was concatenated with an unconditional space.
 *
 * This lives here, beside the copy, because the accordion and the structured
 * data both need it and an earlier revision of this change had them disagree:
 * the rendered page was fixed while the JSON-LD still published the defect.
 */
export function faqJoinSuffix(suffix: string): string {
  return /^[.,;:!?]/.test(suffix) ? suffix : ` ${suffix}`
}

/**
 * The plain-text answer, with the inline link folded back into the sentence.
 *
 * Structured data carries no markup, and a reader arriving from search should
 * get the same sentence the page shows rather than one truncated at the link.
 */
export function faqAnswerText(item: FaqItem): string {
  if (!item.link) return item.answer
  const suffix = item.link.suffix ? faqJoinSuffix(item.link.suffix) : ''
  return `${item.answer} ${item.link.label}${suffix}`
}

/** `FAQPage` structured data, serialised from the same constant the page renders. */
export function faqPageJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerText(item),
      },
    })),
  })
}
