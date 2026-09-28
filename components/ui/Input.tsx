import * as React from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'state-interactive h-11 w-full rounded-[8px] border border-[var(--text)] bg-[var(--surface)] px-4 text-body-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
        className
      )}
      {...props}
    />
  )
}
