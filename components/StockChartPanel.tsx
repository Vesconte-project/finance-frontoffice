'use client'

import { useMemo, useState } from 'react'
import StockChart, { type StockChartSignalMarker } from '@/components/StockChart'
import type { PricePoint } from '@/lib/finance'
import FilterChip from '@/components/ui/FilterChip'
import Badge from '@/components/ui/Badge'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useChartPalette } from '@/components/charts/ChartContainer'

type Timeframe = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX'

const TIMEFRAME_OPTIONS: Timeframe[] = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX']

function parseIsoDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`)
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
}

function getStartDate(timeframe: Timeframe, latestDate: Date): Date | null {
  switch (timeframe) {
    case '1M':
      return subtractDays(latestDate, 30)
    case '3M':
      return subtractDays(latestDate, 90)
    case '6M':
      return subtractDays(latestDate, 182)
    case 'YTD':
      return new Date(Date.UTC(latestDate.getUTCFullYear(), 0, 1))
    case '1Y':
      return subtractDays(latestDate, 365)
    case '5Y':
      return subtractDays(latestDate, 1825)
    case 'MAX':
    default:
      return null
  }
}

function normalizedConvictionPct(value: number | null): number | null {
  if (value === null) return null
  const scaled = value > 1 ? value : value * 100
  if (!Number.isFinite(scaled)) return null
  return Math.max(0, Math.min(100, scaled))
}

function convictionDescriptor(value: number | null): 'low' | 'moderate' | 'high' {
  const pct = normalizedConvictionPct(value)
  if (pct === null) return 'moderate'
  if (pct < 20) return 'low'
  if (pct < 70) return 'moderate'
  return 'high'
}

function directionLabel(direction: StockChartSignalMarker['direction']): string {
  if (direction === 'bullish') return 'Bullish'
  if (direction === 'bearish') return 'Bearish'
  return 'Neutral'
}

function badgeVariantForDirection(
  direction: StockChartSignalMarker['direction']
): 'success' | 'danger' | 'neutral' {
  if (direction === 'bullish') return 'success'
  if (direction === 'bearish') return 'danger'
  return 'neutral'
}

type ChartInterpretation = {
  sentence: string
  stateLabel: string
  stateVariant: 'success' | 'danger' | 'neutral' | 'warning'
}

function buildChartInterpretation(data: PricePoint[], markers: StockChartSignalMarker[]): ChartInterpretation {
  if (data.length < 2 || markers.length === 0) {
    return {
      sentence: 'Price action is visible, but signal history is limited in this window.',
      stateLabel: 'Limited Signal Context',
      stateVariant: 'neutral',
    }
  }

  const dateToIndex = new Map(data.map((point, idx) => [point.date.slice(0, 10), idx]))
  const markersWithIndex = markers
    .map((marker) => ({ marker, index: dateToIndex.get(marker.date.slice(0, 10)) }))
    .filter((value): value is { marker: StockChartSignalMarker; index: number } => value.index !== undefined)
    .sort((a, b) => a.index - b.index)

  const latestState = markersWithIndex[markersWithIndex.length - 1]
  if (!latestState) {
    return {
      sentence: 'Price action is visible, but signal history is limited in this window.',
      stateLabel: 'Limited Signal Context',
      stateVariant: 'neutral',
    }
  }

  const latestDirection = latestState.marker.direction
  const latestIndex = latestState.index
  const flips = markersWithIndex.filter((item) => item.marker.kind === 'flip')

  const regimeStart =
    [...flips].reverse().find((item) => item.marker.direction === latestDirection && item.index <= latestIndex) ??
    latestState

  const sessionsHeld = Math.max(1, latestIndex - regimeStart.index + 1)
  const regimeStartPoint = data[regimeStart.index]
  const latestPoint = data[latestIndex]
  const priceChange =
    regimeStartPoint && latestPoint && regimeStartPoint.close > 0
      ? (latestPoint.close - regimeStartPoint.close) / regimeStartPoint.close
      : 0

  const recentWindowStart = Math.max(0, data.length - 30)
  const recentFlipCount = flips.filter((item) => item.index >= recentWindowStart).length
  const unstable = recentFlipCount >= 3 || (recentFlipCount >= 2 && sessionsHeld <= 6)
  const convictionLevel = convictionDescriptor(latestState.marker.conviction)
  const isRangeBound = Math.abs(priceChange) <= 0.015
  const priceConfirms =
    latestDirection === 'bullish'
      ? priceChange >= 0.01
      : latestDirection === 'bearish'
        ? priceChange <= -0.01
        : isRangeBound

  if (unstable) {
    return {
      sentence: 'Recent flips suggest unstable direction.',
      stateLabel: 'Unstable',
      stateVariant: 'warning',
    }
  }

  if (latestDirection === 'neutral' && isRangeBound) {
    return {
      sentence: `Price remains range-bound despite ${convictionLevel} conviction.`,
      stateLabel: 'Range Regime',
      stateVariant: 'neutral',
    }
  }

  if (priceConfirms && sessionsHeld >= 6) {
    return {
      sentence: `${directionLabel(latestDirection)} regime has held for ${sessionsHeld} sessions.`,
      stateLabel: directionLabel(latestDirection),
      stateVariant: badgeVariantForDirection(latestDirection),
    }
  }

  if (!priceConfirms) {
    return {
      sentence: `Price is not yet confirming the ${latestDirection} signal regime.`,
      stateLabel: directionLabel(latestDirection),
      stateVariant: badgeVariantForDirection(latestDirection),
    }
  }

  return {
    sentence: `${directionLabel(latestDirection)} direction is stable with ${convictionLevel} conviction.`,
    stateLabel: directionLabel(latestDirection),
    stateVariant: badgeVariantForDirection(latestDirection),
  }
}

export default function StockChartPanel({
  data,
  currency = 'USD',
  signalMarkers,
}: {
  data: PricePoint[]
  currency?: string
  signalMarkers?: StockChartSignalMarker[]
}) {
  const palette = useChartPalette()
  const [timeframe, setTimeframe] = useState<Timeframe>('1Y')
  const [showRegimes, setShowRegimes] = useState(true)
  const [showSignalMarkers, setShowSignalMarkers] = useState(true)

  const filteredData = useMemo(() => {
    if (data.length === 0) return []

    const latestPoint = data[data.length - 1]
    if (!latestPoint) return data

    const latestDate = parseIsoDate(latestPoint.date)
    const startDate = getStartDate(timeframe, latestDate)
    if (!startDate) return data

    const next = data.filter((point) => parseIsoDate(point.date) >= startDate)
    return next.length > 1 ? next : data
  }, [data, timeframe])

  const visibleDates = useMemo(() => new Set(filteredData.map((point) => point.date.slice(0, 10))), [filteredData])
  const filteredMarkers = useMemo(() => {
    if (!signalMarkers || signalMarkers.length === 0) return []
    return signalMarkers.filter((marker) => visibleDates.has(marker.date.slice(0, 10)))
  }, [signalMarkers, visibleDates])
  const interpretation = useMemo(
    () => buildChartInterpretation(filteredData, filteredMarkers),
    [filteredData, filteredMarkers]
  )

  return (
    <div className="h-full space-y-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-content-muted">
                Regime Chart
              </span>
              <Badge variant={interpretation.stateVariant}>{interpretation.stateLabel}</Badge>
            </div>
            <p className="text-body-sm font-medium leading-snug text-content-primary">{interpretation.sentence}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              analyticsId="chart_toggle_regimes"
              label={showRegimes ? 'Regimes On' : 'Regimes Off'}
              active={showRegimes}
              onClick={() => setShowRegimes((value) => !value)}
            />
            <FilterChip
              analyticsId="chart_toggle_markers"
              label={showSignalMarkers ? 'Markers On' : 'Markers Off'}
              active={showSignalMarkers}
              onClick={() => setShowSignalMarkers((value) => !value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-content-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: palette.primary }} />
              Price
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] signal-fill-bullish signal-confidence-medium" />
              Regime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ borderColor: palette.tooltipBorder, backgroundColor: palette.tooltipBg }}
              />
              Markers
            </span>
          </div>

          <SegmentedControl
            options={TIMEFRAME_OPTIONS}
            value={timeframe}
            onChange={setTimeframe}
            ariaLabel="Chart timeframe"
            analyticsId="ticker_chart_timeframe"
          />
        </div>
      </div>

      <div className="h-[360px] md:h-[400px]">
        <StockChart
          data={filteredData}
          currency={currency}
          signalMarkers={filteredMarkers}
          showRegimes={showRegimes}
          showSignalMarkers={showSignalMarkers}
        />
      </div>
    </div>
  )
}
