'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type SegmentedControlProps<T extends string> = {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
  /** Names this control in telemetry so segment changes are attributable. */
  analyticsId?: string
}

/**
 * Liquid-glass segmented control with a sliding glass thumb.
 * Reusable theme component — use for timeframe pickers and small option groups.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  analyticsId,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)

  const updateThumb = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const active = container.querySelector<HTMLButtonElement>('[data-active="true"]')
    if (!active) {
      setThumb(null)
      return
    }
    setThumb({ left: active.offsetLeft, width: active.offsetWidth })
  }, [])

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(updateThumb)
    return () => window.cancelAnimationFrame(frame)
  }, [updateThumb, value, options])

  useEffect(() => {
    window.addEventListener('resize', updateThumb)
    return () => window.removeEventListener('resize', updateThumb)
  }, [updateThumb])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn('glass relative inline-flex items-center gap-0.5 rounded-full p-1', className)}
    >
      {thumb ? (
        <span
          aria-hidden="true"
          className="glass-thumb absolute top-1 bottom-1 rounded-full transition-[left,width] duration-[420ms] ease-[cubic-bezier(0.34,1.45,0.44,1)] motion-reduce:transition-none"
          style={{ left: thumb.left, width: thumb.width }}
        />
      ) : null}
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active ? 'true' : 'false'}
            data-analytics-id={analyticsId ? `${analyticsId}:${option}` : undefined}
            data-analytics-control={analyticsId}
            data-analytics-value={option}
            onClick={() => onChange(option)}
            className={cn(
              'relative z-10 cursor-pointer rounded-full px-2.5 py-1 text-[12px] leading-none transition-[color,transform] duration-150 active:scale-90',
              active
                ? 'font-semibold text-[var(--color-accent)]'
                : 'text-content-secondary hover:text-content-primary'
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
