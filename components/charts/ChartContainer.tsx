'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type ChartPalette = {
  isDark: boolean
  primary: string
  secondary: string
  accent: string
  neutral: string
  grid: string
  text: string
  textMuted: string
  axisText: string
  tooltipBg: string
  tooltipBorder: string
  bullish: string
  bearish: string
  signalNeutral: string
  regimeBullish: string
  regimeBearish: string
  regimeNeutral: string
}

export const LIGHT_CHART_PALETTE: ChartPalette = {
  isDark: false,
  primary: 'var(--text)', secondary: 'var(--text-muted)', accent: 'var(--accent)',
  neutral: 'var(--text-muted)', grid: 'var(--line)', text: 'var(--text)',
  textMuted: 'var(--text-muted)', axisText: 'var(--text-muted)',
  tooltipBg: 'var(--surface)', tooltipBorder: 'var(--line)',
  bullish: 'var(--up)', bearish: 'var(--down)', signalNeutral: 'var(--text-muted)',
  regimeBullish: 'color-mix(in srgb, var(--up) 14%, transparent)',
  regimeBearish: 'color-mix(in srgb, var(--down) 14%, transparent)',
  regimeNeutral: 'color-mix(in srgb, var(--text-muted) 12%, transparent)',
}

export const DARK_CHART_PALETTE: ChartPalette = {
  isDark: true,
  primary: 'var(--text)', secondary: 'var(--text-muted)', accent: 'var(--accent)',
  neutral: 'var(--text-muted)', grid: 'var(--line)', text: 'var(--text)',
  textMuted: 'var(--text-muted)', axisText: 'var(--text-muted)',
  tooltipBg: 'var(--surface)', tooltipBorder: 'var(--line)',
  bullish: 'var(--up)', bearish: 'var(--down)', signalNeutral: 'var(--text-muted)',
  regimeBullish: 'color-mix(in srgb, var(--up) 20%, transparent)',
  regimeBearish: 'color-mix(in srgb, var(--down) 20%, transparent)',
  regimeNeutral: 'color-mix(in srgb, var(--text-muted) 20%, transparent)',
}

export const CHART_PALETTE: ChartPalette = LIGHT_CHART_PALETTE

function detectDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const root = document.documentElement
  const theme = root.dataset.theme
  if (theme === 'dark') return true
  if (theme === 'light') return false
  if (root.classList.contains('dark')) return true
  if (root.classList.contains('light')) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useChartPalette(): ChartPalette {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const update = () => setIsDark(detectDarkMode())
    update()

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onMediaChange = () => update()
    media.addEventListener('change', onMediaChange)

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    return () => {
      media.removeEventListener('change', onMediaChange)
      observer.disconnect()
    }
  }, [])

  return isDark ? DARK_CHART_PALETTE : LIGHT_CHART_PALETTE
}

export const CHART_MARGINS = {
  standard: { top: 12, right: 16, bottom: 12, left: 16 },
  withYAxisLabels: { top: 12, right: 16, bottom: 12, left: 24 },
  stock: { top: 14, right: 14, bottom: 30, left: 46 },
  sankey: { top: 28, right: 20, bottom: 20, left: 20 },
} as const

type ChartTooltipRow = {
  label: string
  value: string
  swatchColor?: string
}

export function ChartTooltipCard({
  title,
  rows,
}: {
  title?: string
  rows: ChartTooltipRow[]
}) {
  if (rows.length === 0) return null

  return (
    <div className="rounded-[var(--radius-lg)] border border-chart-tooltip-border bg-chart-tooltip px-3.5 py-3">
      {title ? (
        <div className="mb-2 text-label-sm text-content-primary">
          {title}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-4 text-label-sm">
            <div className="inline-flex items-center gap-2 text-content-secondary">
              {row.swatchColor ? (
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.swatchColor }} />
              ) : null}
              <span>{row.label}</span>
            </div>
            <span className="text-data-sm text-content-primary numeric-tabular">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

type ChartContainerArgs = {
  width: number
  height: number
  isReady: boolean
  palette: ChartPalette
}

type ChartContainerProps = {
  className?: string
  padding?: 'none' | 'sm' | 'md'
  loading?: boolean
  loadingText?: string
  children: (args: ChartContainerArgs) => React.ReactNode
}

function paddingClass(padding: ChartContainerProps['padding']): string {
  if (padding === 'md') return 'p-4'
  if (padding === 'sm') return 'p-2'
  return ''
}

export default function ChartContainer({
  className,
  padding = 'none',
  loading = false,
  loadingText = 'Loading chart...',
  children,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const palette = useChartPalette()

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      })
    }

    updateSize()
    const observer = new ResizeObserver(() => updateSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const isReady = !loading && size.width > 40 && size.height > 40

  return (
    <div ref={containerRef} className={cn('relative w-full min-w-0', paddingClass(padding), className)}>
      {isReady ? (
        children({
          width: size.width,
          height: size.height,
          isReady,
          palette,
        })
      ) : (
        <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-content-muted">
          {loadingText}
        </div>
      )}
    </div>
  )
}
