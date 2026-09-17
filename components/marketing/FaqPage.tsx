import type { CSSProperties } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Inter, JetBrains_Mono, Sora } from 'next/font/google'
import FaqAccordion from '@/components/marketing/FaqAccordion'
import { FAQ_GROUPS } from '@/lib/faq-content'
import { CONTACT_EMAIL } from '@/components/marketing/site-config'
import { SiteHeader, sharedHeaderSpacerClass } from '@/components/marketing/site-chrome'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

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
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question about Vesconte')}`

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
            {/*
              The page-level h1. It was an h2 while the route composed SiteHeader
              directly instead of MarketingPageShell, which left /faq starting at
              h2 and descending to h3 with no document title. The heading order is
              now h1 page -> h2 group -> h3 question.
            */}
            <h1
              id="faq-questions-heading"
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-4xl font-extrabold leading-tight tracking-[-0.05em] text-brand-spark sm:text-5xl"
            >
              Find your answers.
            </h1>
          </div>

          <FaqAccordion groups={FAQ_GROUPS} />
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
          {/* A plain anchor: next/link is for in-app navigation, not a mailto. */}
          <a
            href={contactHref}
            className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-content-primary transition-colors duration-200 hover:text-brand-spark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-spark"
          >
            Email the team
            <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  )
}
