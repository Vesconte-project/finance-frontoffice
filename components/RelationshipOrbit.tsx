'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import RelationshipComparisonChart from '@/components/RelationshipComparisonChart'
import ExpandingSelector from '@/components/ui/ExpandingSelector'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { sectorColor } from '@/lib/network-regions'
import type { RelationshipNeighbor, RelationshipThemePeer, TickerRelationships } from '@/lib/relationships'
import styles from './RelationshipOrbit.module.css'

export type RelationshipWindow = 126 | 252
export type ToggleLayer = 'residual' | 'leadLag' | 'theme' | 'market'

type RelationshipOrbitProps = {
  centerTicker: string
  centerName: string | null
  relationshipsByWindow: Record<RelationshipWindow, TickerRelationships>
  coverageLabel: string
  initialWindow?: RelationshipWindow
  initialLayer?: ToggleLayer
  maxNeighborsPerLayer?: number
}

type RelationshipFlow = 'to-center' | 'from-center' | null

type RelationshipRow = {
  symbol: string
  name: string | null
  sector: string | null
  country: string | null
  region: string | null
  relation: string
  detail: string | null
  strength: number | null
  confidence: number | null
  flow: RelationshipFlow
  color: string
}

type OrbitPoint = RelationshipRow & {
  x: number
  y: number
  rank: number
  normalizedStrength: number
  confidenceProminence: number
  size: number
}

const DEFAULT_LAYER_RENDER_LIMIT = 50
const INITIAL_CARD_COUNT = 12
const LAYER_ORDER: ToggleLayer[] = ['residual', 'leadLag', 'theme', 'market']
const LAYER_COPY: Record<ToggleLayer, { label: string }> = {
  residual: {
    label: 'Moves independently',
  },
  leadLag: {
    label: 'Moves before / after',
  },
  theme: {
    label: 'Same investment theme',
  },
  market: {
    label: 'Moves with the market',
  },
}
const LAYER_DESCRIPTION: Record<ToggleLayer, (ticker: string) => string> = {
  residual: (ticker) => `Companies whose movement remained connected to ${ticker} after broad-market effects were filtered out.`,
  leadLag: (ticker) => `Companies observed moving before or after ${ticker}; this indicates timing, not causality.`,
  theme: (ticker) => `Companies returned with an investment theme shared with ${ticker}.`,
  market: (ticker) => `Companies whose prices moved with ${ticker} as part of the wider market.`,
}
const WINDOW_OPTIONS = ['126', '252'] as const

function strengthMagnitude(value: number | null): number {
  return value === null ? -1 : Math.abs(value)
}

