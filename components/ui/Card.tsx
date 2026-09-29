import * as React from 'react'
import { cn } from '@/lib/utils'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'sm' | 'md' | 'lg' | 'none'
  tone?: 'default' | 'featured' | 'quiet'
}

function paddingClass(padding: CardProps['padding']): string {
  if (padding === 'none') return ''
  if (padding === 'sm') return 'p-4 md:p-5'
  if (padding === 'lg') return 'p-6 md:p-7'
  return 'p-5'
}

export default function Card({
  className,
  padding = 'md',
  tone = 'default',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'surface-secondary relative overflow-hidden text-content-primary',
        paddingClass(padding),
        className
      )}
      data-surface={tone}
      {...props}
    />
  )
}
