'use client'

import { useMemo, useRef, useState } from 'react'
import { type ChartPalette, ChartTooltipCard, useChartPalette } from '@/components/charts/ChartContainer'

type SignalDirection = 'bullish' | 'neutral' | 'bearish'

type HoverState = {
  direction: SignalDirection
  x: number
  y: number
}

type BubbleDatum = {
  direction: SignalDirection
  label: string
  count: number
  share: number
  percent: number
  descriptor: 'dominant' | 'secondary' | 'minor'
  cx: number
  cy: number
  r: number
}

export type SignalCompositionInsights = {
  biasLabel: string
  interpretation: string
  summaryLine: string
  activePct: number
  bullishShare: number
  neutralShare: number
  bearishShare: number
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

function colorFor(
  direction: SignalDirection,
  palette: ChartPalette,
  descriptor: 'dominant' | 'secondary' | 'minor' = 'secondary'
): { fill: string; stroke: string; text: string } {
  const intensity =
    descriptor === 'dominant' ? 1.12 : descriptor === 'secondary' ? 1 : 0.84
  const fillAlpha = (palette.isDark ? 0.17 : 0.22) * intensity
  const strokeAlpha = (palette.isDark ? 0.5 : 0.62) * intensity
  const textAlpha = (palette.isDark ? 0.82 : 0.94) * intensity
  if (direction === 'bullish') {
    return {
      fill: withAlpha(palette.bullish, Math.min(0.3, fillAlpha)),
      stroke: withAlpha(palette.bullish, Math.min(0.74, strokeAlpha)),
      text: withAlpha(palette.bullish, Math.min(0.98, textAlpha)),
    }
  }
  if (direction === 'bearish') {
    return {
      fill: withAlpha(palette.bearish, Math.min(0.3, fillAlpha)),
      stroke: withAlpha(palette.bearish, Math.min(0.72, (palette.isDark ? 0.48 : 0.6) * intensity)),
      text: withAlpha(palette.bearish, Math.min(0.98, textAlpha)),
    }
  }
  return {
    fill: withAlpha(palette.signalNeutral, Math.min(0.28, fillAlpha)),
    stroke: withAlpha(palette.signalNeutral, Math.min(0.72, (palette.isDark ? 0.52 : 0.6) * intensity)),
    text: withAlpha(palette.signalNeutral, Math.min(0.96, (palette.isDark ? 0.9 : 0.95) * intensity)),
  }
}

function summaryLine(values: {
  bullishShare: number
  neutralShare: number
  bearishShare: number
}): string {
  const { bullishShare, neutralShare, bearishShare } = values
  const maxShare = Math.max(bullishShare, neutralShare, bearishShare)
  const minShare = Math.min(bullishShare, neutralShare, bearishShare)
  const spread = maxShare - minShare

  if (bullishShare >= 0.56 && bearishShare <= 0.2) {
    return 'Bullish signals dominate with limited bearish pressure.'
  }
  if (neutralShare >= 0.5) {
    return 'Neutral regimes absorb most observations, limiting directional edge.'
  }
  if (spread <= 0.12) {
    return 'Distribution is balanced, with no strong directional bias.'
  }
  if (bearishShare >= 0.52 && bullishShare <= 0.22) {
    return 'Bearish regimes dominate with limited bullish relief.'
  }
  if (bullishShare > bearishShare) {
    return 'Bullish share leads, but neutral and bearish regimes still matter.'
  }
  if (bearishShare > bullishShare) {
    return 'Bearish share leads, though neutral periods still absorb meaningful time.'
  }
  return 'Signal distribution is mixed across regimes.'
}

export function deriveSignalCompositionInsights(values: {
  bullishCount: number
  neutralCount: number
  bearishCount: number
}): SignalCompositionInsights {
  const total = values.bullishCount + values.neutralCount + values.bearishCount
  const bullishShare = total > 0 ? values.bullishCount / total : 0
  const neutralShare = total > 0 ? values.neutralCount / total : 0
  const bearishShare = total > 0 ? values.bearishCount / total : 0
  const activePct = Math.round((bullishShare + bearishShare) * 100)

  let biasLabel = 'Balanced system'
  let interpretation = 'Balanced distribution enables adaptability but lowers conviction.'

  if (neutralShare >= 0.5) {
    biasLabel = 'Neutral-heavy system'
    interpretation = 'Neutral dominance reduces directional edge.'
  } else if (bullishShare >= 0.5 && bullishShare - bearishShare >= 0.14) {
    biasLabel = 'Bullish-biased system'
    interpretation = 'System spends most time in bullish regimes with limited bearish exposure.'
  } else if (bearishShare >= 0.5 && bearishShare - bullishShare >= 0.14) {
    biasLabel = 'Bearish-biased system'
    interpretation = 'System spends most time in bearish regimes with limited bullish exposure.'
  } else if (bullishShare > bearishShare + 0.08) {
    biasLabel = 'Bullish-leaning system'
    interpretation = 'Bullish regimes lead, but neutral periods still cap directional conviction.'
  } else if (bearishShare > bullishShare + 0.08) {
    biasLabel = 'Bearish-leaning system'
    interpretation = 'Bearish regimes lead, but neutral periods still interrupt directional momentum.'
  }

  return {
    biasLabel,
    interpretation,
    summaryLine: summaryLine({ bullishShare, neutralShare, bearishShare }),
    activePct,
    bullishShare,
    neutralShare,
    bearishShare,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export default function SignalDistributionBubbleCluster({
  bullishCount,
  neutralCount,
  bearishCount,
  mode = 'standard',
  showSummaryLine = true,
  showCount,
  showRoleInside = false,
}: {
  bullishCount: number
  neutralCount: number
  bearishCount: number
  mode?: 'standard' | 'compact'
  showSummaryLine?: boolean
  showCount?: boolean
  showRoleInside?: boolean
}) {
  const palette = useChartPalette()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<HoverState | null>(null)

  const total = bullishCount + neutralCount + bearishCount
  const bullishShare = total > 0 ? bullishCount / total : 0
  const neutralShare = total > 0 ? neutralCount / total : 0
  const bearishShare = total > 0 ? bearishCount / total : 0

  const descriptorByDirection = useMemo(() => {
    const ranked = [
      { direction: 'bullish' as const, share: bullishShare },
      { direction: 'neutral' as const, share: neutralShare },
      { direction: 'bearish' as const, share: bearishShare },
    ].sort((a, b) => b.share - a.share)

    const map = new Map<SignalDirection, 'dominant' | 'secondary' | 'minor'>()
    if (ranked[0]) map.set(ranked[0].direction, 'dominant')
    if (ranked[1]) map.set(ranked[1].direction, 'secondary')
    if (ranked[2]) map.set(ranked[2].direction, 'minor')
    return map
  }, [bullishShare, neutralShare, bearishShare])

  const compact = mode === 'compact'
  const bubbleConfig = compact
    ? {
        viewW: 460,
        viewH: 250,
        hClass: 'h-[230px]',
        bullish: { cx: 148, cy: 98 },
        neutral: { cx: 312, cy: 98 },
        bearish: { cx: 230, cy: 178 },
        baseRadius: 34,
        radiusScale: 30,
        radiusMax: 72,
      }
    : {
        viewW: 560,
        viewH: 320,
        hClass: 'h-[280px]',
        bullish: { cx: 184, cy: 132 },
        neutral: { cx: 380, cy: 132 },
        bearish: { cx: 282, cy: 240 },
        baseRadius: 44,
        radiusScale: 38,
        radiusMax: 88,
      }

  const bubbles: BubbleDatum[] = [
    {
      direction: 'bullish',
      label: 'Bullish',
      count: bullishCount,
      share: bullishShare,
      percent: bullishShare * 100,
      descriptor: descriptorByDirection.get('bullish') ?? 'minor',
      cx: bubbleConfig.bullish.cx,
      cy: bubbleConfig.bullish.cy,
      r: clamp(
        bubbleConfig.baseRadius + Math.sqrt(Math.max(0, bullishShare)) * bubbleConfig.radiusScale,
        bubbleConfig.baseRadius - 2,
        bubbleConfig.radiusMax
      ),
    },
    {
      direction: 'neutral',
      label: 'Neutral',
      count: neutralCount,
      share: neutralShare,
      percent: neutralShare * 100,
      descriptor: descriptorByDirection.get('neutral') ?? 'minor',
      cx: bubbleConfig.neutral.cx,
      cy: bubbleConfig.neutral.cy,
      r: clamp(
        bubbleConfig.baseRadius + Math.sqrt(Math.max(0, neutralShare)) * bubbleConfig.radiusScale,
        bubbleConfig.baseRadius - 2,
        bubbleConfig.radiusMax
      ),
    },
    {
      direction: 'bearish',
      label: 'Bearish',
      count: bearishCount,
      share: bearishShare,
      percent: bearishShare * 100,
      descriptor: descriptorByDirection.get('bearish') ?? 'minor',
      cx: bubbleConfig.bearish.cx,
      cy: bubbleConfig.bearish.cy,
      r: clamp(
        bubbleConfig.baseRadius + Math.sqrt(Math.max(0, bearishShare)) * bubbleConfig.radiusScale,
        bubbleConfig.baseRadius - 2,
        bubbleConfig.radiusMax
      ),
    },
  ]

  const hoverBubble = hover ? bubbles.find((bubble) => bubble.direction === hover.direction) ?? null : null
  const insights = deriveSignalCompositionInsights({ bullishCount, neutralCount, bearishCount })

  return (
    <div className="space-y-3" ref={containerRef}>
      {showSummaryLine ? (
        <p className="text-[13px] text-content-secondary">{insights.summaryLine}</p>
      ) : null}

      <div
        className={`relative w-full overflow-hidden rounded-md border border-border bg-surface-elevated ${bubbleConfig.hClass}`}
      >
        <svg
          viewBox={`0 0 ${bubbleConfig.viewW} ${bubbleConfig.viewH}`}
          className="h-full w-full"
          role="img"
          aria-label="Signal distribution bubbles"
        >
          {bubbles.map((bubble) => {
            const bubblePalette = colorFor(bubble.direction, palette, bubble.descriptor)
            const canShowCount = (showCount ?? !compact) && bubble.r >= 58
            const roleText =
              bubble.descriptor === 'dominant'
                ? 'Dominant'
                : bubble.descriptor === 'secondary'
                  ? 'Secondary'
                  : 'Minor'

            return (
              <g
                key={bubble.direction}
                onMouseMove={(event) => {
                  const containerRect = containerRef.current?.getBoundingClientRect()
                  if (!containerRect) return
                  setHover({
                    direction: bubble.direction,
                    x: clamp(event.clientX - containerRect.left + 8, 8, containerRect.width - 12),
                    y: clamp(event.clientY - containerRect.top - 8, 8, containerRect.height - 8),
                  })
                }}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  cx={bubble.cx}
                  cy={bubble.cy}
                  r={bubble.r}
                  fill={bubblePalette.fill}
                  stroke={bubblePalette.stroke}
                  strokeWidth={bubble.descriptor === 'dominant' ? 2.3 : 2}
                />
                <text
                  x={bubble.cx}
                  y={bubble.cy - (showRoleInside ? 15 : canShowCount ? 10 : 4)}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={500}
                  fill={bubblePalette.text}
                  style={{
                    paintOrder: 'stroke',
                    stroke: withAlpha(palette.tooltipBg, palette.isDark ? 0.98 : 0.92),
                    strokeWidth: 3,
                  }}
                >
                  {bubble.label}
                </text>
                <text
                  x={bubble.cx}
                  y={bubble.cy + (showRoleInside ? 3 : canShowCount ? 11 : 6)}
                  textAnchor="middle"
                  fontSize={showRoleInside ? 16 : canShowCount ? 18 : 16}
                  fontWeight={500}
                  fill={bubblePalette.text}
                  style={{
                    paintOrder: 'stroke',
                    stroke: withAlpha(palette.tooltipBg, palette.isDark ? 0.98 : 0.94),
                    strokeWidth: 3,
                  }}
                >
                  {Math.round(bubble.percent)}%
                </text>
                {showRoleInside ? (
                  <text
                    x={bubble.cx}
                    y={bubble.cy + 20}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={500}
                    fill={withAlpha(bubblePalette.text, 0.84)}
                    style={{
                      paintOrder: 'stroke',
                      stroke: withAlpha(palette.tooltipBg, palette.isDark ? 0.98 : 0.9),
                      strokeWidth: 3,
                    }}
                  >
                    {roleText}
                  </text>
                ) : null}
                {canShowCount ? (
                  <text
                    x={bubble.cx}
                    y={bubble.cy + 28}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={500}
                    fill={withAlpha(bubblePalette.text, 0.84)}
                    style={{
                      paintOrder: 'stroke',
                      stroke: withAlpha(palette.tooltipBg, palette.isDark ? 0.98 : 0.9),
                      strokeWidth: 3,
                    }}
                  >
                    {bubble.count} obs
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        {hover && hoverBubble ? (
          <div className="pointer-events-none absolute" style={{ left: hover.x, top: hover.y }}>
            <ChartTooltipCard
              title={hoverBubble.label}
              rows={[
                {
                  label: 'Share',
                  value: `${hoverBubble.percent.toFixed(1)}%`,
                  swatchColor: colorFor(hoverBubble.direction, palette, hoverBubble.descriptor).stroke,
                },
                {
                  label: 'Count',
                  value: `${hoverBubble.count}`,
                },
                {
                  label: 'Role',
                  value:
                    hoverBubble.descriptor === 'dominant'
                      ? 'Dominant'
                      : hoverBubble.descriptor === 'secondary'
                        ? 'Secondary'
                        : 'Minor',
                },
              ]}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
