import { cn } from '@/lib/utils'
import {
  SCORECARD_AXIS_LABELS,
  SCORECARD_AXIS_ORDER,
  scoreColor,
  type Scorecard,
  type ScorecardAxis,
} from '@/lib/scorecard-types'

type ScorecardDiscProps = {
  scorecard: Scorecard
  size?: number
  mini?: boolean
  compact?: boolean
  className?: string
  /** Makes each slice a button that picks its axis (keyboard and pointer). */
  onSelectAxis?: (key: ScorecardAxis['key']) => void
  selectedAxis?: ScorecardAxis['key'] | null
}

type Point = {
  x: number
  y: number
}

function clampScore(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function polarToCartesian(center: number, radius: number, angleDegrees: number): Point {
  const angle = ((angleDegrees - 90) * Math.PI) / 180
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  }
}

function wedgePath(center: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(center, radius, startAngle)
  const end = polarToCartesian(center, radius, endAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${center.toFixed(2)} ${center.toFixed(2)}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function axisByKey(scorecard: Scorecard): Map<ScorecardAxis['key'], ScorecardAxis> {
  return new Map(scorecard.axes.map((axis) => [axis.key, axis]))
}

function centerTextColor(score: number | null): string {
  if (score !== null && score >= 38 && score <= 58) return 'var(--text)'
  return 'var(--surface)'
}

export default function ScorecardDisc({
  scorecard,
  size,
  mini = false,
  compact = false,
  className,
  onSelectAxis,
  selectedAxis = null,
}: ScorecardDiscProps) {
  const interactive = Boolean(onSelectAxis) && !mini
  const resolvedSize = size ?? (mini ? 40 : compact ? 260 : 360)
  const viewBoxSize = 240
  const center = viewBoxSize / 2
  const axisMap = axisByKey(scorecard)
  const outerRadius = mini ? 102 : compact ? 82 : 78
  const labelRadius = 107
  const centerRadius = mini ? 30 : compact ? 35 : 39
  const slice = 360 / SCORECARD_AXIS_ORDER.length
  const gap = mini ? 2.5 : 3.8
  const overallScore = scorecard.overall.score
  const overallColor = overallScore === null ? 'var(--text-muted)' : scoreColor(overallScore)
  const grade = scorecard.overall.grade || '–'
  const showLabels = !mini
  const showRings = !mini
  const fontScale = resolvedSize / viewBoxSize

  return (
    <div
      className={cn('shrink-0', className)}
      style={{ width: resolvedSize, height: resolvedSize }}
      aria-label={`Scorecard ${grade}, ${scorecard.overall.label}`}
      role={interactive ? 'group' : 'img'}
    >
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} width={resolvedSize} height={resolvedSize} className="block overflow-visible">
        <style>
          {`
            .scorecard-disc-slice {
              transform-box: view-box;
              transform-origin: center;
              animation: scorecard-disc-grow 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            @keyframes scorecard-disc-grow {
              from { transform: scale(0.08); opacity: 0.42; }
              to { transform: scale(1); opacity: 1; }
            }
            @media (prefers-reduced-motion: reduce) {
              .scorecard-disc-slice { animation: none; }
            }
            .scorecard-disc-axis { cursor: pointer; outline: none; }
            .scorecard-disc-axis:focus-visible .scorecard-disc-hit { stroke: var(--accent); stroke-width: 2.5; }
            .scorecard-disc-axis[aria-pressed='true'] .scorecard-disc-hit { stroke: var(--text); stroke-width: 1.5; stroke-dasharray: 3 3; }
          `}
        </style>

        {showRings
          ? [25, 50, 75, 100].map((ring) => (
              <circle
                key={ring}
                cx={center}
                cy={center}
                r={(outerRadius * ring) / 100}
                fill="none"
                stroke="var(--border)"
                strokeOpacity={ring === 100 ? 0.42 : 0.28}
                strokeWidth={ring === 100 ? 1.1 : 0.8}
              />
            ))
          : null}

        {SCORECARD_AXIS_ORDER.map((key, index) => {
          const axis = axisMap.get(key) ?? {
            key,
            label: SCORECARD_AXIS_LABELS[key],
            score: null,
            available: false,
          }
          const available = axis.available && axis.score !== null
          const score = clampScore(axis.score)
          const radius = available
            ? Math.max(mini ? 24 : 18, (outerRadius * score) / 100)
            : outerRadius * (mini ? 0.34 : 0.29)
          const startAngle = index * slice + gap / 2
          const endAngle = (index + 1) * slice - gap / 2
          const midAngle = (startAngle + endAngle) / 2
          const labelPoint = polarToCartesian(center, labelRadius, midAngle)
          const missingMark = polarToCartesian(center, radius * 0.62, midAngle)

          const select = () => onSelectAxis?.(key)
          const axisButton = interactive
            ? {
                className: 'scorecard-disc-axis',
                role: 'button',
                tabIndex: 0,
                'aria-pressed': selectedAxis === key,
                'aria-label': available ? `${axis.label}, ${Math.round(score)} of 100` : `${axis.label}, not scored`,
                'data-scorecard-axis': key,
                onClick: select,
                onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  select()
                },
              }
            : {}

          return (
            <g key={key} {...axisButton}>
              {interactive ? (
                // The whole slice is the target, however small the score.
                <path
                  className="scorecard-disc-hit"
                  d={wedgePath(center, outerRadius, startAngle, endAngle)}
                  fill="transparent"
                  stroke="none"
                />
              ) : null}
              <path
                className="scorecard-disc-slice"
                d={wedgePath(center, radius, startAngle, endAngle)}
                fill={available ? scoreColor(score) : 'var(--neutral-300)'}
                fillOpacity={available ? 0.9 : 0.24}
                stroke={available ? 'var(--text)' : 'var(--text-muted)'}
                strokeWidth={mini ? 1.4 : 1.1}
                strokeDasharray={available ? undefined : mini ? '3 3' : '5 4'}
                style={{ animationDelay: `${index * 42}ms` }}
              />
              {!available && !mini ? (
                <text
                  x={missingMark.x}
                  y={missingMark.y + 4}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={500}
                  fill="var(--content-muted)"
                >
                  –
                </text>
              ) : null}
              {showLabels ? (
                <text
                  x={labelPoint.x}
                  y={labelPoint.y + 4}
                  textAnchor={labelPoint.x < center - 8 ? 'end' : labelPoint.x > center + 8 ? 'start' : 'middle'}
                  fontSize={compact ? 10 : 11}
                  fontWeight={650}
                  fill="var(--content-secondary)"
                >
                  {axis.label}
                </text>
              ) : null}
            </g>
          )
        })}

        <circle
          cx={center}
          cy={center}
          r={centerRadius}
          fill={overallColor}
          stroke="var(--text)"
          strokeWidth={mini ? 2.3 : 2.8}
        />
        <circle
          cx={center}
          cy={center}
          r={centerRadius + (mini ? 4 : 6)}
          fill="none"
          stroke={overallColor}
          strokeOpacity={0.24}
          strokeWidth={mini ? 2 : 3}
        />
        <text
          x={center}
          y={center + (mini ? 5.5 : -1)}
          textAnchor="middle"
          fontSize={Math.max(mini ? 8 : 24, (mini ? 63 : 22) * fontScale)}
          fontWeight={500}
          fill={centerTextColor(overallScore)}
        >
          {grade}
        </text>
        {!mini ? (
          <text
            x={center}
            y={center + 23}
            textAnchor="middle"
            fontSize={compact ? 10 : 11}
            fontWeight={650}
            fill={centerTextColor(overallScore)}
            opacity={0.84}
          >
            {scorecard.overall.label}
          </text>
        ) : null}
      </svg>
    </div>
  )
}
