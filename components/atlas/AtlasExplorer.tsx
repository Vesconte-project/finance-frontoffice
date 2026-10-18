'use client'

import Link from 'next/link'
import { Lock, Maximize2, Minus, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  atlasOverviewPath,
  parseCompanyPanel,
  parseOverview,
  parseZonePanel,
  type AtlasCompanyPanel,
  type AtlasDenial,
  type AtlasLine,
  type AtlasNode,
  type AtlasOverview,
  type AtlasZone,
  type AtlasZonePanel,
  atlasDenial,
} from '@/lib/atlas-model'
import {
  LEVEL_ZOOM,
  atlasBounds,
  covers,
  dotRadius,
  fitCamera,
  levelForZoom,
  nodeAt,
  padBounds,
  toScreen,
  toWorld,
  visibleBounds,
  zoneAt,
  zoneHues,
  zoomAt,
  type Bounds,
  type Camera,
  type Viewport,
} from '@/lib/atlas-view'
import styles from './AtlasExplorer.module.css'

const SIGN_UP_HREF = '/sign-up?redirect_url=/markets/network'

type Selection = { kind: 'company'; symbol: string } | { kind: 'zone'; zoneId: string } | null

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'company'; data: AtlasCompanyPanel }
  | { status: 'zone'; data: AtlasZonePanel }
  | { status: 'denied'; reason: AtlasDenial }
  | { status: 'error' }

type Detail = { level: number; area: Bounds; nodes: AtlasNode[]; lines: AtlasLine[] }

type Palette = { bg: string; text: string; muted: string; line: string; accent: string; dark: boolean }

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const bg = token('--bg', '#F2F3F5')
  const hex = bg.replace('#', '')
  const luminance = hex.length === 6 ? parseInt(hex.slice(0, 2), 16) * 0.3 + parseInt(hex.slice(2, 4), 16) * 0.59 + parseInt(hex.slice(4, 6), 16) * 0.11 : 240
  return {
    bg,
    text: token('--text', '#0B1220'),
    muted: token('--text-muted', '#566173'),
    line: token('--line', '#D3D8DF'),
    accent: token('--accent', '#2557D6'),
    dark: luminance < 110,
  }
}

function zoneFill(hue: number, palette: Palette, emphasis: number): string {
  return palette.dark ? `hsla(${hue}, 38%, 62%, ${0.16 * emphasis})` : `hsla(${hue}, 46%, 52%, ${0.2 * emphasis})`
}

function zoneInk(hue: number, palette: Palette, alpha = 1): string {
  return palette.dark ? `hsla(${hue}, 45%, 72%, ${alpha})` : `hsla(${hue}, 40%, 34%, ${alpha})`
}

