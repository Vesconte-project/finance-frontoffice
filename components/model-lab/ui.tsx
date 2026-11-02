import { Check, Info, Minus, X } from 'lucide-react'
import type { CheckState, LimitState } from '@/lib/model-lab/contract'
import { cn } from '@/lib/utils'

const CHECK_LABEL: Readonly<Record<CheckState, string>> = { holds: 'Holds', partly: 'Partly', fails: 'Does not hold' }

/** A check mark that never relies on colour alone: it has a shape and a word. */
export function CheckMark({ state, className }: { state: CheckState; className?: string }) {
  const Icon = state === 'holds' ? Check : state === 'partly' ? Minus : X
  return (
    <span
      role="img"
      aria-label={CHECK_LABEL[state]}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
        state === 'holds' && 'bg-[color-mix(in_srgb,var(--up)_16%,transparent)] text-[var(--up-ink,var(--up))]',
        state === 'partly' && 'bg-[var(--surface-soft)] text-content-secondary ring-1 ring-[var(--line-strong)]',
        state === 'fails' && 'bg-[color-mix(in_srgb,var(--down)_16%,transparent)] text-[var(--down)]',
        className
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
    </span>
  )
}

export function checkLabel(state: CheckState): string {
  return CHECK_LABEL[state]
}

export function LimitMark({ state }: { state: LimitState }) {
  if (state === 'known') return <CheckMark state="holds" />
  if (state === 'partly') return <CheckMark state="partly" />
  return (
    <span role="img" aria-label="Not established" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-content-muted ring-1 ring-[var(--line)]">
      <Info aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
    </span>
  )
}

/** A plain label. It never carries a verdict, only a fact such as a count. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-label-sm text-content-secondary', className)}>
      {children}
    </span>
  )
}

export function Note({ children, tone = 'plain', className }: { children: React.ReactNode; tone?: 'plain' | 'warn'; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border border-[var(--line)] border-l-[3px] bg-[var(--surface)] px-4 py-3 text-body-sm text-content-primary',
        tone === 'warn' ? 'border-l-[var(--down)]' : 'border-l-[var(--line-strong)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function Section({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
        <h2 className="text-card-title text-content-primary">{title}</h2>
        {aside ? <div className="text-caption text-content-muted">{aside}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function PageTitle({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-page-title text-content-primary">{title}</h1>
        {children ? <p className="text-body mt-2">{children}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export const pct = (x: number, digits = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(digits)}%`
export const signed = (x: number, digits = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatWhen(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const days = Math.floor((nowMs - t) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return formatDate(iso)
}
