'use client'

import { useEffect, useMemo, useState } from 'react'
import ChartContainer, {
  type ChartPalette,
  ChartTooltipCard,
} from '@/components/charts/ChartContainer'

type SignalDirection = 'bullish' | 'neutral' | 'bearish'

type FlowSignalPoint = {
  signal_date: string
  direction: SignalDirection
  prob_side: number | null
}

type Point = {
  x: number
  y: number
  date: string
  direction: SignalDirection
  conviction: number | null
}

type RegimeSegment = {
  direction: SignalDirection
  startIndex: number
  endIndex: number
  startDate: string
  endDate: string
  durationDays: number
}

type PositionedSegment = RegimeSegment & {
  startX: number
  endX: number
  width: number
  centerX: number
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if (![r, g, b].every(Number.isFinite)) return hex
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function signalColor(direction: SignalDirection, palette: ChartPalette): string {
  if (direction === 'bullish') return palette.bullish
  if (direction === 'bearish') return palette.bearish
  return palette.signalNeutral
}

function signalLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return 'Bullish'
  if (direction === 'bearish') return 'Bearish'
  return 'Neutral'
}

function directionY(direction: SignalDirection, top: number, height: number): number {
  if (direction === 'bullish') return top + height * 0.2
  if (direction === 'bearish') return top + height * 0.8
  return top + height * 0.5
}

