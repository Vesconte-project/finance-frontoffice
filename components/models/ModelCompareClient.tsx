'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import CompareDiffRow from '@/components/models/CompareDiffRow'
import { buttonClass } from '@/components/ui/Button'
import ChartContainer, {
  CHART_MARGINS,
  type ChartPalette,
  ChartTooltipCard,
  useChartPalette,
} from '@/components/charts/ChartContainer'
import { loadModelsFromStorage } from '@/lib/model-store-client'
import { type ModelRecord } from '@/lib/model-builder'
import { trackEvent } from '@/lib/analytics'

type ConfidenceLabel = 'Low' | 'Moderate' | 'High'
type CompareOutcome = 'left' | 'right' | 'same' | 'na'

type ComparisonMetric = {
  key: string
  label: string
  leftDisplay: string
  rightDisplay: string
  outcome: CompareOutcome
}

type CompareChartPoint = {
  t: string
  left: number | null
  right: number | null
  benchmark: number | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = average(values)
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function hasCondition(
  model: ModelRecord,
  metric: string,
  operator: 'above' | 'below',
  thresholdTest: (value: number) => boolean
): boolean {
  return model.conditions.some(
    (condition) =>
      condition.metric === metric &&
      condition.operator === operator &&
      thresholdTest(condition.value)
  )
}

function modelFlipRate(model: ModelRecord): number {
  if (model.signals.length <= 1) return 0
  const flips = model.signals.reduce((count, row, index) => {
    if (index === 0) return count
    const prev = model.signals[index - 1]
    return prev && prev.signal !== row.signal ? count + 1 : count
  }, 0)
  return flips / (model.signals.length - 1)
}

function formatCondition(condition: ModelRecord['conditions'][number]): string {
  return `${condition.metric} ${condition.operator === 'above' ? '>' : '<'} ${condition.value}`
}

function compareValues(
  left: number | null,
  right: number | null,
  mode: 'higher' | 'lower' | 'lowerAbs',
  epsilon: number
): CompareOutcome {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return 'na'

  if (mode === 'higher') {
    if (Math.abs(left - right) <= epsilon) return 'same'
    return left > right ? 'left' : 'right'
  }

  if (mode === 'lowerAbs') {
    const leftAbs = Math.abs(left)
    const rightAbs = Math.abs(right)
    if (Math.abs(leftAbs - rightAbs) <= epsilon) return 'same'
    return leftAbs < rightAbs ? 'left' : 'right'
  }

  if (Math.abs(left - right) <= epsilon) return 'same'
  return left < right ? 'left' : 'right'
}

function sideVariant(outcome: CompareOutcome, side: 'left' | 'right'): 'success' | 'danger' | 'neutral' {
  if (outcome === 'na' || outcome === 'same') return 'neutral'
  return outcome === side ? 'success' : 'danger'
}

function sideLabel(outcome: CompareOutcome, side: 'left' | 'right'): string {
  if (outcome === 'na') return 'n/a'
  if (outcome === 'same') return 'unchanged'
  return outcome === side ? 'better' : 'worse'
}

function modelInsights(model: ModelRecord): {
  personality: string
  confidence: ConfidenceLabel
  confidencePct: number
  topInsightHeadline: string
  topInsightSummary: string
  signalCount: number
  flipRate: number
} {
  const scoreByLabel = new Map(model.profileDimensions.map((dimension) => [dimension.label, dimension.score]))
  const trendScore = scoreByLabel.get('Trend') ?? 50
  const momentumScore = scoreByLabel.get('Momentum') ?? 50
  const riskScore = scoreByLabel.get('Risk') ?? 50
  const stabilityScore = scoreByLabel.get('Stability') ?? 50
  const summary = model.summary
  const flipRate = modelFlipRate(model)

  const trendMomentumEmphasis =
    hasCondition(model, 'Trend', 'above', (value) => value >= 55) ||
    hasCondition(model, 'Momentum', 'above', (value) => value >= 55) ||
    (trendScore >= 58 && momentumScore >= 56)
  const volatilityFilter =
    hasCondition(model, 'Risk', 'below', (value) => value <= 50) ||
    riskScore >= 56
  const stabilityFilter =
    hasCondition(model, 'Stability', 'above', (value) => value >= 55) ||
    hasCondition(model, 'Flip rate', 'below', (value) => value <= 50) ||
    (stabilityScore >= 56 && flipRate <= 0.3)

  const personality =
    volatilityFilter && stabilityFilter && !trendMomentumEmphasis
      ? 'Defensive system'
      : trendMomentumEmphasis && momentumScore > trendScore + 3
        ? 'Momentum-driven model'
        : trendMomentumEmphasis && volatilityFilter
          ? 'Trend follower'
          : 'Balanced signal filter'

  const returnDispersion = stdDev(model.signals.map((row) => row.returnPct))
  const consistencyScore = summary
    ? clamp((summary.winRate - 45) / 20, 0, 1) * 0.55 +
      clamp((summary.relativePerformance + 2) / 8, 0, 1) * 0.45
    : 0.45
  const stabilityScoreNorm = clamp(1 - flipRate / 0.42, 0, 1)
  const dispersionScoreNorm = clamp(1 - returnDispersion / 2.2, 0, 1)
  const sampleScoreNorm = clamp(model.signals.length / 20, 0, 1)
  const confidenceScore =
    stabilityScoreNorm * 0.4 +
    consistencyScore * 0.32 +
    dispersionScoreNorm * 0.18 +
    sampleScoreNorm * 0.1
  const confidencePct = Math.round(confidenceScore * 100)
  const confidence: ConfidenceLabel =
    confidenceScore >= 0.68 ? 'High' : confidenceScore >= 0.45 ? 'Moderate' : 'Low'

  const topInsightHeadline = `${personality} · ${confidence} confidence`
  const topInsightSummary =
    trendMomentumEmphasis && volatilityFilter
      ? 'Performs best in directional markets, weaker during volatility spikes.'
      : stabilityFilter
        ? 'Best in cleaner regimes, but less reliable through rapid reversals.'
        : 'Edge appears selective and can fade in unstable market structure.'

  return {
    personality,
    confidence,
    confidencePct,
    topInsightHeadline,
    topInsightSummary,
    signalCount: model.signals.length,
    flipRate,
  }
}

type CompareTooltipPayload = {
  t: string
  left: number | null
  right: number | null
  benchmark: number | null
}

function CompareTooltip({
  active,
  payload,
  leftLabel,
  rightLabel,
  benchmarkLabel,
  palette,
}: {
  active?: boolean
  payload?: Array<{ payload?: CompareTooltipPayload }>
  leftLabel: string
  rightLabel: string
  benchmarkLabel: string | null
  palette: ChartPalette
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null

  const rows = [
    {
      label: leftLabel,
      value: point.left === null ? '—' : point.left.toFixed(2),
      swatchColor: palette.secondary,
    },
    {
      label: rightLabel,
      value: point.right === null ? '—' : point.right.toFixed(2),
      swatchColor: palette.primary,
    },
  ]

  if (benchmarkLabel) {
    rows.push({
      label: benchmarkLabel,
      value: point.benchmark === null ? '—' : point.benchmark.toFixed(2),
      swatchColor: palette.neutral,
    })
  }

  return <ChartTooltipCard title={point.t} rows={rows} />
}

function ComparePageSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <Card key={`compare-skeleton-model-${key}`} className="section-gap">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-2/3 rounded-md" />
              <Skeleton className="h-4 w-1/4 rounded-md" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-4 w-48 rounded-md" />
      </div>

      <Card className="section-gap">
        <Skeleton className="h-6 w-56 rounded-md" />
        <div className="grid grid-cols-[160px_1fr_1fr] gap-2">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={`compare-skeleton-metric-${row}`} className="contents">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="section-gap">
        <Skeleton className="h-6 w-56 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
        <Skeleton className="h-[300px] w-full rounded-md" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
      </Card>

      <Card className="section-gap">
        <Skeleton className="h-6 w-56 rounded-md" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={`compare-skeleton-diff-${row}`} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Card key={`compare-skeleton-insight-${key}`} className="section-gap">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-4/6 rounded-md" />
          </Card>
        ))}
      </section>
    </>
  )
}

