'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Waypoints } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ExpandingSelector from '@/components/ui/ExpandingSelector'
import SegmentedControl from '@/components/ui/SegmentedControl'
import {
  normalizeRelationshipAtlas,
  normalizeRelationshipAtlasDetail,
  type AtlasCommunity,
  type AtlasEdge,
  type AtlasNode,
  type AtlasView,
  type RelationshipAtlas,
  type RelationshipAtlasDetail,
} from '@/lib/network-atlas'
import type { MarketUniverseLevel } from '@/lib/market-universe-layout'
import {
  MARKET_REGION_COLORS,
  MARKET_REGION_LABELS,
  MARKET_REGION_ORDER,
  normalizeMarketRegion,
  type MarketRegionKey,
} from '@/lib/network-regions'
import styles from './MarketUniverse.module.css'

const MarketUniverseScene = dynamic(() => import('./MarketUniverseScene'), {
  ssr: false,
  loading: () => <UniverseWait />,
})

const VIEW_OPTIONS = [
  { value: 'market', label: 'Market movement' },
  { value: 'residual', label: 'Beyond the market' },
  { value: 'timing', label: 'Timing' },
  { value: 'theme', label: 'Shared themes' },
] as const

function UniverseWait() {
  return (
    <div className={styles.wait} aria-label="Loading market universe" role="status">
      <i /><i /><i /><i /><i />
    </div>
  )
}

class UniverseBoundary extends React.Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function useMobileScene(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return mobile
}

// A node reaching a field by weight rather than assignment: say how much of it
// is here, so "also here" is a fact the reader can weigh rather than a label.
function fieldShare(node: AtlasNode, communityId: string | undefined): string {
  if (!communityId) return ''
  const share = node.memberships.find((entry) => entry.communityId === communityId)?.weight
  return share ? ` — ${Math.round(share * 100)}% of its connections` : ''
}

