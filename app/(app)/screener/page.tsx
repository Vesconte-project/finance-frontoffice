import type { Metadata } from 'next'
import Link from 'next/link'
import { Construction, Layers3, PanelsTopLeft } from 'lucide-react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'

/**
 * Signals — held behind a development lock.
 *
 * This route previously served an early screener built before the scorecard readings
 * existed. It is being rebuilt around signals proper rather than extended, so the
 * page is locked instead of left half-working. The previous implementation is in git
 * history at this path; nothing was deleted from the components it used
 * (`components/ScreenerSignalCard.tsx` is untouched and still exported).
 */

export const metadata: Metadata = {
  title: 'Signals — in development',
  description:
    'Signal monitoring is being rebuilt around the scorecard readings. Company rankings are available now.',
  robots: { index: false, follow: true },
}

const ELSEWHERE = [
  {
    href: '/picks/long-term',
    icon: PanelsTopLeft,
    title: 'Rankings',
    body: 'The tracked universe ranked three ways — long term, income and short term.',
  },
  {
    href: '/markets/network',
    icon: Layers3,
    title: 'Correlations',
    body: 'Which names move together, and where one sector actually ends.',
  },
]

export default function SignalsPage() {
  return (
    <div className="container-lg section-gap">
      <header className="max-w-3xl">
        <div className="text-caption uppercase tracking-[0.18em] text-content-muted">Signals</div>
        <h1 className="text-page-title mt-2 text-content-primary">Signals is in development.</h1>
      </header>

      <Card className="rounded-[var(--radius-2xl)] text-center" padding="lg">
        <div className="flex flex-col items-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Construction className="h-6 w-6" aria-hidden="true" />
          </span>

          <h2 className="text-section-title mt-5 text-content-primary">
            Come back in the near future.
          </h2>
          <p className="text-body mt-3 max-w-[58ch]">
            We are rebuilding signal monitoring on top of the scorecard readings rather than
            bolting it onto the old screener. Until that is something worth reading, this page
            stays closed instead of showing you numbers we do not stand behind yet.
          </p>

          <div className="mt-7 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-2">
            {ELSEWHERE.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="state-interactive group flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-4 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                >
                  <Icon className="h-5 w-5 text-content-muted" aria-hidden="true" />
                  <span className="text-label-sm mt-3 font-semibold text-content-primary">
                    {item.title}
                  </span>
                  <span className="text-caption mt-1 text-content-muted">{item.body}</span>
                </Link>
              )
            })}
          </div>

          <div className="mt-7">
            <Link href="/picks/long-term" className={buttonClass({ variant: 'primary' })}>
              See the rankings instead
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
