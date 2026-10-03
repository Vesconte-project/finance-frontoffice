import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import HeaderBar from '@/components/marketing/HeaderBar'
import AccountEntryLink from '@/components/AccountEntryLink'
import { cn } from '@/lib/utils'
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/components/marketing/site-config'

export const sharedHeaderShellClass = 'fixed inset-x-0 top-0 z-[90]'

export const sharedHeaderInnerClass = 'mx-auto max-w-[1500px] px-6 py-3 sm:px-10 lg:px-14'

export const sharedHeaderMenuShellClass =
  'border border-[var(--line)] bg-[var(--surface)]'

export const sharedHeaderDesktopSearchClass = 'ml-auto w-full max-w-[520px] lg:max-w-[480px]'

export const sharedHeaderOffsetClass = 'pt-[72px]'
export const sharedHeaderSpacerClass = 'h-[72px]'

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
    <span className={cn('marketing-logo-type text-xl md:text-2xl', className)}>{BRAND_NAME}</span>
  )
}

export function HandScript({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={className}>{children}</span>
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
  void tone
  const stroke = 'var(--text)'

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
  void tone
  const toneClass = 'border-[var(--line)] text-[var(--text)]'

  return (
    <div
      className={cn(
        'relative inline-flex rounded-md border px-5 py-4 text-[1.85rem] leading-none',
        toneClass,
        className
      )}
    >
      <span className="absolute inset-0 rounded-md" aria-hidden="true" />
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
        'relative overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] p-6',
        className
      )}
    >
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
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text)] dark:text-[var(--text)]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{title}</h2>
      {accent === false ? null : accent ? (
        accent
      ) : (
        <HandScript className="mt-4 block text-[2.15rem] leading-none text-[var(--text)] dark:text-[var(--text)]">
          Signal before the open.
        </HandScript>
      )}
      {body ? <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--text-muted)] dark:text-[var(--text)]">{body}</p> : null}
      {href ? (
        <Link
          href={href}
          className="mt-7 inline-flex items-center gap-3 text-sm font-semibold text-[var(--text)] transition hover:gap-4 dark:text-[var(--text)]"
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
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-transparent bg-transparent" />
      <div className="pointer-events-none absolute left-[-5%] top-[8rem] h-72 w-72 rounded-md border border-[var(--line)] bg-[var(--surface)] dark:border-[var(--line)] dark:bg-[var(--surface)]" />
      <div className="pointer-events-none absolute right-[-3%] top-[16rem] h-56 w-56 rounded-md border border-[var(--line)]/26 bg-[var(--line)]/8" />
      <SiteHeader activeHref={activeHref} />
      <div className={sharedHeaderSpacerClass} aria-hidden="true" />

      <section className="mx-auto grid max-w-[1500px] gap-8 px-6 pb-16 pt-10 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.7fr)] lg:px-14 lg:pt-16">
        <div className="max-w-[760px]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text)] dark:text-[var(--text)]">
            {eyebrow}
          </p>
          <h1 className="mt-5 text-[clamp(2.7rem,6vw,5rem)] font-black leading-[0.98] tracking-tight">
            {title}
          </h1>
          {heroAccent === false ? null : heroAccent ? (
            heroAccent
          ) : (
            <CircleHighlight tone="blue" className="mt-6">
              <HandScript className="text-[2.6rem] leading-none text-[var(--text)] dark:text-[var(--text)]">
                Signal before the open.
              </HandScript>
            </CircleHighlight>
          )}
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-muted)] dark:text-[var(--text)]">
            {description}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            {primaryCta ? (
              <Link
                href={primaryCta.href}
                target={primaryCta.openInNewTab ? '_blank' : undefined}
                rel={primaryCta.openInNewTab ? 'noopener noreferrer' : undefined}
                className="inline-flex h-[52px] items-center justify-center gap-3 rounded-md bg-[var(--btn-primary-bg)] px-6 font-medium text-[var(--btn-primary-fg)] transition duration-200 ease-out"
              >
                {primaryCta.label} <ArrowRight className="size-5" />
              </Link>
            ) : null}
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                target={secondaryCta.openInNewTab ? '_blank' : undefined}
                rel={secondaryCta.openInNewTab ? 'noopener noreferrer' : undefined}
                className="inline-flex h-[52px] items-center justify-center border-b-2 border-[var(--line)] px-1 text-base text-[var(--text)] transition hover:border-[var(--line)]/28 hover:text-[var(--line)] dark:border-[var(--line)] dark:text-[var(--text)] dark:hover:text-[var(--line)]"
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
      <GlassPanel className="mx-auto grid max-w-[1280px] gap-6 bg-transparent p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text)] dark:text-[var(--text)]">
            Membership
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Signals, research, and alerts in one workspace.</h2>
          <HandScript className="mt-3 block text-[2.2rem] leading-none text-[var(--text)] dark:text-[var(--text)]">
            Open the workspace.
          </HandScript>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)] dark:text-[var(--text)]">
            {BRAND_NAME} keeps the workflow focused: review signals, follow the market context, and keep research and watchlists in one place.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <AccountEntryLink
            signedOutLabel="Start membership"
            signedInLabel="Open workspace"
            analyticsId="page_hero_sign_up"
            className="inline-flex h-12 items-center justify-center rounded-md bg-[var(--btn-primary-bg)] px-6 text-sm font-medium text-[var(--btn-primary-fg)] transition"
          />
          <Link
            href="/screener"
            data-analytics-id="page_hero_view_signal"
            className="inline-flex h-12 items-center justify-center rounded-md border border-[var(--text)] bg-transparent px-6 text-sm font-medium text-[var(--text)] transition"
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
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text)] dark:text-[var(--text)]">
            {BRAND_NAME}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">One trade. One edge.</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)] dark:text-[var(--text)]">
            {BRAND_DESCRIPTION}
          </p>
          <CircleHighlight className="mt-5" tone="orange">
            <HandScript className="text-[2rem] leading-none text-[var(--down)]">One trade. One edge.</HandScript>
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
