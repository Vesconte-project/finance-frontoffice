import type { ReactNode } from 'react'
import Link from 'next/link'
import { Caveat } from 'next/font/google'
import { ArrowRight } from 'lucide-react'
import HeaderSearch from '@/components/HeaderSearch'
import HeaderBar from '@/components/marketing/HeaderBar'
import { cn } from '@/lib/utils'
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/components/marketing/site-config'

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
})

export const sharedHeaderShellClass = 'fixed inset-x-0 top-0 z-[90]'

export const sharedHeaderInnerClass = 'mx-auto max-w-[1500px] px-6 py-3 sm:px-10 lg:px-14'

export const sharedHeaderMenuShellClass =
  'border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-[28px] saturate-[1.75]'

export const sharedHeaderDesktopSearchClass = 'ml-auto w-full max-w-[520px] lg:max-w-[480px]'

export const sharedHeaderMobileSearchClass = 'mx-auto w-full max-w-[680px]'

export const sharedHeaderOffsetClass = 'pt-[100px] md:pt-[72px]'
export const sharedHeaderSpacerClass = 'h-[100px] md:h-[72px]'

type PageLink = {
  openInNewTab?: boolean
  label: string
  href: string
}

type PageShellProps = {
  activeHref?: string
  eyebrow: string
  title: ReactNode
  description: string
  primaryCta?: PageLink
  secondaryCta?: PageLink
  heroAccent?: ReactNode | false
  note?: string
  heroAside?: ReactNode
  children: ReactNode
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('marketing-logo-type flex items-center gap-3 text-xl tracking-normal md:text-2xl', className)}>
      <span>lb</span>
      <span className="text-[#ff8b2b]">/</span>
    </span>
  )
}

export function HandScript({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn(caveat.className, className)}>{children}</span>
}

export function CircleHighlight({
  children,
  className,
  tone = 'orange',
}: {
  children: ReactNode
  className?: string
  tone?: 'blue' | 'orange' | 'chalk'
}) {
  const stroke =
    tone === 'orange' ? '#ff8b2b' : tone === 'chalk' ? 'rgba(255,255,255,0.72)' : '#6f79ff'

  return (
    <span className={cn('relative inline-flex items-center justify-center px-4 py-2', className)}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 240 92" aria-hidden="true">
        <path
          d="M18 28 C36 8 204 8 224 24 C238 36 234 70 214 76 C176 88 56 88 26 74 C6 64 2 42 18 28 Z"
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="3.2"
        />
      </svg>
      <span className="relative z-10">{children}</span>
    </span>
  )
}

export function ScribbleNote({
  children,
  className,
  tone = 'blue',
}: {
  children: ReactNode
  className?: string
  tone?: 'blue' | 'orange' | 'chalk'
}) {
  const toneClass =
    tone === 'orange'
      ? 'border-[#ff8b2b]/60 text-[#ff8b2b] shadow-[0_0_40px_rgba(255,139,43,0.16)]'
      : tone === 'chalk'
        ? 'border-white/30 text-white/80 shadow-[0_0_32px_rgba(255,255,255,0.08)]'
        : 'border-[#4a63ff]/55 text-[#4a63ff] shadow-[0_0_40px_rgba(74,99,255,0.18)] dark:text-[#7d8cff]'

  return (
    <div
      className={cn(
        caveat.className,
        'relative inline-flex rotate-[-3deg] rounded-[28px] border px-5 py-4 text-[1.85rem] leading-none tracking-tight backdrop-blur-md',
        toneClass,
        className
      )}
    >
      <span className="absolute inset-0 rounded-[28px] bg-white/6 dark:bg-white/[0.03]" aria-hidden="true" />
      <span className="absolute inset-x-4 bottom-2 h-px rotate-[-2deg] bg-current/50" aria-hidden="true" />
      <span className="relative z-10">{children}</span>
    </div>
  )
}

