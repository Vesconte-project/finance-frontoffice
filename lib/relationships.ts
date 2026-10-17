import 'server-only'

import { fetchBackendJson } from './backend'
import type { NetworkNode } from './network'

export type RelationshipLayer = 'residual' | 'leadLag' | 'market' | 'spurious' | 'theme'

export type RelationshipNeighbor = {
  symbol: string
  strength: number | null
  confidence: number | null
  direction: string
}

export type LeadLagRelationships = {
  followers: RelationshipNeighbor[]
  leaders: RelationshipNeighbor[]
}

export type RelationshipThemePeer = Omit<RelationshipNeighbor, 'direction'> & {
  theme: string | null
  themes: string[]
}

export type TickerRelationships = {
  asOf: string | null
  ticker: string
  window: number
  node: NetworkNode | null
  nodes: NetworkNode[]
  marketCoMovers: RelationshipNeighbor[]
  residualCoMovers: RelationshipNeighbor[]
  leadLag: LeadLagRelationships
  probableSpurious: RelationshipNeighbor[]
  themePeers: RelationshipThemePeer[]
}

export type TickerRelationshipOptions = {
  window?: number
  topK?: number
  layers?: RelationshipLayer[]
}

export type TickerRelationshipCandidate = {
  symbol: string
  strength: number | null
  confidence: number | null
  relations: string[]
}

const RELATIONSHIP_REVALIDATE_SECONDS = 900

type BackendRelationshipNeighbor = Partial<RelationshipNeighbor> & {
  ticker?: string
}

type BackendRelationshipThemePeer = Partial<RelationshipThemePeer> & {
  ticker?: string
}

type BackendRelationshipNode = Partial<NetworkNode> & {
  symbol?: string
}

type BackendTickerRelationships = Partial<Omit<TickerRelationships, 'node' | 'nodes' | 'leadLag'>> & {
  node?: BackendRelationshipNode | null
  nodes?: BackendRelationshipNode[]
  leadLag?: Partial<{
    followers: BackendRelationshipNeighbor[]
    leaders: BackendRelationshipNeighbor[]
  }> | null
}

function relationshipPath(ticker: string, options: Required<Pick<TickerRelationshipOptions, 'window'>> & TickerRelationshipOptions): string {
  const params = new URLSearchParams()
  params.set('window', String(options.window))
  if (options.topK !== undefined) params.set('topK', String(options.topK))
  if (options.layers && options.layers.length > 0) params.set('layers', options.layers.join(','))
  return `/v1/relationships/${encodeURIComponent(ticker)}?${params.toString()}`
}