function formatConfidence(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unknown'
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function formatVolatility(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function formatMarketCap(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return '—'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${Math.round(value).toLocaleString()}`
}

function edgeForNode(edges: AtlasEdge[], symbol: string): AtlasEdge[] {
  return edges
    .filter((edge) => edge.source === symbol || edge.target === symbol)
    .sort((left, right) => right.score - left.score)
}

function clientAtlas(payload: RelationshipAtlas): RelationshipAtlas {
  return normalizeRelationshipAtlas(payload)
}

function clientDetail(payload: RelationshipAtlasDetail): RelationshipAtlasDetail {
  return normalizeRelationshipAtlasDetail(payload)
}

function StaticUniverse({ atlas, onSelectNode }: { atlas: RelationshipAtlas; onSelectNode: (node: AtlasNode) => void }) {
  const nodes = atlas.landmarks.slice(0, 32)
  const xs = nodes.map((node) => node.position.x)
  const ys = nodes.map((node) => node.position.y)
  const minX = Math.min(...xs, -1)
  const maxX = Math.max(...xs, 1)
  const minY = Math.min(...ys, -1)
  const maxY = Math.max(...ys, 1)
  return (
    <div className={styles.staticUniverse} aria-label="Accessible market atlas">
      {nodes.map((node, index) => (
        <button
          key={`${node.communityId}:${node.symbol}:${index}`}
          type="button"
          onClick={() => onSelectNode(node)}
          style={{
            left: `${12 + ((node.position.x - minX) / Math.max(1, maxX - minX)) * 76}%`,
            top: `${14 + ((maxY - node.position.y) / Math.max(1, maxY - minY)) * 68}%`,
            width: `${24 + node.centrality * 30}px`,
            height: `${24 + node.centrality * 30}px`,
          }}
          aria-label={`${node.name}, ${node.symbol}`}
        >
          <span>{node.symbol}</span>
        </button>
      ))}
    </div>
  )
}

function UniverseLegend({ view, level, mobile, regions }: {
  view: AtlasView
  level: MarketUniverseLevel
  mobile: boolean
  regions: Array<{ key: string; label: string; color: string }>
}) {
  return (
    <div className={styles.legend} aria-label="How to read the economic atlas">
      <span className={styles.travelHint}><i data-kind="travel" />{mobile ? 'Pinch to zoom · drag to pan' : 'Scroll to zoom · drag to pan'}</span>
      {level === 'economy' ? <span><i data-kind="mass" />Field size: companies</span> : null}
      {level !== 'economy' ? <span><i data-kind="mass" />Core: market value</span> : null}
      {level === 'company' ? <span><i data-kind="distance" />Closer: stronger link</span> : null}
      {level !== 'economy' ? <span><i data-kind="halo" />Halo: systemic reach</span> : null}
      <span><i data-kind="line" />Line: relationship strength</span>
      <span><i data-kind="fade" />Fade: confidence</span>
      {view === 'timing' ? <span><i data-kind="timing" />Pulse: direction</span> : null}
      {regions.map((region) => (
        <span key={region.key}>
          <i style={{ background: region.color, width: '0.5rem', height: '0.5rem', borderRadius: '50%' }} />
          {region.label}
        </span>
      ))}
    </div>
  )
}

function LandmarkIndex({ nodes, activeSymbol, onSelect }: {
  nodes: AtlasNode[]
  activeSymbol: string | null
  onSelect: (node: AtlasNode) => void
}) {
  return (
    <div className={styles.index} aria-label="Systemic market landmarks">
      <p>Systemic landmarks</p>
      {nodes.slice(0, 6).map((node, index) => (
        <button key={`${node.communityId}:${node.symbol}:${index}`} type="button" aria-pressed={activeSymbol === node.symbol} onClick={() => onSelect(node)}>
          <i style={{ opacity: 0.28 + node.centrality * 0.72 }} />
          <span>{node.symbol}</span>
          <small>{node.country || node.sector || 'Global'}</small>
        </button>
      ))}
    </div>
  )
}

function AccessibleNavigator({
  communities,
  selectedId,
  onSelectCommunity,
}: {
  communities: AtlasCommunity[]
  selectedId: string | null
  onSelectCommunity: (community: AtlasCommunity) => void
}) {
  const navigatorRef = useRef<HTMLDetailsElement>(null)

  function selectCommunityAndClose(community: AtlasCommunity) {
    navigatorRef.current?.removeAttribute('open')
    onSelectCommunity(community)
  }

  return (
    <details ref={navigatorRef} className={styles.accessibleNavigator} aria-label="Browse economic atlas">
      <summary><Waypoints aria-hidden="true" /> Browse atlas</summary>
      <div className={styles.navigatorPanel} data-lenis-prevent>
        <section aria-labelledby="atlas-community-list">
          <h2 id="atlas-community-list">Economic fields</h2>
          {communities.length ? communities.map((community) => (
            <button
              key={community.id}
              type="button"
              aria-pressed={selectedId === community.id}
              onClick={() => selectCommunityAndClose(community)}
            >
              <span>{community.displayLabel}</span>
              <small>{community.memberCount} companies · {community.scopeLabel}</small>
            </button>
          )) : <p>No materialized fields are available in this preview.</p>}
        </section>
      </div>
    </details>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>
}

function Inspector({
  community,
  detail,
  neighborhood,
  activeNode,
  loading,
  backLabel,
  onBack,
  onSelectNode,
}: {
  community: AtlasCommunity | null
  detail: RelationshipAtlasDetail | null
  neighborhood: RelationshipAtlasDetail | null
  activeNode: AtlasNode | null
  loading: boolean
  backLabel: 'Full economy' | 'Economic field'
  onBack: () => void
  onSelectNode: (node: AtlasNode) => void
}) {
  const source = neighborhood ?? detail
  const relationships = activeNode && source ? edgeForNode(source.edges, activeNode.symbol) : []
  const nodeBySymbol = new Map(source?.nodes.map((node) => [node.symbol, node]) ?? [])
  // Not filtered by communityId any more. Louvain gives each node one home, and
  // for some it picks the field holding the smaller share — TLS.AX carries all
  // of its weight in one field and is assigned to another, so filtering by
  // assignment hid it from the field it actually belongs to. The server decides
  // membership now and marks it with isPrimary; assigned members come first.
  const members = detail?.nodes.filter((node) => !node.context) ?? []
  const location = activeNode
    ? [...new Set([activeNode.country, activeNode.region].filter((value): value is string => Boolean(value)))].join(' · ')
    : ''

  return (
    <motion.aside
      className={styles.inspector}
      initial={{ opacity: 0, x: 22, filter: 'blur(8px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 14, filter: 'blur(6px)' }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      aria-label={activeNode ? `${activeNode.name} relationship context` : `${community?.displayName ?? 'Market'} context`}
    >
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> {backLabel}
      </button>

      {activeNode ? (
        <>
          <div className={styles.inspectorHeading}>
            <p>{activeNode.symbol}</p>
            <h2>{activeNode.name}</h2>
            <div>
              <span>{activeNode.sector || 'Cross-market'}</span>
              {location ? <span>{location}</span> : null}
            </div>
          </div>
          <div className={styles.metrics}>
            {activeNode.marketCap && activeNode.marketCap > 0
              ? <Metric label="Market value" value={formatMarketCap(activeNode.marketCap)} />
              : null}
            <Metric label="Systemic reach" value={formatPercent(activeNode.centrality)} />
            <Metric label="Bridge role" value={formatPercent(activeNode.bridgeScore)} />
            <Metric label="20d volatility" value={formatVolatility(activeNode.volatility)} />
          </div>
          {loading ? <UniverseWait /> : null}
          {!loading ? (
            <div className={styles.relations}>
              <div className={styles.sectionLabel}><span>Strongest visible links</span><small>strength · confidence</small></div>
              {relationships.slice(0, 6).map((edge, index) => {
                const peerSymbol = edge.source === activeNode.symbol ? edge.target : edge.source
                const peer = nodeBySymbol.get(peerSymbol)
                return (
                  <button key={`${edge.source}:${edge.target}:${index}`} type="button" onClick={() => peer && onSelectNode(peer)} disabled={!peer}>
                    <span><strong>{peerSymbol}</strong><small>{peer?.name ?? 'Connected company'}</small></span>
                    <span><b>{Math.abs(edge.strength).toFixed(2)}</b><small>{formatConfidence(edge.confidence)}</small></span>
                  </button>
                )
              })}
              {relationships.length === 0 ? <p className={styles.emptyCopy}>No detailed neighborhood is available for this landmark yet.</p> : null}
            </div>
          ) : null}
          <Link className={styles.exploreLink} href={`/stocks/${activeNode.symbol}`}>Explore {activeNode.symbol} <ArrowUpRight aria-hidden="true" /></Link>
        </>
      ) : community ? (
        <>
          <div className={styles.inspectorHeading}>
            <h2>{community.displayName}</h2>
            <div>
              <span>{community.memberCount} companies</span>
              <span>{formatConfidence(community.averageConfidence)} confidence</span>
            </div>
            <small className={styles.fieldNote}>{community.description} This is a relationship field, not a sector classification.</small>
          </div>
          <div className={styles.metrics}>
            {community.marketCapTotal && community.marketCapTotal > 0
              ? <Metric label="Known market value" value={formatMarketCap(community.marketCapTotal)} />
              : null}
            <Metric label="External bridges" value={String(community.bridgeCount || 0)} />
            <Metric label="Primary sector" value={community.dominantSector || 'Mixed'} />
            <Metric label="Primary region" value={community.dominantRegion || community.dominantCountry || 'Global'} />
          </div>
          {loading ? <UniverseWait /> : null}
          {!loading && members.length ? (
            <div className={styles.companyGrid} aria-label="Companies in this field">
              {members.slice(0, 12).map((node, index) => (
                <button
                  key={`${node.communityId}:${node.symbol}:${index}`}
                  type="button"
                  onClick={() => onSelectNode(node)}
                  className={node.isPrimary ? undefined : styles.alsoHere}
                  title={node.isPrimary ? undefined : `Also belongs here${fieldShare(node, community?.id)}`}
                >
                  <span>{node.symbol}</span><small>{node.name}</small>
                  {node.isPrimary ? null : <em aria-label="Also belongs to this field">also here</em>}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </motion.aside>
  )
}

export default function MarketUniverse({ initialAtlas }: { initialAtlas: RelationshipAtlas }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reducedMotion = Boolean(useReducedMotion())
  const mobile = useMobileScene()
  const [atlas, setAtlas] = useState(initialAtlas)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RelationshipAtlasDetail | null>(null)
  // Every field's members, loaded once when the atlas loads (bounded: ~24 fields
  // × ≤84 nodes, flat in universe size). Rendered in-place in the overview; each
  // field's members reveal purely by zoom (see ProximityField), the data is
  // always present.
  const [fieldDetails, setFieldDetails] = useState<Map<string, RelationshipAtlasDetail>>(() => new Map())
  const [neighborhood, setNeighborhood] = useState<RelationshipAtlasDetail | null>(null)
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [loadingAtlas, setLoadingAtlas] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const atlasRequestId = useRef(0)
  const detailRequestId = useRef(0)
  const [atlasCache] = useState(() => new Map<string, RelationshipAtlas>([[`${initialAtlas.window}:${initialAtlas.view}`, initialAtlas]]))
  const [detailCache] = useState(() => new Map<string, RelationshipAtlasDetail>())
  const [neighborhoodCache] = useState(() => new Map<string, RelationshipAtlasDetail>())

  const selectedCommunity = useMemo(
    () => atlas.communities.find((community) => community.id === selectedId) ?? null,
    [atlas.communities, selectedId],
  )
  const allVisibleNodes = useMemo(() => {
    const bySymbol = new Map<string, AtlasNode>()
    for (const node of atlas.landmarks) bySymbol.set(node.symbol, node)
    for (const node of detail?.nodes ?? []) bySymbol.set(node.symbol, node)
    for (const node of neighborhood?.nodes ?? []) bySymbol.set(node.symbol, node)
    return bySymbol
  }, [atlas.landmarks, detail?.nodes, neighborhood?.nodes])
  const activeNode = activeSymbol ? allVisibleNodes.get(activeSymbol) ?? null : null

  function syncUrl(window: number, view: AtlasView) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('window', String(window))
    params.set('view', view)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  async function selectAtlas(window: number, view: AtlasView) {
    const requestId = ++atlasRequestId.current
    detailRequestId.current += 1
    setSelectedId(null)
    setDetail(null)
    setFieldDetails(new Map())
    setNeighborhood(null)
    setActiveSymbol(null)
    setRequestError(null)
    const key = `${window}:${view}`
    const cached = atlasCache.get(key)
    if (cached) { setLoadingAtlas(false); setAtlas(cached); syncUrl(window, view); return }
    setLoadingAtlas(true)
    try {
      const response = await fetch(`/api/network/atlas?window=${window}&view=${view}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Atlas unavailable')
      const next = clientAtlas(await response.json() as RelationshipAtlas)
      if (!next.materialized || next.communities.length === 0) {
        throw new Error(`${VIEW_OPTIONS.find((option) => option.value === view)?.label ?? 'This view'} is not materialized yet.`)
      }
      if (requestId !== atlasRequestId.current) return
      atlasCache.set(key, next)
      setAtlas(next)
      syncUrl(window, view)
    } catch (error) {
      if (requestId !== atlasRequestId.current) return
      setRequestError(error instanceof Error ? error.message : 'This atlas view is temporarily unavailable.')
    } finally {
      if (requestId === atlasRequestId.current) setLoadingAtlas(false)
    }
  }

  async function loadCommunityDetail(community: AtlasCommunity): Promise<RelationshipAtlasDetail> {
    const key = `${atlas.asOf}:${atlas.window}:${atlas.view}:${community.id}`
    const cached = detailCache.get(key)
    if (cached) return cached
    const params = new URLSearchParams({
      window: String(atlas.window),
      view: atlas.view,
      limit: String(mobile ? 44 : 84),
    })
    if (atlas.asOf) params.set('asOf', atlas.asOf)
    const response = await fetch(
      `/api/network/atlas/communities/${encodeURIComponent(community.id)}?${params.toString()}`,
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Community unavailable')
    const next = clientDetail(await response.json() as RelationshipAtlasDetail)
    detailCache.set(key, next)
    return next
  }

  async function loadNeighborhood(node: AtlasNode): Promise<RelationshipAtlasDetail> {
    const key = `${atlas.asOf}:${atlas.window}:${atlas.view}:${node.symbol}`
    const cached = neighborhoodCache.get(key)
    if (cached) return cached
    const params = new URLSearchParams({
      window: String(atlas.window),
      view: atlas.view,
      limit: String(mobile ? 18 : 32),
    })
    if (atlas.asOf) params.set('asOf', atlas.asOf)
    const response = await fetch(
      `/api/network/atlas/neighborhoods/${encodeURIComponent(node.symbol)}?${params.toString()}`,
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Neighborhood unavailable')
    const next = clientDetail(await response.json() as RelationshipAtlasDetail)
    neighborhoodCache.set(key, next)
    return next
  }

  async function selectCommunity(community: AtlasCommunity) {
    const requestId = ++detailRequestId.current
    setSelectedId(community.id)
    setActiveSymbol(null)
    setDetail(null)
    setNeighborhood(null)
    setRequestError(null)
    setLoadingDetail(true)
    try {
      const next = await loadCommunityDetail(community)
      if (requestId === detailRequestId.current) {
        setDetail(next)
      }
    } catch {
      if (requestId === detailRequestId.current) {
        setRequestError('This economic field is temporarily unavailable. Return to the full economy and try again.')
      }
    } finally {
      if (requestId === detailRequestId.current) setLoadingDetail(false)
    }
  }

  async function selectNode(node: AtlasNode) {
    const requestId = ++detailRequestId.current
    setActiveSymbol(node.symbol)
    setSelectedId(node.communityId || selectedId)
    setNeighborhood(null)
    setRequestError(null)
    setLoadingDetail(true)
    try {
      const parent = atlas.communities.find((community) => community.id === node.communityId) ?? null
      const [fieldResult, neighborhoodResult] = await Promise.allSettled([
        detail || !parent ? Promise.resolve(detail) : loadCommunityDetail(parent),
        loadNeighborhood(node),
      ])
      if (requestId !== detailRequestId.current) return
      if (fieldResult.status === 'fulfilled' && fieldResult.value) {
        setDetail(fieldResult.value)
      }
      if (neighborhoodResult.status === 'rejected') throw neighborhoodResult.reason
      setNeighborhood(neighborhoodResult.value)
    } catch {
      if (requestId !== detailRequestId.current) return
      setNeighborhood(null)
      setRequestError('This company neighborhood is temporarily unavailable. The current field remains interactive.')
    } finally {
      if (requestId === detailRequestId.current) setLoadingDetail(false)
    }
  }

  function clearFocus() {
    detailRequestId.current += 1
    setLoadingDetail(false)
    setSelectedId(null)
    setDetail(null)
    setNeighborhood(null)
    setActiveSymbol(null)
    setRequestError(null)
  }

  function stepBack() {
    if (activeSymbol && detail && selectedId) {
      detailRequestId.current += 1
      setLoadingDetail(false)
      setActiveSymbol(null)
      setNeighborhood(null)
      setRequestError(null)
      return
    }
    clearFocus()
  }

  // Load every field's members once, when the atlas loads. The dataset is small
  // and bounded (~24 fields × ≤84 nodes, flat in universe size). It's fired off
  // the initial-render critical path — when the browser is idle, after the canvas
  // is up — so the requests don't compete with first paint; the map renders
  // immediately from the atlas landmarks, each field fills in as its request
  // returns, and the reveal is purely visual (by zoom). Re-runs on view/window.
  useEffect(() => {
    let cancelled = false
    const warmAllFields = () => {
      for (const community of atlas.communities) {
        loadCommunityDetail(community)
          .then((next) => { if (!cancelled) setFieldDetails((prev) => new Map(prev).set(community.id, next)) })
          .catch(() => { /* best-effort; the field stays at landmark density */ })
      }
    }
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warmAllFields, { timeout: 2000 })
      return () => { cancelled = true; window.cancelIdleCallback?.(handle) }
    }
    const timer = setTimeout(warmAllFields, 200)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas])

  const regionLegend = useMemo(() => {
    const present = new Set<MarketRegionKey>()
    for (const node of atlas.landmarks) present.add(normalizeMarketRegion(node.region))
    return MARKET_REGION_ORDER
      .filter((key) => present.has(key))
      .map((key) => ({ key, label: MARKET_REGION_LABELS[key], color: MARKET_REGION_COLORS[key] }))
  }, [atlas.landmarks])

  const sceneLevel = activeNode ? 'company' : selectedCommunity ? 'field' : 'economy'

  return (
    <section className={styles.root} data-atlas-root aria-label="Market relationship map">
      <div className={styles.chrome} data-atlas-chrome>
        <div className={styles.intro} data-atlas-intro>
          <AccessibleNavigator
            communities={atlas.communities}
            selectedId={selectedId}
            onSelectCommunity={(community) => void selectCommunity(community)}
          />
        </div>
        <div className={styles.controls} data-atlas-controls>
          <ExpandingSelector
            className="atlas-view"
            label="View"
            ariaLabel="Choose how relationships are interpreted"
            value={atlas.view}
            options={VIEW_OPTIONS}
            onValueChange={(value) => void selectAtlas(atlas.window, value as AtlasView)}
          />
          <div className={styles.windowControl} data-atlas-window>
            <span>Window</span>
            <SegmentedControl
              options={['126', '252'] as const}
              value={String(atlas.window) as '126' | '252'}
              onChange={(value) => void selectAtlas(Number(value), atlas.view)}
              ariaLabel="Evidence window"
              analyticsId="market_universe_window"
            />
          </div>
        </div>
      </div>

      <div className={styles.stage} data-atlas-stage data-focused={sceneLevel === 'economy' ? 'false' : 'true'} data-level={sceneLevel}>
        <UniverseBoundary fallback={<StaticUniverse atlas={atlas} onSelectNode={(node) => void selectNode(node)} />}>
          <MarketUniverseScene
            atlas={atlas}
            fieldDetails={fieldDetails}
            selectedCommunityId={selectedId}
            activeSymbol={activeSymbol}
            reducedMotion={reducedMotion}
            mobile={mobile}
            onSelectCommunity={(community) => void selectCommunity(community)}
            onSelectNode={(node) => void selectNode(node)}
          />
        </UniverseBoundary>

        {loadingAtlas ? <div className={styles.loadingVeil}><UniverseWait /></div> : null}
        {!selectedId && !activeSymbol ? <LandmarkIndex nodes={atlas.landmarks} activeSymbol={activeSymbol} onSelect={(node) => void selectNode(node)} /> : null}
        <UniverseLegend view={atlas.view} level={sceneLevel} mobile={mobile} regions={regionLegend} />
        <div className={styles.snapshot}>
          <span>{atlas.asOf ? `As of ${atlas.asOf}` : 'Latest snapshot'}</span>
          {!atlas.materialized ? <small>Live relationship preview</small> : <small>Materialized topology</small>}
        </div>

        <AnimatePresence>
          {selectedCommunity || activeNode ? (
            <Inspector
              community={selectedCommunity}
              detail={detail}
              neighborhood={neighborhood}
              activeNode={activeNode}
              loading={loadingDetail}
              backLabel={activeNode && detail ? 'Economic field' : 'Full economy'}
              onBack={stepBack}
              onSelectNode={(node) => void selectNode(node)}
            />
          ) : null}
        </AnimatePresence>

        {requestError ? (
          <button type="button" className={styles.errorToast} onClick={() => setRequestError(null)}>
            {requestError}
          </button>
        ) : null}
      </div>
    </section>
  )
}
