'use client'

import Link from 'next/link'
import { Layers, Lock, Maximize2, Minus, Network, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  atlasOverviewPath,
  atlasSymbol,
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
  RELIEF_PITCH,
  atlasBounds,
  ballRadius,
  buildSheet,
  correlationSentence,
  covers,
  findOnMap,
  fitCamera,
  groundAt,
  levelForZoom,
  mostConnected,
  nodeAt,
  padBounds,
  panBy,
  toWorld,
  visibleBounds,
  zoneAt,
  zoneHues,
  zoomAt,
  type Bounds,
  type Camera,
  type SearchResult,
  type Viewport,
} from '@/lib/atlas-view'
import { drawAtlas, edgeKey, parseColor, zoneColor, type Palette } from './atlas-canvas'
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

type Sheet = 'browse' | 'help' | 'layers' | null

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const bg = token('--bg', '#F2F3F5')
  const [red, green, blue] = parseColor(bg)
  const luminance = red * 0.3 + green * 0.59 + blue * 0.11
  return {
    bg,
    surface: token('--surface', '#FFFFFF'),
    text: token('--text', '#0B1220'),
    muted: token('--text-muted', '#566173'),
    accent: token('--accent', '#2557D6'),
    dark: luminance < 110,
  }
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
  const sheetButtons = useRef(new Map<Exclude<Sheet, null>, HTMLButtonElement | null>())
  const [zoom, setZoom] = useState(1)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingArea, setLoadingArea] = useState(false)
  const [areaError, setAreaError] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [hover, setHover] = useState<{ node: AtlasNode; x: number; y: number } | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const [openSheet, setOpenSheet] = useState<Sheet>(null)
  const [showNames, setShowNames] = useState(true)
  const [keyOpen, setKeyOpen] = useState(false)
  const [landmarksOpen, setLandmarksOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeResult, setActiveResult] = useState(0)
  const searchId = useId()

  const hues = useMemo(() => zoneHues(initial.zones), [initial.zones])
  const zonesById = useMemo(() => new Map(initial.zones.map((zone) => [zone.zoneId, zone])), [initial.zones])
  const bounds = useMemo(() => atlasBounds(initial), [initial])
  // The ground's wells come from the first answer and stay put while deeper levels load.
  const sheet = useMemo(() => buildSheet(initial.nodes, bounds), [initial.nodes, bounds])
  const pitch = sheet ? RELIEF_PITCH : 0
  const maxLevel = signedIn ? access.maxLevel : Math.min(access.maxLevel, initial.level)
  const level = levelForZoom(zoom, maxLevel)

  // The base map is the first answer; deeper levels arrive per area and replace only what they cover.
  const loadedNodes = useMemo(() => {
    const merged = new Map(initial.nodes.map((node) => [node.symbol, node]))
    if (detail) for (const node of detail.nodes) merged.set(node.symbol, node)
    return [...merged.values()]
  }, [initial.nodes, detail])
  const nodes = useMemo(() => loadedNodes.filter((node) => node.level <= level), [loadedNodes, level])
  const lines = useMemo(() => {
    if (!access.lines) return []
    const source = detail && detail.level === level ? detail.lines : initial.level === level ? initial.lines : []
    const shown = new Set(nodes.map((node) => node.symbol))
    return source.filter((line) => shown.has(line.source) && shown.has(line.target))
  }, [access.lines, detail, initial.level, initial.lines, level, nodes])

  // Ties of the company selected or under the pointer: its lines, its bundle ties, and, once loaded, its panel's.
  const focusSymbol = selection?.kind === 'company' ? selection.symbol : hover?.node.symbol ?? null
  const { related, relatedEdges } = useMemo(() => {
    const symbols = new Set<string>()
    const edges = new Set<string>()
    if (!focusSymbol) return { related: symbols, relatedEdges: edges }
    const add = (a: string, b: string) => {
      if (a !== focusSymbol && b !== focusSymbol) return
      symbols.add(a === focusSymbol ? b : a)
      edges.add(edgeKey(a, b))
    }
    for (const line of lines) add(line.source, line.target)
    for (const bundle of initial.bundles) for (const tie of bundle.ties) add(tie.source, tie.target)
    if (panel.status === 'company' && panel.data.symbol === focusSymbol) {
      for (const neighbour of panel.data.neighbours.slice(0, 10)) {
        symbols.add(neighbour.symbol)
        edges.add(edgeKey(neighbour.symbol, focusSymbol))
      }
    }
    return { related: symbols, relatedEdges: edges }
  }, [focusSymbol, lines, initial.bundles, panel])

  const landmarks = useMemo(() => mostConnected(initial.nodes), [initial.nodes])
  const maxReach = landmarks[0]?.reach ?? 1
  const results = useMemo(() => findOnMap(query, loadedNodes, initial.zones), [query, loadedNodes, initial.zones])
  const typedSymbol = atlasSymbol(query)
  const offerOpen = signedIn && typedSymbol !== null && !results.some((result) => result.kind === 'company' && result.symbol === typedSymbol)
  const options: Array<SearchResult | { kind: 'open'; symbol: string }> = offerOpen && typedSymbol ? [...results, { kind: 'open', symbol: typedSymbol }] : results
  const listOpen = query.trim().length > 0

  const draw = useCallback(() => {
    frameRequest.current = null
    const canvas = canvasRef.current
    const camera = cameraRef.current
    const viewport = viewportRef.current
    const fit = fitRef.current
    if (!canvas || !camera || !fit || !viewport.width) return
    const palette = paletteRef.current ?? readPalette(canvas)
    paletteRef.current = palette
    const context = canvas.getContext('2d')
    if (!context) return
    drawAtlas(context, {
      viewport,
      camera,
      zoom: camera.k / fit.k,
      palette,
      bounds,
      sheet,
      zones: initial.zones,
      hues,
      nodes,
      lines,
      bundles: initial.bundles,
      signedIn,
      baseline: initial.marketCorrelation?.value ?? 0,
      showNames,
      selectedZone: selection?.kind === 'zone' ? selection.zoneId : null,
      hoverZone,
      selectedSymbol: selection?.kind === 'company' ? selection.symbol : null,
      hoverSymbol: hover?.node.symbol ?? null,
      related,
      relatedEdges,
    }, window.devicePixelRatio || 1)
  }, [bounds, hover, hoverZone, hues, initial.bundles, initial.marketCorrelation, initial.zones, lines, nodes, related, relatedEdges, selection, sheet, showNames, signedIn])

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
    const resize = () => {
      const rect = frame.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      viewportRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.round(rect.width * ratio)
      canvas.height = Math.round(rect.height * ratio)
      const previousFit = fitRef.current
      // The map fits under the controls and clear of the zoom stack and the week's line.
      const controls = [...frame.querySelectorAll<HTMLElement>('[data-atlas-controls]')]
      const top = Math.max(0, ...controls.map((element) => element.getBoundingClientRect().bottom - rect.top)) + 10
      const narrow = rect.width < 640
      fitRef.current = fitCamera(bounds, viewportRef.current, pitch, { top, right: narrow ? 16 : 64, bottom: narrow ? 72 : 44, left: 16 })
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
  }, [bounds, pitch, schedule])

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

  const focusOn = useCallback((x: number, y: number, minimumZoom: number) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return
    setCamera({ ...camera, cx: x, cy: y, k: Math.max(camera.k, fit.k * minimumZoom) })
  }, [setCamera])

  // A company opened from search before its area loaded: once its panel names its region, go there, once.
  const travelledTo = useRef<string | null>(null)
  useEffect(() => {
    if (panel.status === 'idle') travelledTo.current = null
    if (panel.status !== 'company' || travelledTo.current === panel.data.symbol) return
    travelledTo.current = panel.data.symbol
    if (loadedNodes.some((node) => node.symbol === panel.data.symbol)) return
    const zone = zonesById.get(panel.data.zoneId)
    if (zone && zone.x !== null && zone.y !== null) focusOn(zone.x, zone.y, 1)
  }, [focusOn, loadedNodes, panel, zonesById])

  const ballZ = useCallback((node: AtlasNode) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return 0
    // the ball's centre sits one radius above the ground
    return groundAt(sheet, node.x, node.y) + ballRadius(node.size, camera.k / fit.k) / camera.k
  }, [sheet])

  const pickNode = (x: number, y: number) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return null
    const scale = camera.k / fit.k
    return nodeAt(nodes, camera, viewportRef.current, x, y, 10, { z: ballZ, radius: (node) => ballRadius(node.size, scale) })
  }

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setOpenSheet(null)
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
      const node = pickNode(point.x, point.y)
      setHover((current) => (node ? { node, x: point.x, y: point.y } : current === null ? current : null))
      const [wx, wy] = toWorld(camera, viewportRef.current, point.x, point.y)
      const zoneId = node ? null : zoneAt(initial.zones, wx, wy)?.zoneId ?? null
      setHoverZone((current) => (current === zoneId ? current : zoneId))
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
    if (drag.moved) setCamera(panBy(camera, point.x - previous.x, point.y - previous.y))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFrom(event)
    pointersRef.current.delete(event.pointerId)
    const drag = dragRef.current
    if (pointersRef.current.size === 0) dragRef.current = null
    const camera = cameraRef.current
    if (!drag || drag.moved || !camera) return
    const node = pickNode(point.x, point.y)
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

  const closeSheet = useCallback(() => {
    setOpenSheet((current) => {
      if (current) sheetButtons.current.get(current)?.focus()
      return null
    })
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (openSheet) closeSheet()
      else if (keyOpen) setKeyOpen(false)
      else setSelection(null)
      return
    }
    // Keys typed in the search field or a panel are theirs; the map answers only when it has focus itself.
    if (event.target !== event.currentTarget) return
    const camera = cameraRef.current
    if (!camera) return
    const step = 60
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (event.key in moves) {
      const [dx, dy] = moves[event.key]
      setCamera(panBy(camera, dx, dy))
    } else if (event.key === '+' || event.key === '=') zoomBy(1.4)
    else if (event.key === '-' || event.key === '_') zoomBy(1 / 1.4)
    else if (event.key === '0') fitAll()
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

  const choose = (option: (typeof options)[number]) => {
    setQuery('')
    setActiveResult(0)
    if (option.kind === 'zone') {
      const zone = zonesById.get(option.zoneId)
      if (zone) selectZone(zone)
      return
    }
    const node = loadedNodes.find((item) => item.symbol === option.symbol)
    if (node) selectCompany(node)
    else setSelection({ kind: 'company', symbol: option.symbol })
  }

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && options.length) {
      setActiveResult((index) => (index + 1) % options.length)
      event.preventDefault()
    } else if (event.key === 'ArrowUp' && options.length) {
      setActiveResult((index) => (index - 1 + options.length) % options.length)
      event.preventDefault()
    } else if (event.key === 'Enter' && options.length) {
      choose(options[Math.min(activeResult, options.length - 1)])
      event.preventDefault()
    } else if (event.key === 'Escape' && query) {
      setQuery('')
      event.stopPropagation()
    }
  }

  const toggleSheet = (sheetName: Exclude<Sheet, null>) => setOpenSheet((current) => (current === sheetName ? null : sheetName))

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

  const sentence = correlationSentence(initial.marketCorrelation)
  const activeId = options.length ? `${searchId}-option-${Math.min(activeResult, options.length - 1)}` : undefined

  return (
    <div className={styles.shell}>
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
          aria-label={`Relationship atlas, week of ${formatDate(initial.asOf)}: ${initial.zoneCount} regions. Arrow keys move, plus and minus zoom, 0 shows the whole map, Escape closes a panel. Use Browse atlas or search for a list.`}
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
            onPointerLeave={() => {
              setHover(null)
              setHoverZone(null)
            }}
            aria-hidden="true"
          />

          <div className={styles.chrome}>
            <div className={styles.chromeLeft} data-atlas-controls="">
              <button
                type="button"
                ref={(element) => { sheetButtons.current.set('browse', element) }}
                className={styles.pill}
                aria-expanded={openSheet === 'browse'}
                aria-controls="atlas-browse"
                aria-label="Browse atlas"
                onClick={() => toggleSheet('browse')}
              >
                <Network size={15} aria-hidden="true" /><span>Browse<span className={styles.wide}> atlas</span></span>
              </button>
              <button
                type="button"
                ref={(element) => { sheetButtons.current.set('help', element) }}
                className={styles.pill}
                aria-expanded={openSheet === 'help'}
                aria-controls="atlas-help"
                aria-label="How to read"
                onClick={() => toggleSheet('help')}
              >
                <span className={styles.wide}>How to read</span><span className={styles.narrow} aria-hidden="true">?</span>
              </button>
              <button
                type="button"
                ref={(element) => { sheetButtons.current.set('layers', element) }}
                className={styles.pill}
                aria-expanded={openSheet === 'layers'}
                aria-controls="atlas-layers"
                aria-label="Layers"
                onClick={() => toggleSheet('layers')}
              >
                <Layers size={15} aria-hidden="true" /><span className={styles.wide}>Layers</span>
              </button>
              <div className={styles.search}>
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  role="combobox"
                  aria-label="Find a company or region on the map"
                  aria-expanded={listOpen}
                  aria-controls={`${searchId}-results`}
                  aria-autocomplete="list"
                  aria-activedescendant={listOpen ? activeId : undefined}
                  placeholder="Find on the map"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActiveResult(0)
                  }}
                  onKeyDown={onSearchKey}
                />
                {listOpen ? (
                  <ul id={`${searchId}-results`} className={styles.results} role="listbox" aria-label="Matches on the map">
                    {options.length ? options.map((option, index) => (
                      <li
                        key={`${option.kind}-${option.kind === 'zone' ? option.zoneId : option.symbol}`}
                        id={`${searchId}-option-${index}`}
                        role="option"
                        aria-selected={index === Math.min(activeResult, options.length - 1)}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                      >
                        {option.kind === 'zone' ? (
                          <><b>Region</b><span>{option.label}</span><small>{option.memberCount} companies</small></>
                        ) : option.kind === 'company' ? (
                          <><b>{option.symbol}</b><span>{option.name ?? ''}</span><small>{zonesById.get(option.zoneId)?.label ?? ''}</small></>
                        ) : (
                          <><b>{option.symbol}</b><span>Open its place on the map</span><small /></>
                        )}
                      </li>
                    )) : (
                      <li className={styles.none} role="option" aria-selected="false" aria-disabled="true">
                        {signedIn ? 'Nothing on the map by that name' : 'Only the largest companies are on the map before you sign in'}
                      </li>
                    )}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className={styles.chromeRight} role="group" aria-label="Movement over time" data-atlas-controls="">
              <span className={styles.eyebrow}>Movement</span>
              {signedIn ? (
                <span className={styles.lockNote}><Lock size={13} aria-hidden="true" /> History available on Pro</span>
              ) : (
                <Link className={styles.lockNote} href={SIGN_UP_HREF}><Lock size={13} aria-hidden="true" /> Create an account to follow the map</Link>
              )}
            </div>
            {/* The open sheet starts on its own line, under the controls however many lines they take. */}
            {openSheet ? <span className={styles.break} aria-hidden="true" /> : null}

            {openSheet === 'browse' ? (
              <section id="atlas-browse" className={styles.sheet} aria-labelledby="atlas-browse-title" data-lenis-prevent="">
                <h2 id="atlas-browse-title">Browse the market</h2>
                <ul className={styles.browse}>
                  {browse.map(({ zone, nodes: leaders }) => (
                    <li key={zone.zoneId}>
                      <button type="button" className={styles.zoneButton} onClick={() => selectZone(zone)}>
                        <i style={{ background: zoneColor(hues.get(zone.zoneId) ?? 200, false) }} aria-hidden="true" />
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
              </section>
            ) : null}

            {openSheet === 'help' ? (
              <section id="atlas-help" className={styles.sheet} aria-labelledby="atlas-help-title" data-lenis-prevent="">
                <h2 id="atlas-help-title">How to read the atlas</h2>
                <dl className={styles.helpList}>
                  <dt>Position</dt><dd>Companies whose prices move together sit close, after removing what the whole market does that day.</dd>
                  <dt>Regions</dt><dd>Areas of companies that move together, measured from prices. The line holds 80% of a region&apos;s weight; a company can sit between two.</dd>
                  <dt>Size</dt><dd>Market value.</dd>
                  <dt>Wells</dt><dd>How many companies move with it in its region. A small ball in a deep well is a small company many others move with.{signedIn ? '' : ' Shown with a free account.'}</dd>
                  <dt>Lines</dt><dd>The strongest ties inside each region. Every region shows the same share of its companies at each zoom level, and the lines join the ones on screen.</dd>
                  <dt>Bundles</dt><dd>Real ties between two regions. Point at a region to see its strongest bundles and how many strong ties each holds; select a company to see its own ties.</dd>
                  <dt>Average correlation</dt><dd>How much companies move together this week once the market is taken out, against the last year&apos;s weeks.</dd>
                  <dt>Weeks</dt><dd>The map is rebuilt every week. Earlier weeks and how companies moved between them are part of Pro.</dd>
                </dl>
              </section>
            ) : null}

            {openSheet === 'layers' ? (
              <section id="atlas-layers" className={styles.sheet} aria-labelledby="atlas-layers-title" data-lenis-prevent="">
                <h2 id="atlas-layers-title">Layers</h2>
                <h3 className={styles.eyebrow}>Reading</h3>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={showNames} onChange={(event) => setShowNames(event.target.checked)} /> Names on the map
                </label>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={keyOpen} onChange={(event) => setKeyOpen(event.target.checked)} /> Map key
                </label>
              </section>
            ) : null}
          </div>

          {signedIn && landmarks.length ? (
            <div className={styles.landmarks} role="group" aria-label="Most connected companies">
              <button type="button" className={styles.landmarksHead} aria-expanded={landmarksOpen} onClick={() => setLandmarksOpen((open) => !open)}>
                <span className={styles.eyebrow}>Most connected</span><span aria-hidden="true">{landmarksOpen ? '▾' : '▸'}</span>
              </button>
              {landmarksOpen ? landmarks.map((node) => (
                <button key={node.symbol} type="button" className={styles.landmark} onClick={() => selectCompany(node)}>
                  <i style={{ opacity: 0.3 + 0.7 * ((node.reach ?? 0) / (maxReach || 1)) }} aria-hidden="true" />
                  <b>{node.symbol}</b>
                  <small>{zonesById.get(node.zoneId)?.label ?? ''}</small>
                </button>
              )) : null}
            </div>
          ) : null}

          {hover ? (
            <span className={styles.tip} role="status" style={{ left: hover.x, top: hover.y }}>
              <b>{hover.node.symbol}</b>{hover.node.name ? ` ${hover.node.name}` : ''}{zonesById.get(hover.node.zoneId) ? ` · ${zonesById.get(hover.node.zoneId)?.label}` : ''}
            </span>
          ) : null}
          {loadingArea ? <span className={styles.loading} role="status">Loading companies in this area</span> : null}
          {areaError ? (
            <button type="button" className={styles.loading} onClick={() => { setAreaError(false); setDetail(null) }}>
              Companies in this area could not load. Retry
            </button>
          ) : null}

          <div className={styles.zoom} role="group" aria-label="Zoom and reading">
            <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in"><Plus size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out"><Minus size={16} aria-hidden="true" /></button>
            <button type="button" onClick={fitAll} aria-label="Show the whole map"><Maximize2 size={14} aria-hidden="true" /></button>
            <span className={styles.level} aria-label={`Detail level ${level}`}>L{level}</span>
            <button type="button" className={styles.text} aria-pressed={showNames} onClick={() => setShowNames((value) => !value)} aria-label="Names on the map" title="Names on the map">Aa</button>
            <button type="button" className={styles.text} aria-pressed={keyOpen} aria-controls="atlas-key" onClick={() => setKeyOpen((value) => !value)} title="Map key">Key</button>
          </div>

          {keyOpen ? <MapKey signedIn={signedIn} onClose={() => setKeyOpen(false)} /> : null}

          <p className={styles.snapshot}>
            <span>Week of <b>{formatDate(initial.asOf)}</b></span>
            <span>{initial.companyCount.toLocaleString('en-US')} companies in {initial.zoneCount} regions</span>
            {sentence ? <span>{sentence}</span> : null}
          </p>
        </div>

        {selection ? (
          <aside className={styles.panel} aria-live="polite" aria-label="Details" data-lenis-prevent="">
            <button type="button" className={styles.close} onClick={() => setSelection(null)} aria-label="Close details"><X size={16} aria-hidden="true" /></button>
            <PanelBody panel={panel} zonesById={zonesById} onRetry={() => setSelection((current) => (current ? { ...current } : current))} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function MapKey({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const icon = (body: ReactNode) => <svg viewBox="0 0 36 24" width="36" height="24" aria-hidden="true">{body}</svg>
  const accent = 'var(--accent)'
  const muted = 'var(--text-muted)'
  const items: Array<[ReactNode, string]> = [
    [icon(<path d="M5 13 C4 5 14 3 19 6 S33 6 31 14 S20 22 13 20 S6 18 5 13Z" fill={accent} fillOpacity="0.16" stroke={accent} strokeOpacity="0.55" />),
      signedIn ? 'Region: companies whose prices move together. The line holds 80% of its weight' : 'Region: where companies that move together sit. A free account shows its real outline'],
    [icon(<><circle cx="6" cy="14" r="2.5" fill={muted} /><circle cx="15" cy="13" r="4" fill={muted} /><circle cx="27" cy="12" r="6.5" fill={muted} /></>), 'Size: market value'],
  ]
  if (signedIn) {
    items.push(
      [icon(<circle cx="18" cy="12" r="6" fill="none" stroke={muted} strokeWidth="1.6" strokeDasharray="2.5 2" />), 'Hollow: no strong ties, it moves on its own'],
      [icon(<><ellipse cx="18" cy="13" rx="15" ry="7" fill="none" stroke={muted} strokeOpacity="0.35" /><ellipse cx="18" cy="13" rx="9.5" ry="4.5" fill="none" stroke={muted} strokeOpacity="0.6" /><circle cx="18" cy="13" r="3" fill="var(--text)" /></>), 'Well: how many companies move with it'],
      [icon(<><circle cx="5" cy="17" r="2.4" fill={muted} /><circle cx="17" cy="8" r="2.4" fill={muted} /><circle cx="31" cy="15" r="2.4" fill={muted} /><path d="M5 17 L17 8 L31 15" fill="none" stroke={muted} strokeWidth="1.1" /></>), 'Line: the strongest ties inside a region'],
      [icon(<path d="M3 4 C14 6 22 12 33 8 M3 11 C14 11 22 12 33 12 M3 19 C14 16 22 12 33 17" fill="none" stroke={accent} strokeWidth="1.1" strokeOpacity="0.8" />), 'Bundle: real ties between two regions. More strands, more ties'],
    )
  }
  items.push([icon(<><rect x="2" y="5" width="32" height="14" rx="7" fill="var(--surface)" stroke={muted} strokeOpacity="0.4" /><text x="18" y="15.5" fontSize="8.5" textAnchor="middle" fill={accent}>38 ties</text></>),
    signedIn ? 'Count: strong ties in a bundle, where it reaches the other region' : 'Count: strong ties between two regions'])
  return (
    <div id="atlas-key" className={styles.key} role="group" aria-label="Map key" data-lenis-prevent="">
      <div className={styles.keyHead}>
        <span className={styles.eyebrow}>Map key</span>
        <button type="button" className={styles.keyClose} onClick={onClose} aria-label="Close the map key"><X size={14} aria-hidden="true" /></button>
      </div>
      <ul>
        {items.map(([symbol, text]) => <li key={text}>{symbol}<span>{text}</span></li>)}
      </ul>
      <p className={styles.keyFoot}>Scroll or pinch to zoom · drag to move · select a region or company for details</p>
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