export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[30px] border border-white/42 bg-white/[0.14] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-1px_0_rgba(255,255,255,0.14),0_22px_80px_rgba(20,33,51,0.1)] backdrop-blur-[38px] saturate-[1.9] dark:border-white/14 dark:bg-white/[0.035] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.04),0_28px_90px_rgba(0,0,0,0.26)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.48),rgba(255,255,255,0.18)_18%,rgba(255,255,255,0.05)_42%,transparent_72%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.06)_20%,rgba(255,255,255,0.02)_42%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[28%] bg-[linear-gradient(90deg,rgba(255,255,255,0.22),transparent)] dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.07),transparent)]" />
      <div className="pointer-events-none absolute -left-12 top-[-14%] h-36 w-36 rounded-full bg-white/24 blur-3xl dark:bg-white/[0.08]" />
      <div className="pointer-events-none absolute -right-12 top-[-18%] h-40 w-40 rounded-full bg-white/20 blur-3xl dark:bg-[color:color-mix(in_srgb,var(--brand-spark)_10%,transparent)]" />
      <div className="pointer-events-none absolute bottom-[-18%] right-[10%] h-28 w-44 rounded-full bg-[color:color-mix(in_srgb,var(--brand-spark)_10%,transparent)] blur-3xl dark:bg-[color:color-mix(in_srgb,var(--brand-spark)_12%,transparent)]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  href,
  label = 'Go deeper',
  accent,
}: {
  eyebrow: string
  title: string
  body?: string
  href?: string
  label?: string
  accent?: ReactNode | false
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0757ff] dark:text-[#f8f200]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{title}</h2>
      {accent === false ? null : accent ? (
        accent
      ) : (
        <HandScript className="mt-4 block text-[2.15rem] leading-none text-[#6f79ff] dark:text-[#8590ff]">
          Signal before the open.
        </HandScript>
      )}
      {body ? <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-white/62">{body}</p> : null}
      {href ? (
        <Link
          href={href}
          className="mt-7 inline-flex items-center gap-3 text-sm font-semibold text-[#0757ff] transition hover:gap-4 dark:text-[#f8f200]"
        >
          {label} <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  )
}

export function SiteHeader({ activeHref }: { activeHref?: string }) {
  const isHome = activeHref === '/'
  return (
    <header
      data-active-href={activeHref ?? undefined}
      data-internal={!isHome ? '' : undefined}
      className={cn(sharedHeaderShellClass, 'site-header')}
    >
      <div className={cn(sharedHeaderInnerClass, 'site-header__inner')}>
        <HeaderBar isHome={isHome} />

        <div className="mt-3 md:hidden">
          <HeaderSearch className={sharedHeaderMobileSearchClass} />
        </div>
      </div>
      <div className="site-header__backdrop" aria-hidden="true" />
    </header>
  )
}

export function MarketingPageShell({
  activeHref,
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  heroAccent,
  note,
  heroAside,
  children,
}: PageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-950 dark:bg-[#00040a] dark:text-white">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_18%_8%,rgba(7,87,255,0.14),transparent_28%),radial-gradient(circle_at_83%_0%,rgba(255,139,43,0.12),transparent_30%),linear-gradient(180deg,rgba(232,240,255,0.48),rgba(255,255,255,0)_68%)] dark:bg-[radial-gradient(circle_at_18%_8%,rgba(7,87,255,0.22),transparent_28%),radial-gradient(circle_at_83%_0%,rgba(255,139,43,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
      <div className="pointer-events-none absolute left-[-5%] top-[8rem] h-72 w-72 rounded-full border border-white/22 bg-white/12 blur-[2px] dark:border-white/8 dark:bg-white/[0.02]" />
      <div className="pointer-events-none absolute right-[-3%] top-[16rem] h-56 w-56 rounded-full border border-[#6f79ff]/26 bg-[#6f79ff]/8 blur-[2px]" />
      <SiteHeader activeHref={activeHref} />
      <div className={sharedHeaderSpacerClass} aria-hidden="true" />

      <section className="mx-auto grid max-w-[1500px] gap-8 px-6 pb-16 pt-10 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.7fr)] lg:px-14 lg:pt-16">
        <div className="max-w-[760px]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0757ff] dark:text-[#f8f200]">
            {eyebrow}
          </p>
          <h1 className="mt-5 text-[clamp(2.7rem,6vw,5rem)] font-black leading-[0.98] tracking-tight">
            {title}
          </h1>
          {heroAccent === false ? null : heroAccent ? (
            heroAccent
          ) : (
            <CircleHighlight tone="blue" className="mt-6">
              <HandScript className="text-[2.6rem] leading-none text-[#6f79ff] dark:text-[#8590ff]">
                Signal before the open.
              </HandScript>
            </CircleHighlight>
          )}
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 dark:text-white/68">
            {description}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            {primaryCta ? (
              <Link
                href={primaryCta.href}
                target={primaryCta.openInNewTab ? '_blank' : undefined}
                rel={primaryCta.openInNewTab ? 'noopener noreferrer' : undefined}
                className="inline-flex h-[52px] items-center justify-center gap-3 rounded-xl bg-[#0757ff] px-6 font-semibold text-white shadow-[0_0_36px_rgba(7,87,255,0.28)] transition duration-200 ease-out hover:-translate-y-1 hover:bg-[#1a66ff]"
              >
                {primaryCta.label} <ArrowRight className="size-5" />
              </Link>
            ) : null}
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                target={secondaryCta.openInNewTab ? '_blank' : undefined}
                rel={secondaryCta.openInNewTab ? 'noopener noreferrer' : undefined}
                className="inline-flex h-[52px] items-center justify-center border-b-2 border-slate-950/16 px-1 text-base text-slate-950 transition hover:border-[#0757ff]/28 hover:text-[#0757ff] dark:border-[#f8f200] dark:text-white dark:hover:text-[#fff4c8]"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
          {note ? <ScribbleNote className="mt-8" tone="orange">{note}</ScribbleNote> : null}
        </div>
        <div className="relative">{heroAside}</div>
      </section>

      <div className="space-y-0">{children}</div>
    </main>
  )
}

export function MarketingPageOutro() {
  return (
    <section className="px-6 py-24 sm:px-10 lg:px-14">
      <GlassPanel className="mx-auto grid max-w-[1280px] gap-6 bg-[radial-gradient(circle_at_80%_0%,rgba(7,87,255,0.14),transparent_32%)] p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0757ff] dark:text-[#f8f200]">
            Membership
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Signals, research, and alerts in one workspace.</h2>
          <HandScript className="mt-3 block text-[2.2rem] leading-none text-[#6f79ff] dark:text-[#8590ff]">
            Open the workspace.
          </HandScript>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-white/62">
            {BRAND_NAME} keeps the workflow focused: review signals, follow the market context, and keep research and watchlists in one place.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white transition hover:scale-[1.02] dark:bg-white dark:text-[#03050b]"
          >
            Start membership
          </Link>
          <Link
            href="/screener"
            className="inline-flex h-12 items-center justify-center rounded-full border border-slate-950/10 bg-white/45 px-6 text-sm font-semibold text-slate-950 transition hover:bg-white/68 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.1]"
          >
            View current signal
          </Link>
        </div>
      </GlassPanel>
    </section>
  )
}

export function BrandSummary() {
  return (
    <GlassPanel className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0757ff] dark:text-[#f8f200]">
            {BRAND_NAME}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">One trade. One edge.</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-white/62">
            {BRAND_DESCRIPTION}
          </p>
          <CircleHighlight className="mt-5" tone="orange">
            <HandScript className="text-[2rem] leading-none text-[#ff8b2b]">One trade. One edge.</HandScript>
          </CircleHighlight>
        </div>
        <ScribbleNote tone="blue" className="mt-2 sm:mr-2">
          Live tape.
          <br />
          Real time.
          <br />
          No noise.
        </ScribbleNote>
      </div>
    </GlassPanel>
  )
}
