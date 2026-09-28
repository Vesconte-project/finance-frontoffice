import { ArrowRight } from 'lucide-react'
import AccountEntryLink from '@/components/AccountEntryLink'
import Link from 'next/link'

export default function HomeClose() {
  return (
    <section
      id="pricing"
      className="relative isolate overflow-hidden border-t border-border px-6 py-28 text-center text-[color:var(--content-primary)] sm:px-10"
      aria-labelledby="home-close-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-transparent opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[440px] w-[860px] max-w-[92vw] -translate-x-1/2 rounded-md bg-transparent"
      />

      <h2
        id="home-close-heading"
        style={{ fontFamily: 'var(--font-display)' }}
        className="mx-auto max-w-3xl text-[clamp(1.6rem,2.6vw,2.25rem)] font-bold leading-tight tracking-tight"
      >
        A ranked list is where the work starts.
      </h2>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[color:color-mix(in_srgb,var(--content-primary)_40%,var(--content-secondary))]">
        Filter the full ranking by sector, follow what changes, and get the weekly signal before Monday.
      </p>

      <AccountEntryLink
        signedOutLabel="Create account"
        signedInLabel="Open workspace"
        analyticsId="home_close_sign_up"
        trailingIcon={<ArrowRight className="size-5" aria-hidden="true" />}
        className="mt-10 inline-flex h-14 items-center justify-center gap-3 rounded-md bg-[var(--btn-primary-bg)] px-8 font-medium text-[var(--btn-primary-fg)] transition"
      />
      <div>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:color-mix(in_srgb,var(--content-primary)_40%,var(--content-secondary))] transition hover:text-brand-spark"
        >
          Open the full pricing page <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
