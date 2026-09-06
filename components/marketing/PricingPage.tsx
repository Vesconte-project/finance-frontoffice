import Link from 'next/link'
import { Sora, JetBrains_Mono, Inter } from 'next/font/google'
import { ArrowRight, Check } from 'lucide-react'
import { GlassPanel, SiteHeader, sharedHeaderSpacerClass } from '@/components/marketing/site-chrome'
import { getViewerAccess } from '@/lib/billing'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

const freeFeatures = ['Signal previews', 'Market and ticker context'] as const

const basicFeatures = [
  'Extended ML Lab usage',
  'Daily picks',
  'Periodic investment choices',
  'Faster watchlist alerts',
  'Buy/Sell notifications when available',
] as const

const proFeatures = [
  'Pre-configured models',
  'More complex analysis systems',
  'Advanced ML Lab tools',
  'Additional benefits over Basic',
] as const

function FeatureList({ features, future = false }: { features: readonly string[]; future?: boolean }) {
  return (
    <ul className="pricing-plan-features">
      {features.map((feature) => (
        <li key={feature}>
          <span className="pricing-check" aria-hidden="true">
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span>{feature}</span>
          {future ? <span className="pricing-feature-state">planned</span> : null}
        </li>
      ))}
    </ul>
  )
}

function FutureStatus() {
  return <span className="pricing-status pricing-status--future">Coming soon</span>
}

export default async function PricingPage() {
  const viewer = await getViewerAccess()
  const freeHref = viewer.isSignedIn ? '/dashboard' : '/sign-up?redirect_url=/dashboard'
  const freeLabel = viewer.isSignedIn ? 'Open workspace' : 'Explore free access'

  return (
    <main
      data-theme="light"
      className={`marketing-pricing relative min-h-screen overflow-hidden ${inter.className}`}
      style={{
        ['--pricing-display' as string]: sora.style.fontFamily,
        ['--pricing-body' as string]: inter.style.fontFamily,
        ['--pricing-mono' as string]: mono.style.fontFamily,
      }}
    >
      <div className="pricing-ambient pricing-ambient--top" aria-hidden="true" />
      <SiteHeader activeHref="/pricing" />
      <div className={sharedHeaderSpacerClass} aria-hidden="true" />

      <section className="pricing-hero mx-auto max-w-[1280px] px-6 pb-4 pt-5 sm:px-10 lg:px-16">
        <div className="max-w-2xl">
          <p className="pricing-kicker">Pricing / access</p>
        </div>
      </section>

      <section className="pricing-plans mx-auto grid max-w-[1280px] gap-4 px-6 pb-14 sm:px-10 md:grid-cols-3 lg:px-16 lg:pb-18" aria-label="Plans">
        <GlassPanel className="pricing-plan-card pricing-plan-card--free p-6 sm:p-7">
          <div className="pricing-plan-heading">
            <div>
              <p className="pricing-kicker">Free</p>
              <div className="pricing-price-row mt-5">
                <span className="pricing-display pricing-price">€0</span>
                <span className="pricing-copy pricing-period">/ now</span>
              </div>
            </div>
            <span className="pricing-status">Available now</span>
          </div>
          <p className="pricing-plan-summary mt-6">A simple way to explore the signal workspace.</p>
          <FeatureList features={freeFeatures} />
          <Link href={freeHref} className="pricing-cta pricing-cta--quiet mt-7 w-full">
            {freeLabel} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </GlassPanel>

        <GlassPanel className="pricing-plan-card pricing-plan-card--basic p-6 sm:p-7">
          <div className="pricing-plan-heading">
            <div>
              <p className="pricing-kicker">Basic</p>
              <div className="pricing-price-row mt-5">
                <span className="pricing-display pricing-price">€3,99</span>
                <span className="pricing-copy pricing-period">/ month</span>
              </div>
            </div>
            <FutureStatus />
          </div>
          <p className="pricing-plan-summary mt-6">The planned paid tier for a broader, more timely workflow.</p>
          <FeatureList features={basicFeatures} future />
          <div className="pricing-future-note mt-7">No checkout yet. Subscription details will follow when this tier is live.</div>
        </GlassPanel>

        <GlassPanel className="pricing-plan-card pricing-plan-card--pro p-6 sm:p-7">
          <div className="pricing-plan-heading">
            <div>
              <p className="pricing-kicker">Pro</p>
              <div className="pricing-price-row mt-5">
                <span className="pricing-display pricing-price">€9,99</span>
                <span className="pricing-copy pricing-period">/ month</span>
              </div>
            </div>
            <FutureStatus />
          </div>
          <p className="pricing-plan-summary mt-6">A future layer for deeper systems and advanced analysis.</p>
          <FeatureList features={proFeatures} future />
          <div className="pricing-future-note mt-7">Future direction only. No payment flow or launch date is available.</div>
        </GlassPanel>
      </section>

      <section className="pricing-note mx-auto max-w-[1280px] px-6 pb-16 sm:px-10 lg:px-16 lg:pb-24" aria-labelledby="pricing-note-heading">
        <Link href="/faq" className="pricing-text-link mb-7">
          Read the FAQ <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <div className="pricing-note-inner">
          <div>
            <p className="pricing-kicker">What is live</p>
            <h2 id="pricing-note-heading" className="pricing-display mt-3 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
              Start free today. Paid tiers are still being prepared.
            </h2>
          </div>
          <p className="pricing-copy max-w-xl text-sm leading-6">
            The Basic and Pro benefits shown above are planned direction, not current entitlements. Exact access, cadence, and billing will be published when implemented.
          </p>
        </div>
      </section>
    </main>
  )
}
