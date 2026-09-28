'use client'

import React, { useState } from 'react'
import type { PricePoint } from '@/lib/finance'
import { formatMoney } from '@/lib/currency'
import ChartContainer, { CHART_MARGINS, type ChartPalette, ChartTooltipCard } from '@/components/charts/ChartContainer'

type Point = { x: number; y: number; value: number; date: string }
type HoverState = { index: number; mouseX: number; mouseY: number; yOnCurve: number }
type SignalDirection = 'bullish' | 'bearish' | 'neutral'
type SignalMarkerKind = 'flip' | 'latest'

export type StockChartSignalMarker = {
  date: string
  direction: SignalDirection
  conviction: number | null
  horizon: number
  kind: SignalMarkerKind
}

type RenderedSignalMarker = StockChartSignalMarker & {
  index: number
  x: number
  y: number
}

type SignalBand = {
  x: number
  width: number
  direction: SignalDirection
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

function formatDateShort(date: string): string {
  const d = new Date(date)
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`
}

function formatPrice(value: number, currency: string): string {
  return formatMoney(value, currency)
}

function formatDateLong(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatConviction(prob: number | null): string {
  if (prob === null) return '—'
  return `${(prob * 100).toFixed(0)}%`
}

function signalColor(direction: SignalDirection, palette: ChartPalette): { solid: string; soft: string } {
  const softAlpha = palette.isDark ? 0.17 : 0.22
  if (direction === 'bullish') {
    return {
      solid: palette.bullish,
      soft: withAlpha(palette.bullish, softAlpha),
    }
  }
  if (direction === 'bearish') {
    return {
      solid: palette.bearish,
      soft: withAlpha(palette.bearish, softAlpha),
    }
  }
  return {
    solid: palette.signalNeutral,
    soft: withAlpha(palette.signalNeutral, palette.isDark ? 0.16 : 0.2),
  }
}

function signalBandFill(direction: SignalDirection, palette: ChartPalette): string {
  const tone = signalColor(direction, palette).solid
  return withAlpha(tone, palette.isDark ? 0.22 : 0.17)
}

function signalDirectionLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return 'Bullish'
  if (direction === 'bearish') return 'Bearish'
  return 'Neutral'
}

function signalKindLabel(kind: SignalMarkerKind): string {
  if (kind === 'flip') return 'Model Flip'
  return 'Latest Signal'
}

function compactSignalMarkers(markers: RenderedSignalMarker[]): RenderedSignalMarker[] {
  if (markers.length <= 1) return markers

  const flipMarkers = markers.filter((marker) => marker.kind === 'flip').sort((a, b) => a.index - b.index)
  const spacedFlips: RenderedSignalMarker[] = []

  for (const marker of flipMarkers) {
    const previous = spacedFlips[spacedFlips.length - 1]
    if (!previous) {
      spacedFlips.push(marker)
      continue
    }

    if (marker.x - previous.x < 26) {
      // Keep the most recent transition when flip markers cluster tightly.
      spacedFlips[spacedFlips.length - 1] = marker
      continue
    }
    spacedFlips.push(marker)
  }

  const latestMarker = markers[markers.length - 1] ?? null
  const markerByIndex = new Map<number, RenderedSignalMarker>(spacedFlips.map((marker) => [marker.index, marker]))
  if (latestMarker) markerByIndex.set(latestMarker.index, latestMarker)
  return [...markerByIndex.values()].sort((a, b) => a.index - b.index)
}

function buildSmoothLinePath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length < 3) {
    return points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ')
  }

  const commandParts: string[] = [`M${points[0]?.x.toFixed(2)} ${points[0]?.y.toFixed(2)}`]

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

    commandParts.push(
      `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    )
  }

  return commandParts.join(' ')
}

