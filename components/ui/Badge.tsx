import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'danger' | 'warning'

const variantClass: Record<BadgeVariant, string> = {
  neutral:
    'border-border bg-surface-elevated text-content-secondary',
  primary:
    'border-primary/35 bg-primary/10 text-accent-text',
  success:
    'signal-bg-bullish signal-bullish glow-bullish',
  danger:
    'signal-bg-bearish signal-bearish glow-bearish',
  warning:
    'signal-bg-warn glow-warn',
}

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

export default function Badge({
  className,
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide state-interactive',
        variantClass[variant],
        className
      )}
      {...props}
    />
  )
}
