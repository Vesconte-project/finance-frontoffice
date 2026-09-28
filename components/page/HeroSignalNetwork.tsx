'use client'

import { useMemo, useRef, useState } from 'react'
import { useChartPalette } from '@/components/charts/ChartContainer'
import type { ScreenerSignal } from '@/lib/signals'

type SignalDirection = 'bullish' | 'neutral' | 'bearish'
type NodeSignalState = SignalDirection | 'noSignal'
type RegionKey =
  | 'northAmerica'
  | 'latinAmerica'
  | 'europe'
  | 'africa'
  | 'middleEast'
  | 'india'
  | 'eastAsia'
  | 'southeastAsia'
  | 'australia'
type MacroRegionKey = 'americas' | 'emea' | 'apac'
type LayerKey = 'background' | 'mid' | 'foreground'

type NormalizedPoint = {
  x: number
  y: number
}

type RegionSpec = {
  macro: MacroRegionKey
  center: NormalizedPoint
  spread: NormalizedPoint
  supports: NormalizedPoint[]
  weight: number
}

type NetworkNode = {
  ticker: string
  name: string | null
  direction: SignalDirection
  signalState: NodeSignalState
  conviction: number
  predictionHorizon: number
  importance: number
  depth: number
  x: number
  y: number
  anchorX: number
  anchorY: number
  radius: number
  region: RegionKey
  macroRegion: MacroRegionKey
  sizeTier: 1 | 2 | 3 | 4
  layer: LayerKey
  driftX: number
  driftY: number
  driftDuration: number
  driftDelay: number
  pulseDelay: number
}

type NetworkEdge = {
  id: string
  from: string
  to: string
  strength: number
  crossRegion: boolean
  ambientDelay: number
  ambientDuration: number
  ambient: boolean
}

type HoverState = {
  ticker: string
  x: number
  y: number
}

type ParallaxState = {
  x: number
  y: number
}

const WIDTH = 1160
const HEIGHT = 448
const HERO_NODE_CAP = 180
const HERO_NODE_FLOOR = 140

const REGION_ORDER: RegionKey[] = [
  'northAmerica',
  'latinAmerica',
  'europe',
  'africa',
  'middleEast',
  'india',
  'eastAsia',
  'southeastAsia',
  'australia',
]

const REGION_SPECS: Record<RegionKey, RegionSpec> = {
  northAmerica: {
    macro: 'americas',
    center: { x: 0.22, y: 0.34 },
    spread: { x: 0.055, y: 0.075 },
    supports: [{ x: 0.2, y: 0.24 }, { x: 0.27, y: 0.37 }],
    weight: 0.28,
  },
  latinAmerica: {
    macro: 'americas',
    center: { x: 0.28, y: 0.66 },
    spread: { x: 0.035, y: 0.085 },
    supports: [{ x: 0.31, y: 0.74 }],
    weight: 0.06,
  },
  europe: {
    macro: 'emea',
    center: { x: 0.49, y: 0.3 },
    spread: { x: 0.05, y: 0.05 },
    supports: [{ x: 0.45, y: 0.24 }, { x: 0.52, y: 0.37 }],
    weight: 0.16,
  },
  africa: {
    macro: 'emea',
    center: { x: 0.52, y: 0.61 },
    spread: { x: 0.04, y: 0.09 },
    supports: [{ x: 0.54, y: 0.74 }],
    weight: 0.07,
  },
  middleEast: {
    macro: 'emea',
    center: { x: 0.59, y: 0.44 },
    spread: { x: 0.035, y: 0.045 },
    supports: [],
    weight: 0.06,
  },
  india: {
    macro: 'apac',
    center: { x: 0.69, y: 0.5 },
    spread: { x: 0.028, y: 0.04 },
    supports: [],
    weight: 0.08,
  },
  eastAsia: {
    macro: 'apac',
    center: { x: 0.79, y: 0.34 },
    spread: { x: 0.05, y: 0.06 },
    supports: [{ x: 0.83, y: 0.28 }, { x: 0.79, y: 0.26 }],
    weight: 0.18,
  },
  southeastAsia: {
    macro: 'apac',
    center: { x: 0.77, y: 0.58 },
    spread: { x: 0.04, y: 0.055 },
    supports: [{ x: 0.79, y: 0.66 }],
    weight: 0.07,
  },
  australia: {
    macro: 'apac',
    center: { x: 0.87, y: 0.74 },
    spread: { x: 0.028, y: 0.035 },
    supports: [{ x: 0.91, y: 0.81 }],
    weight: 0.04,
  },
}

type HeroRoster = {
  anchors: string[]
  secondary: string[]
}

const HERO_ROSTER_BY_REGION: Record<RegionKey, HeroRoster> = {
  northAmerica: {
    anchors: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'SPY', 'QQQ', 'JPM', 'XOM'],
    secondary: ['DIA', 'VOO', 'VTI', 'IWM', 'NFLX', 'AMD', 'PLTR', 'UNH', 'COST', 'AVGO', 'CRM', 'ORCL'],
  },
  europe: {
    anchors: ['ASML', 'SAP', 'SHEL', 'NVO', 'HSBC', 'TTE', 'AZN', 'VGK', 'EZU'],
    secondary: ['BP', 'UL', 'SNY', 'DB', 'EWI', 'EWP', 'EWU', 'FEZ', 'GSK'],
  },
  eastAsia: {
    anchors: ['TSM', 'BABA', 'JD', 'BIDU', 'EWJ', 'EWT', 'MCHI'],
    secondary: ['NTES', 'SONY', 'KWEB', 'FXI', 'KORU', 'EWY'],
  },
  india: {
    anchors: ['INDA', 'INFY', 'HDB', 'IBN'],
    secondary: ['WIT', 'TTM', 'RDY', 'INDY', 'SMIN'],
  },
  australia: {
    anchors: ['EWA', 'BHP', 'RIO'],
    secondary: ['CSL', 'WOW', 'WBC', 'ANZ', 'ASX'],
  },
  latinAmerica: {
    anchors: ['EWZ', 'VALE', 'PBR', 'EWW', 'MELI', 'ILF'],
    secondary: ['BAP', 'EC', 'CX', 'SBS', 'BBD', 'ARGT'],
  },
  southeastAsia: {
    anchors: ['EWS', 'EWM', 'EPHE', 'VNM'],
    secondary: ['IDX', 'THD', 'EIDO', 'ASEA'],
  },
  middleEast: {
    anchors: ['EIS', 'ISRA', 'UAE'],
    secondary: ['SAUD', 'QAT', 'KSA'],
  },
  africa: {
    anchors: ['EZA', 'AFK', 'NGE'],
    secondary: ['EGPT', 'GAF'],
  },
}

