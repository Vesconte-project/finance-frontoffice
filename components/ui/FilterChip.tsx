import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FilterChipProps = {
  label: string
  active?: boolean
  onClick?: () => void
  href?: string
  className?: string
  type?: 'button' | 'submit' | 'reset'
  title?: string
  /** Optional node rendered before the label (e.g. a colored dot). */
  leading?: ReactNode
  /** Optional node rendered after the label (e.g. counts). */
  trailing?: ReactNode
  /**
   * Names this filter in telemetry. Set it and the chip reports as a
   * `filter_apply` with a stable id, rather than as a generic click whose
   * identity is whatever the label currently says.
   */
  analyticsId?: string
}

/**
 * Liquid-glass filter chip — shared theme component.
 * Pairs with `.glass` / `SegmentedControl`; use for toggles and filter pills.
 */
export default function FilterChip({
  label,
  active = false,
  onClick,
  href,
  className,
  type = 'button',
  title,
  leading,
  trailing,
  analyticsId,
}: FilterChipProps) {
  const analyticsAttrs = analyticsId
    ? {
        'data-analytics-id': analyticsId,
        'data-analytics-event': 'filter_apply',
        'data-analytics-value': label,
        'data-analytics-active': String(active),
      }
    : {}

  const sharedClass = cn(
    'state-interactive inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 text-label-sm shadow-[inset_0_1px_0_var(--glass-highlight),var(--glass-shadow)] backdrop-blur-[30px] saturate-[1.8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg',
    active
      ? 'border-[color-mix(in_srgb,var(--color-accent)_55%,transparent)] bg-[var(--color-accent-light)] font-medium text-[var(--color-accent)]'
      : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-content-secondary hover:border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] hover:text-content-primary',
    className
  )

  const content = (
    <>
      {leading}
      {label}
      {trailing}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={sharedClass} title={title} {...analyticsAttrs}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={sharedClass}
      title={title}
      aria-pressed={active || undefined}
      {...analyticsAttrs}
    >
      {content}
    </button>
  )
}
