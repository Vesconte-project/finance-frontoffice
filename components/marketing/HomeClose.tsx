import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type HomeCloseProps = {
  lockedCount: number
  totalRanked: number
  boardHasData: boolean
  countsAvailable: boolean
}

export default function HomeClose({
  lockedCount,
  totalRanked,
  boardHasData,
  countsAvailable,
}: HomeCloseProps) {
  const hasTrustworthyCounts = boardHasData && countsAvailable
  const isLocked = hasTrustworthyCounts && lockedCount > 0
  const visible = totalRanked - lockedCount

  const heading = !hasTrustworthyCounts
    ? 'Signals, research, and alerts in one workspace.'
    : isLocked
      ? `You are seeing ${visible} of ${totalRanked} in each list.`
      : 'You have the full list.'
  const description = !hasTrustworthyCounts
    ? null
    : isLocked
      ? 'The rest, the alerts, and the weekly signal are behind a free account.'
      : 'Open the workspace to sort it, filter it, and set alerts on it.'
  const primaryHref = hasTrustworthyCounts && !isLocked ? '/picks/long-term' : '/sign-up'
  const primaryLabel = hasTrustworthyCounts && !isLocked ? 'Open the workspace' : 'Create account'

  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-t border-border px-6 py-28 text-center sm:px-10"
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
        className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight md:text-6xl"
      >
        {heading}
      </h2>
      {description ? (
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-content-secondary">
          {description}
        </p>
      ) : null}

      <Link
        href={primaryHref}
        className="mt-10 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-brand-spark px-8 font-semibold text-[color:var(--brand-spark-on)] shadow-[0_18px_50px_-12px_var(--brand-spark)] transition hover:brightness-110"
      >
        {primaryLabel} <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
      <div>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-content-secondary transition hover:text-brand-spark"
        >
          Open the full pricing page <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