function cachedRelationshipInit(ticker: string): RequestInit & { next: { revalidate: number; tags: string[] } } {
  return {
    cache: 'no-store',
    next: {
      revalidate: RELATIONSHIP_REVALIDATE_SECONDS,
      tags: ['relationships', `relationships:${ticker}`],
    },
  }
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeNode(node: BackendRelationshipNode | null | undefined): NetworkNode | null {
  const ticker = (node?.ticker ?? node?.symbol ?? '').trim().toUpperCase()
  if (!ticker) return null
  return {
    ticker,
    name: node?.name ?? null,
    country: node?.country ?? null,
    region: node?.region ?? null,
    sector: node?.sector ?? null,
    marketCap: typeof node?.marketCap === 'number' && Number.isFinite(node.marketCap) ? node.marketCap : null,
    marketCapSource: node?.marketCapSource === 'latest_metadata' ? 'latest_metadata' : null,
    degree: typeof node?.degree === 'number' && Number.isFinite(node.degree) ? node.degree : null,
  }
}

function normalizeNeighbor(neighbor: BackendRelationshipNeighbor): RelationshipNeighbor | null {
  const symbol = (neighbor.symbol ?? neighbor.ticker ?? '').trim().toUpperCase()
  if (!symbol) return null
  const strength = finiteNumber(neighbor.strength)
  return {
    symbol,
    strength,
    confidence: finiteNumber(neighbor.confidence),
    direction: String(neighbor.direction ?? ''),
  }
}

function normalizeNeighbors(neighbors: BackendRelationshipNeighbor[] | undefined): RelationshipNeighbor[] {
  return (neighbors ?? [])
    .map(normalizeNeighbor)
    .filter((neighbor): neighbor is RelationshipNeighbor => neighbor !== null)
}

function normalizeThemePeer(neighbor: BackendRelationshipThemePeer): RelationshipThemePeer | null {
  const symbol = (neighbor.symbol ?? neighbor.ticker ?? '').trim().toUpperCase()
  if (!symbol) return null
  const strength = finiteNumber(neighbor.strength)
  const theme = typeof neighbor.theme === 'string' && neighbor.theme.trim() ? neighbor.theme.trim() : null
  const themes = Array.isArray(neighbor.themes)
    ? neighbor.themes.map((item) => String(item ?? '').trim()).filter(Boolean)
    : theme
      ? [theme]
      : []
  return {
    symbol,
    strength,
    confidence: finiteNumber(neighbor.confidence),
    theme,
    themes,
  }
}

function normalizeThemePeers(neighbors: BackendRelationshipThemePeer[] | undefined): RelationshipThemePeer[] {
  return (neighbors ?? [])
    .map(normalizeThemePeer)
    .filter((neighbor): neighbor is RelationshipThemePeer => neighbor !== null)
}

function normalizeRelationships(raw: BackendTickerRelationships, ticker: string, window: number): TickerRelationships {
  const normalizedNodes = (raw.nodes ?? [])
    .map(normalizeNode)
    .filter((node): node is NetworkNode => node !== null)
  const node = normalizeNode(raw.node) ?? normalizedNodes.find((item) => item.ticker === ticker) ?? null

  return {
    asOf: raw.asOf ?? null,
    ticker: (raw.ticker ?? ticker).trim().toUpperCase(),
    window: finiteNumber(raw.window) ?? window,
    node,
    nodes: normalizedNodes,
    marketCoMovers: normalizeNeighbors(raw.marketCoMovers),
    residualCoMovers: normalizeNeighbors(raw.residualCoMovers),
    leadLag: {
      followers: normalizeNeighbors(raw.leadLag?.followers),
      leaders: normalizeNeighbors(raw.leadLag?.leaders),
    },
    probableSpurious: normalizeNeighbors(raw.probableSpurious),
    themePeers: normalizeThemePeers(raw.themePeers),
  }
}

export async function getTickerRelationships(
  tickerRaw: string,
  options: TickerRelationshipOptions = {}
): Promise<TickerRelationships> {
  const ticker = tickerRaw.trim().toUpperCase()
  const window = Math.max(1, Math.round(options.window ?? 252))
  const topK = options.topK === undefined ? undefined : Math.max(1, Math.min(50, Math.round(options.topK)))
  const layers = options.layers
  const path = relationshipPath(ticker, { window, topK, layers })
  const response = await fetchBackendJson<BackendTickerRelationships>(path, {
    context: `ticker.relationships.${ticker}`,
    timeoutMs: 9000,
    init: cachedRelationshipInit(ticker),
  })

  return normalizeRelationships(response, ticker, window)
}

export function rankTickerRelationshipCandidates(
  relationships: TickerRelationships,
  tickerRaw: string,
  limit = 6,
): TickerRelationshipCandidate[] {
  const ticker = tickerRaw.trim().toUpperCase()
  const layered = [
    ...relationships.residualCoMovers.map((neighbor) => ({ neighbor, relation: 'Residual co-movement' })),
    ...relationships.themePeers.map((neighbor) => ({ neighbor, relation: 'Theme relationship' })),
    ...relationships.leadLag.followers.map((neighbor) => ({ neighbor, relation: 'Directional relationship' })),
    ...relationships.leadLag.leaders.map((neighbor) => ({ neighbor, relation: 'Directional relationship' })),
    ...relationships.marketCoMovers.map((neighbor) => ({ neighbor, relation: 'Market co-movement' })),
  ]
    .filter((item) => item.neighbor.symbol !== ticker)
    .sort(
      (left, right) =>
        Math.abs(right.neighbor.strength ?? 0) - Math.abs(left.neighbor.strength ?? 0) ||
        left.neighbor.symbol.localeCompare(right.neighbor.symbol),
    )

  const candidates = new Map<string, TickerRelationshipCandidate>()
  for (const item of layered) {
    const existing = candidates.get(item.neighbor.symbol)
    if (existing) {
      if (!existing.relations.includes(item.relation)) existing.relations.push(item.relation)
      continue
    }
    candidates.set(item.neighbor.symbol, {
      symbol: item.neighbor.symbol,
      strength: item.neighbor.strength,
      confidence: item.neighbor.confidence,
      relations: [item.relation],
    })
  }
  return [...candidates.values()].slice(0, Math.max(1, limit))
}
