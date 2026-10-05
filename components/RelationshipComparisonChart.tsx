'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ChartContainer from '@/components/charts/ChartContainer'
import styles from './RelationshipComparisonChart.module.css'

type PricePoint = {
  date: string
  close: number
}

type ComparisonPayload = {
  base: { ticker: string; points: PricePoint[] }
  peer: { ticker: string; points: PricePoint[] }
}

type IndexedPoint = {
  date: string
  base: number
  peer: number
}

const comparisonCache = new Map<string, ComparisonPayload>()
const comparisonRequestCache = new Map<string, Promise<ComparisonPayload>>()

function validPoint(value: unknown): value is PricePoint {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<PricePoint>
  return typeof point.date === 'string' && typeof point.close === 'number' && Number.isFinite(point.close)
}

function parsePayload(value: unknown): ComparisonPayload | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Partial<ComparisonPayload>
  if (!payload.base || !payload.peer) return null
  if (typeof payload.base.ticker !== 'string' || typeof payload.peer.ticker !== 'string') return null
  if (!Array.isArray(payload.base.points) || !Array.isArray(payload.peer.points)) return null
  return {
    base: { ticker: payload.base.ticker, points: payload.base.points.filter(validPoint) },
    peer: { ticker: payload.peer.ticker, points: payload.peer.points.filter(validPoint) },
  }
}

function indexCommonDates(payload: ComparisonPayload | null): IndexedPoint[] {
  if (!payload) return []
  const baseByDate = new Map(payload.base.points.map((point) => [point.date.slice(0, 10), point.close]))
  const common = payload.peer.points
    .map((point) => ({ date: point.date.slice(0, 10), peer: point.close, base: baseByDate.get(point.date.slice(0, 10)) }))
    .filter((point): point is { date: string; peer: number; base: number } => typeof point.base === 'number')
    .sort((left, right) => left.date.localeCompare(right.date))

  const baseStart = common[0]?.base
  const peerStart = common[0]?.peer
  if (!baseStart || !peerStart || common.length < 2) return []
  return common.map((point) => ({
    date: point.date,
    base: (point.base / baseStart) * 100,
    peer: (point.peer / peerStart) * 100,
  }))
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatChange(value: number): string {
  const change = value - 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

function paddedDomain(values: number[]): { floor: number; ceiling: number } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || Math.max(4, Math.abs(max) * 0.04)
  return {
    floor: min - spread * 0.12,
    ceiling: max + spread * 0.12,
  }
}

function PriceComparisonSkeleton() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading price comparison">
      <i /><i /><i /><i />
    </div>
  )
}

