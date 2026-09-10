'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import MetricGrid from '@/components/page/MetricGrid'
import SystemProfileBlob from '@/components/page/SystemProfileBlob'
import DismissibleLocalHint from '@/components/onboarding/DismissibleLocalHint'
import SignalDistributionBubbleCluster, {
  deriveSignalCompositionInsights,
} from '@/components/SignalDistributionBubbleCluster'
import { buttonClass } from '@/components/ui/Button'
import ChartContainer, {
  CHART_MARGINS,
  type ChartPalette,
  ChartTooltipCard,
  useChartPalette,
} from '@/components/charts/ChartContainer'
import {
  upsertModel,
  duplicateModelRecord,
  getModelById,
  rerunModelValidation,
} from '@/lib/model-store-client'
import {
  buildModelRecord,
  buildModelSystemDescription,
  deriveModelQualitativeState,
  modelSummaryResult,
  universeLabel,
  type ModelQualitativeState,
  type ModelRecord,
} from '@/lib/model-builder'
import { signalHeadlineFromInputs } from '@/lib/signalSummary'
import { buildSampleModelInput, SAMPLE_MODEL_ID } from '@/lib/model-samples'
import { trackEvent } from '@/lib/analytics'

function formatDate(value: string | null): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function signalToneClass(signal: ModelRecord['currentSignal']): string {
  if (!signal) return 'text-content-secondary'
  if (signal.direction === 'bullish') return 'signal-bullish'
  if (signal.direction === 'bearish') return 'signal-bearish'
  return 'signal-neutral'
}

function statusVariant(status: ModelRecord['status']): 'success' | 'warning' {
  return status === 'validated' ? 'success' : 'warning'
}

function qualitativeStateVariant(state: ModelQualitativeState): 'success' | 'neutral' | 'warning' {
  if (state === 'Constructive') return 'success'
  if (state === 'Mixed') return 'neutral'
  return 'warning'
}

type CurveTooltipPayload = {
  t: string
  strategy: number
  benchmark: number
}

function ValidationTooltip({
  active,
  payload,
  palette,
}: {
  active?: boolean
  payload?: Array<{
    payload?: CurveTooltipPayload
  }>
  palette: ChartPalette
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <ChartTooltipCard
      title={point.t}
      rows={[
        {
          label: 'Strategy',
          value: point.strategy.toFixed(2),
          swatchColor: palette.secondary,
        },
        {
          label: 'Benchmark',
          value: point.benchmark.toFixed(2),
          swatchColor: palette.neutral,
        },
        {
          label: 'Spread',
          value: `${(point.strategy - point.benchmark) >= 0 ? '+' : ''}${(point.strategy - point.benchmark).toFixed(2)}`,
        },
      ]}
    />
  )
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hasCondition(
  conditions: ModelRecord['conditions'],
  metric: string,
  operator: 'above' | 'below',
  thresholdTest: (value: number) => boolean
): boolean {
  return conditions.some(
    (condition) =>
      condition.metric === metric &&
      condition.operator === operator &&
      thresholdTest(condition.value)
  )
}

type ConfidenceLabel = 'Low' | 'Moderate' | 'High'
type DeltaDirection = 'up' | 'down' | 'flat'

function directionFromDelta(value: number, threshold: number): DeltaDirection {
  if (value > threshold) return 'up'
  if (value < -threshold) return 'down'
  return 'flat'
}

function directionArrow(direction: DeltaDirection): string {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return '→'
}

function directionToneClass(direction: DeltaDirection): string {
  if (direction === 'up') return 'signal-bullish'
  if (direction === 'down') return 'signal-bearish'
  return 'text-content-muted'
}

function frequencyToneClass(direction: DeltaDirection): string {
  if (direction === 'up') return 'text-accent-text'
  if (direction === 'down') return 'signal-warn'
  return 'text-content-muted'
}

function markerColor(signal: ModelRecord['signals'][number]['signal']): string {
  if (signal === 'bullish') return '#12B76A'
  if (signal === 'bearish') return '#E23D2E'
  return '#64768A'
}

function buildMetricHints(summary: NonNullable<ModelRecord['summary']>): {
  validation: string
  winRate: string
  drawdown: string
  relative: string
} {
  const validation =
    summary.validationScore >= 72
      ? 'High quality'
      : summary.validationScore >= 58
        ? 'Developing edge'
        : 'Needs refinement'
  const winRate =
    summary.winRate >= 58 ? 'Above average' : summary.winRate >= 50 ? 'Near average' : 'Below average'
  const drawdownAbs = Math.abs(summary.maxDrawdown)
  const drawdown =
    drawdownAbs <= 6 ? 'Controlled risk' : drawdownAbs <= 12 ? 'Moderate risk' : 'Elevated risk'
  const relative =
    summary.relativePerformance >= 2
      ? 'Outperforming baseline'
      : summary.relativePerformance >= -1
        ? 'Near baseline'
        : 'Lagging baseline'

  return { validation, winRate, drawdown, relative }
}

function buildBenchmarkInterpretation({
  relativePerformance,
  riskScore,
  flipRate,
  benchmark,
}: {
  relativePerformance: number
  riskScore: number
  flipRate: number
  benchmark: string
}): string {
  if (relativePerformance >= 2 && flipRate <= 0.28) {
    return `Outperforms ${benchmark} in trending stretches, with minor weakness during sharp reversals.`
  }
  if (relativePerformance >= 0 && riskScore >= 55) {
    return `Tracks ahead of ${benchmark} when direction is stable, but gives back edge in turbulence.`
  }
  if (relativePerformance < 0 && flipRate > 0.32) {
    return `Underperforms ${benchmark} during choppy regimes where frequent flips reduce signal quality.`
  }
  return `Performance versus ${benchmark} is mixed, improving mainly when trend structure strengthens.`
}

type AnalyticsEntrySource =
  | 'homepage_sample'
  | 'models_hub'
  | 'stock_page'
  | 'screener'
  | 'compare'
  | 'direct'

function coerceEntrySource(value: string | null | undefined): AnalyticsEntrySource | null {
  if (
    value === 'homepage_sample' ||
    value === 'models_hub' ||
    value === 'stock_page' ||
    value === 'screener' ||
    value === 'compare' ||
    value === 'direct'
  ) {
    return value
  }
  return null
}

function inferModelEntrySource(entrySourceHint: string | null | undefined): AnalyticsEntrySource {
  const fromHint = coerceEntrySource(entrySourceHint)
  if (fromHint) return fromHint
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const referrerPath = new URL(document.referrer).pathname
      if (referrerPath === '/') return 'homepage_sample'
      if (referrerPath.startsWith('/models/compare')) return 'compare'
      if (referrerPath === '/models') return 'models_hub'
      if (referrerPath.startsWith('/stocks/')) return 'stock_page'
      if (referrerPath.startsWith('/screener')) return 'screener'
    } catch {
      // Ignore referrer parse failures.
    }
  }
  return 'direct'
}