export default function ModelCompareClient({
  initialLeftId,
  initialRightId,
}: {
  initialLeftId?: string | null
  initialRightId?: string | null
}) {
  const chartPalette = useChartPalette()
  const [models, setModels] = useState<ModelRecord[] | null>(null)
  const [selectedLeftId, setSelectedLeftId] = useState(initialLeftId ?? '')
  const [selectedRightId, setSelectedRightId] = useState(initialRightId ?? '')
  const modelRows = useMemo(() => models ?? [], [models])
  const isBootstrappingModels = models === null

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setModels(loadModelsFromStorage())
    })
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const leftId = useMemo(() => {
    if (selectedLeftId && modelRows.some((model) => model.id === selectedLeftId)) return selectedLeftId
    return modelRows[0]?.id ?? ''
  }, [selectedLeftId, modelRows])

  const rightId = useMemo(() => {
    if (modelRows.length === 0) return ''
    const hasSelectedRight =
      selectedRightId && modelRows.some((model) => model.id === selectedRightId)
    const candidate = hasSelectedRight
      ? selectedRightId
      : modelRows.find((model) => model.id !== leftId)?.id ?? modelRows[0]?.id ?? ''
    if (candidate !== leftId) return candidate
    return modelRows.find((model) => model.id !== leftId)?.id ?? candidate
  }, [selectedRightId, modelRows, leftId])

  const leftModel = useMemo(
    () => modelRows.find((model) => model.id === leftId) ?? null,
    [modelRows, leftId]
  )
  const rightModel = useMemo(
    () => modelRows.find((model) => model.id === rightId) ?? null,
    [modelRows, rightId]
  )

  const leftInsights = leftModel ? modelInsights(leftModel) : null
  const rightInsights = rightModel ? modelInsights(rightModel) : null
  const compareReady = Boolean(leftModel && rightModel && leftModel.id !== rightModel.id)

  const comparisonMetrics = useMemo<ComparisonMetric[]>(() => {
    if (!leftModel || !rightModel || !leftInsights || !rightInsights) return []

    const leftSummary = leftModel.summary
    const rightSummary = rightModel.summary

    const leftValidation = leftSummary?.validationScore ?? null
    const rightValidation = rightSummary?.validationScore ?? null
    const leftWinRate = leftSummary?.winRate ?? null
    const rightWinRate = rightSummary?.winRate ?? null
    const leftDrawdown = leftSummary?.maxDrawdown ?? null
    const rightDrawdown = rightSummary?.maxDrawdown ?? null
    const leftRelative = leftSummary?.relativePerformance ?? null
    const rightRelative = rightSummary?.relativePerformance ?? null

    return [
      {
        key: 'validation',
        label: 'Validation score',
        leftDisplay: leftValidation === null ? '—' : `${leftValidation}/100`,
        rightDisplay: rightValidation === null ? '—' : `${rightValidation}/100`,
        outcome: compareValues(leftValidation, rightValidation, 'higher', 0.2),
      },
      {
        key: 'win-rate',
        label: 'Win rate',
        leftDisplay: formatPct(leftWinRate),
        rightDisplay: formatPct(rightWinRate),
        outcome: compareValues(leftWinRate, rightWinRate, 'higher', 0.25),
      },
      {
        key: 'drawdown',
        label: 'Max drawdown',
        leftDisplay: formatPct(leftDrawdown),
        rightDisplay: formatPct(rightDrawdown),
        outcome: compareValues(leftDrawdown, rightDrawdown, 'lowerAbs', 0.2),
      },
      {
        key: 'relative',
        label: 'Relative performance',
        leftDisplay: formatPct(leftRelative),
        rightDisplay: formatPct(rightRelative),
        outcome: compareValues(leftRelative, rightRelative, 'higher', 0.25),
      },
      {
        key: 'signal-count',
        label: 'Signal count',
        leftDisplay: String(leftInsights.signalCount),
        rightDisplay: String(rightInsights.signalCount),
        outcome: compareValues(leftInsights.signalCount, rightInsights.signalCount, 'higher', 0.1),
      },
      {
        key: 'flip-rate',
        label: 'Flip rate',
        leftDisplay: `${(leftInsights.flipRate * 100).toFixed(1)}%`,
        rightDisplay: `${(rightInsights.flipRate * 100).toFixed(1)}%`,
        outcome: compareValues(leftInsights.flipRate, rightInsights.flipRate, 'lower', 0.01),
      },
    ]
  }, [leftModel, rightModel, leftInsights, rightInsights])

  const showBenchmark =
    compareReady &&
    leftModel?.validation.compareAgainstBenchmark &&
    rightModel?.validation.compareAgainstBenchmark &&
    leftModel.benchmark === rightModel.benchmark
  const benchmarkLabel = showBenchmark && leftModel ? leftModel.benchmark : null

  const chartData = useMemo<CompareChartPoint[]>(() => {
    if (!compareReady || !leftModel || !rightModel) return []
    const leftCurve = leftModel.equityCurve
    const rightCurve = rightModel.equityCurve
    const length = Math.max(leftCurve.length, rightCurve.length)
    const rows: CompareChartPoint[] = []

    for (let index = 0; index < length; index += 1) {
      const leftPoint = leftCurve[index]
      const rightPoint = rightCurve[index]
      const t = leftPoint?.t ?? rightPoint?.t ?? `P${index + 1}`
      rows.push({
        t,
        left: leftPoint?.strategy ?? null,
        right: rightPoint?.strategy ?? null,
        benchmark: benchmarkLabel ? leftPoint?.benchmark ?? rightPoint?.benchmark ?? null : null,
      })
    }

    return rows
  }, [compareReady, leftModel, rightModel, benchmarkLabel])

  const leftConditionLabels = leftModel ? leftModel.conditions.map(formatCondition) : []
  const rightConditionLabels = rightModel ? rightModel.conditions.map(formatCondition) : []
  const conditionDiff = leftConditionLabels.join(' | ') !== rightConditionLabels.join(' | ')

  const tradeoffInsights = useMemo(() => {
    if (!leftModel || !rightModel || !leftInsights || !rightInsights) {
      return {
        left: ['Select two models to generate tradeoff insights.'],
        right: ['Select two models to generate tradeoff insights.'],
        bestUseCase: 'Choose two validated models to view an actionable recommendation.',
      }
    }

    const leftSummary = leftModel.summary
    const rightSummary = rightModel.summary
    const leftDrawdown = leftSummary ? Math.abs(leftSummary.maxDrawdown) : null
    const rightDrawdown = rightSummary ? Math.abs(rightSummary.maxDrawdown) : null

    const leftStrengths: string[] = []
    const rightStrengths: string[] = []

    if (leftInsights.flipRate + 0.03 < rightInsights.flipRate) {
      leftStrengths.push('More stable with fewer regime flips.')
      rightStrengths.push('More reactive, but flip behavior is less stable.')
    } else if (rightInsights.flipRate + 0.03 < leftInsights.flipRate) {
      rightStrengths.push('More stable with fewer regime flips.')
      leftStrengths.push('More reactive, but flip behavior is less stable.')
    }

    if (leftSummary && rightSummary) {
      if (leftSummary.relativePerformance > rightSummary.relativePerformance + 0.8) {
        leftStrengths.push('Stronger baseline outperformance in validation period.')
      } else if (rightSummary.relativePerformance > leftSummary.relativePerformance + 0.8) {
        rightStrengths.push('Stronger baseline outperformance in validation period.')
      }

      if (leftSummary.winRate > rightSummary.winRate + 1.5) {
        leftStrengths.push('Higher hit rate across completed signal windows.')
      } else if (rightSummary.winRate > leftSummary.winRate + 1.5) {
        rightStrengths.push('Higher hit rate across completed signal windows.')
      }
    }

    if (leftDrawdown !== null && rightDrawdown !== null) {
      if (leftDrawdown + 0.8 < rightDrawdown) {
        leftStrengths.push('Lower drawdown profile under stress periods.')
      } else if (rightDrawdown + 0.8 < leftDrawdown) {
        rightStrengths.push('Lower drawdown profile under stress periods.')
      }
    }

    if (leftInsights.signalCount > rightInsights.signalCount + 2) {
      leftStrengths.push('Generates more opportunities from the same market history.')
    } else if (rightInsights.signalCount > leftInsights.signalCount + 2) {
      rightStrengths.push('Generates more opportunities from the same market history.')
    }

    if (leftStrengths.length === 0) {
      leftStrengths.push('Differences are marginal; profile is close to Model B.')
    }
    if (rightStrengths.length === 0) {
      rightStrengths.push('Differences are marginal; profile is close to Model A.')
    }

    let bestUseCase = 'Use the higher-stability model for deployment and the other for exploratory variants.'

    if (
      leftInsights.flipRate + 0.03 < rightInsights.flipRate &&
      leftDrawdown !== null &&
      rightDrawdown !== null &&
      leftDrawdown + 0.8 < rightDrawdown
    ) {
      bestUseCase = 'Choose Model A for cleaner trend following; choose Model B for faster responsiveness.'
    } else if (
      rightInsights.flipRate + 0.03 < leftInsights.flipRate &&
      leftDrawdown !== null &&
      rightDrawdown !== null &&
      rightDrawdown + 0.8 < leftDrawdown
    ) {
      bestUseCase = 'Choose Model B for cleaner trend following; choose Model A for faster responsiveness.'
    } else if (leftSummary && rightSummary) {
      if (leftSummary.relativePerformance > rightSummary.relativePerformance + 1) {
        bestUseCase = 'Model A fits primary deployment; keep Model B for alternative regime checks.'
      } else if (rightSummary.relativePerformance > leftSummary.relativePerformance + 1) {
        bestUseCase = 'Model B fits primary deployment; keep Model A for alternative regime checks.'
      }
    }

    return {
      left: leftStrengths.slice(0, 3),
      right: rightStrengths.slice(0, 3),
      bestUseCase,
    }
  }, [leftModel, rightModel, leftInsights, rightInsights])

  const compareHref =
    leftId && rightId
      ? `/models/compare?left=${encodeURIComponent(leftId)}&right=${encodeURIComponent(rightId)}`
      : '/models/compare'
  const trackedComparePairsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!compareReady || !leftModel || !rightModel) return
    const pairKey = `${leftModel.id}::${rightModel.id}`
    if (trackedComparePairsRef.current.has(pairKey)) return
    trackedComparePairsRef.current.add(pairKey)
    trackEvent('complete_compare', {
      left_model_id: leftModel.id,
      right_model_id: rightModel.id,
      left_signal_count: leftInsights?.signalCount ?? null,
      right_signal_count: rightInsights?.signalCount ?? null,
    })
  }, [compareReady, leftModel, rightModel, leftInsights?.signalCount, rightInsights?.signalCount])

  return (
    <div className="container-lg section-gap">
        <PageHeader
          title="Compare in Model Lab"
          subtitle="Review two model versions side by side and inspect the tradeoffs."
          action={
            <Link href="/models" className={buttonClass({ variant: 'ghost' })}>
              Back to Model Lab
            </Link>
          }
        />

        {isBootstrappingModels ? (
          <ComparePageSkeleton />
        ) : modelRows.length === 0 ? (
          <Card>
            <EmptyState
              title="No models to compare"
              description="Create and validate at least two models to unlock side-by-side comparison."
              action={
                <Link href="/models/new" className={buttonClass({ variant: 'primary' })}>
                  New model
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="section-gap">
                <div className="text-filter-label">Model A</div>
                <Select value={leftId} onChange={(event) => setSelectedLeftId(event.target.value)}>
                  {modelRows.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </Select>
                {leftModel && leftInsights ? (
                  <>
                    <div>
                      <h2 className="text-card-title text-content-primary">{leftModel.name}</h2>
                      <div className="text-caption mt-1 text-content-muted">
                        {leftModel.ticker ? leftModel.ticker : leftModel.universe}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{leftInsights.personality}</Badge>
                      <Badge variant="neutral">{leftInsights.confidence} confidence</Badge>
                    </div>
                    <div className="surface-tertiary px-3 py-2">
                      <div className="text-label-md text-content-primary">
                        {leftInsights.topInsightHeadline}
                      </div>
                      <div className="text-caption text-content-secondary">
                        {leftInsights.topInsightSummary}
                      </div>
                    </div>
                    <div className="text-caption numeric-tabular text-content-muted">
                      Confidence score: {leftInsights.confidencePct}
                    </div>
                  </>
                ) : null}
              </Card>

              <Card className="section-gap">
                <div className="text-filter-label">Model B</div>
                <Select value={rightId} onChange={(event) => setSelectedRightId(event.target.value)}>
                  {modelRows.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </Select>
                {rightModel && rightInsights ? (
                  <>
                    <div>
                      <h2 className="text-card-title text-content-primary">{rightModel.name}</h2>
                      <div className="text-caption mt-1 text-content-muted">
                        {rightModel.ticker ? rightModel.ticker : rightModel.universe}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{rightInsights.personality}</Badge>
                      <Badge variant="neutral">{rightInsights.confidence} confidence</Badge>
                    </div>
                    <div className="surface-tertiary px-3 py-2">
                      <div className="text-label-md text-content-primary">
                        {rightInsights.topInsightHeadline}
                      </div>
                      <div className="text-caption text-content-secondary">
                        {rightInsights.topInsightSummary}
                      </div>
                    </div>
                    <div className="text-caption numeric-tabular text-content-muted">
                      Confidence score: {rightInsights.confidencePct}
                    </div>
                  </>
                ) : null}
              </Card>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={compareHref}
                className={buttonClass({ variant: 'secondary' })}
                aria-disabled={!compareReady}
              >
                Refresh compare
              </Link>
              {compareReady ? null : (
                <span className="text-caption text-content-muted">
                  Select two different models to compare.
                </span>
              )}
            </div>

            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Summary comparison</h3>
              <div className="grid grid-cols-[160px_1fr_1fr] gap-2 text-sm">
                <div className="text-filter-label">Metric</div>
                <div className="text-filter-label">Model A</div>
                <div className="text-filter-label">Model B</div>
                {comparisonMetrics.map((metric) => (
                  <div key={metric.key} className="contents">
                    <div className="surface-tertiary px-3 py-2 text-content-secondary">
                      {metric.label}
                    </div>
                    <div className="surface-secondary px-3 py-2">
                      <div className="text-label-md text-content-primary numeric-tabular">{metric.leftDisplay}</div>
                      <Badge variant={sideVariant(metric.outcome, 'left')} className="mt-1">
                        {sideLabel(metric.outcome, 'left')}
                      </Badge>
                    </div>
                    <div className="surface-secondary px-3 py-2">
                      <div className="text-label-md text-content-primary numeric-tabular">{metric.rightDisplay}</div>
                      <Badge variant={sideVariant(metric.outcome, 'right')} className="mt-1">
                        {sideLabel(metric.outcome, 'right')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Equity curve comparison</h3>
              <p className="text-body">Model A and B strategy curves on the same axis.</p>
              <ChartContainer className="h-[300px]">
                {({ width, height, palette }) => (
                  <LineChart width={width} height={height} data={chartData} margin={CHART_MARGINS.stock}>
                      <CartesianGrid strokeDasharray="2 6" stroke={palette.grid} vertical={false} />
                      <XAxis dataKey="t" tick={{ fontSize: 11, fill: palette.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: palette.textMuted }}
                        axisLine={false}
                        tickLine={false}
                        width={42}
                        tickFormatter={(value) => Number(value).toFixed(0)}
                      />
                      <Tooltip
                        content={
                          <CompareTooltip
                            leftLabel={leftModel?.name ?? 'Model A'}
                            rightLabel={rightModel?.name ?? 'Model B'}
                            benchmarkLabel={benchmarkLabel}
                            palette={palette}
                          />
                        }
                        cursor={{ stroke: palette.neutral, strokeOpacity: 0.24 }}
                      />
                      <Line type="monotone" dataKey="left" stroke={palette.secondary} strokeWidth={2.4} dot={false} />
                      <Line type="monotone" dataKey="right" stroke={palette.primary} strokeWidth={2.4} dot={false} />
                      {benchmarkLabel ? (
                        <Line
                          type="monotone"
                          dataKey="benchmark"
                          stroke={palette.neutral}
                          strokeWidth={1.8}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      ) : null}
                  </LineChart>
                )}
              </ChartContainer>
              <div className="text-caption flex flex-wrap items-center gap-2 text-content-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartPalette.secondary }} />
                  Model A
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartPalette.primary }} />
                  Model B
                </span>
                {benchmarkLabel ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartPalette.neutral }} />
                    {benchmarkLabel}
                  </span>
                ) : null}
              </div>
            </Card>

            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Rule and configuration diff</h3>
              {leftModel && rightModel ? (
                <div className="space-y-2 text-sm">
                  {[
                    {
                      label: 'Lookback',
                      left: `${leftModel.lookbackDays}d`,
                      right: `${rightModel.lookbackDays}d`,
                    },
                    {
                      label: 'Logic mode',
                      left: leftModel.logicMode === 'all' ? 'Match all' : 'Match any',
                      right: rightModel.logicMode === 'all' ? 'Match all' : 'Match any',
                    },
                    {
                      label: 'Holding horizon',
                      left: `${leftModel.validation.holdingHorizonDays}d`,
                      right: `${rightModel.validation.holdingHorizonDays}d`,
                    },
                    {
                      label: 'Risk mode',
                      left: leftModel.validation.riskMode,
                      right: rightModel.validation.riskMode,
                    },
                  ].map((row) => {
                    const changed = row.left !== row.right
                    return (
                      <CompareDiffRow
                        key={row.label}
                        label={row.label}
                        left={row.left}
                        right={row.right}
                        changed={changed}
                      />
                    )
                  })}

                  <div
                    className={`rounded-[var(--radius-md)] border px-3 py-2 ${
                      conditionDiff
                        ? 'signal-bg-warn'
                        : 'border-border bg-surface-card'
                    }`}
                  >
                    <div className="text-label-md text-content-secondary">Conditions</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <ul className="space-y-1 text-content-primary">
                        {leftConditionLabels.map((condition, index) => (
                          <li key={`left-condition-${index}`}>{condition}</li>
                        ))}
                      </ul>
                      <ul className="space-y-1 text-content-primary">
                        {rightConditionLabels.map((condition, index) => (
                          <li key={`right-condition-${index}`}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="section-gap">
                <h3 className="text-card-title text-content-primary">Where Model A is stronger</h3>
                <ul className="list-disc space-y-1 pl-5 text-body">
                  {tradeoffInsights.left.map((item, index) => (
                    <li key={`left-stronger-${index}`}>{item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="section-gap">
                <h3 className="text-card-title text-content-primary">Where Model B is stronger</h3>
                <ul className="list-disc space-y-1 pl-5 text-body">
                  {tradeoffInsights.right.map((item, index) => (
                    <li key={`right-stronger-${index}`}>{item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="section-gap">
                <h3 className="text-card-title text-content-primary">Best use case</h3>
                <p className="text-body">{tradeoffInsights.bestUseCase}</p>
              </Card>
            </section>
          </>
        )}
      </div>
  )
}