const REGION_FILL_SEQUENCE: RegionKey[] = [
  'northAmerica',
  'europe',
  'eastAsia',
  'northAmerica',
  'europe',
  'eastAsia',
  'india',
  'southeastAsia',
  'latinAmerica',
  'middleEast',
  'africa',
  'australia',
]

const REGION_SIZE_MULTIPLIER: Record<RegionKey, number> = {
  northAmerica: 1.12,
  europe: 1.05,
  eastAsia: 1.08,
  india: 0.96,
  southeastAsia: 0.94,
  middleEast: 0.9,
  latinAmerica: 0.86,
  africa: 0.82,
  australia: 0.84,
}

const TICKER_HOME_REGION: Record<string, RegionKey> = {
  AAPL: 'northAmerica',
  MSFT: 'northAmerica',
  NVDA: 'northAmerica',
  AMZN: 'northAmerica',
  GOOGL: 'northAmerica',
  META: 'northAmerica',
  TSLA: 'northAmerica',
  AMD: 'northAmerica',
  AVGO: 'northAmerica',
  CRM: 'northAmerica',
  ORCL: 'northAmerica',
  NFLX: 'northAmerica',
  PLTR: 'northAmerica',
  BRK: 'northAmerica',
  'BRK.B': 'northAmerica',
  SPY: 'northAmerica',
  QQQ: 'northAmerica',
  DIA: 'northAmerica',
  VOO: 'northAmerica',
  VTI: 'northAmerica',
  IWM: 'northAmerica',
  XLF: 'northAmerica',
  XLE: 'northAmerica',
  EWZ: 'latinAmerica',
  ILF: 'latinAmerica',
  MELI: 'latinAmerica',
  EWW: 'latinAmerica',
  VALE: 'latinAmerica',
  PBR: 'latinAmerica',
  BAP: 'latinAmerica',
  EC: 'latinAmerica',
  CX: 'latinAmerica',
  SBS: 'latinAmerica',
  BBD: 'latinAmerica',
  ARGT: 'latinAmerica',
  ASML: 'europe',
  SAP: 'europe',
  SHEL: 'europe',
  AZN: 'europe',
  GSK: 'europe',
  HSBC: 'europe',
  TTE: 'europe',
  VGK: 'europe',
  EZU: 'europe',
  FEZ: 'europe',
  EWU: 'europe',
  NVO: 'europe',
  EWQ: 'europe',
  EWG: 'europe',
  EWI: 'europe',
  EWP: 'europe',
  EZA: 'africa',
  AFK: 'africa',
  EGPT: 'africa',
  GAF: 'africa',
  NGE: 'africa',
  EIS: 'middleEast',
  SAUD: 'middleEast',
  ISRA: 'middleEast',
  UAE: 'middleEast',
  QAT: 'middleEast',
  KSA: 'middleEast',
  INDA: 'india',
  INDY: 'india',
  SMIN: 'india',
  INFY: 'india',
  HDB: 'india',
  IBN: 'india',
  WIT: 'india',
  TTM: 'india',
  RDY: 'india',
  TSM: 'eastAsia',
  BABA: 'eastAsia',
  BIDU: 'eastAsia',
  NTES: 'eastAsia',
  SONY: 'eastAsia',
  JD: 'eastAsia',
  FXI: 'eastAsia',
  MCHI: 'eastAsia',
  KWEB: 'eastAsia',
  EWY: 'eastAsia',
  EWJ: 'eastAsia',
  EWT: 'eastAsia',
  KORU: 'eastAsia',
  EWS: 'southeastAsia',
  EPHE: 'southeastAsia',
  EWM: 'southeastAsia',
  VNM: 'southeastAsia',
  IDX: 'southeastAsia',
  THD: 'southeastAsia',
  EIDO: 'southeastAsia',
  ASEA: 'southeastAsia',
  EWA: 'australia',
  BHP: 'australia',
  RIO: 'australia',
  CSL: 'australia',
  WOW: 'australia',
  WBC: 'australia',
  ANZ: 'australia',
  ASX: 'australia',
}