export default function ModelDetailClient({
  modelId,
  entrySourceHint = null,
}: {
  modelId: string
  entrySourceHint?: string | null
}) {
  const router = useRouter()
  const chartPalette = useChartPalette()
  const [model, setModel] = useState<ModelRecord | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isRerunning, setIsRerunning] = useState(false)
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')
  const viewedModelRef = useRef<string | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const existing = getModelById(modelId)
      if (existing) {
        setModel(existing)
        return
      }
      if (modelId === SAMPLE_MODEL_ID) {
        const sample = buildModelRecord(buildSampleModelInput(), {
          id: SAMPLE_MODEL_ID,
          createdAt: '2026-01-05T00:00:00.000Z',
          status: 'validated',
        })
        upsertModel(sample)
        setModel(sample)
        return
      }
      setModel(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [modelId])

  useEffect(() => {
    if (!model) return
    if (viewedModelRef.current === model.id) return
    viewedModelRef.current = model.id
    const entrySource = inferModelEntrySource(entrySourceHint)
    trackEvent('view_model', {
      model_id: model.id,
      is_sample: model.id === SAMPLE_MODEL_ID,
      entry_source: entrySource,
    })
  }, [model, entrySourceHint])

  const summary = model?.summary ?? null
  const signalHeadline =
    model?.currentSignal
      ? signalHeadlineFromInputs(model.currentSignal.direction, model.currentSignal.conviction)
      : 'No actionable edge'

  if (!model) {
    return (
      <div className="container-md section-gap">
        <Card className="section-gap text-center">
          <h2 className="text-section-title text-content-primary">Model not found</h2>
          <p className="text-body">This model may be missing from local storage or was never created.</p>
          <div>
            <Link href="/models" className={buttonClass({ variant: 'primary' })}>
              Back to Model Lab
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const qualitativeState = deriveModelQualitativeState(model.profileDimensions)
  const modelDescription = buildModelSystemDescription({
    conditions: model.conditions,
    logicMode: model.logicMode,
  })
  const stockContextHref = model.ticker
    ? `/stocks/${model.ticker}?from=model&modelName=${encodeURIComponent(model.name)}`
    : null
  const scoreByLabel = new Map(model.profileDimensions.map((dimension) => [dimension.label, dimension.score]))
  const trendScore = scoreByLabel.get('Trend') ?? 50
  const riskScore = scoreByLabel.get('Risk') ?? 50
  const stabilityScore = scoreByLabel.get('Stability') ?? 50
  const momentumScore = scoreByLabel.get('Momentum') ?? 50

  const signalRows = model.signals
  const recentRows = signalRows.slice(0, 5)
  const historicalAvgReturn = average(signalRows.map((row) => row.returnPct))
  const recentAvgReturn = average(recentRows.map((row) => row.returnPct))
  const convictionAvg = average(signalRows.map((row) => row.conviction))
  const flipCount = signalRows.reduce((count, row, index) => {
    if (index === 0) return count
    const previous = signalRows[index - 1]
    return previous && previous.signal !== row.signal ? count + 1 : count
  }, 0)
  const flipRate = signalRows.length > 1 ? flipCount / (signalRows.length - 1) : 0
  const metricHints = summary
    ? buildMetricHints(summary)
    : {
        validation: 'No run yet',
        winRate: 'No run yet',
        drawdown: 'No run yet',
        relative: 'No run yet',
      }

  const keyFindings: string[] = []
  if (summary && summary.relativePerformance >= 2) {
    keyFindings.push(
      `Model is outperforming ${model.benchmark} with strongest results in directional phases.`
    )
  } else if (summary && summary.relativePerformance <= -2) {
    keyFindings.push(
      `Model is lagging ${model.benchmark}, especially when market direction changes quickly.`
    )
  } else {
    keyFindings.push(
      `Performance is close to ${model.benchmark}, with edge concentrated in cleaner regimes.`
    )
  }

  if (flipRate <= 0.24 && stabilityScore >= 58) {
    keyFindings.push('Signal behavior is stable with limited regime flipping.')
  } else if (flipRate >= 0.34 || stabilityScore < 50) {
    keyFindings.push('Frequent direction changes are reducing reliability in choppy periods.')
  } else {
    keyFindings.push('Stability is moderate; direction changes still require confirmation.')
  }

  if (recentAvgReturn >= historicalAvgReturn + 0.15) {
    keyFindings.push('Recent trade outcomes are improving versus the longer historical average.')
  } else if (recentAvgReturn <= historicalAvgReturn - 0.15) {
    keyFindings.push('Recent trade outcomes are softer than the model’s historical average.')
  } else {
    keyFindings.push('Recent behavior is broadly in line with historical model behavior.')
  }

  const strengths: string[] = []
  if (trendScore >= 60) strengths.push('Captures trend continuation when directional pressure persists.')
  if (riskScore >= 58) strengths.push('Absorbs volatility better than average with tighter drawdown control.')
  if (stabilityScore >= 58 && flipRate <= 0.28) strengths.push('Maintains consistent signals with a low flip cadence.')
  if (momentumScore >= 58) strengths.push('Momentum alignment improves follow-through after entry signals.')
  while (strengths.length < 2) {
    strengths.push('Shows repeatable structure when trend and conviction move together.')
  }

  const weaknesses: string[] = []
  if (trendScore < 54) weaknesses.push('Loses edge when trend quality weakens or quickly reverses.')
  if (riskScore < 52 || (summary && Math.abs(summary.maxDrawdown) > 10)) {
    weaknesses.push('Volatility spikes can widen drawdowns and reduce consistency.')
  }
  if (stabilityScore < 54 || flipRate > 0.3) {
    weaknesses.push('Higher flip frequency can dilute conviction in sideways markets.')
  }
  if (summary && summary.relativePerformance < 0) {
    weaknesses.push('Baseline-relative performance slips when confirmations are incomplete.')
  }
  while (weaknesses.length < 2) {
    weaknesses.push('Signal quality degrades when regime transitions accelerate.')
  }

  const worksBest: string[] = []
  worksBest.push('Persistent trend environments with stable direction.')
  if (momentumScore >= 55) worksBest.push('Sessions where momentum confirms the primary trend.')
  if (convictionAvg >= 0.55) worksBest.push('Higher-conviction setups where follow-through is present.')
  if (worksBest.length < 3) worksBest.push('Lower-noise periods with fewer abrupt reversals.')

  const cautious: string[] = []
  cautious.push('Volatility spikes or sudden macro-driven reversals.')
  if (flipRate > 0.3 || stabilityScore < 54) cautious.push('Range-bound periods with frequent signal flips.')
  if (recentAvgReturn < historicalAvgReturn - 0.1) cautious.push('Periods where recent outcomes weaken versus history.')
  if (cautious.length < 3) cautious.push('Low-conviction stretches without clear directional confirmation.')

  const benchmarkInterpretation = summary
    ? buildBenchmarkInterpretation({
        relativePerformance: summary.relativePerformance,
        riskScore,
        flipRate,
        benchmark: model.benchmark,
      })
    : `Benchmark comparison will appear after validation versus ${model.benchmark}.`
  const createdAtLabel = formatDateTime(model.createdAt)
  const lastRunLabel = formatDateTime(model.lastRunAt)
  const diagnosticsText = model.diagnostics.notes.join(' ').toLowerCase()
  const usesHistoricalValidation =
    diagnosticsText.includes('historical daily data') &&
    !diagnosticsText.includes('showing preview output')
  const variationMeta =
    model.variationLabel ??
    (model.sourceKind === 'variation' ? 'Variation generated from previous model configuration.' : null)
  const parentModel = model.variationOfModelId ? getModelById(model.variationOfModelId) : null

  const trendMomentumEmphasis =
    hasCondition(model.conditions, 'Trend', 'above', (value) => value >= 55) ||
    hasCondition(model.conditions, 'Momentum', 'above', (value) => value >= 55) ||
    (trendScore >= 58 && momentumScore >= 56)
  const volatilityFilter =
    hasCondition(model.conditions, 'Risk', 'below', (value) => value <= 50) ||
    riskScore >= 56
  const stabilityFilter =
    hasCondition(model.conditions, 'Stability', 'above', (value) => value >= 55) ||
    hasCondition(model.conditions, 'Flip rate', 'below', (value) => value <= 50) ||
    (stabilityScore >= 56 && flipRate <= 0.3)
  const confirmationFilter = hasCondition(model.conditions, 'Confirmation', 'above', (value) => value >= 55)

  const personalityLabel =
    volatilityFilter && stabilityFilter && !trendMomentumEmphasis
      ? 'Defensive system'
      : trendMomentumEmphasis && momentumScore > trendScore + 3
        ? 'Momentum-driven model'
        : trendMomentumEmphasis && volatilityFilter
          ? 'Trend follower'
          : 'Balanced signal filter'

  const whyDriver = trendMomentumEmphasis
    ? momentumScore > trendScore + 2
      ? 'Momentum continuation drives entries during persistent directional bursts.'
      : 'Trend persistence drives entries when directional structure is intact.'
    : 'Edge relies on selective setup quality rather than directional aggression.'
  const whyFilter =
    volatilityFilter && stabilityFilter
      ? 'Risk and stability filters suppress exposure during noisy regime shifts.'
      : volatilityFilter
        ? 'Volatility filter limits downside during abrupt risk spikes.'
        : stabilityFilter
          ? 'Stability filter avoids frequent signal reversals in range-bound phases.'
          : confirmationFilter
            ? 'Confirmation gating blocks weaker setups before entry.'
            : 'Filtering is lighter, so unstable periods have greater impact.'
  const whyEdgeSource =
    trendMomentumEmphasis && volatilityFilter
      ? 'Captures sustained moves while filtering unstable regimes.'
      : confirmationFilter
        ? 'Edge comes from validated setups rather than raw signal frequency.'
        : 'Edge comes from avoiding low-quality signals more than maximizing upside.'

  const returnDispersion = stdDev(signalRows.map((row) => row.returnPct))
  const consistencyScore = summary
    ? clamp((summary.winRate - 45) / 20, 0, 1) * 0.55 +
      clamp((summary.relativePerformance + 2) / 8, 0, 1) * 0.45
    : 0.45
  const stabilityScoreNorm = clamp(1 - flipRate / 0.42, 0, 1)
  const dispersionScoreNorm = clamp(1 - returnDispersion / 2.2, 0, 1)
  const sampleScoreNorm = clamp(signalRows.length / 20, 0, 1)
  const confidenceScore =
    stabilityScoreNorm * 0.4 +
    consistencyScore * 0.32 +
    dispersionScoreNorm * 0.18 +
    sampleScoreNorm * 0.1
  const confidencePct = Math.round(confidenceScore * 100)
  const confidence: ConfidenceLabel =
    confidenceScore >= 0.68 ? 'High' : confidenceScore >= 0.45 ? 'Moderate' : 'Low'
  const confidenceHelper =
    confidence === 'High'
      ? 'Stable flips, consistent outcomes, and tighter dispersion.'
      : confidence === 'Moderate'
        ? 'Some consistency, with moderate regime sensitivity.'
        : 'Higher instability or dispersed outcomes reduce trust.'

  const whatChanged: string[] = []
  let variationDelta:
    | {
        performance: number | null
        stability: number
        frequency: number
      }
    | null = null
  if (parentModel) {
    if (model.lookbackDays !== parentModel.lookbackDays) {
      const direction = model.lookbackDays > parentModel.lookbackDays ? 'increased' : 'reduced'
      whatChanged.push(`Lookback ${direction}: ${parentModel.lookbackDays}d -> ${model.lookbackDays}d.`)
    }
    if (model.logicMode !== parentModel.logicMode) {
      whatChanged.push(
        `Logic mode changed: ${parentModel.logicMode === 'all' ? 'Match all' : 'Match any'} -> ${model.logicMode === 'all' ? 'Match all' : 'Match any'}.`
      )
    }

    const maxConditions = Math.max(model.conditions.length, parentModel.conditions.length)
    for (let index = 0; index < maxConditions; index += 1) {
      const current = model.conditions[index]
      const previous = parentModel.conditions[index]
      if (!current && !previous) continue
      if (current && !previous) {
        whatChanged.push(
          `Rule ${index + 1} added: ${current.metric} ${current.operator === 'above' ? '>' : '<'} ${current.value}.`
        )
        continue
      }
      if (!current && previous) {
        whatChanged.push(`Rule ${index + 1} removed from prior model.`)
        continue
      }
      if (!current || !previous) continue

      if (
        current.metric !== previous.metric ||
        current.operator !== previous.operator ||
        current.value !== previous.value
      ) {
        if (current.metric === previous.metric && current.operator === previous.operator) {
          const direction = current.value > previous.value ? 'raised' : 'lowered'
          whatChanged.push(`Rule ${index + 1} threshold ${direction}: ${previous.value} -> ${current.value}.`)
        } else {
          whatChanged.push(
            `Rule ${index + 1} changed: ${previous.metric} ${previous.operator === 'above' ? '>' : '<'} ${previous.value} -> ${current.metric} ${current.operator === 'above' ? '>' : '<'} ${current.value}.`
          )
        }
      }
      if (whatChanged.length >= 4) break
    }
    if (whatChanged.length === 0) {
      whatChanged.push('No major parameter differences detected versus the parent model.')
    }

    const parentSummary = parentModel.summary
    const parentFlipCount = parentModel.signals.reduce((count, row, index) => {
      if (index === 0) return count
      const previous = parentModel.signals[index - 1]
      return previous && previous.signal !== row.signal ? count + 1 : count
    }, 0)
    const parentFlipRate =
      parentModel.signals.length > 1 ? parentFlipCount / (parentModel.signals.length - 1) : 0
    variationDelta = {
      performance:
        summary && parentSummary ? summary.relativePerformance - parentSummary.relativePerformance : null,
      stability: parentFlipRate - flipRate,
      frequency:
        model.validation.signalUpdateFrequency === parentModel.validation.signalUpdateFrequency
          ? 0
          : model.validation.signalUpdateFrequency === 'daily'
            ? 1
            : -1,
    }
  }

  const effectOfChange = (() => {
    if (!parentModel || !variationDelta) return null

    const stabilityDelta = variationDelta.stability
    const relativeDelta = variationDelta.performance
    const cadenceShift =
      model.validation.signalUpdateFrequency === parentModel.validation.signalUpdateFrequency
        ? 'Signal cadence is unchanged.'
        : model.validation.signalUpdateFrequency === 'weekly'
          ? 'Signal frequency is slower with fewer refresh points.'
          : 'Signal frequency is faster with more refresh points.'

    const stabilitySentence =
      stabilityDelta > 0.04
        ? 'Stability improved with fewer regime flips.'
        : stabilityDelta < -0.04
          ? 'Stability weakened as flip cadence increased.'
          : 'Stability remained broadly similar to the parent model.'
    const performanceSentence =
      relativeDelta === null
        ? 'Performance impact will be clearer after additional validation runs.'
        : relativeDelta >= 1
          ? `Relative performance improved by ${relativeDelta.toFixed(1)}%.`
          : relativeDelta <= -1
            ? `Relative performance declined by ${Math.abs(relativeDelta).toFixed(1)}%.`
            : 'Relative performance changed only marginally.'

    return `${stabilitySentence} ${performanceSentence} ${cadenceShift}`
  })()

  const performanceDirection = directionFromDelta(variationDelta?.performance ?? 0, 0.7)
  const stabilityDirection = directionFromDelta(variationDelta?.stability ?? 0, 0.03)
  const frequencyDirection = directionFromDelta(variationDelta?.frequency ?? 0, 0.1)
  const performanceDeltaLabel =
    variationDelta?.performance === null || variationDelta === null
      ? 'n/a'
      : `${variationDelta.performance >= 0 ? '+' : ''}${variationDelta.performance.toFixed(1)}%`
  const stabilityDeltaLabel =
    variationDelta === null
      ? 'n/a'
      : `${variationDelta.stability >= 0 ? '+' : ''}${(variationDelta.stability * 100).toFixed(1)}%`
  const frequencyDeltaLabel =
    variationDelta === null
      ? 'n/a'
      : variationDelta.frequency > 0
        ? 'faster'
        : variationDelta.frequency < 0
          ? 'slower'
          : 'unchanged'
  const topInsightHeadline = `${personalityLabel} · ${confidence} confidence`
  const topInsightSummary =
    trendMomentumEmphasis && volatilityFilter
      ? 'Performs best in directional markets, weaker during volatility spikes.'
      : stabilityFilter
        ? 'Best in cleaner regimes, but less reliable through rapid reversals.'
        : 'Edge appears selective and can fade in unstable market structure.'
  const inferredComposition = signalRows.reduce(
    (acc, row) => {
      if (row.signal === 'bullish') acc.bullishCount += 1
      else if (row.signal === 'neutral') acc.neutralCount += 1
      else acc.bearishCount += 1
      return acc
    },
    { bullishCount: 0, neutralCount: 0, bearishCount: 0 }
  )
  if (
    inferredComposition.bullishCount + inferredComposition.neutralCount + inferredComposition.bearishCount === 0 &&
    model.currentSignal
  ) {
    if (model.currentSignal.direction === 'bullish') inferredComposition.bullishCount = 1
    else if (model.currentSignal.direction === 'neutral') inferredComposition.neutralCount = 1
    else inferredComposition.bearishCount = 1
  }
  const regimeComposition =
    model.regimeComposition && model.regimeComposition.total > 0
      ? model.regimeComposition
      : {
          ...inferredComposition,
          total:
            inferredComposition.bullishCount +
            inferredComposition.neutralCount +
            inferredComposition.bearishCount,
        }
  const compositionInsights = deriveSignalCompositionInsights({
    bullishCount: regimeComposition.bullishCount,
    neutralCount: regimeComposition.neutralCount,
    bearishCount: regimeComposition.bearishCount,
  })
  const showActiveExposure = regimeComposition.total > 0 && regimeComposition.neutralCount > 0
  const modifyDraftPayload = {
    name: model.name,
    universe: model.universe,
    ticker: model.ticker,
    lookbackDays: model.lookbackDays,
    benchmark: model.benchmark,
    logicMode: model.logicMode,
    conditions: model.conditions.map((condition) => ({ ...condition })),
    holdingHorizonDays: model.validation.holdingHorizonDays,
    signalUpdateFrequency: model.validation.signalUpdateFrequency,
    compareAgainstBenchmark: model.validation.compareAgainstBenchmark,
    riskMode: model.validation.riskMode,
    sourceKind: model.sourceKind ?? 'manual',
    templateKey: model.templateKey ?? null,
    variationOfModelId: model.variationOfModelId ?? null,
    variationLabel: model.variationLabel ?? null,
  }
  const isSampleModel = model.id === SAMPLE_MODEL_ID
  const modifyHref = `/models/new?draft=${encodeURIComponent(JSON.stringify(modifyDraftPayload))}`
  const compareHref = parentModel
    ? `/models/compare?left=${encodeURIComponent(parentModel.id)}&right=${encodeURIComponent(model.id)}`
    : `/models/compare?left=${encodeURIComponent(model.id)}`

  const usageSignal =
    confidence === 'High'
      ? trendMomentumEmphasis
        ? 'Suitable for trending markets.'
        : 'Suitable with selective, confirmed setups.'
      : confidence === 'Moderate'
        ? 'Use cautiously in volatile conditions.'
        : flipRate > 0.3 || stabilityScore < 54
          ? 'Not reliable in sideways regimes.'
          : 'Use cautiously until stability improves.'

  const nextSteps: string[] = []
  if (flipRate > 0.3 || stabilityScore < 54) {
    nextSteps.push('Increase stability threshold or tighten the flip-rate filter.')
  }
  if (riskScore < 52 || (summary && Math.abs(summary.maxDrawdown) > 10)) {
    nextSteps.push('Tighten risk conditions or test conservative risk mode.')
  }
  if (summary && summary.relativePerformance < 0) {
    nextSteps.push('Compare this setup with a defensive variation and rerun validation.')
  }
  if (trendScore < 55) {
    nextSteps.push('Raise trend threshold or test a longer lookback window.')
  }
  if (nextSteps.length < 2) {
    nextSteps.push('Test a shorter lookback variation for faster signal response.')
  }

  const logicModeLabel = model.logicMode === 'all' ? 'all rule thresholds' : 'at least one rule threshold'
  const bearishRuleBias =
    hasCondition(model.conditions, 'Risk', 'above', (value) => value >= 55) ||
    hasCondition(model.conditions, 'Flip rate', 'above', (value) => value >= 52)
  const bearishSignalsPresent =
    signalRows.some((row) => row.signal === 'bearish') || model.currentSignal?.direction === 'bearish'

  const tradeExplanation = (row: ModelRecord['signals'][number]): string => {
    const conditionText =
      row.signal === 'bullish'
        ? trendMomentumEmphasis
          ? 'Trend and momentum thresholds aligned at trigger.'
          : confirmationFilter
            ? 'Confirmation filters approved the bullish trigger.'
            : `Bullish trigger matched ${logicModeLabel}.`
        : row.signal === 'bearish'
          ? bearishRuleBias
            ? 'Risk and instability thresholds supported the downside trigger.'
            : `Bearish trigger matched ${logicModeLabel}.`
          : `Neutral trigger matched ${logicModeLabel}.`
    const outcomeText =
      row.returnPct >= 0
        ? 'Price moved in the signal direction before exit.'
        : 'Follow-through failed before the fixed-horizon exit.'
    return `${conditionText} ${outcomeText}`
  }

  const byReturn = [...signalRows].sort((a, b) => b.returnPct - a.returnPct)
  const bestTrade = byReturn[0] ?? null
  const worstTrade = byReturn[byReturn.length - 1] ?? null
  const recentTrade = signalRows[0] ?? null
  const tradeExampleCandidates: Array<{ label: string; row: ModelRecord['signals'][number] | null }> = [
    { label: 'Best trade', row: bestTrade },
    { label: 'Worst trade', row: worstTrade },
    { label: 'Most recent', row: recentTrade },
  ]
  const seenTradeKeys = new Set<string>()
  const tradeExamples = tradeExampleCandidates
    .filter((item): item is { label: string; row: ModelRecord['signals'][number] } => item.row !== null)
    .filter((item) => {
      const key = `${item.row.date}-${item.row.signal}-${item.row.returnPct}`
      if (seenTradeKeys.has(key)) return false
      seenTradeKeys.add(key)
      return true
    })
    .slice(0, 3)

  const performanceDrivers: string[] = []
  if (trendMomentumEmphasis) {
    performanceDrivers.push('Trend capture is the primary return engine when direction persists.')
  } else {
    performanceDrivers.push('Limited trend capture reduces upside in sustained directional phases.')
  }
  if (riskScore >= 56 && (!summary || Math.abs(summary.maxDrawdown) <= 10)) {
    performanceDrivers.push('Volatility sensitivity is controlled by risk filters and moderate drawdowns.')
  } else {
    performanceDrivers.push('Volatility spikes are a key drag, with wider drawdowns during turbulence.')
  }
  if (flipRate <= 0.25) {
    performanceDrivers.push('Low flip cadence supports consistency and cleaner signal follow-through.')
  } else {
    performanceDrivers.push('Higher flip cadence lowers consistency, especially in sideways regimes.')
  }

  const evaluationMethodItems = [
    `Signals evaluated ${model.validation.signalUpdateFrequency}.`,
    `Entry at close on signal day; exit after ${model.validation.holdingHorizonDays} sessions.`,
    'No fees, slippage, or partial fills are modeled.',
    model.validation.compareAgainstBenchmark
      ? `Benchmark uses the same entry/exit windows against ${model.benchmark}.`
      : 'Benchmark comparison is disabled for this run.',
  ]

  const chartTradeMarkers = (() => {
    if (model.equityCurve.length === 0 || signalRows.length === 0) return []
    const markers: Array<{
      key: string
      t: string
      strategy: number
      signal: ModelRecord['signals'][number]['signal']
    }> = []
    const seen = new Set<string>()
    for (const row of signalRows.slice(0, 10)) {
      const index = model.equityCurve.findIndex((point) => point.t >= row.date)
      const point = model.equityCurve[index >= 0 ? index : model.equityCurve.length - 1]
      if (!point) continue
      const key = `${point.t}-${row.signal}`
      if (seen.has(key)) continue
      seen.add(key)
      markers.push({
        key,
        t: point.t,
        strategy: point.strategy,
        signal: row.signal,
      })
      if (markers.length >= 8) break
    }
    return markers
  })()

  return (
    <div className="container-lg section-gap">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <span>{model.name}</span>
              <Badge variant={statusVariant(model.status)}>
                {model.status === 'validated' ? 'Validated' : 'Draft'}
              </Badge>
            </span>
          }
          subtitle={modelSummaryResult(model)}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={modifyHref}
                className={buttonClass({ variant: 'ghost' })}
                onClick={() =>
                  trackEvent('click_modify_model', {
                    model_id: model.id,
                    is_sample: isSampleModel,
                    source: 'model_header_edit',
                  })
                }
              >
                Edit
              </Link>
              <Link
                href={`/models/compare?left=${encodeURIComponent(model.id)}`}
                className={buttonClass({ variant: 'ghost' })}
                onClick={() =>
                  trackEvent('click_compare', {
                    model_id: model.id,
                    is_sample: isSampleModel,
                    source: 'model_header_compare',
                  })
                }
              >
                Compare in Model Lab
              </Link>
              {parentModel ? (
                <Link
                  href={`/models/compare?left=${encodeURIComponent(parentModel.id)}&right=${encodeURIComponent(model.id)}`}
                  className={buttonClass({ variant: 'primary' })}
                  onClick={() =>
                    trackEvent('click_compare', {
                      model_id: model.id,
                      compare_to_model_id: parentModel.id,
                      is_sample: isSampleModel,
                      source: 'model_header_compare_previous',
                    })
                  }
                >
                  Compare with previous
                </Link>
              ) : null}
              <button
                type="button"
                className={buttonClass({ variant: 'secondary' })}
                onClick={async () => {
                  if (isRerunning) return
                  setIsRerunning(true)
                  try {
                    const rerun = await rerunModelValidation(model.id)
                    if (!rerun) return
                    setModel(rerun)
                    setMessageTone('success')
                    setMessage('Validation rerun complete.')
                  } catch (error) {
                    setMessageTone('error')
                    setMessage(error instanceof Error ? error.message : 'Validation rerun failed.')
                  } finally {
                    setIsRerunning(false)
                  }
                }}
                disabled={isRerunning}
              >
                {isRerunning ? 'Rerunning…' : 'Rerun'}
              </button>
              <button
                type="button"
                className={buttonClass({ variant: 'secondary' })}
                onClick={() => {
                  const duplicated = duplicateModelRecord(model.id)
                  if (!duplicated) return
                  router.push(`/models/${duplicated.id}`)
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                className={buttonClass({ variant: 'secondary' })}
                onClick={() => {
                  const duplicated = duplicateModelRecord(model.id)
                  if (!duplicated) return

                  const nextLookback =
                    duplicated.lookbackDays >= 756
                      ? 504
                      : Math.min(756, duplicated.lookbackDays + 63)
                  const nextConditions = duplicated.conditions.map((condition, index) => {
                    let nextValue = condition.value
                    if (index === 0) {
                      nextValue += condition.operator === 'above' ? 5 : -5
                    } else if (index === 1) {
                      nextValue += condition.operator === 'above' ? 3 : -3
                    }

                    return {
                      ...condition,
                      value: clamp(nextValue, 0, 100),
                    }
                  })

                  const draftPayload = {
                    name: `${duplicated.name.replace(/\s+\(Copy\)$/i, '')} Variation`,
                    universe: duplicated.universe,
                    ticker: duplicated.ticker,
                    lookbackDays: nextLookback,
                    benchmark: duplicated.benchmark,
                    logicMode: duplicated.logicMode,
                    conditions: nextConditions,
                    holdingHorizonDays: duplicated.validation.holdingHorizonDays,
                    signalUpdateFrequency: duplicated.validation.signalUpdateFrequency,
                    compareAgainstBenchmark: duplicated.validation.compareAgainstBenchmark,
                    riskMode: duplicated.validation.riskMode,
                    sourceKind: 'variation',
                    variationOfModelId: model.id,
                    variationLabel: `Variation of ${model.name}`,
                  }

                  router.push(`/models/new?draft=${encodeURIComponent(JSON.stringify(draftPayload))}`)
                }}
              >
                Try variation
              </button>
            </div>
          }
        />

        {message ? (
          <div className={`text-body-sm ${messageTone === 'success' ? 'signal-bullish' : 'signal-bearish'}`}>
            {message}
          </div>
        ) : null}
        <DismissibleLocalHint
          storageKey="vesconte_onboarding_loop_hint_dismissed_v1"
          text="Start here: Explore a model → tweak it → compare results"
        />

        <Card className="section-gap border-primary/20 bg-[radial-gradient(circle_at_top_right,var(--accent-glow),transparent_68%)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-filter-label">Model identity</div>
              <h2 className="mt-1 text-section-title text-content-primary">{model.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated px-3 py-2">
                <div className="text-micro flex items-center justify-between gap-3">
                  <span className="text-content-muted">Confidence</span>
                  <span className="text-label-sm text-content-secondary numeric-tabular">
                    {confidence} · {confidencePct}
                  </span>
                </div>
                <div className="relative mt-1 h-2 w-[150px] overflow-hidden rounded-full bg-gradient-to-r from-[var(--bear-400)] via-[var(--warn-400)] to-[var(--bull-500)]">
                  <div
                    className="state-interactive absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border bg-surface-card"
                    style={{ left: `calc(${confidencePct}% - 6px)`, borderColor: chartPalette.tooltipBg }}
                  />
                </div>
              </div>
              <Badge variant="neutral">{personalityLabel}</Badge>
              <Badge variant={qualitativeStateVariant(qualitativeState)}>{qualitativeState}</Badge>
            </div>
          </div>
          <p className="text-body">{modelDescription}</p>
          <p className="text-caption text-content-muted">{confidenceHelper}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {usesHistoricalValidation ? 'Historical validation' : 'Preview validation'}
            </Badge>
            <span
              className="text-caption text-content-muted"
              title={
                usesHistoricalValidation
                  ? 'Validation uses historical daily data with simplified execution assumptions.'
                  : 'Results are simulated previews to guide early iteration while live validation is in progress.'
              }
            >
              {usesHistoricalValidation
                ? 'Simplified execution assumptions (no slippage, fixed horizon)'
                : 'Simulated result'}
            </span>
          </div>
          <div className="text-caption grid grid-cols-1 gap-1 text-content-secondary sm:grid-cols-2">
            <div>Created: <span className="numeric-tabular">{createdAtLabel}</span></div>
            <div>Last run: <span className="numeric-tabular">{lastRunLabel}</span></div>
            {variationMeta ? <div className="sm:col-span-2">Variation: <span className="numeric-tabular">{variationMeta}</span></div> : null}
          </div>
        </Card>

        <Card className="section-gap">
          <div className="text-label-lg text-content-primary">{topInsightHeadline}</div>
          <p className="text-body-sm text-content-secondary">{topInsightSummary}</p>
        </Card>
        <Card className="section-gap">
          <div className="text-micro uppercase tracking-wide text-content-muted">
            Explore → Modify → Compare
          </div>
          <div className="text-label-md mt-2 flex flex-wrap items-center gap-2">
            <a href="#key-findings" className="text-accent-text hover:underline">
              Explore
            </a>
            <span className="text-content-muted">→</span>
            <Link
              href={modifyHref}
              className="text-accent-text hover:underline"
              onClick={() =>
                trackEvent('click_modify_model', {
                  model_id: model.id,
                  is_sample: isSampleModel,
                  source: 'model_loop_modify',
                })
              }
            >
              Modify
            </Link>
            <span className="text-content-muted">→</span>
            <Link
              href={compareHref}
              className="text-accent-text hover:underline"
              onClick={() =>
                trackEvent('click_compare', {
                  model_id: model.id,
                  compare_to_model_id: parentModel?.id ?? null,
                  is_sample: isSampleModel,
                  source: 'model_loop_compare',
                })
              }
            >
              Compare
            </Link>
          </div>
          <div className="pt-1">
            <Link
              href={modifyHref}
              className={buttonClass({ variant: 'secondary' })}
              onClick={() =>
                trackEvent('click_modify_model', {
                  model_id: model.id,
                  is_sample: isSampleModel,
                  source: 'model_try_adjusting',
                })
              }
            >
              Try adjusting this model
            </Link>
          </div>
        </Card>

        <Card className="section-gap">
          <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-card-title text-content-primary">Behavioral composition</h3>
          <Badge variant="neutral">{compositionInsights.biasLabel}</Badge>
        </div>
        <p className="text-body">{compositionInsights.interpretation}</p>
        {showActiveExposure ? (
          <p className="text-caption numeric-tabular text-content-muted">
            Active {compositionInsights.activePct}% of time
          </p>
        ) : null}
          <SignalDistributionBubbleCluster
            bullishCount={regimeComposition.bullishCount}
            neutralCount={regimeComposition.neutralCount}
            bearishCount={regimeComposition.bearishCount}
            mode="compact"
            showSummaryLine={false}
            showCount={false}
            showRoleInside
          />
        </Card>

        <div className="rounded-[var(--radius-md)] border border-border bg-surface-elevated px-3 py-2 text-body-sm text-content-secondary">
          <span className="mr-2 text-label-md text-content-primary">Should I use this?</span>
          {usageSignal}
        </div>

        <Card className="section-gap">
          <details>
              <summary className="cursor-pointer list-none text-card-title text-content-primary">
                How this was evaluated
              </summary>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-body">
              {evaluationMethodItems.map((item, index) => (
                <li key={`evaluation-method-${index}`}>{item}</li>
              ))}
            </ul>
          </details>
        </Card>

        <Card id="key-findings" className="section-gap">
          <h3 className="text-card-title text-content-primary">Key Findings</h3>
          <div className="space-y-1 text-body">
            {keyFindings.slice(0, 3).map((finding, index) => (
              <p key={`finding-${index}`}>{finding}</p>
            ))}
          </div>
        </Card>

        <Card className="section-gap">
          <h3 className="text-card-title text-content-primary">Trade examples</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {tradeExamples.map((example) => (
              <div
                key={`${example.label}-${example.row.date}-${example.row.signal}-${example.row.returnPct}`}
                className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-micro uppercase tracking-wide text-content-muted">
                    {example.label}
                  </div>
                  <Badge
                    variant={
                      example.row.signal === 'bullish'
                        ? 'success'
                        : example.row.signal === 'bearish'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {example.row.signal}
                  </Badge>
                </div>
                <div className={`text-data-sm numeric-tabular mt-1 ${example.row.returnPct >= 0 ? 'signal-bullish' : 'signal-bearish'}`}>
                  {formatPercent(example.row.returnPct)}
                </div>
                <div className="text-caption numeric-tabular mt-1 text-content-muted">
                  {formatDate(example.row.date)} · {model.validation.holdingHorizonDays}d hold
                </div>
                <p className="text-caption mt-2 text-content-secondary">{tradeExplanation(example.row)}</p>
              </div>
            ))}
          </div>
          {tradeExamples.length === 0 ? (
            <p className="text-body">No completed trade examples yet for this configuration.</p>
          ) : null}
          {bearishSignalsPresent ? (
            <p className="text-caption text-content-muted">
              Bearish returns assume frictionless short exposure.
            </p>
          ) : null}
        </Card>

        <Card className="section-gap">
          <h3 className="text-card-title text-content-primary">What drives performance</h3>
          <ul className="list-disc space-y-1 pl-5 text-body">
            {performanceDrivers.slice(0, 3).map((driver, index) => (
              <li key={`driver-${index}`}>{driver}</li>
            ))}
          </ul>
        </Card>

        <Card className="section-gap">
          <h3 className="text-card-title text-content-primary">Why this model works</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-3">
              <div className="text-micro uppercase tracking-wide text-content-muted">
                Driver
              </div>
              <p className="text-body-sm mt-1 text-content-secondary">{whyDriver}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-3">
              <div className="text-micro uppercase tracking-wide text-content-muted">
                Filter
              </div>
              <p className="text-body-sm mt-1 text-content-secondary">{whyFilter}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-3">
              <div className="text-micro uppercase tracking-wide text-content-muted">
                Edge Source
              </div>
              <p className="text-body-sm mt-1 text-content-secondary">{whyEdgeSource}</p>
            </div>
          </div>
        </Card>

        {parentModel ? (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">What changed</h3>
              <ul className="list-disc space-y-1 pl-5 text-body">
                {whatChanged.slice(0, 4).map((item, index) => (
                  <li key={`change-${index}`}>{item}</li>
                ))}
              </ul>
            </Card>
            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Effect of change</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="state-interactive rounded-[var(--radius-md)] border border-border bg-surface-elevated px-3 py-2 hover:bg-surface-hover">
                  <div className="text-micro uppercase tracking-wide text-content-muted">
                    Performance
                  </div>
                  <div className={`text-label-md ${directionToneClass(performanceDirection)}`}>
                    {directionArrow(performanceDirection)} {performanceDeltaLabel}
                  </div>
                </div>
                <div className="state-interactive rounded-[var(--radius-md)] border border-border bg-surface-elevated px-3 py-2 hover:bg-surface-hover">
                  <div className="text-micro uppercase tracking-wide text-content-muted">
                    Stability
                  </div>
                  <div className={`text-label-md ${directionToneClass(stabilityDirection)}`}>
                    {directionArrow(stabilityDirection)} {stabilityDeltaLabel}
                  </div>
                </div>
                <div className="state-interactive rounded-[var(--radius-md)] border border-border bg-surface-elevated px-3 py-2 hover:bg-surface-hover">
                  <div className="text-micro uppercase tracking-wide text-content-muted">
                    Signal Frequency
                  </div>
                  <div className={`text-label-md ${frequencyToneClass(frequencyDirection)}`}>
                    {directionArrow(frequencyDirection)} {frequencyDeltaLabel}
                  </div>
                </div>
              </div>
              <p className="text-body">{effectOfChange}</p>
            </Card>
          </section>
        ) : null}

        <Card className="section-gap">
          <h3 className="text-card-title text-content-primary">Next step</h3>
          <ul className="list-disc space-y-1 pl-5 text-body">
            {nextSteps.slice(0, 2).map((item, index) => (
              <li key={`next-${index}`}>{item}</li>
            ))}
          </ul>
        </Card>

        <MetricGrid
          items={[
            {
              label: 'Validation Score',
              value: summary ? `${summary.validationScore}/100` : '—',
              hint: metricHints.validation,
            },
            {
              label: 'Win Rate',
              value: summary ? `${summary.winRate.toFixed(1)}%` : '—',
              hint: metricHints.winRate,
            },
            {
              label: 'Max Drawdown',
              value: summary ? `${summary.maxDrawdown.toFixed(1)}%` : '—',
              hint: metricHints.drawdown,
            },
            {
              label: 'Relative Performance',
              value: summary ? `${summary.relativePerformance >= 0 ? '+' : ''}${summary.relativePerformance.toFixed(1)}%` : '—',
              hint: `${metricHints.relative} · vs ${model.benchmark}`,
            },
          ]}
          columns={4}
        />

        <div className="text-body-sm text-content-secondary">{benchmarkInterpretation}</div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="section-gap">
            <Card className="section-gap">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-card-title text-content-primary">Validation and performance</div>
                  <p className="text-body mt-1">
                    Strategy curve {model.validation.compareAgainstBenchmark ? `vs ${model.benchmark}` : 'without benchmark overlay'}.
                  </p>
                  {chartTradeMarkers.length > 0 ? (
                    <p className="text-caption mt-1 text-content-muted">
                      Markers show recent entry signals.
                    </p>
                  ) : null}
                </div>
              </div>

              <ChartContainer className="h-[280px]">
                {({ width, height, palette }) => (
                  <AreaChart width={width} height={height} data={model.equityCurve} margin={CHART_MARGINS.stock}>
                      <defs>
                        <linearGradient id="modelStrategyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={palette.secondary} stopOpacity={0.26} />
                          <stop offset="100%" stopColor={palette.secondary} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 6" stroke={palette.grid} vertical={false} />
                      <XAxis dataKey="t" tick={{ fontSize: 11, fill: palette.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: palette.textMuted }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        tickFormatter={(value) => Number(value).toFixed(0)}
                      />
                      <Tooltip content={<ValidationTooltip palette={palette} />} cursor={{ stroke: palette.secondary, strokeOpacity: 0.26 }} />
                      {model.validation.compareAgainstBenchmark ? (
                        <Line
                          type="monotone"
                          dataKey="benchmark"
                          stroke={palette.neutral}
                          strokeWidth={1.8}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      ) : null}
                      <Area type="monotone" dataKey="strategy" stroke="none" fill="url(#modelStrategyFill)" />
                      <Line
                        type="monotone"
                        dataKey="strategy"
                        stroke={palette.secondary}
                        strokeWidth={2.6}
                        dot={false}
                      />
                      {chartTradeMarkers.map((marker) => (
                        <ReferenceDot
                          key={marker.key}
                          x={marker.t}
                          y={marker.strategy}
                          r={3.5}
                          fill={markerColor(marker.signal)}
                          stroke={palette.tooltipBg}
                          strokeWidth={1}
                          ifOverflow="extendDomain"
                        />
                      ))}
                  </AreaChart>
                )}
              </ChartContainer>
            </Card>

            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Signal / trade table</h3>
              <div className="overflow-x-auto">
                <table className="numeric-tabular w-full text-left text-body-sm">
                  <thead className="text-label-sm uppercase tracking-wide text-content-muted">
                    <tr>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Signal</th>
                      <th className="px-2 py-2">Conviction</th>
                      <th className="px-2 py-2">Return</th>
                      <th className="px-2 py-2">Benchmark</th>
                      <th className="px-2 py-2">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.signals.map((row) => (
                      <tr key={`${row.date}-${row.signal}-${row.returnPct}`} className="border-t border-border">
                        <td className="px-2 py-2">{formatDate(row.date)}</td>
                        <td className="px-2 py-2">
                          <Badge
                            variant={row.signal === 'bullish' ? 'success' : row.signal === 'bearish' ? 'danger' : 'neutral'}
                          >
                            {row.signal}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">{Math.round(row.conviction * 100)}%</td>
                        <td className={`px-2 py-2 ${row.returnPct >= 0 ? 'signal-bullish' : 'signal-bearish'}`}>
                          {formatPercent(row.returnPct)}
                        </td>
                        <td className={`px-2 py-2 ${row.benchmarkPct >= 0 ? 'signal-bullish' : 'signal-bearish'}`}>
                          {formatPercent(row.benchmarkPct)}
                        </td>
                        <td className="px-2 py-2">
                          {stockContextHref ? (
                            <Link href={stockContextHref} className="text-label-sm text-accent-text hover:underline">
                              View stock
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="section-gap">
            <Card>
              <h3 className="text-card-title text-content-primary">Model/system profile</h3>
              <div className="mt-3 flex justify-center">
                <SystemProfileBlob compact dimensions={model.profileDimensions} />
              </div>
            </Card>

            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Signal summary</h3>
              <div className={`text-data-sm numeric-tabular ${signalToneClass(model.currentSignal)}`}>{signalHeadline}</div>
              <p className="text-body">
                Latest regime: {model.currentSignal?.direction ?? 'neutral'} · Conviction {model.currentSignal ? `${Math.round(model.currentSignal.conviction * 100)}%` : '—'}.
              </p>
            </Card>

            <Card className="section-gap">
              <h3 className="text-card-title text-content-primary">Rule summary</h3>
              <p className="text-body">
                Universe: {universeLabel(model.universe)}
                {model.ticker ? ` (${model.ticker})` : ''} · Logic mode: {model.logicMode === 'all' ? 'Match all' : 'Match any'}.
              </p>
              <ul className="text-sm text-content-secondary">
                {model.conditions.map((condition) => (
                  <li key={condition.id}>
                    {condition.metric} {condition.operator} {condition.value}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="section-gap">
            <h3 className="text-card-title text-content-primary">Strengths</h3>
            <ul className="list-disc space-y-1 pl-5 text-body">
              {strengths.slice(0, 3).map((item, index) => (
                <li key={`strength-${index}`}>{item}</li>
              ))}
            </ul>
          </Card>
          <Card className="section-gap">
            <h3 className="text-card-title text-content-primary">Weaknesses</h3>
            <ul className="list-disc space-y-1 pl-5 text-body">
              {weaknesses.slice(0, 3).map((item, index) => (
                <li key={`weakness-${index}`}>{item}</li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="section-gap">
            <h3 className="text-card-title text-content-primary">When this works best</h3>
            <ul className="list-disc space-y-1 pl-5 text-body">
              {worksBest.slice(0, 3).map((item, index) => (
                <li key={`works-${index}`}>{item}</li>
              ))}
            </ul>
          </Card>
          <Card className="section-gap">
            <h3 className="text-card-title text-content-primary">When to be cautious</h3>
            <ul className="list-disc space-y-1 pl-5 text-body">
              {cautious.slice(0, 3).map((item, index) => (
                <li key={`caution-${index}`}>{item}</li>
              ))}
            </ul>
          </Card>
        </section>

        <Card className="section-gap">
          <h3 className="text-card-title text-content-primary">Supporting diagnostics</h3>
          <ul className="text-body space-y-1">
            {model.diagnostics.notes.map((item, index) => (
              <li key={`note-${index}`}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
  )
}
