'use client'

import { browserRead } from '@/lib/read-client'

import Link from 'next/link'
import { Layers, Maximize2, Minus, Network, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  ATLAS_MAX_LEVEL,
  atlasOverviewPath,
  atlasSymbol,
  parseCompanyPanel,
  parseOverview,
  parseZonePanel,
  type AtlasLens,
  type AtlasLine,
  type AtlasNode,
  type AtlasOverview,
  type AtlasPoint,
  type AtlasZone,
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
  mapExtent,
  mostConnected,
  nodeAt,
  padBounds,
  panBy,
  toScreen,
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
import {
  GROUPS_KEY,
  NOTEBOOK_KEY,
  alignWeek,
  basketCentre,
  browserStorage,
  farTies,
  frameAt,
  groupKey,
  influencePill,
  insidePolygon,
  loadList,
  meanAccuracy,
  noteTitle,
  parseGroups,
  parseNotes,
  pathOf,
  playWeek,
  saveList,
  selectionSummary,
  spanAgo,
  thenAndNow,
  timelineNote,
  todayFrame,
  weekLabel,
  type AtlasGroup,
  type MovementSpan,
  type NotebookEntry,
  type NotebookView,
  type ProFeature,
  type WeekFrame,
} from '@/lib/atlas-pro'
import {
  atlasSetPath,
  parseCompare,
  parseInfluence,
  parseSetCohesion,
  parseMovement,
  parseTest,
  parseThemeDetail,
  parseThemes,
  parseWeeks,
  type AtlasMovement,
  type AtlasTheme,
} from '@/lib/atlas-pro-model'
import { cohesionDots, nameSourceLine, regionChanges } from '@/lib/atlas-panels'
import { drawAtlas, edgeKey, parseColor, type FlowLine, type InfluenceLine, type Overlay, type Palette, type PathLine } from './atlas-canvas'
import { SIGN_UP_HREF, formatDate } from './atlas-format'
import AtlasBrowse, { type BrowseTab } from './AtlasBrowse'
import { InfluenceCard, ThemeCard } from './AtlasCards'
import AtlasLayers from './AtlasLayers'
import AtlasMapKey from './AtlasMapKey'
import AtlasNotebook from './AtlasNotebook'
import AtlasPanel, { type PanelAction, type PanelState } from './AtlasPanel'
import AtlasThemeMenu from './AtlasThemeMenu'
import AtlasTimeBar from './AtlasTimeBar'
import AtlasToolRail, { type AtlasTool } from './AtlasToolRail'
import AtlasUpsell from './AtlasUpsell'
import { AtlasDock, AtlasTray, type DockKind, type DockSource, type TestState } from './AtlasWorkbench'
import { fetchAtlasJson, useAtlasJson, type Remote } from './use-atlas-json'
import styles from './AtlasExplorer.module.css'
import pro$ from './AtlasPro.module.css'

type Selection = { kind: 'company'; symbol: string } | { kind: 'zone'; zoneId: string } | null

type Detail = { level: number; lens: AtlasLens; area: Bounds; nodes: AtlasNode[]; lines: AtlasLine[] }

type Sheet = 'browse' | 'help' | 'layers' | 'notebook' | null

type Dock = { kind: DockKind; a: string; b: string }

/** How many earlier weeks load at once while the time bar fills. */
const WEEK_REQUESTS = 4

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
    up: token('--up', '#0F7B55'),
    down: token('--down', '#C2362B'),
    dark: luminance < 110,
  }
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function AtlasExplorer({ initial }: { initial: AtlasOverview }) {
  const access = initial.access
  const signedIn = access.tier !== 'signedOut'
  const pro = access.pro
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 })
  const fitRef = useRef<Camera | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{ moved: boolean; startX: number; startY: number; pinch: number | null } | null>(null)
  const lassoRef = useRef<AtlasPoint[] | null>(null)
  const frameRequest = useRef<number | null>(null)
  const paletteRef = useRef<Palette | null>(null)
  const sheetButtons = useRef(new Map<Exclude<Sheet, null>, HTMLButtonElement | null>())
  const upsellAnchor = useRef<HTMLElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingArea, setLoadingArea] = useState(false)
  const [areaError, setAreaError] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [panelAttempt, setPanelAttempt] = useState(0)
  const [hover, setHover] = useState<{ node: AtlasNode; x: number; y: number } | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const [zoneTip, setZoneTip] = useState<{ zoneId: string; x: number; y: number } | null>(null)
  const [openSheet, setOpenSheet] = useState<Sheet>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [browseTab, setBrowseTab] = useState<BrowseTab>('regions')
  const [showNames, setShowNames] = useState(true)
  const [keyOpen, setKeyOpen] = useState(false)
  const [landmarksOpen, setLandmarksOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeResult, setActiveResult] = useState(0)
  const [upsell, setUpsell] = useState<ProFeature | null>(null)
  // Pro layers
  const [lens, setLens] = useState<AtlasLens>('residual')
  const [byValue, setByValue] = useState(false)
  const [showFidelity, setShowFidelity] = useState(false)
  const [showInfluence, setShowInfluence] = useState(false)
  // history
  const [cmp, setCmp] = useState<MovementSpan>(0)
  const [week, setWeek] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [historyWanted, setHistoryWanted] = useState(false)
  const framesRef = useRef<Array<WeekFrame | undefined>>([])
  const [framesLoaded, setFramesLoaded] = useState(0)
  const [historyError, setHistoryError] = useState(false)
  const [movements, setMovements] = useState<Record<number, Remote<AtlasMovement>>>({})
  // themes
  const [themeMenu, setThemeMenu] = useState(false)
  const [themesWanted, setThemesWanted] = useState(false)
  const [theme, setTheme] = useState<AtlasTheme | null>(null)
  // tools
  const [tool, setTool] = useState<'explore' | 'select'>('explore')
  const [multi, setMulti] = useState<Set<string>>(() => new Set())
  const [forced, setForced] = useState<Map<string, AtlasNode>>(() => new Map())
  const [dock, setDock] = useState<Dock | null>(null)
  const [testsRun, setTestsRun] = useState(0)
  const [test, setTest] = useState<{ key: string; state: TestState }>({ key: '', state: { status: 'idle' } })
  // the reader's own lists, kept in this browser only; every access is guarded
  const [groups, setGroups] = useState<AtlasGroup[]>(() => parseGroups(loadList(browserStorage(), GROUPS_KEY)))
  const [notes, setNotes] = useState<NotebookEntry[]>(() => parseNotes(loadList(browserStorage(), NOTEBOOK_KEY)))
  const [stored, setStored] = useState(true)
  const searchId = useId()

  // ------------------------------------------------------------ what the map is built on
  const [lensRemote, retryLens] = useAtlasJson(pro && lens === 'total' ? atlasOverviewPath(initial.level, null, { lens: 'total' }) : null, parseOverview)
  const atlas = lens === 'total' && lensRemote.status === 'ok' ? lensRemote.data : initial
  const residual = atlas.lens === 'residual'

  const hues = useMemo(() => zoneHues(initial.zones), [initial.zones])
  const zonesById = useMemo(() => new Map(atlas.zones.map((zone) => [zone.zoneId, zone])), [atlas.zones])
  const labelOf = useCallback((zoneId: string, fallback: string | null = null) => zonesById.get(zoneId)?.label ?? fallback ?? zoneId, [zonesById])
  const bounds = useMemo(() => atlasBounds(atlas), [atlas])
  // The ground's wells come from the first answer and stay put while deeper levels load.
  const sheet = useMemo(() => buildSheet(atlas.nodes, bounds), [atlas.nodes, bounds])
  const pitch = sheet ? RELIEF_PITCH : 0
  const maxLevel = signedIn ? access.maxLevel : Math.min(access.maxLevel, initial.level)
  const level = levelForZoom(zoom, maxLevel)

  // ------------------------------------------------------------ weeks
  const [weeksRemote] = useAtlasJson(pro ? '/api/atlas/weeks' : null, parseWeeks)
  const weeks = useMemo(() => (weeksRemote.status === 'ok' ? weeksRemote.data.weeks : []), [weeksRemote])
  const span = Math.min(52, Math.max(0, weeks.length - 1))
  const historyOn = pro && residual && span > 0
  const shownWeek = historyOn ? Math.min(week, span) : 0

  // Earlier weeks load once the reader reaches for them, at full detail, each laid onto today's map.
  useEffect(() => {
    if (!historyOn || !historyWanted || framesRef.current.length) return
    const controller = new AbortController()
    const signal = controller.signal
    let complete = false
    const run = async () => {
      const today = await fetchAtlasJson(atlasOverviewPath(ATLAS_MAX_LEVEL), parseOverview, { signal })
      if (signal.aborted) return
      if (today.status !== 'ok') {
        setHistoryError(true)
        return
      }
      const frames: Array<WeekFrame | undefined> = new Array(span + 1)
      frames[0] = todayFrame(weeks[0], today.data.nodes, today.data.zones)
      framesRef.current = frames
      setFramesLoaded(1)
      const reference = frames[0].positions
      const queue = Array.from({ length: span }, (_, index) => index + 1)
      let loaded = 1
      const worker = async () => {
        for (let k = queue.shift(); k !== undefined && !signal.aborted; k = queue.shift()) {
          const answer = await fetchAtlasJson(atlasOverviewPath(ATLAS_MAX_LEVEL, null, { asOf: weeks[k] }), parseOverview, { signal })
          if (signal.aborted) return
          if (answer.status === 'ok') frames[k] = alignWeek(weeks[k], answer.data.nodes, answer.data.zones, reference) ?? undefined
          loaded += 1
          setFramesLoaded(loaded)
        }
      }
      await Promise.all(Array.from({ length: WEEK_REQUESTS }, worker))
      complete = !signal.aborted
    }
    void run()
    return () => {
      controller.abort()
      // an interrupted load starts again from the beginning next time
      if (!complete) framesRef.current = []
    }
  }, [historyOn, historyWanted, span, weeks])

  // Movement against an earlier week: the control's span, the paths' span, and the panel's (6 months unless set).
  const movementSpans = useMemo(() => {
    if (!pro || !residual || !weeks.length) return []
    const wanted = new Set<number>()
    if (cmp && cmp < weeks.length) wanted.add(cmp)
    if (shownWeek > 0) wanted.add(span)
    // Browse › Regions counts who moved in and out over six months
    if (openSheet === 'browse' && 26 < weeks.length) wanted.add(26)
    if (selection?.kind === 'company') {
      const panelSpan = cmp || 26
      if (panelSpan < weeks.length) wanted.add(panelSpan)
    }
    return [...wanted]
  }, [cmp, openSheet, pro, residual, selection, shownWeek, span, weeks.length])

  // Each span is read once per visit; a failed read stays failed until the page is reloaded.
  const movementRequests = useRef(new Set<number>())
  useEffect(() => {
    for (const value of movementSpans) {
      if (movementRequests.current.has(value)) continue
      movementRequests.current.add(value)
      setMovements((current) => ({ ...current, [value]: { status: 'loading' } }))
      const params = new URLSearchParams({ from: weeks[value], to: weeks[0] })
      void fetchAtlasJson(`/api/atlas/movement?${params.toString()}`, parseMovement).then((answer) => {
        setMovements((current) => ({ ...current, [value]: answer }))
      })
    }
  }, [movementSpans, weeks])

  const movementFor = (value: number): AtlasMovement | null => {
    const answer = movements[value]
    return answer?.status === 'ok' ? answer.data : null
  }

  // ------------------------------------------------------------ themes and influence
  const [themesRemote] = useAtlasJson(signedIn && themesWanted ? `/api/atlas/themes?asOf=${encodeURIComponent(initial.asOf)}` : null, parseThemes)
  const [themeDetail] = useAtlasJson(signedIn && theme ? `/api/atlas/themes/${encodeURIComponent(theme.themeId)}?asOf=${encodeURIComponent(initial.asOf)}` : null, parseThemeDetail)
  const themeShown: AtlasTheme | null = theme ? (themeDetail.status === 'ok' ? themeDetail.data : theme) : null
  const themeMembers = useMemo(() => {
    if (!theme) return null
    const members = new Set<string>()
    for (const node of atlas.nodes) if (node.themes.includes(theme.themeId)) members.add(node.symbol)
    if (themeDetail.status === 'ok') for (const node of themeDetail.data.members) members.add(node.symbol)
    return members
  }, [atlas.nodes, theme, themeDetail])
  const [influenceRemote] = useAtlasJson(
    pro && residual && (showInfluence || openSheet === 'layers') ? `/api/atlas/influence?asOf=${encodeURIComponent(initial.asOf)}` : null,
    parseInfluence,
  )

  // ------------------------------------------------------------ companies on screen
  // The base map is the first answer; deeper levels arrive per area and replace only what they cover.
  const loadedNodes = useMemo(() => {
    const merged = new Map(atlas.nodes.map((node) => [node.symbol, node]))
    if (detail && detail.lens === atlas.lens) for (const node of detail.nodes) merged.set(node.symbol, node)
    return [...merged.values()]
  }, [atlas.nodes, atlas.lens, detail])
  const loadedBySymbol = useMemo(() => {
    const map = new Map(loadedNodes.map((node) => [node.symbol, node]))
    for (const [symbol, node] of forced) if (!map.has(symbol)) map.set(symbol, node)
    if (residual && themeDetail.status === 'ok') for (const node of themeDetail.data.members) if (!map.has(node.symbol)) map.set(node.symbol, node)
    return map
  }, [forced, loadedNodes, residual, themeDetail])
  // Movers show at every level while their arrows or paths are on screen: the movement is about them.
  const moverSymbols = useMemo(() => {
    const value = shownWeek > 0 ? span : cmp
    const answer = value ? movements[value] : undefined
    return new Set(answer?.status === 'ok' ? answer.data.flows.flatMap((flow) => flow.symbols) : [])
  }, [cmp, movements, shownWeek, span])

  // A theme's members and a selection show at every zoom level: the highlight is about them, wherever they are.
  const todayNodes = useMemo(() => [...loadedBySymbol.values()].filter((node) =>
    node.level <= level || multi.has(node.symbol) || (themeMembers?.has(node.symbol) ?? false) || forced.has(node.symbol) || moverSymbols.has(node.symbol)),
  [forced, level, loadedBySymbol, moverSymbols, multi, themeMembers])

  const focusedSymbol = selection?.kind === 'company' ? selection.symbol : null
  // Movers not loaded yet are fetched where they now sit, once per movement, so every arrow has its companies.
  const moversRequested = useRef(new Set<number>())
  useEffect(() => {
    const value = shownWeek > 0 ? span : cmp
    const answer = value ? movements[value] : undefined
    if (!value || answer?.status !== 'ok' || moversRequested.current.has(value)) return
    const missing = answer.data.flows.filter((flow) => flow.symbols.some((symbol) => !loadedBySymbol.has(symbol)))
    if (!missing.length) return
    moversRequested.current.add(value)
    const pad = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0) * 0.12
    const xs = missing.map((flow) => flow.to[0])
    const ys = missing.map((flow) => flow.to[1])
    const area: [number, number, number, number] = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
    const wanted = new Set(missing.flatMap((flow) => flow.symbols))
    void fetchAtlasJson(atlasOverviewPath(ATLAS_MAX_LEVEL, area), parseOverview).then((result) => {
      if (result.status !== 'ok') return
      setForced((current) => {
        const next = new Map(current)
        for (const node of result.data.nodes) if (wanted.has(node.symbol)) next.set(node.symbol, node)
        return next
      })
    })
  }, [bounds, cmp, loadedBySymbol, movements, shownWeek, span])

  const past = useMemo(() => {
    if (shownWeek <= 0 || framesLoaded === 0) return null
    return frameAt(framesRef.current, shownWeek)
    // framesLoaded counts the frames as they arrive
  }, [framesLoaded, shownWeek])
  const nodes = useMemo(() => (past
    ? past.nodes.filter((node) => node.level <= level || multi.has(node.symbol) || moverSymbols.has(node.symbol) || node.symbol === focusedSymbol)
    : todayNodes), [focusedSymbol, level, moverSymbols, multi, past, todayNodes])
  const zones = useMemo(() => {
    const source = past ? past.zones : atlas.zones
    return pro && byValue ? source.map((zone) => (zone.contourByValue ? { ...zone, contour: zone.contourByValue } : zone)) : source
  }, [atlas.zones, byValue, past, pro])

  const lines = useMemo(() => {
    if (!access.lines || past) return []
    const source = detail && detail.level === level && detail.lens === atlas.lens ? detail.lines : atlas.level === level ? atlas.lines : []
    const shown = new Set(nodes.map((node) => node.symbol))
    return source.filter((line) => shown.has(line.source) && shown.has(line.target))
  }, [access.lines, atlas.lens, atlas.level, atlas.lines, detail, level, nodes, past])

  // Ties of the company selected or under the pointer: its lines, its bundle ties, and, once loaded, its panel's.
  const focusSymbol = selection?.kind === 'company' ? selection.symbol : hover?.node.symbol ?? null
  const { related, relatedEdges } = useMemo(() => {
    const symbols = new Set<string>()
    const edges = new Set<string>()
    if (!focusSymbol || past) return { related: symbols, relatedEdges: edges }
    const add = (a: string, b: string) => {
      if (a !== focusSymbol && b !== focusSymbol) return
      symbols.add(a === focusSymbol ? b : a)
      edges.add(edgeKey(a, b))
    }
    for (const line of lines) add(line.source, line.target)
    for (const bundle of atlas.bundles) for (const tie of bundle.ties) add(tie.source, tie.target)
    if (panel.status === 'company' && panel.data.symbol === focusSymbol) {
      for (const neighbour of panel.data.neighbours.slice(0, 10)) {
        symbols.add(neighbour.symbol)
        edges.add(edgeKey(neighbour.symbol, focusSymbol))
      }
    }
    return { related: symbols, relatedEdges: edges }
  }, [focusSymbol, lines, atlas.bundles, panel, past])

  // ------------------------------------------------------------ overlay: movement, paths, influence, accuracy
  const selectedSymbol = selection?.kind === 'company' ? selection.symbol : null
  const selectedZone = selection?.kind === 'zone' ? selection.zoneId : null
  const panelSpan = cmp || 26
  const panelMove = useMemo(() => {
    const movement = selectedSymbol && pro && residual ? movements[panelSpan] : undefined
    if (!selectedSymbol || movement?.status !== 'ok') return null
    const move = movement.data.moves.find((item) => item.symbol === selectedSymbol)
    return move ? { move, noise: movement.data.noise } : null
  }, [movements, panelSpan, pro, residual, selectedSymbol])
  const then = useMemo(() => (panelMove ? thenAndNow(panelMove.move, panelMove.noise, panelSpan, (zoneId) => labelOf(zoneId)) : null), [labelOf, panelMove, panelSpan])

  const overlay = useMemo<Overlay>(() => {
    const positions = new Map(nodes.map((node) => [node.symbol, [node.x, node.y] as AtlasPoint]))
    const movers = new Set<string>()
    const result: Overlay = {
      past: past !== null,
      paths: [],
      flows: [],
      movers,
      ghost: null,
      influence: [],
      theme: themeMembers,
      multi,
      showFidelity: pro && showFidelity,
      farTies: [],
      lasso: null,
    }
    if (past) {
      const pathMovement = movementFor(span)
      for (const symbol of pathMovement?.flows.flatMap((flow) => flow.symbols) ?? []) movers.add(symbol)
      const paths: PathLine[] = []
      for (const symbol of movers) {
        if (symbol === selectedSymbol) continue
        const points = pathOf(symbol, framesRef.current, span, shownWeek, positions.get(symbol) ?? null)
        if (points.length) paths.push({ points, selected: false })
      }
      if (selectedSymbol) {
        const points = pathOf(selectedSymbol, framesRef.current, span, shownWeek, positions.get(selectedSymbol) ?? null)
        if (points.length) paths.push({ points, selected: true })
      }
      result.paths = paths
      return result
    }
    const movement = cmp ? movementFor(cmp) : null
    if (movement && !selectedSymbol) {
      const flows: FlowLine[] = []
      for (const flow of movement.flows) {
        if (selectedZone && flow.fromZoneId !== selectedZone && flow.toZoneId !== selectedZone) continue
        flows.push({ from: flow.from, to: flow.to, count: flow.symbols.length, label: `${flow.symbols.length} · ${labelOf(flow.fromZoneId)} → ${labelOf(flow.toZoneId)}` })
        for (const symbol of flow.symbols) movers.add(symbol)
      }
      result.flows = flows
    }
    if (panelMove?.move.flow && panelMove.move.from) result.ghost = { at: panelMove.move.from, label: spanAgo(panelSpan) }
    const influence = influenceRemote.status === 'ok' ? influenceRemote.data : null
    if (pro && residual && showInfluence && influence?.tested && !selectedSymbol) {
      const lines: InfluenceLine[] = []
      const anchor = (zoneId: string | null): AtlasPoint | null => {
        const zone = zoneId ? zonesById.get(zoneId) : undefined
        return zone && zone.x !== null && zone.y !== null ? [zone.x, zone.y] : null
      }
      for (const arrow of influence.arrows) {
        const from = basketCentre(arrow.from.members, positions, anchor(arrow.from.zoneId))
        const to = basketCentre(arrow.to.members, positions, anchor(arrow.to.zoneId))
        if (from && to) lines.push({ from, to, sign: arrow.sign, t: arrow.t, label: influencePill(arrow) })
      }
      result.influence = lines
    }
    if (pro && selectedSymbol && panel.status === 'company' && panel.data.symbol === selectedSymbol) {
      result.farTies = farTies(selectedSymbol, panel.data.neighbours.map((neighbour) => neighbour.symbol), loadedNodes)
    }
    return result
    // movementFor reads `movements`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmp, influenceRemote, labelOf, loadedNodes, movements, multi, nodes, panel, panelMove, panelSpan, past, pro, residual, selectedSymbol, selectedZone, showFidelity, showInfluence, shownWeek, span, themeMembers, zonesById])

  const landmarks = useMemo(() => mostConnected(atlas.nodes), [atlas.nodes])
  const maxReach = landmarks[0]?.reach ?? 1
  const results = useMemo(() => findOnMap(query, loadedNodes, atlas.zones), [query, loadedNodes, atlas.zones])
  const typedSymbol = atlasSymbol(query)
  const offerOpen = signedIn && typedSymbol !== null && !results.some((result) => result.kind === 'company' && result.symbol === typedSymbol)
  const options: Array<SearchResult | { kind: 'open'; symbol: string }> = offerOpen && typedSymbol ? [...results, { kind: 'open', symbol: typedSymbol }] : results
  const listOpen = query.trim().length > 0

  // ------------------------------------------------------------ drawing
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
      extent: mapExtent(bounds, fit),
      palette,
      bounds,
      sheet,
      zones,
      hues,
      nodes,
      lines,
      bundles: past ? [] : atlas.bundles,
      signedIn,
      baseline: atlas.marketCorrelation?.value ?? 0,
      showNames,
      selectedZone,
      hoverZone,
      selectedSymbol,
      hoverSymbol: hover?.node.symbol ?? null,
      related,
      relatedEdges,
      overlay: { ...overlay, lasso: lassoRef.current },
    }, window.devicePixelRatio || 1)
  }, [atlas.bundles, atlas.marketCorrelation, bounds, hover, hoverZone, hues, lines, nodes, overlay, past, related, relatedEdges, selectedSymbol, selectedZone, sheet, showNames, signedIn, zones])

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
  const fittedAtlas = useRef<AtlasOverview | null>(null)
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
      // The map fits under the controls, clear of the zoom stack, the tool rail and the time bar.
      const edge = (selector: string) => [...frame.querySelectorAll<HTMLElement>(selector)].map((element) => element.getBoundingClientRect())
      const top = Math.max(0, ...edge('[data-atlas-controls]').map((box) => box.bottom - rect.top)) + 10
      const narrow = rect.width < 640
      // on a phone the rail lies along the bottom too
      const bottom = Math.max(narrow ? 72 : 44, ...edge(narrow ? '[data-atlas-bottom], [data-atlas-left]' : '[data-atlas-bottom]').map((box) => rect.bottom - box.top + 8))
      const left = narrow ? 16 : Math.max(16, ...edge('[data-atlas-left]').map((box) => box.right - rect.left + 8))
      fitRef.current = fitCamera(bounds, viewportRef.current, pitch, { top, right: narrow ? 16 : 64, bottom, left })
      if (!cameraRef.current || !previousFit || fittedAtlas.current !== atlas) cameraRef.current = { ...fitRef.current }
      else cameraRef.current = { ...cameraRef.current, k: cameraRef.current.k * (fitRef.current.k / previousFit.k) }
      fittedAtlas.current = atlas
      const fit = fitRef.current
      if (fit && cameraRef.current) setZoom(cameraRef.current.k / fit.k)
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
  }, [atlas, bounds, pitch, schedule])

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
    if (!signedIn || level <= atlas.level) return
    const camera = cameraRef.current
    if (!camera) return
    const view = visibleBounds(camera, viewportRef.current)
    if (detail && detail.lens === atlas.lens && detail.level >= level && covers(detail.area, view)) return
    const area = padBounds(view, 0.25)
    const controller = new AbortController()
    const areaLens = atlas.lens
    const timer = window.setTimeout(async () => {
      setLoadingArea(true)
      setAreaError(false)
      try {
        const response = await browserRead(atlasOverviewPath(level, [area.x0, area.y0, area.x1, area.y1], { lens: areaLens }), { signal: controller.signal })
        const parsed = response.ok ? parseOverview(await response.json()) : null
        if (!parsed) throw new Error('atlas area unavailable')
        setDetail({ level, lens: areaLens, area, nodes: parsed.nodes, lines: parsed.lines })
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
  }, [atlas.lens, atlas.level, detail, level, signedIn, zoom])

  // panel
  useEffect(() => {
    if (!selection) {
      setPanel({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setPanel({ status: 'loading' })
    const lensQuery = lens === 'total' && pro ? '?lens=total' : ''
    const path = selection.kind === 'company'
      ? `/api/atlas/companies/${encodeURIComponent(selection.symbol)}${lensQuery}`
      : `/api/atlas/zones/${encodeURIComponent(selection.zoneId)}${lensQuery}`
    browserRead(path, { signal: controller.signal })
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
  }, [selection, lens, pro, panelAttempt])

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

  // ------------------------------------------------------------ play
  const playRef = useRef<number | null>(null)
  const stopPlay = useCallback(() => {
    if (playRef.current !== null) cancelAnimationFrame(playRef.current)
    playRef.current = null
    setPlaying(false)
  }, [])
  useEffect(() => () => {
    if (playRef.current !== null) cancelAnimationFrame(playRef.current)
  }, [])
  const togglePlay = () => {
    if (playing) {
      stopPlay()
      return
    }
    setHistoryWanted(true)
    // near today there is nothing left to play: start again from a year ago
    const from = shownWeek >= 2 ? shownWeek : span
    const started = performance.now()
    const reduced = reducedMotion()
    setPlaying(true)
    const step = (now: number) => {
      const next = playWeek(from, now - started, reduced)
      setWeek(next)
      if (next > 0) playRef.current = requestAnimationFrame(step)
      else {
        playRef.current = null
        setPlaying(false)
      }
    }
    playRef.current = requestAnimationFrame(step)
  }
  const onWeek = (value: number) => {
    stopPlay()
    setHistoryWanted(true)
    setWeek(Math.max(0, Math.min(span, value)))
  }

  // ------------------------------------------------------------ gates
  const gate = useCallback((feature: ProFeature, anchor: HTMLElement | null) => {
    upsellAnchor.current = anchor
    setUpsell(feature)
  }, [])
  const closeUpsell = useCallback(() => {
    setUpsell(null)
    upsellAnchor.current?.focus()
  }, [])

  // ------------------------------------------------------------ selection tools
  const ballZ = useCallback((node: AtlasNode) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return 0
    // the ball's centre sits one radius above the ground
    return groundAt(sheet, node.x, node.y) + ballRadius(node.bulk, camera.k / fit.k, mapExtent(bounds, fit)) / camera.k
  }, [bounds, sheet])

  const toggleMulti = useCallback((symbols: string[], add: boolean) => {
    setMulti((current) => {
      const next = new Set(current)
      for (const symbol of symbols) {
        if (add || !next.has(symbol)) next.add(symbol)
        else next.delete(symbol)
      }
      return next
    })
  }, [])

  const addZoneMembers = useCallback(async (zoneId: string) => {
    const answer = await fetchAtlasJson(`/api/atlas/zones/${encodeURIComponent(zoneId)}${atlas.lens === 'total' ? '?lens=total' : ''}`, parseZonePanel)
    const symbols = answer.status === 'ok' ? answer.data.members.map((member) => member.symbol) : loadedNodes.filter((node) => node.zoneId === zoneId).map((node) => node.symbol)
    toggleMulti(symbols, true)
  }, [atlas.lens, loadedNodes, toggleMulti])

  /** Every company inside the lasso, loaded or not: the selection is about the area, so its companies are fetched. */
  const selectArea = useCallback(async (polygon: AtlasPoint[]) => {
    const camera = cameraRef.current
    const viewport = viewportRef.current
    if (!camera) return
    const inside = (node: AtlasNode) => {
      const [sx, sy] = toScreen(camera, viewport, node.x, node.y, ballZ(node))
      return insidePolygon(polygon, sx, sy)
    }
    const local = nodes.filter(inside).map((node) => node.symbol)
    toggleMulti(local, true)
    const world = polygon.map(([x, y]) => toWorld(camera, viewport, x, y))
    const area = padBounds({
      x0: Math.min(...world.map(([x]) => x)), y0: Math.min(...world.map(([, y]) => y)),
      x1: Math.max(...world.map(([x]) => x)), y1: Math.max(...world.map(([, y]) => y)),
    }, 0.15)
    const answer = await fetchAtlasJson(atlasOverviewPath(ATLAS_MAX_LEVEL, [area.x0, area.y0, area.x1, area.y1], { lens: atlas.lens }), parseOverview)
    if (answer.status !== 'ok') return
    const found = answer.data.nodes.filter(inside)
    setForced((current) => {
      const next = new Map(current)
      for (const node of found) next.set(node.symbol, node)
      return next
    })
    toggleMulti(found.map((node) => node.symbol), true)
  }, [atlas.lens, ballZ, nodes, toggleMulti])

  // ------------------------------------------------------------ pointer
  const pickNode = (x: number, y: number) => {
    const camera = cameraRef.current
    const fit = fitRef.current
    if (!camera || !fit) return null
    const scale = camera.k / fit.k
    const extent = mapExtent(bounds, fit)
    return nodeAt(nodes, camera, viewportRef.current, x, y, 10, { z: ballZ, radius: (node) => ballRadius(node.bulk, scale, extent) })
  }

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setOpenSheet((current) => (current === 'notebook' ? current : null))
    setThemeMenu(false)
    const point = pointFrom(event)
    pointersRef.current.set(event.pointerId, point)
    if (pointersRef.current.size === 1 && tool === 'select' && pro) {
      lassoRef.current = [[point.x, point.y]]
      dragRef.current = null
      return
    }
    lassoRef.current = null
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
    const lasso = lassoRef.current
    if (lasso && previous) {
      const last = lasso[lasso.length - 1]
      if (Math.hypot(point.x - last[0], point.y - last[1]) > 3) {
        lasso.push([point.x, point.y])
        schedule()
      }
      return
    }
    if (!previous) {
      const node = pickNode(point.x, point.y)
      setHover((current) => (node ? { node, x: point.x, y: point.y } : current === null ? current : null))
      const [wx, wy] = toWorld(camera, viewportRef.current, point.x, point.y)
      const zoneId = node ? null : zoneAt(zones, wx, wy)?.zoneId ?? null
      setHoverZone((current) => (current === zoneId ? current : zoneId))
      setZoneTip(zoneId ? { zoneId, x: point.x, y: point.y } : null)
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
    const lasso = lassoRef.current
    if (lasso) {
      lassoRef.current = null
      schedule()
      if (lasso.length >= 4) {
        void selectArea(lasso)
        return
      }
      // a short lasso is a click: it toggles the company, or adds the whole region
      const node = pickNode(point.x, point.y)
      if (node) toggleMulti([node.symbol], false)
      else {
        const camera = cameraRef.current
        if (!camera) return
        const [wx, wy] = toWorld(camera, viewportRef.current, point.x, point.y)
        const zone = zoneAt(zones, wx, wy)
        if (zone) void addZoneMembers(zone.zoneId)
      }
      return
    }
    const drag = dragRef.current
    if (pointersRef.current.size === 0) dragRef.current = null
    const camera = cameraRef.current
    if (!drag || drag.moved || !camera) return
    const node = pickNode(point.x, point.y)
    if (node && event.shiftKey && pro) {
      toggleMulti([node.symbol], false)
      return
    }
    if (node) {
      setSelection({ kind: 'company', symbol: node.symbol })
      return
    }
    const [wx, wy] = toWorld(camera, viewportRef.current, point.x, point.y)
    const zone = zoneAt(zones, wx, wy)
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

  const railButton = (name: AtlasTool) => frameRef.current?.querySelector<HTMLButtonElement>(`[data-tool="${name}"]`) ?? null

  const closeDock = useCallback(() => {
    setDock((current) => {
      if (current) frameRef.current?.querySelector<HTMLButtonElement>(`[data-tool="${current.kind}"]`)?.focus()
      return null
    })
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // the innermost thing open closes first, and focus goes back to what opened it
      if (upsell) closeUpsell()
      else if (themeMenu) setThemeMenu(false)
      else if (openSheet) closeSheet()
      else if (dock) closeDock()
      else if (keyOpen) setKeyOpen(false)
      else if (selection) setSelection(null)
      else if (tool === 'select') setTool('explore')
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

  const selectSymbol = (symbol: string) => {
    const node = loadedBySymbol.get(symbol)
    if (node) selectCompany(node)
    else setSelection({ kind: 'company', symbol })
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
    selectSymbol(option.symbol)
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

  const toggleSheet = (sheetName: Exclude<Sheet, null>) => {
    setThemeMenu(false)
    setOpenSheet((current) => (current === sheetName ? null : sheetName))
  }

  // ------------------------------------------------------------ layers
  const changeLens = (next: AtlasLens) => {
    if (next === lens) return
    // a new map: new positions, regions and ties; the selection and the history belong to the other one
    stopPlay()
    setSelection(null)
    setDetail(null)
    setWeek(0)
    setCmp(0)
    setShowInfluence(false)
    setMulti(new Set())
    setForced(new Map())
    setLens(next)
  }

  // ------------------------------------------------------------ workbench
  const sources = useMemo<DockSource[]>(() => {
    const list: DockSource[] = []
    const push = (source: DockSource) => {
      if (!list.some((item) => item.key === source.key)) list.push(source)
    }
    if (multi.size) push({ key: groupKey(multi), label: `Selection · ${multi.size}`, count: multi.size })
    if (selectedSymbol) push({ key: selectedSymbol, label: selectedSymbol, count: 1 })
    for (const group of groups) push({ key: groupKey(group.members), label: `Group · ${group.name}`, count: group.members.length })
    for (const zone of atlas.zones) if (zone.memberCount >= 3) push({ key: `zone:${zone.zoneId}`, label: zone.label.replace(/_/g, ' '), count: zone.memberCount })
    return list
  }, [atlas.zones, groups, multi, selectedSymbol])

  const openDock = (kind: DockKind, aKey?: string) => {
    if (!sources.length) return
    const a = sources.find((source) => source.key === aKey) ?? sources[0]
    const own = loadedBySymbol.get(a.key)?.zoneId
    const b = sources.find((source) => source.key.startsWith('zone:') && source.key !== a.key && source.key !== `zone:${own}`) ?? sources[1] ?? a
    setOpenSheet((current) => (current === 'notebook' ? null : current))
    setDock({ kind, a: a.key, b: b.key })
  }

  const dockSources = dock ? sources : []
  const dockA = dock && dockSources.some((source) => source.key === dock.a) ? dock.a : dockSources[0]?.key ?? ''
  const dockB = dock && dockSources.some((source) => source.key === dock.b) ? dock.b : (dockSources[1] ?? dockSources[0])?.key ?? ''
  const compareParams = new URLSearchParams({ a: dockA, b: dockB, asOf: initial.asOf })
  const [compare] = useAtlasJson(pro && dock?.kind === 'compare' && dockA && dockB ? `/api/atlas/compare?${compareParams.toString()}` : null, parseCompare)
  const testKey = `${dockA}>${dockB}`
  const testState: TestState = test.key === testKey ? test.state : { status: 'idle' }

  const runTest = async () => {
    const run = testsRun + 1
    setTestsRun(run)
    setTest({ key: testKey, state: { status: 'loading' } })
    const params = new URLSearchParams({ from: dockA, to: dockB, testsRun: String(run), asOf: initial.asOf })
    const answer = await fetchAtlasJson(`/api/atlas/test?${params.toString()}`, parseTest)
    setTest({
      key: testKey,
      state: answer.status === 'ok' ? { status: 'done', result: answer.data, run } : answer.status === 'invalid' ? { status: 'invalid' } : { status: 'error' },
    })
  }

  const saveGroups = (next: AtlasGroup[]) => {
    setGroups(next)
    setStored(saveList(browserStorage(), GROUPS_KEY, next))
  }
  const saveNotes = (next: NotebookEntry[]) => {
    setNotes(next)
    setStored(saveList(browserStorage(), NOTEBOOK_KEY, next))
  }

  const viewState = (): NotebookView => {
    const camera = cameraRef.current
    return {
      week: Math.round(shownWeek),
      cmp,
      theme: theme?.themeId ?? null,
      lens,
      node: selectedSymbol,
      zone: selectedZone,
      multi: [...multi],
      layers: { inf: showInfluence, fid: showFidelity, cap: byValue },
      cam: camera ? { cx: camera.cx, cy: camera.cy, k: camera.k } : null,
      dock: dock ? { kind: dock.kind, a: dockA, b: dockB } : null,
    }
  }

  const saveView = () => {
    const view = viewState()
    const entry: NotebookEntry = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: noteTitle(view, view.zone ? labelOf(view.zone) : null),
      savedAt: new Date().toISOString(),
      note: '',
      view,
    }
    saveNotes([entry, ...notes].slice(0, 100))
    setOpenSheet('notebook')
  }

  /** A saved view opens on the current week's data. */
  const openNote = (entry: NotebookEntry) => {
    const view = entry.view
    stopPlay()
    if (view.lens !== lens) changeLens(view.lens)
    setCmp(view.cmp)
    const known = view.theme && themesRemote.status === 'ok' ? themesRemote.data.find((item) => item.themeId === view.theme) : undefined
    if (view.theme && !known) setThemesWanted(true)
    setTheme(known ?? (view.theme ? { themeId: view.theme, label: view.theme, memberCount: 0, cohesion: null, typicalCohesion: null, verdict: null, regions: [] } : null))
    setMulti(new Set(view.multi))
    setShowInfluence(view.layers.inf)
    setShowFidelity(view.layers.fid)
    setByValue(view.layers.cap)
    setSelection(view.node ? { kind: 'company', symbol: view.node } : view.zone ? { kind: 'zone', zoneId: view.zone } : null)
    if (view.week > 0) setHistoryWanted(true)
    setWeek(Math.min(view.week, span))
    const camera = cameraRef.current
    if (camera && view.cam && view.lens === lens) setCamera({ ...camera, ...view.cam })
    setDock(view.dock)
    setOpenSheet(null)
  }

  const onTool = (name: AtlasTool, anchor: HTMLElement) => {
    if (name === 'explore') setTool('explore')
    else if (name === 'select') setTool((current) => (current === 'select' ? 'explore' : 'select'))
    else if (name === 'compare' || name === 'test') {
      if (dock?.kind === name) closeDock()
      else openDock(name)
    } else if (name === 'notebook') {
      sheetButtons.current.set('notebook', anchor as HTMLButtonElement)
      toggleSheet('notebook')
    } else if (name === 'groups') {
      setBrowseTab('groups')
      setOpenSheet((current) => (current === 'browse' && browseTab === 'groups' ? null : 'browse'))
    }
  }

  const onPanelAction = (action: PanelAction, feature: ProFeature, anchor: HTMLElement) => {
    if (!pro) {
      gate(feature, anchor)
      return
    }
    if (action === 'note') saveView()
    else if (action === 'add') {
      if (selectedSymbol) toggleMulti([selectedSymbol], true)
      else if (selectedZone) void addZoneMembers(selectedZone)
    } else openDock(action, selectedSymbol ?? (selectedZone ? `zone:${selectedZone}` : undefined))
  }

  const onMovement = (value: MovementSpan, anchor: HTMLElement) => {
    if (!pro) {
      if (value) gate(value === 52 ? 'movement1y' : 'timeline', anchor)
      return
    }
    setCmp(value)
  }

  // Lead tickers per region: the backend's leaders, else (signed out) its largest companies on the map.
  const leadersOf = useCallback((zone: AtlasZone) => {
    if (zone.leaders.length) return zone.leaders
    return atlas.nodes.filter((node) => node.zoneId === zone.zoneId && node.level === 0).map((node) => node.symbol)
  }, [atlas.nodes])
  const dots = useMemo(() => cohesionDots(atlas.zones), [atlas.zones])
  const changes = useMemo(() => {
    const answer = pro && residual ? movements[26] : undefined
    return answer?.status === 'ok' ? regionChanges(answer.data.moves) : null
  }, [movements, pro, residual])

  const sentence = correlationSentence(atlas.marketCorrelation)
  const activeId = options.length ? `${searchId}-option-${Math.min(activeResult, options.length - 1)}` : undefined
  const accuracy = useMemo(() => meanAccuracy(atlas.nodes), [atlas.nodes])
  const selectedMove = shownWeek > 0 && selectedSymbol ? movementFor(span)?.moves.find((move) => move.symbol === selectedSymbol) ?? null : null
  const note = shownWeek > 0 ? timelineNote(span, selectedSymbol ? { symbol: selectedSymbol, changed: selectedMove ? selectedMove.flow : null } : null) : null
  const framesNeeded = span + 1
  const loadingWeeks = historyWanted && historyOn && framesLoaded < framesNeeded && !historyError
    ? `Loading earlier weeks · ${Math.max(0, framesLoaded - 1)} of ${span}`
    : historyError ? 'Earlier weeks could not load.' : null
  const influence = influenceRemote.status === 'ok' ? influenceRemote.data : null
  const summary = useMemo(() => selectionSummary(multi, loadedBySymbol), [loadedBySymbol, multi])
  // The selection's cohesion, read once the selection has settled; a newer selection cancels the older read.
  const [setCohesion, setSetCohesion] = useState<{ key: string; value: number | null } | null>(null)
  const setPath = pro ? atlasSetPath(multi, initial.asOf) : null
  useEffect(() => {
    if (!setPath) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchAtlasJson(setPath, parseSetCohesion, { signal: controller.signal }).then((answer) => {
        if (controller.signal.aborted) return
        setSetCohesion({ key: setPath, value: answer.status === 'ok' && answer.data.available ? answer.data.meanCorrelation : null })
      })
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [setPath])
  const trayCorrelation = setPath && setCohesion?.key === setPath ? setCohesion.value : null
  const railActive = new Set<AtlasTool>([
    tool === 'select' ? 'select' : 'explore',
    ...(dock ? [dock.kind] : []),
    ...(openSheet === 'notebook' ? ['notebook' as const] : []),
    ...(openSheet === 'browse' && browseTab === 'groups' ? ['groups' as const] : []),
  ])

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
          aria-label={`Relationship atlas, week of ${formatDate(initial.asOf)}: ${atlas.zoneCount} regions. Arrow keys move, plus and minus zoom, 0 shows the whole map, Escape closes a panel. Use Browse atlas or search for a list.`}
          onKeyDown={onKeyDown}
        >
          <canvas
            ref={canvasRef}
            className={tool === 'select' && pro ? `${styles.canvas} ${pro$.lassoCursor}` : styles.canvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={(event) => {
              pointersRef.current.delete(event.pointerId)
              dragRef.current = null
              lassoRef.current = null
            }}
            onPointerLeave={() => {
              setHover(null)
              setHoverZone(null)
              setZoneTip(null)
            }}
            aria-hidden="true"
          />

          <div className={styles.chrome} data-more={moreOpen ? 'true' : 'false'}>
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
              {/* On a phone the theme, the search and movement fold behind this button, so the map keeps the screen. */}
              <button
                type="button"
                className={`${styles.pill} ${styles.moreToggle}`}
                aria-expanded={moreOpen}
                aria-controls={`${searchId}-more`}
                aria-label={signedIn ? 'Theme, find and movement' : 'Find and movement'}
                onClick={() => setMoreOpen((open) => !open)}
              >
                {moreOpen ? <X size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}<span>More</span>
              </button>
              <span id={`${searchId}-more`} className={`${styles.foldGroup} ${styles.foldable}`}>
              {signedIn ? (
                <AtlasThemeMenu
                  open={themeMenu}
                  onOpen={(open) => {
                    if (open) {
                      setThemesWanted(true)
                      setOpenSheet(null)
                    }
                    setThemeMenu(open)
                  }}
                  themes={themesRemote}
                  theme={themeShown}
                  onPick={setTheme}
                />
              ) : null}
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
              </span>
            </div>
            <div className={`${styles.chromeRight} ${styles.foldable}`} role="group" aria-label="Movement over time" data-atlas-controls="">
              <span className={styles.eyebrow}>Movement</span>
              <div className={pro$.seg} role="group" aria-label={pro ? 'Compare with an earlier map' : 'Compare with an earlier map: Pro'}>
                {([[0, 'Off', 'Movement off'], [26, '6 mo', 'Movement over the last 6 months'], [52, '1 yr', 'Movement over the last year']] as const).map(([value, text, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={(pro ? cmp : 0) === value}
                    aria-label={pro || !value ? label : `${label}: Pro`}
                    data-locked={!pro && value ? '' : undefined}
                    disabled={pro && value > 0 && (!residual || value >= weeks.length)}
                    title={pro && value > 0 && residual && value >= weeks.length && weeksRemote.status === 'ok' ? `Needs ${value} earlier weeks` : undefined}
                    onClick={(event) => onMovement(value, event.currentTarget)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            {/* The open sheet starts on its own line, under the controls however many lines they take. */}
            {openSheet ? <span className={styles.break} aria-hidden="true" /> : null}

            {openSheet === 'browse' ? (
              <section id="atlas-browse" className={styles.sheet} aria-labelledby="atlas-browse-title" data-lenis-prevent="">
                <h2 id="atlas-browse-title">Browse the market</h2>
                <AtlasBrowse
                  tab={browseTab}
                  onTab={setBrowseTab}
                  zones={atlas.zones}
                  bundles={atlas.bundles}
                  leadersOf={leadersOf}
                  dots={dots}
                  changes={changes}
                  hues={hues}
                  dark={paletteRef.current?.dark ?? false}
                  selectedZone={selectedZone}
                  onZone={selectZone}
                  onCompany={selectSymbol}
                  onHoverZone={(zoneId) => setHoverZone((current) => (current === zoneId ? current : zoneId))}
                  signedIn={signedIn}
                  pro={pro}
                  groups={groups}
                  onGroup={(group) => setMulti(new Set(group.members))}
                  onDeleteGroup={(group) => saveGroups(groups.filter((item) => item.id !== group.id))}
                  accuracy={accuracy}
                  weeks={weeksRemote}
                  lens={lens}
                  onLocked={gate}
                />
              </section>
            ) : null}

            {openSheet === 'help' ? (
              <section id="atlas-help" className={styles.sheet} aria-labelledby="atlas-help-title" data-lenis-prevent="">
                <h2 id="atlas-help-title">How to read the atlas</h2>
                <dl className={styles.helpList}>
                  <dt>Position</dt><dd>Companies whose prices move together sit close, after removing what the whole market does that day.</dd>
                  <dt>Regions</dt><dd>Areas of companies that move together, measured from prices. The line holds 80% of a region&apos;s weight; a company can sit between two.</dd>
                  <dt>Themes</dt><dd>What thematic funds hold together. A theme is a label, not a measurement: it can cross regions, and its companies need not move together. The theme card says whether prices confirm it.{signedIn ? '' : ' Shown with a free account.'}</dd>
                  <dt>Size</dt><dd>Market value.</dd>
                  <dt>Wells</dt><dd>How many companies move with it in its region. A small ball in a deep well is a small company many others move with.{signedIn ? '' : ' Shown with a free account.'}</dd>
                  <dt>Lines</dt><dd>The strongest ties inside each region. Every region shows the same share of its companies at each zoom level, and the lines join the ones on screen.</dd>
                  <dt>Bundles</dt><dd>Real ties between two regions. Point at a region to see its strongest bundles and how many strong ties each holds; select a company to see its own ties.</dd>
                  <dt>Average correlation</dt><dd>How much companies move together this week, against the last year&apos;s weeks.</dd>
                  <dt>Movement</dt><dd>Arrows show groups of companies that moved from one region to another in the last 6 months or year.{pro ? '' : ' Part of Pro.'}</dd>
                  <dt>Time</dt><dd>Drag the bar at the bottom to see where companies were in the past year.{pro ? '' : ' Part of Pro.'}</dd>
                  <dt>Influence</dt><dd>Arrows that show one group moving another on the same day: when the first group reports results, the second moves too, and not the other way round. Shown only when this repeats in both of the last two years. Turn it on in Layers; when nothing passes the test, nothing is drawn and the list says so.{pro ? '' : ' Part of Pro.'}</dd>
                </dl>
              </section>
            ) : null}

            {openSheet === 'layers' ? (
              <section id="atlas-layers" className={styles.sheet} aria-labelledby="atlas-layers-title" data-lenis-prevent="">
                <h2 id="atlas-layers-title">Layers</h2>
                <AtlasLayers
                  pro={pro}
                  lens={lens}
                  byValue={byValue}
                  showFidelity={showFidelity}
                  showInfluence={showInfluence}
                  influence={influenceRemote}
                  showNames={showNames}
                  keyOpen={keyOpen}
                  onLens={changeLens}
                  onByValue={setByValue}
                  onFidelity={setShowFidelity}
                  onInfluence={setShowInfluence}
                  onNames={setShowNames}
                  onKey={setKeyOpen}
                  onLocked={gate}
                />
                {pro && lens === 'total' && lensRemote.status === 'loading' ? <p className={pro$.muted} role="status">Loading the total co-movement map…</p> : null}
                {pro && lens === 'total' && (lensRemote.status === 'error' || lensRemote.status === 'denied') ? (
                  <p className={pro$.empty}>The total co-movement map could not load. <button type="button" className={pro$.chip} onClick={retryLens}>Retry</button></p>
                ) : null}
              </section>
            ) : null}

            {openSheet === 'notebook' && pro ? (
              <AtlasNotebook
                notes={notes}
                stored={stored}
                onSave={saveView}
                onOpen={openNote}
                onDelete={(entry) => saveNotes(notes.filter((item) => item.id !== entry.id))}
                onNote={(entry, text) => saveNotes(notes.map((item) => (item.id === entry.id ? { ...item, note: text } : item)))}
                onClose={() => {
                  setOpenSheet(null)
                  railButton('notebook')?.focus()
                }}
              />
            ) : null}
          </div>

          {pro && showInfluence && influence && residual && shownWeek === 0 ? (
            <div className={pro$.cardSlot}><InfluenceCard influence={influence} /></div>
          ) : themeShown ? (
            <div className={pro$.cardSlot}><ThemeCard theme={themeShown} labelOf={labelOf} /></div>
          ) : null}

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

          <AtlasToolRail pro={pro} active={railActive} onTool={onTool} onLocked={gate} />

          {pro && (dock || multi.size) ? (
            <div className={pro$.workbench}>
              {dock ? (
                <AtlasDock
                  kind={dock.kind}
                  sources={dockSources}
                  a={dockA}
                  b={dockB}
                  onPick={(a, b) => setDock({ ...dock, a, b })}
                  onClose={closeDock}
                  compare={compare}
                  test={testState}
                  testsRun={testsRun}
                  onRun={() => void runTest()}
                  onNote={saveView}
                />
              ) : null}
              {multi.size ? (
                <AtlasTray
                  summary={summary}
                  meanCorrelation={trayCorrelation}
                  groupCount={groups.length}
                  onCompare={() => openDock('compare', groupKey(multi))}
                  onTest={() => openDock('test', groupKey(multi))}
                  onSave={(name) => saveGroups([...groups, { id: `${Date.now().toString(36)}${groups.length}`, name, members: [...multi] }])}
                  onNote={saveView}
                  onClear={() => setMulti(new Set())}
                />
              ) : null}
            </div>
          ) : null}

          {hover ? (
            <span className={styles.tip} role="status" style={{ left: hover.x, top: hover.y }}>
              <b>{hover.node.symbol}</b>{hover.node.name ? ` ${hover.node.name}` : ''}{zonesById.get(hover.node.zoneId) ? ` · ${zonesById.get(hover.node.zoneId)?.label}` : ''}
            </span>
          ) : null}
          {!hover && zoneTip && zonesById.get(zoneTip.zoneId) ? (() => {
            const zone = zonesById.get(zoneTip.zoneId) as AtlasZone
            const source = nameSourceLine(zone.labelSource, zone.labelSupport)
            return (
              <span className={styles.tip} role="status" style={{ left: zoneTip.x, top: zoneTip.y }}>
                <span style={{ fontWeight: 600 }}>{zone.label.replace(/_/g, ' ')}</span> · {zone.memberCount} companies{source ? <><br /><small>{source}</small></> : null}
              </span>
            )
          })() : null}
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

          {keyOpen ? (
            <AtlasMapKey
              signedIn={signedIn}
              extras={{
                arrowsSince: cmp && shownWeek === 0 ? spanAgo(cmp) : null,
                paths: shownWeek > 0,
                fidelity: pro && showFidelity,
                influence: pro && showInfluence && residual,
                theme: theme !== null,
              }}
              onClose={() => setKeyOpen(false)}
            />
          ) : null}

          {residual || !pro ? (
            <AtlasTimeBar
              pro={pro}
              span={span}
              week={shownWeek}
              label={weekLabel(weeks, shownWeek)}
              playing={playing}
              note={note}
              loading={loadingWeeks}
              onWeek={onWeek}
              onPlay={togglePlay}
              onLocked={gate}
            />
          ) : null}

          {upsell ? <AtlasUpsell feature={upsell} signedIn={signedIn} onClose={closeUpsell} /> : null}

          <p className={styles.snapshot}>
            <span>Week of <b>{formatDate(initial.asOf)}</b></span>
            <span>{atlas.companyCount.toLocaleString('en-US')} companies in {atlas.zoneCount} regions{lens === 'total' && atlas.lens === 'total' ? ' · total co-movement' : ''}</span>
            {sentence ? <span>{sentence}</span> : null}
          </p>
        </div>

        {selection ? (
          <aside className={styles.panel} aria-live="polite" aria-label="Details" data-lenis-prevent="">
            <button type="button" className={styles.close} onClick={() => setSelection(null)} aria-label="Close details"><X size={16} aria-hidden="true" /></button>
            <AtlasPanel
              panel={panel}
              zonesById={zonesById}
              onRetry={() => setPanelAttempt((count) => count + 1)}
              pro={pro}
              then={pro && residual ? then : null}
              farTies={overlay.farTies.length}
              onAction={onPanelAction}
              onCompany={selectSymbol}
              onZone={(zoneId) => {
                const zone = zonesById.get(zoneId)
                if (zone) selectZone(zone)
              }}
              hues={hues}
              dark={paletteRef.current?.dark ?? false}
              maxReach={atlas.reachMax ?? maxReach}
            />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