function formatStrength(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function normalizedConfidence(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const scaled = Math.abs(value) <= 1 ? value : value / 100
  return Math.max(0, Math.min(1, scaled))
}

function formatConfidence(value: number | null): string {
  const normalized = normalizedConfidence(value)
  return normalized === null ? '—' : `${Math.round(normalized * 100)}%`
}

function themeLabel(peer: RelationshipThemePeer): string | null {
  const theme = peer.theme ?? peer.themes[0]
  return theme ? theme.replace(/[_-]+/g, ' ') : null
}

function sortRows(rows: RelationshipRow[]): RelationshipRow[] {
  return [...rows].sort(
    (left, right) => strengthMagnitude(right.strength) - strengthMagnitude(left.strength) || left.symbol.localeCompare(right.symbol),
  )
}

function layerItems(relationships: TickerRelationships, layer: ToggleLayer): RelationshipRow[] {
  const nodeLookup = new Map(relationships.nodes.map((node) => [node.ticker, node]))
  const row = (
    item: RelationshipNeighbor | RelationshipThemePeer,
    relation: string,
    detail: string | null = null,
    flow: RelationshipFlow = null,
  ): RelationshipRow => {
    const node = nodeLookup.get(item.symbol)
    return {
      symbol: item.symbol,
      name: node?.name ?? null,
      sector: node?.sector ?? null,
      country: node?.country ?? null,
      region: node?.region ?? null,
      relation,
      detail,
      strength: item.strength,
      confidence: item.confidence,
      flow,
      color: sectorColor(node?.sector),
    }
  }

  if (layer === 'residual') {
    return relationships.residualCoMovers.map((item) => row(item, 'Beyond-market movement'))
  }
  if (layer === 'theme') {
    return relationships.themePeers.map((item) => row(item, 'Shared investment theme', themeLabel(item)))
  }
  if (layer === 'market') {
    return relationships.marketCoMovers.map((item) => row(item, 'Wider-market movement'))
  }
  return [
    ...relationships.leadLag.leaders.map((item) => row(item, 'Moved before', null, 'to-center')),
    ...relationships.leadLag.followers.map((item) => row(item, 'Moved after', null, 'from-center')),
  ]
}

function preferredLayer(relationships: TickerRelationships): ToggleLayer {
  return [...LAYER_ORDER].sort(
    (left, right) => layerItems(relationships, right).length - layerItems(relationships, left).length,
  )[0] ?? 'residual'
}

function symbolHash(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function orbitPoints(rows: RelationshipRow[], limit: number): OrbitPoint[] {
  const visibleRows = sortRows(rows).slice(0, Math.max(1, Math.min(50, Math.round(limit))))
  const strengths = visibleRows.map((row) => strengthMagnitude(row.strength)).filter((value) => value >= 0)
  const minStrength = strengths.length > 0 ? Math.min(...strengths) : 0
  const maxStrength = strengths.length > 0 ? Math.max(...strengths) : 1
  const spread = maxStrength - minStrength || 1
  const confidences = visibleRows
    .map((row) => normalizedConfidence(row.confidence))
    .filter((value): value is number => value !== null)
  const minConfidence = confidences.length > 0 ? Math.min(...confidences) : 0
  const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 1
  const confidenceSpread = maxConfidence - minConfidence
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return visibleRows.map((item, index) => {
    const magnitude = Math.max(0, strengthMagnitude(item.strength))
    const normalizedStrength = Math.max(0, Math.min(1, (magnitude - minStrength) / spread))
    const confidence = normalizedConfidence(item.confidence)
    const relativeConfidence = confidence === null || confidenceSpread <= 0.0001
      ? confidence
      : (confidence - minConfidence) / confidenceSpread
    const confidenceProminence = confidence === null
      ? 0.5
      : Math.max(0, Math.min(1, confidence * 0.65 + (relativeConfidence ?? confidence) * 0.35))
    const density = visibleRows.length <= 1 ? 0 : Math.sqrt(index / Math.max(1, visibleRows.length - 1))
    const hash = symbolHash(item.symbol)
    const angle = index * goldenAngle + ((hash % 101) / 101 - 0.5) * 0.22
    const radius = 15 + density * 31 + (((hash >>> 8) % 100) / 100 - 0.5) * 2.8
    return {
      ...item,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.78,
      rank: index + 1,
      normalizedStrength,
      confidenceProminence,
      size: 24 + normalizedStrength * 25,
    }
  })
}

function pointOnQuadratic(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
) {
  const inverse = 1 - progress
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  }
}

function tangentOnQuadratic(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
) {
  return {
    x: 2 * (1 - progress) * (control.x - start.x) + 2 * progress * (end.x - control.x),
    y: 2 * (1 - progress) * (control.y - start.y) + 2 * progress * (end.y - control.y),
  }
}

function RelationshipConnections({
  points,
  selectedSymbol,
  layer,
}: {
  points: OrbitPoint[]
  selectedSymbol: string
  layer: ToggleLayer
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = canvas?.parentElement as HTMLDivElement | null
    if (!canvas || !stage) return
    const context = canvas.getContext('2d')
    if (!context) return

    let frame = 0
    let visible = true
    let width = 0
    let height = 0
    let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let focusStartedAt = performance.now()

    const resize = () => {
      const bounds = stage.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawArrow = (
      point: OrbitPoint,
      start: { x: number; y: number },
      control: { x: number; y: number },
      end: { x: number; y: number },
      alpha: number,
    ) => {
      if (!point.flow) return
      const progress = point.flow === 'from-center' ? 0.68 : 0.32
      const position = pointOnQuadratic(start, control, end, progress)
      const tangent = tangentOnQuadratic(start, control, end, progress)
      const direction = point.flow === 'from-center' ? 1 : -1
      const angle = Math.atan2(tangent.y * direction, tangent.x * direction)
      context.save()
      context.translate(position.x, position.y)
      context.rotate(angle)
      context.beginPath()
      context.moveTo(4.5, 0)
      context.lineTo(-3.5, -2.7)
      context.lineTo(-3.5, 2.7)
      context.closePath()
      context.fillStyle = point.color
      context.globalAlpha = alpha
      context.fill()
      context.restore()
    }

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height)
      const center = { x: width * 0.5, y: height * 0.5 }
      const focusProgress = reduceMotion ? 1 : Math.min(1, (time - focusStartedAt) / 360)
      let hasDirectionalMotion = false

      for (const point of points) {
        const active = point.symbol === selectedSymbol
        const end = { x: width * (point.x / 100), y: height * (point.y / 100) }
        const dx = end.x - center.x
        const dy = end.y - center.y
        const length = Math.max(1, Math.hypot(dx, dy))
        const curve = (symbolHash(point.symbol) % 2 === 0 ? -1 : 1) * Math.min(20, length * 0.07)
        const control = {
          x: (center.x + end.x) / 2 + (-dy / length) * curve,
          y: (center.y + end.y) / 2 + (dx / length) * curve,
        }
        const strengthWeight = Math.pow(point.normalizedStrength, 2.25)
        const confidenceWeight = Math.pow(point.confidenceProminence, 1.7)
        const restingAlpha = 0.015 + confidenceWeight * 0.34
        const alpha = active ? 0.2 + 0.58 * focusProgress : restingAlpha

        context.save()
        context.beginPath()
        context.moveTo(center.x, center.y)
        context.quadraticCurveTo(control.x, control.y, end.x, end.y)
        context.strokeStyle = point.color
        context.globalAlpha = alpha
        context.lineWidth = active ? 2.8 + strengthWeight * 1.3 : 0.35 + strengthWeight * 3.1
        context.lineCap = 'round'
        if (layer === 'theme' || layer === 'market') context.setLineDash([4, 8])
        if (active) {
          context.shadowBlur = 11
          context.shadowColor = point.color
        }
        context.stroke()
        context.restore()

        if (point.flow) {
          const arrowAlpha = active ? 0.86 : 0.03 + confidenceWeight * 0.34
          drawArrow(point, center, control, end, arrowAlpha)
        }

        if (active && point.flow && !reduceMotion) {
          hasDirectionalMotion = true
          const base = ((time / 1900) % 1 + (point.flow === 'to-center' ? 0.5 : 0)) % 1
          for (let index = 0; index < 2; index += 1) {
            const rawProgress = (base + index * 0.43) % 1
            const progress = point.flow === 'to-center' ? 1 - rawProgress : rawProgress
            const particle = pointOnQuadratic(center, control, end, progress)
            context.save()
            context.beginPath()
            context.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2)
            context.fillStyle = point.color
            context.globalAlpha = 0.18 + Math.sin(rawProgress * Math.PI) * 0.72
            context.shadowBlur = 8
            context.shadowColor = point.color
            context.fill()
            context.restore()
          }
        }
      }

      if (visible && !document.hidden && !reduceMotion && (focusProgress < 1 || hasDirectionalMotion)) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const restart = () => {
      window.cancelAnimationFrame(frame)
      focusStartedAt = performance.now()
      resize()
      frame = window.requestAnimationFrame(draw)
    }
    const resizeObserver = new ResizeObserver(restart)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) restart()
      else window.cancelAnimationFrame(frame)
    })
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => {
      reduceMotion = motionQuery.matches
      restart()
    }
    const updateVisibility = () => {
      if (!document.hidden && visible) restart()
      else window.cancelAnimationFrame(frame)
    }

    resizeObserver.observe(stage)
    intersectionObserver.observe(stage)
    motionQuery.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    restart()

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      motionQuery.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [layer, points, selectedSymbol])

  return <canvas ref={canvasRef} className={styles.connections} aria-hidden="true" />
}

