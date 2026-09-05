import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function HomeClose() {
  return (
    <section
      id="pricing"
      className="relative isolate overflow-hidden border-t border-border bg-[var(--page-bg)] px-6 py-28 text-center text-[color:var(--content-primary)] sm:px-10"
      aria-labelledby="home-close-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--brand-spark),transparent)] opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[440px] w-[860px] max-w-[92vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand-spark)_14%,transparent),transparent)] blur-2xl"
      />

      <h2
        id="home-close-heading"
        style={{ fontFamily: 'var(--font-display)' }}
        className="mx-auto max-w-3xl text-[clamp(1.6rem,2.6vw,2.25rem)] font-bold leading-tight tracking-tight"
      >
        A ranked list is where the work starts.
      </h2>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[color:var(--content-secondary)]">
        Filter the full ranking by sector, follow what changes, and get the weekly signal before Monday.
      </p>

      <Link
        href="/sign-up"
        className="mt-10 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-brand-spark px-8 font-semibold text-[color:var(--brand-spark-on)] shadow-[0_18px_50px_-12px_var(--brand-spark)] transition hover:brightness-110"
      >
        Create account <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
      <div>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--content-secondary)] transition hover:text-brand-spark"
        >
          Open the full pricing page <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