export default function StockChart({
  data,
  currency = 'USD',
  signalMarkers = [],
  showRegimes = true,
  showSignalMarkers = true,
}: {
  data: PricePoint[]
  currency?: string
  signalMarkers?: StockChartSignalMarker[]
  showRegimes?: boolean
  showSignalMarkers?: boolean
}) {
  const [hover, setHover] = useState<HoverState | null>(null)
  const [isHovering, setIsHovering] = useState(false)

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full min-h-[220px] min-w-0 flex flex-col items-center justify-center text-content-muted">
        <span>No historical data available.</span>
      </div>
    )
  }

  return (
    <ChartContainer className="relative w-full h-full min-h-[220px] min-w-0">
      {({ width, height, palette }) => {
        const padding = CHART_MARGINS.stock
        const innerW = Math.max(1, width - padding.left - padding.right)
        const innerH = Math.max(1, height - padding.top - padding.bottom)
        const prices = data.map((d) => d.close)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        const spread = maxPrice - minPrice
        const pad = spread === 0 ? Math.max(1, minPrice * 0.01) : spread * 0.1
        const yMin = minPrice - pad
        const yMax = maxPrice + pad
        const yRange = Math.max(1e-6, yMax - yMin)

        const points: Point[] = data.map((d, idx) => {
          const x = padding.left + (idx / Math.max(1, data.length - 1)) * innerW
          const y = padding.top + (1 - (d.close - yMin) / yRange) * innerH
          return { x, y, value: d.close, date: d.date }
        })

        const path = buildSmoothLinePath(points)
        const baselineY = padding.top + innerH
        const firstPoint = points[0]
        const lastPoint = points[points.length - 1]
        const areaPath =
          firstPoint && lastPoint
            ? `${path} L${lastPoint.x.toFixed(2)} ${baselineY.toFixed(2)} L${firstPoint.x.toFixed(2)} ${baselineY.toFixed(2)} Z`
            : ''

        const yTicks = 4
        const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i / yTicks) * yRange)
        const xTickIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
          (v, i, arr) => arr.indexOf(v) === i
        )
        const dateToPointIndex = new Map(points.map((point, idx) => [point.date, idx]))

        const signalMarkerMap = new Map<string, RenderedSignalMarker>()
        for (const marker of signalMarkers) {
          const normalizedDate = marker.date.slice(0, 10)
          const pointIndex = dateToPointIndex.get(normalizedDate)
          if (pointIndex === undefined) continue
          const point = points[pointIndex]
          if (!point) continue

          const key = `${normalizedDate}:${marker.kind}`
          signalMarkerMap.set(key, {
            ...marker,
            date: normalizedDate,
            index: pointIndex,
            x: point.x,
            y: point.y,
          })
        }
        const resolvedSignalMarkers = [...signalMarkerMap.values()].sort((a, b) => a.index - b.index)

        const stateMarkersByIndex = new Map<number, RenderedSignalMarker>()
        for (const marker of resolvedSignalMarkers) {
          const existing = stateMarkersByIndex.get(marker.index)
          if (!existing) {
            stateMarkersByIndex.set(marker.index, marker)
            continue
          }
          if (existing.kind === 'latest' && marker.kind === 'flip') {
            stateMarkersByIndex.set(marker.index, marker)
          }
        }

        const stateMarkers = [...stateMarkersByIndex.values()].sort((a, b) => a.index - b.index)
        const latestStateMarker = stateMarkers[stateMarkers.length - 1] ?? null
        const renderedSignalMarkers = showSignalMarkers ? compactSignalMarkers(stateMarkers) : []
        const signalBands: SignalBand[] = showRegimes
          ? stateMarkers
              .map((marker, idx) => {
                const next = stateMarkers[idx + 1]
                const startX = idx === 0 ? padding.left : marker.x
                const endX = next ? next.x : padding.left + innerW
                return {
                  x: startX,
                  width: Math.max(0, endX - startX),
                  direction: marker.direction,
                }
              })
              .filter((band) => band.width >= 4)
          : []
        const currentBand = signalBands[signalBands.length - 1] ?? null
        const currentRegimeColor = latestStateMarker
          ? signalColor(latestStateMarker.direction, palette).solid
          : palette.primary

        const hoverPoint = hover ? points[hover.index] : null
        const hoverVisible = Boolean(hoverPoint && isHovering)
        const hoverSignalMarker =
          hoverPoint && hover
            ? [...stateMarkers].reverse().find((marker) => marker.index <= hover.index) ?? null
            : null
        const hasSignalContext = stateMarkers.length > 0

        const handleHoverMove = (event: React.MouseEvent<SVGRectElement>) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const localX = event.clientX - rect.left
          const localY = event.clientY - rect.top
          const x = padding.left + localX
          const y = padding.top + localY
          const clampedX = Math.min(Math.max(x, padding.left), padding.left + innerW)
          const clampedY = Math.min(Math.max(y, padding.top), padding.top + innerH)
          const ratio = (clampedX - padding.left) / Math.max(1, innerW)
          const scaled = ratio * Math.max(0, points.length - 1)
          const index = Math.min(points.length - 1, Math.max(0, Math.round(scaled)))
          const lockedPoint = points[index]
          if (!lockedPoint) return

          setIsHovering(true)
          setHover((prev) => {
            if (
              prev &&
              prev.index === index &&
              prev.mouseX === lockedPoint.x &&
              prev.yOnCurve === lockedPoint.y
            ) {
              return prev
            }
            return {
              index,
              mouseX: lockedPoint.x,
              mouseY: clampedY,
              yOnCurve: lockedPoint.y,
            }
          })
        }

        const tooltipWidth = 220
        const tooltipHeight = hasSignalContext ? 148 : 90
        const tooltipTop = hover
          ? Math.min(Math.max(8, hover.yOnCurve - tooltipHeight / 2), height - tooltipHeight - 8)
          : 0
        const placeLeft = hover ? hover.mouseX > padding.left + innerW / 2 : false
        const tooltipLeft = hover
          ? placeLeft
            ? Math.max(8, hover.mouseX - tooltipWidth - 14)
            : Math.min(width - tooltipWidth - 8, hover.mouseX + 14)
          : 0
        const hoverX = hover?.mouseX ?? 0
        const hoverYOnCurve = hover?.yOnCurve ?? 0
        const lineGlowOpacity = palette.isDark ? 0.14 : 0.22

        return (
          <>
            <svg width={width} height={height} className="block overflow-visible">
<rect x={0} y={0} width={width} height={height} fill="transparent" />

              {signalBands.map((band, idx) => (
                <g key={`band-${idx}`}>
                  <rect
                    x={band.x}
                    y={padding.top}
                    width={band.width}
                    height={innerH}
                    fill={signalBandFill(band.direction, palette)}
                  />
                  <line
                    x1={band.x}
                    y1={padding.top + 1}
                    x2={band.x + band.width}
                    y2={padding.top + 1}
                    stroke={withAlpha(signalColor(band.direction, palette).solid, palette.isDark ? 0.34 : 0.24)}
                    strokeWidth={1.25}
                  />
                </g>
              ))}
              {signalBands.slice(1).map((band, idx) => (
                <line
                  key={`band-boundary-${idx}`}
                  x1={band.x}
                  y1={padding.top}
                  x2={band.x}
                  y2={padding.top + innerH}
                  stroke={withAlpha(signalColor(band.direction, palette).solid, palette.isDark ? 0.3 : 0.22)}
                  strokeWidth={1.25}
                />
              ))}
              {currentBand ? (
                <rect
                  x={Math.max(currentBand.x, padding.left + innerW * 0.76)}
                  y={padding.top}
                  width={Math.max(0, padding.left + innerW - Math.max(currentBand.x, padding.left + innerW * 0.76))}
                  height={innerH}
                  fill="color-mix(in srgb, var(--text) 12%, transparent)"
                />
              ) : null}

              {yTickValues.map((value) => {
                const y =
                  padding.top +
                  (1 - (value - yTickValues[0]) / (yTickValues[yTickValues.length - 1] - yTickValues[0])) *
                    innerH
                return (
                  <g key={`y-${value}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + innerW}
                      y2={y}
                      stroke={palette.grid}
                      strokeWidth={1}
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={12}
                      fill={palette.axisText}
                    >
                      {formatPrice(value, currency)}
                    </text>
                  </g>
                )
              })}

              {xTickIndexes.map((idx) => {
                const point = points[idx]
                if (!point) return null
                return (
                  <text
                    key={`x-${idx}`}
                    x={point.x}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize={12}
                    fill={palette.axisText}
                  >
                    {formatDateShort(point.date)}
                  </text>
                )
              })}

              {areaPath ? <path d={areaPath} fill="color-mix(in srgb, var(--text) 12%, transparent)" stroke="none" /> : null}
              {path ? <path d={path} fill="none" stroke={withAlpha(palette.primary, lineGlowOpacity)} strokeWidth={6} /> : null}
              {path ? <path d={path} fill="none" stroke="var(--text)" strokeWidth={2.5} /> : null}
              {lastPoint ? (
                <g style={{ pointerEvents: 'none' }}>
                  <circle cx={lastPoint.x} cy={lastPoint.y} r={13} fill={withAlpha(currentRegimeColor, palette.isDark ? 0.13 : 0.18)} />
                  <circle cx={lastPoint.x} cy={lastPoint.y} r={6.5} fill={currentRegimeColor} stroke={palette.tooltipBg} strokeWidth={2.5} />
                  <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill={palette.tooltipBg} />
                </g>
              ) : null}

              {renderedSignalMarkers.map((marker) => {
                const colors = signalColor(marker.direction, palette)
                const isActive = hoverPoint?.date === marker.date
                const isLatest = latestStateMarker?.index === marker.index
                return (
                  <g key={`${marker.date}:${marker.kind}`} style={{ pointerEvents: 'none' }}>
                    {marker.kind === 'flip' ? (
                      <line
                        x1={marker.x}
                        y1={padding.top}
                        x2={marker.x}
                        y2={padding.top + innerH}
                        stroke={withAlpha(colors.solid, palette.isDark ? 0.16 : 0.2)}
                        strokeWidth={1}
                        strokeDasharray="3 4"
                      />
                    ) : null}
                    <circle cx={marker.x} cy={marker.y} r={isActive ? 12 : isLatest ? 10.5 : 9} fill={colors.soft} />
                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r={isActive ? 6 : isLatest ? 5.25 : 4.5}
                      fill={colors.solid}
                      stroke={palette.tooltipBg}
                      strokeWidth={2}
                    />
                    <circle cx={marker.x} cy={marker.y} r={1.6} fill={palette.tooltipBg} />
                    {marker.kind === 'flip' ? (
                      <rect
                        x={marker.x - 2.5}
                        y={marker.y - 13}
                        width={5}
                        height={5}
                        rx={1}
                        transform={`rotate(45 ${marker.x} ${marker.y - 10.5})`}
                        fill={colors.solid}
                        opacity={0.95}
                      />
                    ) : null}
                  </g>
                )
              })}

              <rect
                x={padding.left}
                y={padding.top}
                width={innerW}
                height={innerH}
                fill="transparent"
                onMouseMove={handleHoverMove}
                onMouseLeave={() => {
                  setIsHovering(false)
                  setHover(null)
                }}
              />

              {hoverPoint ? (
                <g style={{ opacity: hoverVisible ? 1 : 0, transition: 'opacity 180ms ease-out' }}>
                  <line
                    x1={hoverX}
                    y1={padding.top}
                    x2={hoverX}
                    y2={padding.top + innerH}
                    stroke={withAlpha(palette.axisText, palette.isDark ? 0.44 : 0.38)}
                    strokeWidth={1}
                  />
                  <circle cx={hoverX} cy={hoverYOnCurve} r={12} fill={withAlpha(palette.primary, palette.isDark ? 0.15 : 0.2)} />
                  <circle cx={hoverX} cy={hoverYOnCurve} r={5} fill={palette.primary} stroke={palette.tooltipBg} strokeWidth={2} />
                </g>
              ) : null}
            </svg>

            {hoverPoint ? (
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: tooltipLeft,
                  top: tooltipTop,
                  opacity: hoverVisible ? 1 : 0,
                  transform: hoverVisible ? 'translate3d(0,0,0)' : 'translate3d(0,6px,0)',
                  transition:
                    'left 120ms ease-out, top 120ms ease-out, opacity 180ms ease-out, transform 180ms ease-out',
                }}
              >
                <ChartTooltipCard
                  title={formatDateLong(hoverPoint.date)}
                  rows={[
                    {
                      label: 'Close',
                      value: formatMoney(hoverPoint.value, currency),
                      swatchColor: palette.primary,
                    },
                    ...(hasSignalContext
                      ? [
                          {
                            label: hoverSignalMarker ? signalKindLabel(hoverSignalMarker.kind) : 'Signal Context',
                            value: hoverSignalMarker ? signalDirectionLabel(hoverSignalMarker.direction) : '—',
                            ...(hoverSignalMarker
                              ? { swatchColor: signalColor(hoverSignalMarker.direction, palette).solid }
                              : {}),
                          },
                          {
                            label: 'Signal Date',
                            value: hoverSignalMarker ? formatDateLong(hoverSignalMarker.date) : '—',
                          },
                          {
                            label: 'Conviction',
                            value: hoverSignalMarker ? formatConviction(hoverSignalMarker.conviction) : '—',
                          },
                          {
                            label: 'Horizon',
                            value: hoverSignalMarker ? `${hoverSignalMarker.horizon}d` : '—',
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ) : null}
          </>
        )
      }}
    </ChartContainer>
  )
}