function evidenceLabel(row: RelationshipRow, centerTicker: string, layer: ToggleLayer): string {
  if (row.flow === 'to-center') return `${row.symbol} tended to move before ${centerTicker}`
  if (row.flow === 'from-center') return `${row.symbol} tended to move after ${centerTicker}`
  if (layer === 'theme' && row.detail) return `Shared theme: ${row.detail}`
  if (layer === 'residual') return 'Movement remained after broad-market filtering'
  return 'Movement observed with the wider market'
}

function contextLabel(row: RelationshipRow): string | null {
  return row.detail ?? row.sector ?? row.country ?? row.region
}

function RelationshipInspector({
  row,
  centerTicker,
  layer,
}: {
  row: RelationshipRow
  centerTicker: string
  layer: ToggleLayer
}) {
  const reduceMotion = useReducedMotion()
  const context = contextLabel(row)
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${layer}:${row.symbol}`}
        className={styles.readout}
        initial={reduceMotion ? false : { opacity: 0, y: 9, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -5, filter: 'blur(4px)' }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.readoutHeader}>
          <div className={styles.companyIdentity}>
            <span className={styles.companyMarker} style={{ '--company-color': row.color } as CSSProperties} />
            <div>
              <h2 data-company-name="">{row.name ?? row.symbol}</h2>
              {row.name ? <span className={styles.tickerBadge} data-company-ticker="">{row.symbol}</span> : null}
            </div>
          </div>
          <div className={styles.evidenceMetrics}>
            <span><small>Raw strength</small><strong>{formatStrength(row.strength)}</strong></span>
            <span><small>Confidence</small><strong>{formatConfidence(row.confidence)}</strong></span>
          </div>
        </div>

        <p className={styles.evidenceStatement}>{evidenceLabel(row, centerTicker, layer)}</p>

        <div className={styles.comparison}>
          <RelationshipComparisonChart
            baseTicker={centerTicker}
            peerTicker={row.symbol}
            peerColor={row.color}
          />
        </div>

        {context ? (
          <div className={styles.contextLine}>
            <span>{layer === 'theme' && row.detail ? 'Theme' : 'Company context'}</span>
            <strong>{context}</strong>
          </div>
        ) : null}

        <Link href={`/stocks/${row.symbol}`} className={styles.openLink}>Explore {row.symbol}</Link>
      </motion.div>
    </AnimatePresence>
  )
}

function DiscoveryCards({
  rows,
  selectedSymbol,
  centerTicker,
  layer,
  onSelect,
}: {
  rows: RelationshipRow[]
  selectedSymbol: string
  centerTicker: string
  layer: ToggleLayer
  onSelect: (symbol: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, INITIAL_CARD_COUNT)

  return (
    <section className={styles.discovery} aria-labelledby="relationship-discovery-heading">
      <div className={styles.discoveryHeader}>
        <div>
          <h2 id="relationship-discovery-heading">Connected companies</h2>
          <p>Select one to compare its recent price path with {centerTicker}.</p>
        </div>
        <span>{rows.length} found</span>
      </div>

      <div className={styles.cardGrid}>
        {visibleRows.map((row) => {
          const active = row.symbol === selectedSymbol
          return (
            <article
              key={`${row.relation}:${row.symbol}`}
              className={styles.companyCard}
              data-relationship-card=""
              data-selected={active ? 'true' : 'false'}
              style={{ '--company-color': row.color } as CSSProperties}
            >
              <button type="button" onClick={() => onSelect(row.symbol)} aria-pressed={active}>
                <span className={styles.cardTopline}>
                  <i />
                  <strong>{row.symbol}</strong>
                  <b>{formatStrength(row.strength)} · {formatConfidence(row.confidence)} conf.</b>
                </span>
                {row.name ? <span className={styles.cardName}>{row.name}</span> : null}
                <span className={styles.cardEvidence}>{evidenceLabel(row, centerTicker, layer)}</span>
              </button>
              <Link href={`/stocks/${row.symbol}`} aria-label={`Explore ${row.symbol}`}>Explore</Link>
            </article>
          )
        })}
      </div>

      {rows.length > INITIAL_CARD_COUNT ? (
        <button type="button" className={styles.showAll} onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Show strongest only' : `Show all ${rows.length} companies`}
        </button>
      ) : null}
    </section>
  )
}

export default function RelationshipOrbit({
  centerTicker,
  centerName,
  relationshipsByWindow,
  coverageLabel,
  initialWindow = 252,
  initialLayer,
  maxNeighborsPerLayer = DEFAULT_LAYER_RENDER_LIMIT,
}: RelationshipOrbitProps) {
  const normalizedCenter = centerTicker.trim().toUpperCase()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion()
  const nodeRefs = useRef<Array<HTMLButtonElement | null>>([])
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const availableWindows = useMemo(
    () => ([126, 252] as RelationshipWindow[]).filter((candidate) =>
      LAYER_ORDER.some((layer) => layerItems(relationshipsByWindow[candidate], layer).length > 0),
    ),
    [relationshipsByWindow],
  )
  const firstWindow = availableWindows.includes(initialWindow) ? initialWindow : (availableWindows[0] ?? initialWindow)
  const [window, setWindow] = useState<RelationshipWindow>(firstWindow)
  const relationships = relationshipsByWindow[window]
  const availableLayers = LAYER_ORDER.filter((layer) => layerItems(relationships, layer).length > 0)
  const layerOptions = availableLayers.map((layer) => ({ value: layer, label: LAYER_COPY[layer].label }))
  const initialAvailableLayer = initialLayer && availableLayers.includes(initialLayer) ? initialLayer : preferredLayer(relationships)
  const [activeLayer, setActiveLayer] = useState<ToggleLayer>(initialAvailableLayer)
  const visibleLayer = availableLayers.includes(activeLayer) ? activeLayer : preferredLayer(relationships)
  const allRows = useMemo(() => sortRows(layerItems(relationships, visibleLayer)), [relationships, visibleLayer])
  const points = useMemo(() => orbitPoints(allRows, maxNeighborsPerLayer), [allRows, maxNeighborsPerLayer])
  const [selectedSymbol, setSelectedSymbol] = useState(points[0]?.symbol ?? '')
  const selectedRow = allRows.find((row) => row.symbol === selectedSymbol) ?? points[0] ?? allRows[0]

  const updateQuery = (next: { layer?: ToggleLayer; window?: RelationshipWindow }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.layer) params.set('layer', next.layer)
    if (next.window) params.set('window', String(next.window))
    const query = params.toString()
    globalThis.history.replaceState(globalThis.history.state, '', query ? `${pathname}?${query}` : pathname)
  }

  const selectWindow = (value: string) => {
    const nextWindow = value === '126' ? 126 : 252
    if (!availableWindows.includes(nextWindow)) return
    const nextRelationships = relationshipsByWindow[nextWindow]
    const nextLayers = LAYER_ORDER.filter((layer) => layerItems(nextRelationships, layer).length > 0)
    const nextLayer = nextLayers.includes(activeLayer) ? activeLayer : preferredLayer(nextRelationships)
    setWindow(nextWindow)
    setActiveLayer(nextLayer)
    setSelectedSymbol(sortRows(layerItems(nextRelationships, nextLayer))[0]?.symbol ?? '')
    updateQuery({ window: nextWindow, layer: nextLayer })
  }

  const selectLayer = (layer: ToggleLayer) => {
    if (!availableLayers.includes(layer)) return
    setActiveLayer(layer)
    setSelectedSymbol(sortRows(layerItems(relationships, layer))[0]?.symbol ?? '')
    updateQuery({ layer })
  }

  const selectLayerValue = (value: string) => {
    if (value === 'residual' || value === 'leadLag' || value === 'theme' || value === 'market') selectLayer(value)
  }

  const selectFromCard = (symbol: string) => {
    setSelectedSymbol(symbol)
    globalThis.requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const handleNodeKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let nextIndex = index
    if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = points.length - 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + points.length) % points.length
    else nextIndex = (index + 1) % points.length
    const next = points[nextIndex]
    if (!next) return
    setSelectedSymbol(next.symbol)
    nodeRefs.current[nextIndex]?.focus()
  }

  if (!selectedRow) return null

  return (
    <section className={styles.root} data-relationship-evidence="">
      <div className={styles.controlDeck}>
        <div className={styles.controlBar}>
          <ExpandingSelector
            label="View"
            ariaLabel="Relationship view"
            value={visibleLayer}
            options={layerOptions}
            onValueChange={selectLayerValue}
            className={styles.modeSelector}
          />
          <div className={styles.windowControl}>
            <span>Window</span>
            {availableWindows.length > 1 ? (
              <SegmentedControl
                options={WINDOW_OPTIONS.filter((option) => availableWindows.includes(Number(option) as RelationshipWindow))}
                value={String(window) as '126' | '252'}
                onChange={selectWindow}
                ariaLabel="Evidence window"
                analyticsId="relationship_window"
              />
            ) : (
              <strong>{window}</strong>
            )}
          </div>
        </div>
        <div className={styles.metadata} aria-label="Relationship dataset details">
          <span>Dataset {relationships.asOf ?? 'date unavailable'}</span>
          <span>{allRows.length} companies</span>
          <span>{coverageLabel}</span>
        </div>
      </div>

      <div className={styles.mapGuide} id="relationship-map-guide">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={visibleLayer}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {LAYER_DESCRIPTION[visibleLayer](normalizedCenter)}
          </motion.p>
        </AnimatePresence>
        <div className={styles.mapLegend} aria-label="How to read the relationship map">
          <span><i data-key="strength" />Strength = closer, larger, thicker</span>
          <span><i data-key="confidence" />Confidence = clearer</span>
          <span><i data-key="sector" />Colour = sector</span>
          {visibleLayer === 'leadLag' ? <span><i data-key="direction" />Arrow = observed order</span> : null}
        </div>
      </div>

      <div className={styles.workspace} ref={workspaceRef}>
        <div className={styles.stage} data-layer={visibleLayer} data-selected-symbol={selectedSymbol} aria-describedby="relationship-map-guide">
          <RelationshipConnections points={points} selectedSymbol={selectedSymbol} layer={visibleLayer} />
          <div className={styles.centerNode} data-relationship-center="">
            <span className={styles.centerBall} />
            <strong>{normalizedCenter}</strong>
            {centerName ? <small>{centerName}</small> : null}
          </div>
          <div role="group" aria-label={`Companies related to ${normalizedCenter}`}>
            {points.map((point, index) => {
              const active = point.symbol === selectedSymbol
              return (
                <button
                  key={`${visibleLayer}:${point.symbol}`}
                  ref={(node) => { nodeRefs.current[index] = node }}
                  type="button"
                  className={styles.node}
                  style={{
                    '--node-x': `${point.x.toFixed(4)}%`,
                    '--node-y': `${point.y.toFixed(4)}%`,
                    '--node-size': `${point.size.toFixed(3)}px`,
                    '--node-color': point.color,
                    '--node-confidence': point.confidenceProminence.toFixed(4),
                  } as CSSProperties}
                  data-relationship-node=""
                  data-active={active ? 'true' : 'false'}
                  data-labelled={point.rank <= 9 ? 'true' : 'false'}
                  aria-pressed={active}
                  aria-label={`${point.symbol}, ${point.relation}, raw strength ${formatStrength(point.strength)}, confidence ${formatConfidence(point.confidence)}`}
                  onClick={() => setSelectedSymbol(point.symbol)}
                  onFocus={() => setSelectedSymbol(point.symbol)}
                  onKeyDown={(event) => handleNodeKeyboard(event, index)}
                >
                  <span className={styles.nodeBall}><i /></span>
                  <strong>{point.symbol}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <aside className={styles.inspector} aria-live="polite">
          <RelationshipInspector row={selectedRow} centerTicker={normalizedCenter} layer={visibleLayer} />
        </aside>
      </div>

      <DiscoveryCards
        key={`${window}:${visibleLayer}`}
        rows={allRows}
        selectedSymbol={selectedSymbol}
        centerTicker={normalizedCenter}
        layer={visibleLayer}
        onSelect={selectFromCard}
      />
    </section>
  )
}
