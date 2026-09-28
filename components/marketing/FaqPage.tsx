import { ArrowUpRight } from 'lucide-react'
import FaqAccordion from '@/components/marketing/FaqAccordion'
import { FAQ_GROUPS } from '@/lib/faq-content'
import { CONTACT_EMAIL } from '@/components/marketing/site-config'
import { SiteHeader, sharedHeaderSpacerClass } from '@/components/marketing/site-chrome'

export default function FaqPage() {
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Question about Vesconte')}`

  return (
    <main
      className="marketing-faq relative min-h-screen overflow-x-clip bg-[var(--page-bg)] text-content-primary"
    >
      <SiteHeader activeHref="/faq" />
      <div className={sharedHeaderSpacerClass} aria-hidden="true" />

      <section id="questions" className="relative overflow-hidden bg-[var(--page-bg)]" aria-labelledby="faq-questions-heading">
        <div
          className="pointer-events-none absolute -right-48 top-28 h-[34rem] w-[34rem] rounded-md bg-transparent"
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
              className="text-4xl font-extrabold leading-tight tracking-normal text-brand-spark sm:text-5xl"
            >
              Find your answers.
            </h1>
          </div>

          <FaqAccordion groups={FAQ_GROUPS} />
        </div>
      </section>

      <section id="contact" className="border-t border-border bg-[var(--line)]" aria-label="FAQ contact">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-12 lg:px-14">
          <div>
            <p
              style={{ fontFamily: 'var(--font-mono)' }}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-spark"
            >
              Still stuck?
            </p>
            <p style={{ fontFamily: 'var(--font-display)' }} className="mt-2 text-2xl font-semibold tracking-normal text-content-primary sm:text-3xl">
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
