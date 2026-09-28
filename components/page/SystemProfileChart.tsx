'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type SystemProfileDimension = {
  label: string
  score: number
  hint?: string
}

type SystemProfileChartProps = {
  dimensions: SystemProfileDimension[]
  baselineScores?: number[]
  className?: string
  compact?: boolean
}

type Point = { x: number; y: number }

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const radians = (Math.PI / 180) * angleDeg
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function polygonPath(points: Point[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const start = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  const lines = rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  return `${start} ${lines} Z`
}

function smoothClosedPath(points: Point[], tension = 1): string {
  const n = points.length
  if (n < 3) return polygonPath(points)

  const t = Math.max(0, Math.min(1.35, tension))
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 0; index < n; index += 1) {
    const p0 = points[(index - 1 + n) % n]
    const p1 = points[index]
    const p2 = points[(index + 1) % n]
    const p3 = points[(index + 2) % n]

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * t
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * t
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * t
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * t

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  return `${path} Z`
}

function labelAnchor(cos: number): 'start' | 'middle' | 'end' {
  if (cos > 0.35) return 'start'
  if (cos < -0.35) return 'end'
  return 'middle'
}

export default function SystemProfileChart({
  dimensions,
  baselineScores,
  className,
  compact = false,
}: SystemProfileChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const points = useMemo(() => {
    return dimensions.slice(0, 5).map((dimension, index, arr) => {
      const angle = -90 + (360 / arr.length) * index
      const score = clampScore(dimension.score)
      return {
        ...dimension,
        score,
        angle,
      }
    })
  }, [dimensions])

  const size = compact ? 280 : 340
  const center = size / 2
  const outerRadius = compact ? 86 : 112
  const labelRadius = outerRadius + (compact ? 24 : 30)
  const ringCount = 4

  const gridRings = useMemo(() => {
    return Array.from({ length: ringCount }, (_, idx) => {
      const ringIndex = idx + 1
      const ringRadius = (outerRadius * ringIndex) / ringCount
      return points.map((point) => polarToCartesian(center, center, ringRadius, point.angle))
    })
  }, [center, outerRadius, points])

  const axisEnds = useMemo(
    () => points.map((point) => polarToCartesian(center, center, outerRadius, point.angle)),
    [center, outerRadius, points]
  )

  const profilePoints = useMemo(
    () =>
      points.map((point) =>
        polarToCartesian(center, center, (outerRadius * point.score) / 100, point.angle)
      ),
    [center, outerRadius, points]
  )

  const baselinePoints = useMemo(() => {
    if (!baselineScores || baselineScores.length !== points.length) return null
    return points.map((point, index) =>
      polarToCartesian(
        center,
        center,
        (outerRadius * clampScore(baselineScores[index] ?? 0)) / 100,
        point.angle
      )
    )
  }, [baselineScores, center, outerRadius, points])

  const shapePath = smoothClosedPath(profilePoints, 1.05)
  const baselinePath = baselinePoints ? smoothClosedPath(baselinePoints, 1.05) : null

  if (points.length < 3) return null

  return (
    <div className={cn('mx-auto w-full max-w-[420px]', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full"
        onMouseLeave={() => setActiveIndex(null)}
      >
{gridRings.map((ring, index) => (
          <path
            key={`ring-${index}`}
            d={polygonPath(ring)}
            fill="none"
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        ))}

        {axisEnds.map((point, index) => (
          <line
            key={`axis-${index}`}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        ))}

        {baselinePath ? (
          <path
            d={baselinePath}
            fill="none"
            stroke="var(--chart-axis)"
            strokeWidth={1.4}
            strokeDasharray="4 4"
          />
        ) : null}

        <path d={shapePath} fill="color-mix(in srgb, var(--text) 12%, transparent)" stroke="none" />
        <path d={shapePath} fill="none" stroke="var(--accent-500)" strokeWidth={2.4} />

        {profilePoints.map((point, index) => (
          <g
            key={`vertex-${index}`}
            onMouseEnter={() => setActiveIndex(index)}
            style={{ cursor: 'default' }}
          >
            <circle cx={point.x} cy={point.y} r={5.5} fill="var(--text-muted)" opacity={0.16} />
            <circle cx={point.x} cy={point.y} r={3.4} fill="var(--chart-tooltip-bg)" stroke="var(--accent-500)" strokeWidth={2} />
          </g>
        ))}

        {points.map((point, index) => {
          const labelPoint = polarToCartesian(center, center, labelRadius, point.angle)
          const radians = (Math.PI / 180) * point.angle
          const anchor = labelAnchor(Math.cos(radians))
          const isActive = activeIndex === null || activeIndex === index
          return (
            <g
              key={`label-${point.label}`}
              onMouseEnter={() => setActiveIndex(index)}
              style={{
                opacity: isActive ? 1 : 0.42,
                transition: 'opacity 160ms ease',
                cursor: 'default',
              }}
            >
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="var(--content-primary)"
                fontSize={compact ? 11 : 12}
                fontWeight={500}
              >
                {point.label}
              </text>
              <text
                x={labelPoint.x}
                y={labelPoint.y + (compact ? 12 : 14)}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="var(--content-muted)"
                fontSize={compact ? 10 : 11}
                fontWeight={500}
              >
                {Math.round(point.score)}
              </text>
            </g>
          )
        })}
      </svg>

      {activeIndex !== null && points[activeIndex]?.hint ? (
        <p className="text-body mt-2 text-center">{points[activeIndex]?.hint}</p>
      ) : null}
    </div>
  )
}