function formatCap(value: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return null
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** A plain-language strength for a tie, so the panel reads without a coefficient. */
function strength(correlation: number): string {
  if (correlation >= 0.6) return 'Very strong'
  if (correlation >= 0.4) return 'Strong'
  if (correlation >= 0.25) return 'Clear'
  return 'Weak'
}

export default function AtlasExplorer({ initial }: { initial: AtlasOverview }) {
  const access = initial.access
  const signedIn = access.tier !== 'signedOut'
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 })
  const fitRef = useRef<Camera | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{ moved: boolean; startX: number; startY: number; pinch: number | null } | null>(null)
  const frameRequest = useRef<number | null>(null)
  const paletteRef = useRef<Palette | null>(null)
  const [zoom, setZoom] = useState(1)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingArea, setLoadingArea] = useState(false)
  const [areaError, setAreaError] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [hover, setHover] = useState<AtlasNode | null>(null)
  const [browseOpen, setBrowseOpen] = useState(false)

  const hues = useMemo(() => zoneHues(initial.zones), [initial.zones])
  const zonesById = useMemo(() => new Map(initial.zones.map((zone) => [zone.zoneId, zone])), [initial.zones])
  const maxLevel = signedIn ? access.maxLevel : Math.min(access.maxLevel, initial.level)
  const level = levelForZoom(zoom, maxLevel)

  // The base map is the first answer; deeper levels arrive per area and replace only what they cover.
  const nodes = useMemo(() => {
    const merged = new Map(initial.nodes.map((node) => [node.symbol, node]))
    if (detail) for (const node of detail.nodes) merged.set(node.symbol, node)
    return [...merged.values()].filter((node) => node.level <= level)
  }, [initial.nodes, detail, level])
  const lines = useMemo(() => {
    if (!access.lines) return []
    const source = detail && detail.level === level ? detail.lines : initial.level === level ? initial.lines : []
    const shown = new Set(nodes.map((node) => node.symbol))
    return source.filter((line) => shown.has(line.source) && shown.has(line.target))
  }, [access.lines, detail, initial.level, initial.lines, level, nodes])
  const bundles = useMemo(() => {
    // Signed in, the structural bundles; signed out there is no such flag, so the most numerous ones.
    const ranked = [...initial.bundles].sort((a, b) => b.tieCount - a.tieCount)
    const kept = signedIn ? ranked.filter((bundle) => bundle.structural) : ranked.slice(0, Math.max(4, initial.zones.length))
    return kept
  }, [initial.bundles, initial.zones.length, signedIn])
  const maxTies = useMemo(() => Math.max(1, ...bundles.map((bundle) => bundle.tieCount)), [bundles])

  const draw = useCallback(() => {
    frameRequest.current = null
    const canvas = canvasRef.current
    const camera = cameraRef.current
    const viewport = viewportRef.current
    if (!canvas || !camera || !viewport.width) return
    const palette = paletteRef.current ?? readPalette(canvas)
    paletteRef.current = palette
    const ratio = window.devicePixelRatio || 1
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, viewport.width, viewport.height)
    const focusZone = selection?.kind === 'zone' ? selection.zoneId : null
    const emphasis = (zoneId: string) => (focusZone === null ? 1 : zoneId === focusZone ? 1.7 : 0.45)

    // zones
    for (const zone of initial.zones) {
      const hue = hues.get(zone.zoneId) ?? 200
      const contour = zone.contour
      if (!contour) continue
      context.beginPath()
      if (contour.type === 'circle') {
        const [sx, sy] = toScreen(camera, viewport, contour.x, contour.y)
        context.arc(sx, sy, contour.radius * camera.k, 0, Math.PI * 2)
      } else {
        for (const ring of contour.rings) {
          ring.forEach(([x, y], index) => {
            const [sx, sy] = toScreen(camera, viewport, x, y)
            if (index === 0) context.moveTo(sx, sy)
            else context.lineTo(sx, sy)
          })
          context.closePath()
        }
      }
      context.fillStyle = zoneFill(hue, palette, emphasis(zone.zoneId))
      context.fill('evenodd')
      context.strokeStyle = zoneInk(hue, palette, 0.42 * Math.min(1, emphasis(zone.zoneId)))
      context.lineWidth = contour.type === 'circle' ? 1 : 1.1
      if (contour.type === 'circle') context.setLineDash([3, 4])
      context.stroke()
      context.setLineDash([])
    }

    // bundles between zones: one curve per pair, thicker with more ties
    for (const bundle of bundles) {
      const a = zonesById.get(bundle.zoneA)
      const b = zonesById.get(bundle.zoneB)
      if (!a || !b || a.x === null || a.y === null || b.x === null || b.y === null) continue
      const [ax, ay] = toScreen(camera, viewport, a.x, a.y)
      const [bx, by] = toScreen(camera, viewport, b.x, b.y)
      const mx = (ax + bx) / 2 - (by - ay) * 0.12
      const my = (ay + by) / 2 + (bx - ax) * 0.12
      const involved = focusZone === null || bundle.zoneA === focusZone || bundle.zoneB === focusZone
      context.beginPath()
      context.moveTo(ax, ay)
      context.quadraticCurveTo(mx, my, bx, by)
      context.strokeStyle = palette.muted
      context.globalAlpha = involved ? 0.22 + 0.3 * (bundle.tieCount / maxTies) : 0.06
      context.lineWidth = 0.8 + 3.2 * Math.sqrt(bundle.tieCount / maxTies)
      context.stroke()
      context.globalAlpha = 1
    }

    // lines: the strongest-ties tree inside each zone, for the level on screen
    const bySymbol = new Map(nodes.map((node) => [node.symbol, node]))
    context.lineWidth = 0.8
    for (const line of lines) {
      const a = bySymbol.get(line.source)
      const b = bySymbol.get(line.target)
      if (!a || !b) continue
      const [ax, ay] = toScreen(camera, viewport, a.x, a.y)
      const [bx, by] = toScreen(camera, viewport, b.x, b.y)
      context.beginPath()
      context.moveTo(ax, ay)
      context.lineTo(bx, by)
      context.strokeStyle = zoneInk(hues.get(line.zoneId) ?? 200, palette, focusZone === null || line.zoneId === focusZone ? 0.38 : 0.08)
      context.stroke()
    }

    // companies
    const selected = selection?.kind === 'company' ? selection.symbol : null
    for (const node of nodes) {
      const [sx, sy] = toScreen(camera, viewport, node.x, node.y)
      if (sx < -20 || sy < -20 || sx > viewport.width + 20 || sy > viewport.height + 20) continue
      const radius = dotRadius(node.size)
      context.beginPath()
      context.arc(sx, sy, radius, 0, Math.PI * 2)
      context.fillStyle = zoneInk(hues.get(node.zoneId) ?? 200, palette, focusZone === null || node.zoneId === focusZone ? 0.9 : 0.25)
      context.fill()
      if (node.symbol === selected || node.symbol === hover?.symbol) {
        context.lineWidth = 2
        context.strokeStyle = palette.accent
        context.beginPath()
        context.arc(sx, sy, radius + 3, 0, Math.PI * 2)
        context.stroke()
      }
    }

    // labels: zones first, then companies where there is room
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const placed: Array<[number, number, number, number]> = []
    const free = (x0: number, y0: number, x1: number, y1: number) =>
      placed.every(([a0, b0, a1, b1]) => x1 < a0 || x0 > a1 || y1 < b0 || y0 > b1)
    context.font = '600 11px "IBM Plex Sans", system-ui, sans-serif'
    for (const zone of [...initial.zones].sort((a, b) => b.memberCount - a.memberCount)) {
      if (zone.x === null || zone.y === null) continue
      const [sx, sy] = toScreen(camera, viewport, zone.x, zone.y)
      const label = zone.label.toUpperCase()
      const width = context.measureText(label).width + 6
      if (!free(sx - width / 2, sy - 8, sx + width / 2, sy + 8)) continue
      placed.push([sx - width / 2, sy - 8, sx + width / 2, sy + 8])
      context.lineWidth = 3
      context.strokeStyle = palette.bg
      context.strokeText(label, sx, sy)
      context.fillStyle = zoneInk(hues.get(zone.zoneId) ?? 200, palette, focusZone === null || zone.zoneId === focusZone ? 1 : 0.4)
      context.fillText(label, sx, sy)
    }
    context.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace'
    const zoomNow = camera.k / (fitRef.current?.k ?? camera.k)
    for (const node of [...nodes].sort((a, b) => a.level - b.level || a.size - b.size)) {
      if (zoomNow < LEVEL_ZOOM[node.level] + 0.9 && node.symbol !== selected) continue
      const [sx, sy] = toScreen(camera, viewport, node.x, node.y)
      const y = sy + dotRadius(node.size) + 8
      const width = context.measureText(node.symbol).width + 4
      if (!free(sx - width / 2, y - 6, sx + width / 2, y + 6)) continue
      placed.push([sx - width / 2, y - 6, sx + width / 2, y + 6])
      context.lineWidth = 3
      context.strokeStyle = palette.bg
      context.strokeText(node.symbol, sx, y)
      context.fillStyle = palette.text
      context.fillText(node.symbol, sx, y)
    }
  }, [bundles, hover, hues, initial.zones, lines, maxTies, nodes, selection, zonesById])

  // The latest drawing; listeners hold this ref, so they are not re-registered on every hover.
  const drawRef = useRef(draw)
  const schedule = useCallback(() => {
    if (frameRequest.current === null) frameRequest.current = requestAnimationFrame(() => drawRef.current())
  }, [])

  useEffect(() => {
    drawRef.current = draw
    schedule()
  }, [draw, schedule])

  // size, fit and theme
  useEffect(() => {
    const frame = frameRef.current
    const canvas = canvasRef.current
    if (!frame || !canvas) return
    const bounds = atlasBounds(initial)
    const resize = () => {
      const rect = frame.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      viewportRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.round(rect.width * ratio)
      canvas.height = Math.round(rect.height * ratio)
      const previousFit = fitRef.current
      fitRef.current = fitCamera(bounds, viewportRef.current)
      if (!cameraRef.current || !previousFit) cameraRef.current = { ...fitRef.current }
      else cameraRef.current = { ...cameraRef.current, k: cameraRef.current.k * (fitRef.current.k / previousFit.k) }
      schedule()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(frame)
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    const theme = () => {
      paletteRef.current = null
      schedule()
    }
    scheme.addEventListener('change', theme)
    const themeObserver = new MutationObserver(theme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => {
      observer.disconnect()
      scheme.removeEventListener('change', theme)
      themeObserver.disconnect()
    }
  }, [initial, schedule])

  useEffect(() => () => {
    if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current)
  }, [])

  const setCamera = useCallback((camera: Camera) => {
    cameraRef.current = camera
    const fit = fitRef.current
    if (fit) setZoom(camera.k / fit.k)
    schedule()
  }, [schedule])

  // deeper levels, per area, signed in only
  useEffect(() => {
    if (!signedIn || level <= initial.level) return
    const camera = cameraRef.current
    if (!camera) return
    const view = visibleBounds(camera, viewportRef.current)
    if (detail && detail.level >= level && covers(detail.area, view)) return
    const area = padBounds(view, 0.25)
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingArea(true)
      setAreaError(false)
      try {
        const response = await fetch(atlasOverviewPath(level, [area.x0, area.y0, area.x1, area.y1]), { signal: controller.signal })
        const parsed = response.ok ? parseOverview(await response.json()) : null
        if (!parsed) throw new Error('atlas area unavailable')
        setDetail({ level, area, nodes: parsed.nodes, lines: parsed.lines })
      } catch (error) {
        if (!controller.signal.aborted) setAreaError(true)
        void error
      } finally {
        if (!controller.signal.aborted) setLoadingArea(false)
      }
    }, 260)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [detail, initial.level, level, signedIn, zoom])

  // panel
  useEffect(() => {
    if (!selection) {
      setPanel({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setPanel({ status: 'loading' })
    const path = selection.kind === 'company'
      ? `/api/atlas/companies/${encodeURIComponent(selection.symbol)}`
      : `/api/atlas/zones/${encodeURIComponent(selection.zoneId)}`
    fetch(path, { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null)
        if (response.status === 403) {
          const reason = atlasDenial(body)
          setPanel(reason ? { status: 'denied', reason } : { status: 'error' })
          return
        }
        if (selection.kind === 'company') {
          const data = response.ok ? parseCompanyPanel(body) : null
          setPanel(data ? { status: 'company', data } : { status: 'error' })
        } else {
          const data = response.ok ? parseZonePanel(body) : null
          setPanel(data ? { status: 'zone', data } : { status: 'error' })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setPanel({ status: 'error' })
      })
    return () => controller.abort()
  }, [selection])

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFrom(event)
    pointersRef.current.set(event.pointerId, point)
    const [first, second] = [...pointersRef.current.values()]
    dragRef.current = {
      moved: pointersRef.current.size > 1,
      startX: point.x,
      startY: point.y,
      pinch: second ? Math.hypot(first.x - second.x, first.y - second.y) : null,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFrom(event)
    const camera = cameraRef.current
    const fit = fitRef.current
    const previous = pointersRef.current.get(event.pointerId)
    if (!camera || !fit) return
    if (!previous) {
      setHover(nodeAt(nodes, camera, viewportRef.current, point.x, point.y))
      return
    }
    pointersRef.current.set(event.pointerId, point)
    const drag = dragRef.current
    if (!drag) return
    if (pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (drag.pinch) setCamera(zoomAt(camera, viewportRef.current, fit.k, distance / drag.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2))
      drag.pinch = distance
      drag.moved = true
      return
    }
    if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 4) drag.moved = true
    if (drag.moved) setCamera({ ...camera, cx: camera.cx - (point.x - previous.x) / camera.k, cy: camera.cy + (point.y - previous.y) / camera.k })
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFrom(event)
    pointersRef.current.delete(event.pointerId)
    const drag = dragRef.current
    if (pointersRef.current.size === 0) dragRef.current = null
    const camera = cameraRef.current
    if (!drag || drag.moved || !camera) return
    const node = nodeAt(nodes, camera, viewportRef.current, point.x, point.y)
    if (node) {
      setSelection({ kind: 'company', symbol: node.symbol })
      return
    }
    const [wx, wy] = toWorld(camera, viewportRef.current, point.x, point.y)
    const zone = zoneAt(initial.zones, wx, wy)
    setSelection(zone ? { kind: 'zone', zoneId: zone.zoneId } : null)
  }

  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const camera = cameraRef.current
    const fit = fitRef.current
    const canvas = canvasRef.current
    if (!camera || !fit || !canvas) return
    const rect = canvas.getBoundingClientRect()
    setCamera(zoomAt(camera, viewportRef.current, fit.k, Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top))
  }, [setCamera])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const zoomBy = (factor: number) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return
    setCamera(zoomAt(camera, viewportRef.current, fit.k, factor, viewportRef.current.width / 2, viewportRef.current.height / 2))
  }

  const fitAll = () => {
    if (fitRef.current) setCamera({ ...fitRef.current })
  }

  const focusOn = (x: number, y: number, minimumZoom: number) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return
    setCamera({ cx: x, cy: y, k: Math.max(camera.k, fit.k * minimumZoom) })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const camera = cameraRef.current
    if (!camera) return
    const step = 60 / camera.k
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (event.key in moves) {
      const [dx, dy] = moves[event.key]
      setCamera({ ...camera, cx: camera.cx + dx, cy: camera.cy + dy })
    } else if (event.key === '+' || event.key === '=') zoomBy(1.4)
    else if (event.key === '-' || event.key === '_') zoomBy(1 / 1.4)
    else if (event.key === '0') fitAll()
    else if (event.key === 'Escape') setSelection(null)
    else return
    event.preventDefault()
  }

  const selectCompany = (node: AtlasNode) => {
    setSelection({ kind: 'company', symbol: node.symbol })
    focusOn(node.x, node.y, LEVEL_ZOOM[node.level] + 0.2)
  }

  const selectZone = (zone: AtlasZone) => {
    setSelection({ kind: 'zone', zoneId: zone.zoneId })
    if (zone.x !== null && zone.y !== null) focusOn(zone.x, zone.y, 1)
  }

  const browse = useMemo(() => {
    const byZone = new Map<string, AtlasNode[]>()
    for (const node of initial.nodes) {
      if (node.level > 0) continue
      const list = byZone.get(node.zoneId) ?? []
      list.push(node)
      byZone.set(node.zoneId, list)
    }
    return [...initial.zones].sort((a, b) => b.memberCount - a.memberCount).map((zone) => ({ zone, nodes: byZone.get(zone.zoneId) ?? [] }))
  }, [initial.nodes, initial.zones])

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.pill} aria-expanded={browseOpen} aria-controls="atlas-browse" onClick={() => setBrowseOpen((open) => !open)}>
          Browse atlas
        </button>
        <div className={styles.locked} role="group" aria-label="Movement over time">
          <span className={styles.eyebrow}>Movement</span>
          {signedIn ? (
            <span className={styles.lockNote}><Lock size={13} aria-hidden="true" /> History available on Pro</span>
          ) : (
            <Link className={styles.lockNote} href={SIGN_UP_HREF}><Lock size={13} aria-hidden="true" /> Create an account to follow the map</Link>
          )}
        </div>
      </div>

      {!signedIn ? (
        <p className={styles.invite}>
          You are seeing a sketch: the regions are in their real place, the largest companies are arranged inside them by size, and only the number of ties between regions is shown.{' '}
          <Link href={SIGN_UP_HREF}>Create a free account</Link> to see where every company really sits and what it moves with.
        </p>
      ) : null}

      <div className={styles.stage}>
        <div
          ref={frameRef}
          className={styles.frame}
          tabIndex={0}
          data-lenis-prevent=""
          role="application"
          aria-roledescription="map"
          aria-label={`Relationship atlas, week of ${formatDate(initial.asOf)}: ${initial.zoneCount} regions. Arrow keys move, plus and minus zoom, 0 shows the whole map, Escape closes the panel. Use Browse atlas for a list.`}
          onKeyDown={onKeyDown}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={(event) => {
              pointersRef.current.delete(event.pointerId)
              dragRef.current = null
            }}
            onPointerLeave={() => setHover(null)}
            aria-hidden="true"
          />
          {hover ? <span className={styles.tip} role="status">{hover.symbol}{hover.name ? ` · ${hover.name}` : ''}</span> : null}
          {loadingArea ? <span className={styles.loading} role="status">Loading companies in this area</span> : null}
          {areaError ? (
            <button type="button" className={styles.loading} onClick={() => { setAreaError(false); setDetail(null) }}>
              Companies in this area could not load. Retry
            </button>
          ) : null}
          <div className={styles.zoom} role="group" aria-label="Zoom">
            <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in"><Plus size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out"><Minus size={16} aria-hidden="true" /></button>
            <button type="button" onClick={fitAll} aria-label="Show the whole map"><Maximize2 size={14} aria-hidden="true" /></button>
            <span className={styles.level} aria-label={`Detail level ${level}`}>L{level}</span>
          </div>
          <p className={styles.footnote}>
            Week of {formatDate(initial.asOf)} · {initial.companyCount.toLocaleString('en-US')} companies in {initial.zoneCount} regions
          </p>
        </div>

        {selection ? (
          <aside className={styles.panel} aria-live="polite" aria-label="Details" data-lenis-prevent="">
            <button type="button" className={styles.close} onClick={() => setSelection(null)} aria-label="Close details"><X size={16} aria-hidden="true" /></button>
            <PanelBody panel={panel} zonesById={zonesById} onRetry={() => setSelection((current) => (current ? { ...current } : current))} />
          </aside>
        ) : null}
      </div>

      {browseOpen ? (
        <nav id="atlas-browse" className={styles.browse} aria-label="Regions and their largest companies">
          <ul>
            {browse.map(({ zone, nodes: leaders }) => (
              <li key={zone.zoneId}>
                <button type="button" className={styles.zoneButton} onClick={() => selectZone(zone)}>
                  {zone.label} <span>{zone.memberCount} companies</span>
                </button>
                {leaders.length ? (
                  <ul className={styles.companies}>
                    {leaders.map((node) => (
                      <li key={node.symbol}>
                        <button type="button" onClick={() => selectCompany(node)}>{node.symbol}</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

function CompanyLinks({ items }: { items: Array<{ symbol: string; name: string | null }> }) {
  return (
    <ul className={styles.refs}>
      {items.map((item) => (
        <li key={item.symbol}>
          <Link href={`/stocks/${encodeURIComponent(item.symbol)}`}><b>{item.symbol}</b>{item.name ? ` ${item.name}` : ''}</Link>
        </li>
      ))}
    </ul>
  )
}

function PanelBody({ panel, zonesById, onRetry }: { panel: PanelState; zonesById: Map<string, AtlasZone>; onRetry: () => void }) {
  if (panel.status === 'idle' || panel.status === 'loading') return <p className={styles.muted} role="status">Loading…</p>
  if (panel.status === 'error') {
    return (
      <div>
        <p className={styles.muted}>These details could not load.</p>
        <button type="button" className={styles.pill} onClick={onRetry}>Retry</button>
      </div>
    )
  }
  if (panel.status === 'denied') {
    return panel.reason === 'sign_in_required' ? (
      <div>
        <h2 className={styles.panelTitle}>Sign in to see this</h2>
        <p className={styles.muted}>Without an account the atlas shows each region and its largest companies. A free account shows every company, where it really sits and what it moves with.</p>
        <Link className={styles.cta} href={SIGN_UP_HREF}>Create a free account</Link>
      </div>
    ) : (
      <div>
        <h2 className={styles.panelTitle}>History available on Pro</h2>
        <p className={styles.muted}>Earlier weeks and how companies moved between them are part of Pro.</p>
      </div>
    )
  }
  if (panel.status === 'zone') {
    const zone = panel.data
    const signedOut = zone.access.tier === 'signedOut'
    return (
      <div>
        <p className={styles.eyebrow}>Region</p>
        <h2 className={styles.panelTitle}>{zone.label}</h2>
        <p className={styles.muted}>{zone.memberCount} companies whose prices move together beyond the market.</p>
        <h3 className={styles.panelHeading}>{signedOut ? 'Largest companies' : 'Leading companies'}</h3>
        <CompanyLinks items={zone.leaders} />
        {zone.members.length ? (
          <>
            <h3 className={styles.panelHeading}>All {zone.members.length} companies</h3>
            <ul className={styles.refs}>
              {zone.members.map((member) => (
                <li key={member.symbol}>
                  <Link href={`/stocks/${encodeURIComponent(member.symbol)}`}><b>{member.symbol}</b>{member.name ? ` ${member.name}` : ''}</Link>
                  {member.share !== null ? <span className={styles.share}>{Math.round(member.share * 100)}% here</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {signedOut ? <Link className={styles.cta} href={SIGN_UP_HREF}>See every company in this region</Link> : null}
      </div>
    )
  }
  const company = panel.data
  const signedOut = company.access.tier === 'signedOut'
  const cap = formatCap(company.marketCap)
  return (
    <div>
      <p className={styles.eyebrow}>{company.symbol}</p>
      <h2 className={styles.panelTitle}>{company.name ?? company.symbol}</h2>
      <p className={styles.muted}>
        {[company.sector, company.industry, company.country, cap].filter(Boolean).join(' · ')}
      </p>
      <p>In <b>{company.zoneLabel ?? zonesById.get(company.zoneId)?.label ?? 'its region'}</b></p>
      {company.memberships.length > 1 ? (
        <>
          <h3 className={styles.panelHeading}>Where its ties are</h3>
          <ul className={styles.refs}>
            {company.memberships.map((membership) => (
              <li key={membership.zoneId}>{membership.label ?? membership.zoneId} <span className={styles.share}>{Math.round(membership.share * 100)}%</span></li>
            ))}
          </ul>
        </>
      ) : null}
      {company.neighbours.length ? (
        <>
          <h3 className={styles.panelHeading}>Moves most with</h3>
          <ul className={styles.refs}>
            {company.neighbours.slice(0, 10).map((neighbour) => (
              <li key={neighbour.symbol}>
                <Link href={`/stocks/${encodeURIComponent(neighbour.symbol)}`}><b>{neighbour.symbol}</b>{neighbour.name ? ` ${neighbour.name}` : ''}</Link>
                <span className={styles.share}>{strength(neighbour.correlation)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {signedOut ? (
        <>
          <h3 className={styles.panelHeading}>Largest companies in this region</h3>
          <CompanyLinks items={company.zoneLeaders} />
          <Link className={styles.cta} href={SIGN_UP_HREF}>See what {company.symbol} moves with</Link>
        </>
      ) : null}
      <Link className={styles.more} href={`/stocks/${encodeURIComponent(company.symbol)}`}>Open {company.symbol}</Link>
    </div>
  )
}
