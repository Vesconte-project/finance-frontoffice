'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type ScoreRingTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export type ScoreRingDimension = {
  label: string
  score: number
  tone?: ScoreRingTone
  hint?: string
}

type ScoreRingsProps = {
  dimensions: ScoreRingDimension[]
  className?: string
  compact?: boolean
  showLegend?: boolean
  overallLabel?: string
  subtitle?: string
}

const TONE_COLOR: Record<ScoreRingTone, string> = {
  primary: 'var(--text)',
  success: 'var(--up)',
  warning: 'var(--text-muted)',
  danger: 'var(--down)',
  neutral: 'var(--text-muted)',
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export default function ScoreRings({
  dimensions,
  className,
  compact = false,
  showLegend = true,
  overallLabel = 'Model Score',
  subtitle = 'Systems validation dimensions',
}: ScoreRingsProps) {
  const [isAnimated, setIsAnimated] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsAnimated(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const items = useMemo(
    () =>
      dimensions.slice(0, 5).map((dimension) => ({
        ...dimension,
        score: clampScore(dimension.score),
        tone: dimension.tone ?? 'primary',
      })),
    [dimensions]
  )

  const overallScore = useMemo(() => {
    if (items.length === 0) return 0
    const total = items.reduce((sum, item) => sum + item.score, 0)
    return Math.round(total / items.length)
  }, [items])

  const size = compact ? 164 : 230
  const stroke = compact ? 7 : 8
  const gap = compact ? 8 : 10
  const outerRadius = compact ? 66 : 90
  const center = size / 2

  const rings = items.map((item, index) => {
    const radius = outerRadius - index * (stroke + gap)
    const circumference = 2 * Math.PI * radius
    const animatedScore = isAnimated ? item.score : 0
    const dashOffset = circumference * (1 - animatedScore / 100)
    return {
      ...item,
      radius,
      circumference,
      dashOffset,
      active: activeIndex === null || activeIndex === index,
    }
  })

  if (rings.length === 0) return null

  return (
    <div
      className={cn(
        'grid items-center gap-5',
        compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[minmax(220px,236px)_1fr]',
        className
      )}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div className="relative mx-auto">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <g transform={`rotate(-90 ${center} ${center})`}>
            {rings.map((ring, index) => (
              <g
                key={`${ring.label}-${index}`}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  opacity: ring.active ? 1 : 0.26,
                  transition: 'opacity 180ms ease',
                }}
              >
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  fill="none"
                  stroke={TONE_COLOR[ring.tone]}
                  strokeOpacity={0.2}
                  strokeWidth={stroke + 3}
                  strokeLinecap="round"
                  strokeDasharray={ring.circumference}
                  strokeDashoffset={ring.dashOffset}
                  style={{
                    transition: `stroke-dashoffset 950ms cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 70}ms`,
                  }}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  fill="none"
                  stroke={TONE_COLOR[ring.tone]}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={ring.circumference}
                  strokeDashoffset={ring.dashOffset}
                  style={{
                    transition: `stroke-dashoffset 950ms cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 70}ms`,
                  }}
                />
              </g>
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div
              className={cn(
                'font-semibold leading-none text-[var(--text)] dark:text-[var(--text)]',
                compact ? 'text-[1.9rem]' : 'text-[2.4rem]'
              )}
            >
              {overallScore}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)] dark:text-[var(--text-muted)]">
              {overallLabel}
            </div>
            {!compact ? <div className="text-body mt-1">{subtitle}</div> : null}
          </div>
        </div>
      </div>

      {showLegend ? (
        <div className={cn(compact ? 'grid grid-cols-2 gap-2' : 'space-y-2')}>
          {rings.map((ring, index) => (
            <button
              key={`${ring.label}-${index}-legend`}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              className={cn('w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left transition-colors', activeIndex === index && 'border-[var(--accent)]')}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_COLOR[ring.tone] }} />
                  <span className={cn('text-[var(--text)]', compact ? 'text-xs font-medium' : 'text-sm font-medium')}>
                    {ring.label}
                  </span>
                </div>
                <span className={cn('font-mono text-[var(--text)]', compact ? 'text-xs' : 'text-sm')}>
                  {Math.round(ring.score)}
                </span>
              </div>
              {!compact && ring.hint && activeIndex === index ? (
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">{ring.hint}</div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