const OCEAN_GAPS: Array<{ center: NormalizedPoint; radius: NormalizedPoint; softness: number }> = [
  { center: { x: 0.4, y: 0.48 }, radius: { x: 0.12, y: 0.28 }, softness: 0.12 },
  { center: { x: 0.66, y: 0.62 }, radius: { x: 0.1, y: 0.2 }, softness: 0.105 },
  { center: { x: 0.73, y: 0.42 }, radius: { x: 0.06, y: 0.12 }, softness: 0.08 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function stableHash(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function seededUnit(seed: number, salt: number): number {
  const value = Math.sin((seed + salt * 17.13) * 12.9898) * 43758.5453123
  return value - Math.floor(value)
}

function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}

function directionLabel(direction: NodeSignalState): string {
  if (direction === 'bullish') return 'Bullish'
  if (direction === 'bearish') return 'Bearish'
  if (direction === 'noSignal') return 'No Signal'
  return 'Neutral'
}

function directionColor(direction: NodeSignalState, palette: ReturnType<typeof useChartPalette>): string {
  if (direction === 'bullish') return palette.bullish
  if (direction === 'bearish') return palette.bearish
  if (direction === 'neutral') return palette.isDark ? 'var(--text)' : 'var(--text)'
  return palette.isDark ? 'var(--text-muted)' : 'var(--text-muted)'
}

function fromNormalized(point: NormalizedPoint): { x: number; y: number } {
  return { x: point.x * WIDTH, y: point.y * HEIGHT }
}

function normalizeSignals(signals: ScreenerSignal[]): ScreenerSignal[] {
  const byTicker = new Map<string, ScreenerSignal>()
  for (const row of signals) {
    const ticker = row.ticker?.trim().toUpperCase()
    if (!ticker || byTicker.has(ticker)) continue
    byTicker.set(ticker, { ...row, ticker })
  }

  return [...byTicker.values()]
}

function buildPlaceholderRow(ticker: string): ScreenerSignal {
  return {
    ticker,
    name: null,
    direction: 'neutral',
    conviction: null,
    signalDate: null,
    predictionHorizon: null,
    price: null,
    changePercent: null,
  }
}

function pickAnchorPoint(region: RegionKey, seed: number): NormalizedPoint {
  const spec = REGION_SPECS[region]
  if (spec.supports.length === 0) return spec.center
  const supportBias = seededUnit(seed, 23)
  if (supportBias < 0.72) return spec.center
  const supportIndex = Math.floor(seededUnit(seed, 29) * spec.supports.length)
  const support = spec.supports[supportIndex]
  if (!support) return spec.center
  return {
    x: spec.center.x * 0.58 + support.x * 0.42,
    y: spec.center.y * 0.58 + support.y * 0.42,
  }
}

function inferHomeRegion(row: ScreenerSignal): RegionKey {
  const ticker = row.ticker?.trim().toUpperCase() ?? ''
  if (ticker in TICKER_HOME_REGION) {
    return TICKER_HOME_REGION[ticker] as RegionKey
  }
  const normalized = ticker.includes('-') ? ticker.split('-')[0] : ticker
  if (normalized in TICKER_HOME_REGION) {
    return TICKER_HOME_REGION[normalized] as RegionKey
  }

  const suffix = ticker.includes('.') ? ticker.split('.').pop()?.toUpperCase() ?? '' : ''
  const regionBySuffix: Record<string, RegionKey> = {
    TO: 'northAmerica',
    V: 'northAmerica',
    MX: 'latinAmerica',
    SA: 'latinAmerica',
    BA: 'latinAmerica',
    PA: 'europe',
    DE: 'europe',
    AS: 'europe',
    SW: 'europe',
    MI: 'europe',
    MC: 'europe',
    BR: 'europe',
    L: 'europe',
    JO: 'africa',
    CA: 'africa',
    TA: 'middleEast',
    NS: 'india',
    BO: 'india',
    HK: 'eastAsia',
    T: 'eastAsia',
    TW: 'eastAsia',
    KS: 'eastAsia',
    KQ: 'eastAsia',
    SS: 'eastAsia',
    SZ: 'eastAsia',
    SI: 'southeastAsia',
    KL: 'southeastAsia',
    AX: 'australia',
  }
  if (suffix && suffix in regionBySuffix && suffix.length > 1) {
    return regionBySuffix[suffix] as RegionKey
  }

  const name = (row.name ?? '').toLowerCase()
  if (name.includes('brazil') || name.includes('mexico') || name.includes('argentina') || name.includes('chile')) {
    return 'latinAmerica'
  }
  if (name.includes('saudi') || name.includes('uae') || name.includes('israel') || name.includes('qatar')) {
    return 'middleEast'
  }
  if (name.includes('india')) {
    return 'india'
  }
  if (name.includes('singapore') || name.includes('malaysia') || name.includes('thailand') || name.includes('indonesia') || name.includes('philippines') || name.includes('vietnam')) {
    return 'southeastAsia'
  }
  if (name.includes('japan') || name.includes('china') || name.includes('korea') || name.includes('taiwan') || name.includes('hong kong')) {
    return 'eastAsia'
  }
  if (name.includes('australia') || name.includes('new zealand')) {
    return 'australia'
  }
  if (name.includes('south africa') || name.includes('nigeria') || name.includes('kenya') || name.includes('egypt')) {
    return 'africa'
  }
  if (name.includes('united kingdom') || name.includes('germany') || name.includes('france') || name.includes('europe') || name.includes('switzerland') || name.includes('spain') || name.includes('italy')) {
    return 'europe'
  }

  return 'northAmerica'
}

function rankRegionRows(region: RegionKey, rows: ScreenerSignal[]): ScreenerSignal[] {
  const roster = HERO_ROSTER_BY_REGION[region]
  const anchorIndex = new Map(roster.anchors.map((ticker, index) => [ticker, index]))
  const secondaryIndex = new Map(roster.secondary.map((ticker, index) => [ticker, index]))

  return rows
    .slice()
    .sort((a, b) => {
      const aTicker = a.ticker.toUpperCase()
      const bTicker = b.ticker.toUpperCase()
      const aAnchor = anchorIndex.has(aTicker)
      const bAnchor = anchorIndex.has(bTicker)
      if (aAnchor !== bAnchor) return aAnchor ? -1 : 1
      if (aAnchor && bAnchor) return (anchorIndex.get(aTicker) ?? 0) - (anchorIndex.get(bTicker) ?? 0)
      const aSecondary = secondaryIndex.has(aTicker)
      const bSecondary = secondaryIndex.has(bTicker)
      if (aSecondary !== bSecondary) return aSecondary ? -1 : 1
      if (aSecondary && bSecondary) return (secondaryIndex.get(aTicker) ?? 0) - (secondaryIndex.get(bTicker) ?? 0)
      return (b.conviction ?? 0.5) - (a.conviction ?? 0.5) || aTicker.localeCompare(bTicker)
    })
}

function pickCuratedHeroSignals(rows: ScreenerSignal[]): ScreenerSignal[] {
  const targetCount = Math.min(HERO_NODE_CAP, Math.max(rows.length, HERO_NODE_FLOOR))
  if (targetCount <= 0) return []
  const byTicker = new Map(rows.map((row) => [row.ticker.toUpperCase(), row]))

  const rowsByRegion = new Map<RegionKey, ScreenerSignal[]>()
  for (const region of REGION_ORDER) {
    rowsByRegion.set(region, rankRegionRows(region, rows.filter((row) => inferHomeRegion(row) === region)))
  }

  const selected: ScreenerSignal[] = []
  const seen = new Set<string>()

  const pushRow = (row: ScreenerSignal | undefined) => {
    if (!row) return
    const ticker = row.ticker.toUpperCase()
    if (seen.has(ticker)) return
    seen.add(ticker)
    selected.push(row)
  }

  const regionAnchorRows = new Map<RegionKey, ScreenerSignal[]>()
  const regionSecondaryRows = new Map<RegionKey, ScreenerSignal[]>()

  for (const region of REGION_ORDER) {
    const roster = HERO_ROSTER_BY_REGION[region]
    regionAnchorRows.set(
      region,
      roster.anchors.map((ticker) => byTicker.get(ticker) ?? buildPlaceholderRow(ticker))
    )
    regionSecondaryRows.set(
      region,
      roster.secondary.map((ticker) => byTicker.get(ticker) ?? buildPlaceholderRow(ticker))
    )
  }

  function pushRoundRobin(map: Map<RegionKey, ScreenerSignal[]>) {
    let index = 0
    while (selected.length < targetCount) {
      let added = false
      for (const region of REGION_ORDER) {
        const entry = map.get(region)?.[index]
        if (!entry) continue
        const before = selected.length
        pushRow(entry)
        if (selected.length > before) added = true
        if (selected.length >= targetCount) break
      }
      if (!added) break
      index += 1
    }
  }

  pushRoundRobin(regionAnchorRows)
  if (selected.length < targetCount) {
    pushRoundRobin(regionSecondaryRows)
  }

  const regionCursor = new Map<RegionKey, number>()
  for (const region of REGION_ORDER) {
    regionCursor.set(region, 0)
  }

  while (selected.length < targetCount) {
    let added = false
    for (const region of REGION_FILL_SEQUENCE) {
      const bucket = rowsByRegion.get(region) ?? []
      const cursor = regionCursor.get(region) ?? 0
      const candidate = bucket[cursor]
      regionCursor.set(region, cursor + 1)
      if (!candidate) continue
      const before = selected.length
      pushRow(candidate)
      if (selected.length > before) added = true
      if (selected.length >= targetCount) break
    }
    if (!added) break
  }

  if (selected.length < targetCount) {
    const fallback = rows
      .slice()
      .sort((a, b) => (b.conviction ?? 0.5) - (a.conviction ?? 0.5) || a.ticker.localeCompare(b.ticker))
    for (const row of fallback) {
      if (selected.length >= targetCount) break
      pushRow(row)
    }
  }

  return selected.slice(0, targetCount)
}

function applyOceanGapRepulsion(point: NormalizedPoint): NormalizedPoint {
  let next = { ...point }
  for (const gap of OCEAN_GAPS) {
    const dx = next.x - gap.center.x
    const dy = next.y - gap.center.y
    const rx = Math.max(0.0001, gap.radius.x)
    const ry = Math.max(0.0001, gap.radius.y)
    const normalizedDistance = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
    if (normalizedDistance >= 1) continue
    const scale = (1 - normalizedDistance) * gap.softness
    const pushX = dx === 0 ? 0.001 : dx
    const pushY = dy === 0 ? 0.001 : dy
    const norm = Math.sqrt(pushX * pushX + pushY * pushY) || 0.001
    next = {
      x: clamp(next.x + (pushX / norm) * scale, 0.03, 0.97),
      y: clamp(next.y + (pushY / norm) * scale, 0.04, 0.96),
    }
  }
  return next
}

function carveInternalGap(
  dx: number,
  dy: number,
  gapX: number,
  gapY: number,
  radiusX: number,
  radiusY: number,
  strength: number
): { dx: number; dy: number } {
  const rx = Math.max(0.0001, radiusX)
  const ry = Math.max(0.0001, radiusY)
  const nx = dx - gapX
  const ny = dy - gapY
  const metric = Math.sqrt((nx * nx) / (rx * rx) + (ny * ny) / (ry * ry))
  if (metric >= 1) return { dx, dy }
  const push = (1 - metric) * strength
  const norm = Math.sqrt(nx * nx + ny * ny) || 0.0001
  return {
    dx: dx + (nx / norm) * push,
    dy: dy + (ny / norm) * push,
  }
}

function shapeRegionalPoint(region: RegionKey, anchor: NormalizedPoint, spread: NormalizedPoint, seed: number): NormalizedPoint {
  const sx = spread.x
  const sy = spread.y

  // Non-radial base noise; triangular + skewed components.
  const tx = seededUnit(seed, 37) + seededUnit(seed, 41) - 1
  const ty = seededUnit(seed, 43) + seededUnit(seed, 47) - 1
  let dx = tx * sx
  let dy = ty * sy

  if (region === 'northAmerica') {
    // Wide horizontally, compressed vertically, with downward taper.
    dy *= 0.76
    const downNorm = clamp((dy / Math.max(0.0001, sy) + 1) * 0.5, 0, 1)
    const widthScale = 1.42 - downNorm * 0.52
    dx *= widthScale
    dy += Math.abs(dx) * 0.12
    dx -= sx * 0.08
  } else if (region === 'latinAmerica') {
    dx *= 0.72
    dy *= 1.18
    dx += sx * 0.09
    dy += Math.abs(dx) * 0.13
  } else if (region === 'europe') {
    // Compact, irregular mass with unequal lobes and partial merges.
    const mix = seededUnit(seed, 59)
    const merge = seededUnit(seed, 61)
    if (mix < 0.54) {
      dx = dx * 0.78 - sx * 0.17
      dy = dy * 0.64 - sy * 0.04
    } else if (mix < 0.84) {
      dx = dx * 0.56 + sx * 0.06
      dy = dy * 0.6 + sy * 0.01
    } else {
      dx = dx * 0.42 + sx * 0.23
      dy = dy * 0.48 - sy * 0.11
    }
    dx += (merge - 0.5) * sx * 0.12
    dy += (merge - 0.5) * sy * 0.08
    const carved = carveInternalGap(dx, dy, sx * 0.03, -sy * 0.02, sx * 0.22, sy * 0.18, sx * 0.09)
    dx = carved.dx
    dy = carved.dy
  } else if (region === 'africa') {
    dx *= 0.78
    dy *= 1.2
    dy += Math.abs(dx) * 0.11
  } else if (region === 'middleEast') {
    dx *= 0.86
    dy *= 0.82
    dx += sx * 0.1
  } else if (region === 'india') {
    dx *= 0.76
    dy *= 0.84
    dx += (seededUnit(seed, 71) - 0.5) * sx * 0.22
  } else if (region === 'eastAsia') {
    // Horizontally stretched with 2-3 uneven sub-masses and inner voids.
    const lobe = seededUnit(seed, 73)
    const bridge = seededUnit(seed, 79)
    if (lobe < 0.42) {
      dx = dx * 1.22 - sx * 0.44
      dy = dy * 0.72 - sy * 0.02
    } else if (lobe < 0.83) {
      dx = dx * 1.04 + sx * 0.06
      dy = dy * 0.66 + sy * 0.03
    } else {
      dx = dx * 0.78 + sx * 0.44
      dy = dy * 0.62 - sy * 0.08
    }
    // Partial merge between nearby lobes to avoid isolated repeated circles.
    dx += (bridge - 0.5) * sx * 0.28
    dy += (bridge - 0.5) * sy * 0.16
    const carvedA = carveInternalGap(dx, dy, -sx * 0.08, sy * 0.01, sx * 0.24, sy * 0.16, sx * 0.08)
    const carvedB = carveInternalGap(carvedA.dx, carvedA.dy, sx * 0.18, -sy * 0.02, sx * 0.2, sy * 0.14, sx * 0.06)
    dx = carvedB.dx
    dy = carvedB.dy
  } else if (region === 'southeastAsia') {
    const subPick = seededUnit(seed, 83)
    if (subPick < 0.62) {
      dx = dx * 1.16 - sx * 0.19
      dy = dy * 0.8 + sy * 0.03
    } else {
      dx = dx * 0.9 + sx * 0.26
      dy = dy * 0.72 + sy * 0.08
    }
    const carved = carveInternalGap(dx, dy, sx * 0.02, sy * 0.02, sx * 0.16, sy * 0.12, sx * 0.045)
    dx = carved.dx
    dy = carved.dy
  } else if (region === 'australia') {
    // Small, isolated, slightly elongated.
    dx *= 0.72
    dy *= 0.5
    dx += sx * 0.07
    dy += sy * 0.05
  }

  // Global asymmetry/skew so no region resolves into circles.
  dx += (seededUnit(seed, 97) - 0.5) * sx * 0.14
  dy += (seededUnit(seed, 101) - 0.5) * sy * 0.12
  dx += dy * 0.08

  return {
    x: anchor.x + dx,
    y: anchor.y + dy,
  }
}

function radiusByTier(importance: number): { tier: 1 | 2 | 3 | 4; radius: number } {
  if (importance >= 0.82) return { tier: 4, radius: 11.2 }
  if (importance >= 0.64) return { tier: 3, radius: 9.2 }
  if (importance >= 0.42) return { tier: 2, radius: 7.3 }
  return { tier: 1, radius: 5.8 }
}

function pickLayer(depth: number): LayerKey {
  if (depth < 0.33) return 'background'
  if (depth < 0.7) return 'mid'
  return 'foreground'
}

function buildNetwork(signals: ScreenerSignal[]): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const normalized = pickCuratedHeroSignals(normalizeSignals(signals))
  if (normalized.length === 0) return { nodes: [], edges: [] }

  const nodes: NetworkNode[] = normalized.map((row, index) => {
    const hasSignal = row.signalDate !== null && row.conviction !== null
    const signalState: NodeSignalState = hasSignal ? row.direction : 'noSignal'
    const conviction = clamp(hasSignal ? (row.conviction ?? 0.5) : 0.24, 0.1, 0.96)
    const seed = stableHash(row.ticker)
    const depth = seededUnit(seed, 31)
    const rankWeight = normalized.length <= 1 ? 1 : 1 - index / (normalized.length - 1)
    const priceWeight = row.price && row.price > 0
      ? clamp(Math.log10(row.price + 1) / 3.2, 0, 1)
      : 0.35
    const baseImportance = clamp(conviction * 0.54 + rankWeight * 0.3 + priceWeight * 0.16, 0.06, 1)
    const importance = hasSignal ? baseImportance : clamp(baseImportance * 0.82, 0.08, 0.72)
    const region = inferHomeRegion(row)
    const spec = REGION_SPECS[region]
    const baseAnchor = pickAnchorPoint(region, seed)
    const effectiveAnchor: NormalizedPoint = baseAnchor
    const effectiveCenter: NormalizedPoint = spec.center
    const effectiveSpread: NormalizedPoint = spec.spread
    const macroShiftX = spec.macro === 'americas' ? -0.008 : spec.macro === 'apac' ? 0.006 : 0
    const shapedBase = shapeRegionalPoint(region, effectiveAnchor, effectiveSpread, seed)
    const shaped = applyOceanGapRepulsion({
      x: shapedBase.x + macroShiftX,
      y: shapedBase.y,
    })
    const point = fromNormalized(shaped)
    const anchorPoint = fromNormalized(effectiveCenter)
    const sizeSpec = radiusByTier(importance)
    const isCoreMarket = region === 'northAmerica' || region === 'europe' || region === 'eastAsia'
    const coreBoost = isCoreMarket && importance >= 0.78 ? 0.72 : 0
    const regionScale = REGION_SIZE_MULTIPLIER[region]
    const inactiveScale = hasSignal ? 1 : 0.94

    return {
      ticker: row.ticker,
      name: row.name,
      direction: row.direction,
      signalState,
      conviction,
      predictionHorizon: row.predictionHorizon ?? 20,
      importance,
      depth,
      x: point.x,
      y: point.y,
      anchorX: anchorPoint.x,
      anchorY: anchorPoint.y,
      radius: (sizeSpec.radius * regionScale + conviction * 0.55 + coreBoost) * inactiveScale,
      region,
      macroRegion: spec.macro,
      sizeTier: sizeSpec.tier,
      layer: pickLayer(depth),
      driftX: (seededUnit(seed, 59) - 0.5) * (5.4 + depth * 3),
      driftY: (seededUnit(seed, 61) - 0.5) * (4.8 + depth * 2.7),
      driftDuration: 25 + seededUnit(seed, 67) * 18,
      driftDelay: seededUnit(seed, 71) * -22,
      pulseDelay: seededUnit(seed, 73) * -8,
    }
  })

  const positions = nodes.map((node) => ({ x: node.x, y: node.y, vx: 0, vy: 0 }))
  const anchorPull = 0.009
  const damping = 0.86

  for (let step = 0; step < 92; step += 1) {
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const pointA = positions[i]
        const pointB = positions[j]
        const nodeA = nodes[i]
        const nodeB = nodes[j]
        if (!pointA || !pointB || !nodeA || !nodeB) continue
        const dx = pointB.x - pointA.x
        const dy = pointB.y - pointA.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001
        const targetDistance = nodeA.radius + nodeB.radius + 8
        const limitDistance = targetDistance * 2.25
        if (distance > limitDistance) continue
        const overlapForce = (limitDistance - distance) * 0.012
        const fx = (dx / distance) * overlapForce
        const fy = (dy / distance) * overlapForce
        pointA.vx -= fx
        pointA.vy -= fy
        pointB.vx += fx
        pointB.vy += fy
      }
    }

    for (let index = 0; index < positions.length; index += 1) {
      const point = positions[index]
      const node = nodes[index]
      if (!point || !node) continue
      point.vx += (node.anchorX - point.x) * anchorPull
      point.vy += (node.anchorY - point.y) * anchorPull
      point.vx *= damping
      point.vy *= damping
      point.x = clamp(point.x + point.vx, 14, WIDTH - 14)
      point.y = clamp(point.y + point.vy, 14, HEIGHT - 14)
    }
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const point = positions[index]
    if (!node || !point) continue
    node.x = point.x
    node.y = point.y
  }

  const edges: NetworkEdge[] = []
  const edgeKeys = new Set<string>()

  function addEdge(from: NetworkNode, to: NetworkNode, strength: number, crossRegion: boolean) {
    if (from.ticker === to.ticker) return
    const key = [from.ticker, to.ticker].sort().join('|')
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    const edgeHash = stableHash(key)
    edges.push({
      id: key,
      from: from.ticker,
      to: to.ticker,
      strength: clamp(strength, 0.14, 0.96),
      crossRegion,
      ambient: seededUnit(edgeHash, 83) > (crossRegion ? 0.47 : 0.78),
      ambientDelay: seededUnit(edgeHash, 89) * -9,
      ambientDuration: 9 + seededUnit(edgeHash, 97) * 8,
    })
  }
  function signalSimilarity(a: NetworkNode, b: NetworkNode): number {
    if (a.signalState === 'noSignal' || b.signalState === 'noSignal') return 0.18
    const directionScore =
      a.signalState === b.signalState
        ? 1
        : a.signalState === 'neutral' || b.signalState === 'neutral'
          ? 0.58
          : 0.22
    const convictionScore = 1 - clamp(Math.abs(a.conviction - b.conviction), 0, 1)
    const horizonScore = 1 - clamp(Math.abs(a.predictionHorizon - b.predictionHorizon) / 40, 0, 1)
    return directionScore * 0.56 + convictionScore * 0.32 + horizonScore * 0.12
  }

  for (const source of nodes) {
    const candidates = nodes
      .filter((candidate) => candidate.ticker !== source.ticker)
      .map((candidate) => ({ candidate, similarity: signalSimilarity(source, candidate) }))
      .sort((a, b) => b.similarity - a.similarity || a.candidate.ticker.localeCompare(b.candidate.ticker))
      .slice(0, 2)

    for (const item of candidates) {
      if (item.similarity < 0.5) continue
      addEdge(source, item.candidate, item.similarity, source.macroRegion !== item.candidate.macroRegion)
    }
  }

  const crossEdges = edges
    .filter((edge) => edge.crossRegion)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
  const localEdges = edges
    .filter((edge) => !edge.crossRegion)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))

  const limitedEdges: NetworkEdge[] = []
  const seen = new Set<string>()
  for (const edge of crossEdges.slice(0, 12)) {
    seen.add(edge.id)
    limitedEdges.push(edge)
  }
  for (const edge of [...localEdges, ...crossEdges]) {
    if (limitedEdges.length >= 52) break
    if (seen.has(edge.id)) continue
    seen.add(edge.id)
    limitedEdges.push(edge)
  }

  return { nodes, edges: limitedEdges }
}