export default function RelationshipComparisonChart({
  baseTicker,
  peerTicker,
  peerColor,
}: {
  baseTicker: string
  peerTicker: string
  peerColor: string
}) {
  const cacheKey = `${baseTicker}:${peerTicker}:365`
  const [payload, setPayload] = useState<ComparisonPayload | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    const cached = comparisonCache.get(cacheKey)
    const request = cached
      ? Promise.resolve(cached)
      : comparisonRequestCache.get(cacheKey) ?? (() => {
          const nextRequest = fetch(`/api/stocks/relationship-comparison?base=${encodeURIComponent(baseTicker)}&peer=${encodeURIComponent(peerTicker)}&periodDays=365`)
            .then(async (response) => {
              if (!response.ok) throw new Error(`Comparison request failed with ${response.status}`)
              const parsed = parsePayload(await response.json())
              if (!parsed) throw new Error('Malformed comparison response')
              comparisonCache.set(cacheKey, parsed)
              return parsed
            })
            .finally(() => comparisonRequestCache.delete(cacheKey))
          comparisonRequestCache.set(cacheKey, nextRequest)
          return nextRequest
        })()

    request
      .then((parsed) => {
        if (!active) return
        setPayload(parsed)
        setState(indexCommonDates(parsed).length > 1 ? 'ready' : 'empty')
      })
      .catch(() => {
        if (active) setState('error')
      })

    return () => {
      active = false
    }
  }, [baseTicker, cacheKey, peerTicker])

  const indexed = useMemo(() => indexCommonDates(payload), [payload])
  const last = indexed.at(-1)

  if (state === 'loading') return <PriceComparisonSkeleton />
  if (state === 'error' || state === 'empty' || !last) {
    return (
      <div className={styles.unavailable} role="status">
        <strong>Price comparison unavailable</strong>
        <span>The two prices over the last year could not be read for this pair right now.</span>
      </div>
    )
  }

  return (
    <div className={styles.root} style={{ '--peer-color': peerColor } as CSSProperties}>
      <ChartContainer className={styles.chart} loadingText="">
        {({ width, height }) => {
          // Room on the right for each line's name and change, written at its end.
          const padding = { top: 12, right: 92, bottom: 24, left: 8 }
          const innerWidth = Math.max(1, width - padding.left - padding.right)
          const innerHeight = Math.max(1, height - padding.top - padding.bottom)
          // Both lines are indexed to 100 on the first common day, so they share one
          // scale and their distance apart is the real difference in return.
          const domain = paddedDomain(indexed.flatMap((point) => [point.base, point.peer]))
          const plotY = (value: number, domain: { floor: number; ceiling: number }) =>
            padding.top + (1 - (value - domain.floor) / (domain.ceiling - domain.floor)) * innerHeight
          const positioned = indexed.map((point, index) => ({
            ...point,
            x: padding.left + (index / Math.max(1, indexed.length - 1)) * innerWidth,
            baseY: plotY(point.base, domain),
            peerY: plotY(point.peer, domain),
          }))
          const basePath = linePath(positioned.map((point) => ({ x: point.x, y: point.baseY })))
          const peerPath = linePath(positioned.map((point) => ({ x: point.x, y: point.peerY })))
          const hover = hoverIndex === null ? null : positioned[hoverIndex]

          return (
            <div className={styles.canvas}>
              <svg
                width={width}
                height={height}
                role="img"
                aria-label={`${baseTicker} and ${peerTicker} over the last year, both starting at 100: ${baseTicker} ${formatChange(last.base)}, ${peerTicker} ${formatChange(last.peer)}`}
                onPointerMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left - padding.left) / innerWidth))
                  setHoverIndex(Math.round(ratio * Math.max(0, positioned.length - 1)))
                }}
                onPointerLeave={() => setHoverIndex(null)}
              >
                {[0.25, 0.5, 0.75].map((ratio) => (
                  <line key={ratio} x1={padding.left} x2={padding.left + innerWidth} y1={padding.top + innerHeight * ratio} y2={padding.top + innerHeight * ratio} className={styles.grid} />
                ))}
                <path d={basePath} className={styles.baseLine} pathLength={1} />
                <path d={peerPath} className={styles.peerLine} pathLength={1} />
                {hover ? (
                  <g className={styles.hover}>
                    <line x1={hover.x} x2={hover.x} y1={padding.top} y2={padding.top + innerHeight} />
                    <circle cx={hover.x} cy={hover.baseY} r="4" className={styles.baseDot} />
                    <circle cx={hover.x} cy={hover.peerY} r="4" className={styles.peerDot} />
                  </g>
                ) : null}
                <text x={padding.left} y={height - 4} className={styles.axisLabel}>{formatDate(indexed[0].date)}</text>
                <text x={padding.left + innerWidth} y={height - 4} textAnchor="end" className={styles.axisLabel}>{formatDate(last.date)}</text>
              </svg>
              {(() => {
                const end = positioned.at(-1)!
                // Keep the two end labels apart when the lines finish close together.
                const gap = 18
                let baseTop = end.baseY
                let peerTop = end.peerY
                if (Math.abs(baseTop - peerTop) < gap) {
                  const middle = (baseTop + peerTop) / 2
                  const baseAbove = baseTop <= peerTop
                  baseTop = middle + (baseAbove ? -gap / 2 : gap / 2)
                  peerTop = middle + (baseAbove ? gap / 2 : -gap / 2)
                }
                return (
                  <>
                    <span className={styles.endLabel} data-line="base" style={{ left: end.x + 8, top: baseTop }}>{baseTicker} <strong>{formatChange(last.base)}</strong></span>
                    <span className={styles.endLabel} data-line="peer" style={{ left: end.x + 8, top: peerTop }}>{peerTicker} <strong>{formatChange(last.peer)}</strong></span>
                  </>
                )
              })()}
              {hover ? (
                <div className={styles.tooltip} style={{ left: Math.min(width - 132, Math.max(8, hover.x + 10)) }}>
                  <strong>{formatDate(hover.date)}</strong>
                  <span>{baseTicker} {formatChange(hover.base)}</span>
                  <span>{peerTicker} {formatChange(hover.peer)}</span>
                </div>
              ) : null}
            </div>
          )
        }}
      </ChartContainer>
    </div>
  )
}