function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length < 3) {
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ')
  }

  const commands: string[] = [`M${points[0]?.x.toFixed(2)} ${points[0]?.y.toFixed(2)}`]

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    if (!p0 || !p1 || !p2 || !p3) continue

    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6

    commands.push(
      `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    )
  }

  return commands.join(' ')
}

function formatDate(dateStr: string): string {
  const parsed = Date.parse(dateStr)
  if (!Number.isFinite(parsed)) return dateStr
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  const parsed = Date.parse(dateStr)
  if (!Number.isFinite(parsed)) return dateStr
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatConviction(conviction: number | null): string {
  if (conviction === null || !Number.isFinite(conviction)) return '—'
  return `${Math.round(conviction * 100)}%`
}

function buildSegments(rows: FlowSignalPoint[]): RegimeSegment[] {
  if (rows.length === 0) return []

  const segments: RegimeSegment[] = []
  let start = 0

  for (let index = 1; index <= rows.length; index += 1) {
    const current = rows[index]
    const previous = rows[index - 1]
    if (!previous) continue

    const isBoundary = !current || current.direction !== previous.direction
    if (!isBoundary) continue

    const end = index - 1
    const durationDays = end - start + 1
    segments.push({
      direction: previous.direction,
      startIndex: start,
      endIndex: end,
      startDate: rows[start]?.signal_date ?? previous.signal_date,
      endDate: previous.signal_date,
      durationDays,
    })
    start = index
  }

  return segments
}

function buildBehaviorSummary(rows: FlowSignalPoint[], segments: RegimeSegment[]): string {
  if (rows.length === 0 || segments.length === 0) {
    return 'No signal behavior available for this period.'
  }

  const observations = rows.length
  const flips = Math.max(0, segments.length - 1)
  const flipRate = flips / Math.max(1, observations - 1)

  const durationByDirection = segments.reduce(
    (acc, segment) => {
      acc[segment.direction] += segment.durationDays
      return acc
    },
    { bullish: 0, neutral: 0, bearish: 0 }
  )

  const dominantDirection =
    durationByDirection.bullish >= durationByDirection.neutral &&
    durationByDirection.bullish >= durationByDirection.bearish
      ? 'bullish'
      : durationByDirection.bearish >= durationByDirection.neutral
        ? 'bearish'
        : 'neutral'

  const dominantLabel = signalLabel(dominantDirection)
  const nonDominantSegments = segments.filter((segment) => segment.direction !== dominantDirection)
  const shortInterruptions = nonDominantSegments.filter((segment) => segment.durationDays <= 4)

  if (flipRate >= 0.2 || segments.length >= 10) {
    return 'Frequent regime flips indicate unstable signal behavior.'
  }

  const dominantShare = durationByDirection[dominantDirection] / Math.max(1, observations)

  if (dominantShare >= 0.62 && shortInterruptions.length > 0) {
    return `Mostly stable ${dominantLabel.toLowerCase()} regime with occasional short interruptions.`
  }

  if (dominantShare >= 0.7 && flips <= 2) {
    return `Sustained ${dominantLabel.toLowerCase()} regime with limited flip activity.`
  }

  if (flipRate >= 0.12) {
    return 'Moderate regime shifts suggest mixed but tradable signal structure.'
  }

  return `Balanced regime behavior with a mild ${dominantLabel.toLowerCase()} tilt.`
}

export default function SignalFlowStream({
  signals,
}: {
  signals: FlowSignalPoint[]
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hasEntered, setHasEntered] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const orderedSignals = useMemo(
    () =>
      [...signals]
        .filter((row) => Boolean(row.signal_date))
        .sort((a, b) => Date.parse(a.signal_date) - Date.parse(b.signal_date)),
    [signals]
  )

  const segments = useMemo(() => buildSegments(orderedSignals), [orderedSignals])
  const behaviorSummary = useMemo(
    () => buildBehaviorSummary(orderedSignals, segments),
    [orderedSignals, segments]
  )

  if (orderedSignals.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-sm text-content-muted">
        No signal history available.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-content-secondary">{behaviorSummary}</p>
      <ChartContainer className="relative h-[270px]">
        {({ width, height, palette }) => {
          const padding = { top: 16, right: 14, bottom: 26, left: 16 }
          const innerWidth = Math.max(1, width - padding.left - padding.right)
          const innerHeight = Math.max(1, height - padding.top - padding.bottom)

          const points: Point[] = orderedSignals.map((row, index) => {
            const x =
              padding.left +
              (index / Math.max(1, orderedSignals.length - 1)) * innerWidth
            const y = directionY(row.direction, padding.top, innerHeight)
            return {
              x,
              y,
              date: row.signal_date,
              direction: row.direction,
              conviction: row.prob_side,
            }
          })

          const positionedSegments: PositionedSegment[] = segments.map((segment) => {
            const startPoint = points[segment.startIndex]
            const endPoint = points[segment.endIndex]

            const startX =
              segment.startIndex === 0
                ? padding.left
                : ((points[segment.startIndex - 1]?.x ?? startPoint?.x ?? padding.left) +
                    (startPoint?.x ?? padding.left)) /
                  2
            const endX =
              segment.endIndex >= points.length - 1
                ? padding.left + innerWidth
                : ((endPoint?.x ?? padding.left + innerWidth) +
                    (points[segment.endIndex + 1]?.x ?? padding.left + innerWidth)) /
                  2

            return {
              ...segment,
              startX,
              endX,
              width: Math.max(0, endX - startX),
              centerX: startX + Math.max(0, endX - startX) / 2,
            }
          })

          const currentSegment = positionedSegments[positionedSegments.length - 1] ?? null
          const path = smoothPath(points)
          const streamGlowOpacity = palette.isDark ? 0.12 : 0.2
          const streamCoreOpacity = palette.isDark ? 0.88 : 1
          const currentSegmentFillOpacity = palette.isDark ? 0.22 : 0.34
          const currentSegmentStrokeOpacity = palette.isDark ? 0.52 : 0.7

          const timeTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
            (value, idx, arr) => arr.indexOf(value) === idx
          )

          const hoverPoint = hoverIndex === null ? null : points[hoverIndex] ?? null

          const onMove = (mouseX: number) => {
            const xWithin = mouseX - padding.left
            const ratio = Math.max(0, Math.min(1, xWithin / innerWidth))
            const index = Math.round(ratio * Math.max(0, points.length - 1))
            setHoverIndex(index)
          }

          return (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-full w-full"
              role="img"
              aria-label="Signal flow timeline"
            >
<rect x={0} y={0} width={width} height={height} fill="transparent" />

              {positionedSegments.map((segment, index) => (
                <rect
                  key={`segment-bg-${segment.startDate}-${index}`}
                  x={segment.startX}
                  y={padding.top}
                  width={segment.width}
                  height={innerHeight}
                  fill={
                    segment.direction === 'bullish'
                      ? palette.regimeBullish
                      : segment.direction === 'bearish'
                        ? palette.regimeBearish
                        : palette.regimeNeutral
                  }
                />
              ))}

              {currentSegment ? (
                <rect
                  x={currentSegment.startX}
                  y={padding.top}
                  width={currentSegment.width}
                  height={innerHeight}
                  fill={withAlpha(signalColor(currentSegment.direction, palette), currentSegmentFillOpacity)}
                  stroke={withAlpha(signalColor(currentSegment.direction, palette), currentSegmentStrokeOpacity)}
                  strokeWidth={1.4}
                />
              ) : null}

              {positionedSegments.slice(1).map((segment, index) => (
                <g key={`flip-${segment.startDate}-${index}`}>
                  <line
                    x1={segment.startX}
                    x2={segment.startX}
                    y1={padding.top}
                    y2={padding.top + innerHeight}
                    stroke={withAlpha(palette.axisText, palette.isDark ? 0.36 : 0.45)}
                    strokeWidth={1.2}
                    strokeDasharray="3 4"
                  />
                  <circle
                    cx={segment.startX}
                    cy={directionY(segment.direction, padding.top, innerHeight)}
                    r={3.2}
                    fill={signalColor(segment.direction, palette)}
                    stroke={withAlpha(palette.tooltipBg, 0.96)}
                    strokeWidth={1}
                  />
                </g>
              ))}

              {positionedSegments.map((segment, index) => {
                if (segment.width < 82) return null
                return (
                  <text
                    key={`segment-label-${segment.startDate}-${index}`}
                    x={segment.centerX}
                    y={padding.top + innerHeight / 2 + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={500}
                    fill={withAlpha(signalColor(segment.direction, palette), palette.isDark ? 0.82 : 0.95)}
                    style={{
                      paintOrder: 'stroke',
                      stroke: withAlpha(palette.tooltipBg, palette.isDark ? 0.98 : 0.9),
                      strokeWidth: 3,
                    }}
                  >
                    {`${signalLabel(segment.direction)} · ${segment.durationDays}d`}
                  </text>
                )
              })}

              <g
                style={{
                  opacity: hasEntered ? 1 : 0,
                  transform: hasEntered ? 'translateY(0px)' : 'translateY(5px)',
                  transformOrigin: '50% 50%',
                  transition: 'opacity 440ms ease, transform 620ms ease',
                }}
              >
                <path
                  d={path}
                  fill="none"
                  stroke="var(--text)"
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={streamGlowOpacity}
                />
                <path
                  d={path}
                  fill="none"
                  stroke="var(--text)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={streamCoreOpacity}
                />
              </g>

              {timeTickIndexes.map((index) => {
                const point = points[index]
                if (!point) return null
                return (
                  <text
                    key={`tick-${index}`}
                    x={point.x}
                    y={height - 6}
                    textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                    fontSize={11}
                    fill={palette.axisText}
                  >
                    {formatDateShort(point.date)}
                  </text>
                )
              })}

              {hoverPoint ? (
                <line
                  x1={hoverPoint.x}
                  x2={hoverPoint.x}
                  y1={padding.top}
                  y2={padding.top + innerHeight}
                  stroke={withAlpha(palette.axisText, palette.isDark ? 0.42 : 0.48)}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
              ) : null}

              <rect
                x={padding.left}
                y={padding.top}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onMouseMove={(event) => onMove(event.nativeEvent.offsetX)}
                onMouseLeave={() => setHoverIndex(null)}
              />

              {hoverPoint ? (
                <foreignObject
                  x={Math.min(width - 188, Math.max(6, hoverPoint.x + 10))}
                  y={Math.min(height - 92, Math.max(8, hoverPoint.y - 64))}
                  width={182}
                  height={86}
                  style={{ pointerEvents: 'none' }}
                >
                  <div style={{ fontFamily: 'inherit' }}>
                    <ChartTooltipCard
                      title={formatDate(hoverPoint.date)}
                      rows={[
                        {
                          label: 'Signal',
                          value: signalLabel(hoverPoint.direction),
                          swatchColor: signalColor(hoverPoint.direction, palette),
                        },
                        {
                          label: 'Conviction',
                          value: formatConviction(hoverPoint.conviction),
                        },
                      ]}
                    />
                  </div>
                </foreignObject>
              ) : null}
            </svg>
          )
        }}
      </ChartContainer>
    </div>
  )
}