export default function HeroSignalNetwork({ signals }: { signals: ScreenerSignal[] }) {
  const palette = useChartPalette()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [parallax, setParallax] = useState<ParallaxState>({ x: 0, y: 0 })

  const { nodes, edges } = useMemo(() => buildNetwork(signals), [signals])
  const nodeByTicker = useMemo(() => new Map(nodes.map((node) => [node.ticker, node])), [nodes])

  const connectedTickers = useMemo(() => {
    if (!hover) return null
    const connected = new Set<string>([hover.ticker])
    for (const edge of edges) {
      if (edge.from === hover.ticker) connected.add(edge.to)
      if (edge.to === hover.ticker) connected.add(edge.from)
    }
    return connected
  }, [edges, hover])

  const connectedEdges = useMemo(() => {
    if (!hover) return null
    const highlighted = new Set<string>()
    for (const edge of edges) {
      if (edge.from === hover.ticker || edge.to === hover.ticker) {
        highlighted.add(edge.id)
      }
    }
    return highlighted
  }, [edges, hover])

  const hoveredNode = hover ? nodeByTicker.get(hover.ticker) ?? null : null

  const layeredNodes = useMemo(() => {
    const groups: Record<LayerKey, NetworkNode[]> = {
      background: [],
      mid: [],
      foreground: [],
    }
    for (const node of nodes) {
      groups[node.layer].push(node)
    }
    return groups
  }, [nodes])

  if (nodes.length === 0) {
    return (
      <div className="text-body-sm flex min-h-[340px] items-center justify-center px-5 py-6 text-content-muted">
        Signal network is loading from tracked assets.
      </div>
    )
  }

  const bullishCount = nodes.filter((node) => node.signalState === 'bullish').length
  const neutralCount = nodes.filter((node) => node.signalState === 'neutral').length
  const bearishCount = nodes.filter((node) => node.signalState === 'bearish').length
  const noSignalCount = nodes.filter((node) => node.signalState === 'noSignal').length

  const bgTransform = `translate(${(parallax.x * 2.1).toFixed(2)} ${(parallax.y * 1.35).toFixed(2)})`
  const midTransform = `translate(${(parallax.x * 3.7).toFixed(2)} ${(parallax.y * 2.3).toFixed(2)})`
  const frontTransform = `translate(${(parallax.x * 5.6).toFixed(2)} ${(parallax.y * 3.6).toFixed(2)})`

  return (
    <div
      ref={containerRef}
      className="relative overflow-visible px-1 py-2 sm:px-2"
      onMouseMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const nx = clamp(((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2, -1, 1)
        const ny = clamp(((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2, -1, 1)
        setParallax({ x: nx, y: ny })
      }}
      onMouseLeave={() => {
        setParallax({ x: 0, y: 0 })
        setHover(null)
      }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="relative h-[348px] w-full sm:h-[404px] lg:h-[436px]"
        role="img"
        aria-label="Global signal network"
      >
        <g transform={bgTransform} style={{ transition: 'transform 180ms cubic-bezier(0.2,0.8,0.2,1)' }}>
          {edges.map((edge, index) => {
            const from = nodeByTicker.get(edge.from)
            const to = nodeByTicker.get(edge.to)
            if (!from || !to) return null
            const isConnected = connectedEdges ? connectedEdges.has(edge.id) : false
            const isMuted = connectedEdges ? !isConnected : false
            const baseOpacity = edge.crossRegion ? 0.15 + edge.strength * 0.16 : 0.05 + edge.strength * 0.09
            const strokeOpacity = isConnected ? 0.84 : isMuted ? 0.04 : baseOpacity

            return (
              <g key={`edge-${edge.id}`}>
                {edge.ambient ? (
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isConnected ? palette.primary : withAlpha(palette.primary, 0.9)}
                    strokeWidth={edge.crossRegion ? 1.7 : 1.25}
                    className="signal-network-edge-ambient"
                    style={{
                      animationDelay: `${edge.ambientDelay}s`,
                      animationDuration: `${edge.ambientDuration}s`,
                    }}
                    opacity={isMuted ? 0 : edge.crossRegion ? 0.74 : 0.58}
                  />
                ) : null}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isConnected ? palette.primary : palette.neutral}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={isConnected ? 2.15 : edge.crossRegion ? 1.35 : 0.95}
                  strokeDasharray={edge.crossRegion ? '4 9' : '2 7'}
                  className="signal-network-flow"
                  style={{
                    animationDelay: `${(index % 14) * 0.26}s`,
                    animationDuration: `${8.6 + (1 - edge.strength) * 7.2}s`,
                  }}
                />
              </g>
            )
          })}
        </g>

        {(['background', 'mid', 'foreground'] as LayerKey[]).map((layerKey, layerIndex) => {
          const layerNodes = layeredNodes[layerKey]
          if (!layerNodes || layerNodes.length === 0) return null

          const layerTransform = layerKey === 'background' ? bgTransform : layerKey === 'mid' ? midTransform : frontTransform
          const layerOpacity = layerKey === 'background' ? 0.72 : layerKey === 'mid' ? 0.88 : 1

          return (
            <g
              key={`layer-${layerKey}`}
              transform={layerTransform}
              opacity={layerOpacity}
              style={{ transition: 'transform 180ms cubic-bezier(0.2,0.8,0.2,1)' }}
            >
              {layerNodes.map((node, index) => {
                const isConnected = connectedTickers ? connectedTickers.has(node.ticker) : false
                const isMuted = connectedTickers ? !isConnected : false
                const isHovered = hover?.ticker === node.ticker
                const isNoSignal = node.signalState === 'noSignal'
                const color = directionColor(node.signalState, palette)
                const fill = withAlpha(color, isNoSignal ? (palette.isDark ? 0.32 : 0.24) : palette.isDark ? 0.3 : 0.36)
                const stroke = withAlpha(color, isNoSignal ? (palette.isDark ? 0.76 : 0.66) : palette.isDark ? 0.86 : 0.95)
                const showLabel = isHovered || node.importance >= 0.84
                const tierBoost = node.sizeTier === 4 ? 0.8 : node.sizeTier === 3 ? 0.45 : node.sizeTier === 2 ? 0.22 : 0
                const ringRadius = node.radius + (isHovered ? 6.1 : (isNoSignal ? 3.2 : 2.6) + tierBoost)
                const confidenceOpacity = isNoSignal ? 0.74 : clamp(0.54 + node.conviction * 0.4, 0.45, 0.98)
                const nodeOpacity = isMuted ? 0.2 : confidenceOpacity
                const ringOpacity = isMuted ? 0.1 : isNoSignal ? 0.58 : clamp(0.16 + node.conviction * 0.6, 0.2, 0.84)
                const ringStrokeWidth = isHovered ? 1.35 : isNoSignal ? 1.22 : 0.68 + node.conviction * 1.06
                const tooltipX = clamp(hover?.x ?? 0, 10, WIDTH - 200)
                const tooltipY = clamp(hover?.y ?? 0, 8, HEIGHT - 120)

                return (
                  <a
                    key={`node-${node.ticker}`}
                    href={`/stocks/${node.ticker}`}
                    onMouseEnter={(event) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setHover({
                        ticker: node.ticker,
                        x: clamp(event.clientX - rect.left + 10, 10, rect.width - 176),
                        y: clamp(event.clientY - rect.top - 10, 8, rect.height - 112),
                      })
                    }}
                    onMouseMove={(event) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setHover({
                        ticker: node.ticker,
                        x: clamp(event.clientX - rect.left + 10, 10, rect.width - 176),
                        y: clamp(event.clientY - rect.top - 10, 8, rect.height - 112),
                      })
                    }}
                    onFocus={() => {
                      setHover({
                        ticker: node.ticker,
                        x: tooltipX + (index % 2 === 0 ? 0 : 12),
                        y: tooltipY + (layerIndex === 0 ? 0 : 8),
                      })
                    }}
                    onBlur={() => {
                      setHover((prev) => (prev?.ticker === node.ticker ? null : prev))
                    }}
                  >
                    <g
                      className="signal-network-node-drift"
                      style={{
                        ['--drift-x' as string]: `${node.driftX.toFixed(2)}px`,
                        ['--drift-y' as string]: `${node.driftY.toFixed(2)}px`,
                        animationDelay: `${node.driftDelay.toFixed(2)}s`,
                        animationDuration: `${node.driftDuration.toFixed(2)}s`,
                      }}
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={ringRadius}
                        fill={withAlpha(color, isNoSignal ? 0.11 : isHovered ? 0.16 : 0.06)}
                        stroke={withAlpha(color, isNoSignal ? (palette.isDark ? 0.68 : 0.58) : palette.isDark ? 0.62 : 0.5)}
                        strokeWidth={ringStrokeWidth}
                        strokeDasharray={isNoSignal ? '3 3' : undefined}
                        opacity={ringOpacity}
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isHovered ? node.radius + 1.45 : node.radius}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isHovered ? 2.15 : 1.28}
                        className={isNoSignal ? '' : isHovered ? 'signal-network-node-active' : 'signal-network-node'}
                        style={{
                          animationDelay: isNoSignal ? undefined : `${node.pulseDelay.toFixed(2)}s`,
                          filter: 'none',
                        }}
                        opacity={nodeOpacity}
                      />
                    </g>

                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={Math.max(1.35, node.radius * 0.32)}
                      fill={withAlpha(color, isNoSignal ? (palette.isDark ? 0.34 : 0.26) : palette.isDark ? 0.45 : 0.28)}
                      opacity={isMuted ? 0.16 : isNoSignal ? 0.62 : 0.72}
                    />

                    {showLabel ? (
                      <text
                        x={node.x}
                        y={node.y - node.radius - 7}
                        textAnchor="middle"
                        className="text-micro"
                        fill={palette.text}
                        opacity={isMuted ? 0.2 : 0.9}
                      >
                        {node.ticker}
                      </text>
                    ) : null}

                    <title>
                      {node.signalState === 'noSignal'
                        ? `${node.ticker} · No Signal · Not yet implemented on website`
                        : `${node.ticker} · ${directionLabel(node.signalState)} · ${Math.round(node.conviction * 100)}% conviction`}
                    </title>
                  </a>
                )
              })}
            </g>
          )
        })}
      </svg>

      <div className="text-micro pointer-events-none mt-2 flex flex-wrap items-center gap-3 text-content-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full signal-fill-bullish signal-confidence-high glow-bullish" />
          Bullish {bullishCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full signal-fill-neutral signal-confidence-medium glow-neutral" />
          Neutral {neutralCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface)]" />
          Not Implemented {noSignalCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full signal-fill-bearish signal-confidence-high glow-bearish" />
          Bearish {bearishCount}
        </span>
        <span className="text-content-muted">Hover to reveal assets linked by similar current signal structure</span>
      </div>

      {hoveredNode && hover ? (
        <div
          className="text-micro pointer-events-none absolute z-20 rounded-[var(--radius-lg)] border border-chart-tooltip-border bg-chart-tooltip px-2.5 py-2"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="text-label-sm text-content-primary">{hoveredNode.ticker}</div>
          <div className="text-content-secondary">
            {hoveredNode.signalState === 'noSignal'
              ? 'No signal · Not yet implemented on website'
              : `${directionLabel(hoveredNode.signalState)} · ${Math.round(hoveredNode.conviction * 100)}%`}
          </div>
          <div className="text-content-muted">
            {Math.max(0, (connectedTickers?.size ?? 1) - 1)} assets linked by similar current signal structure
          </div>
        </div>
      ) : null}
    </div>
  )
}
