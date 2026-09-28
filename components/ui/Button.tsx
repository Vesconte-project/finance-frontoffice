import * as React from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]',
  secondary:
    'border border-[var(--text)] bg-transparent text-[var(--text)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 py-2.5 text-label-sm',
  md: 'h-11 px-[18px] py-[12px] text-label-lg',
}

type ButtonClassOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function buttonClass({
  variant = 'primary',
  size = 'md',
}: ButtonClassOptions = {}): string {
  return cn(
    'state-interactive inline-flex items-center justify-center rounded-md font-medium duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size]
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonClassOptions

export default function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClass({ variant, size }), className)}
      {...props}
    />
  )
}
