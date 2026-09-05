import 'server-only'

import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getHistoricalData } from '@/lib/finance'
import {
  getRelationshipAtlasNeighborhood,
  type AtlasEdge,
  type AtlasNode,
  type RelationshipAtlasDetail,
} from '@/lib/network'
import styles from './HomeNeighborhood.module.css'

/**
 * The homepage subject is one product decision with one owner. These names are
 * hand-picked because the atlas has to be able to answer for them: large,
 * liquid, densely connected companies, rotated by UTC date. There is no endpoint
 * that answers "give me a good subject" — see REQ-005. A future paid placement
 * would replace this function and nothing else.
 */
export function selectHomeNeighborhoodSubject(date: Date, offset = 0): string {
  const HOME_NEIGHBORHOOD_SUBJECTS = [
    'AAPL',
    'MSFT',
    'NVDA',
    'AMZN',
    'GOOG',
    'META',
    'JPM',
    'XOM',
  ] as const
  const dayNumberUTC = Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ) / 86_400_000)
  return HOME_NEIGHBORHOOD_SUBJECTS[
    (((dayNumberUTC + offset) % HOME_NEIGHBORHOOD_SUBJECTS.length) + HOME_NEIGHBORHOOD_SUBJECTS.length)
      % HOME_NEIGHBORHOOD_SUBJECTS.length
  ]
}

const MAP_NODE_LIMIT = 10

const getCachedNeighborhood = unstable_cache(
  async (symbol: string, utcDate: string): Promise<RelationshipAtlasDetail> => {
    void utcDate
    return getRelationshipAtlasNeighborhood(symbol, {
      window: 252,
      view: 'market',
      limit: MAP_NODE_LIMIT,
    })
  },
  ['home-neighborhood-v2'],
  { revalidate: 3600 }
)

type FocusConnection = {
  edge: AtlasEdge
  node: AtlasNode
}

function focusConnections(detail: RelationshipAtlasDetail): FocusConnection[] {
  const nodes = new Map(detail.nodes.map((node) => [node.symbol, node]))
  const seen = new Set<string>()

  return [...detail.edges]
    .filter((edge) => edge.source === detail.focus || edge.target === detail.focus)
    .sort((left, right) => right.strength - left.strength)
    .flatMap((edge) => {
      const symbol = edge.source === detail.focus ? edge.target : edge.source
      const node = nodes.get(symbol)
      if (!node || seen.has(symbol)) return []
      seen.add(symbol)
      return [{ edge, node }]
    })
}

function isRenderableNeighborhood(detail: RelationshipAtlasDetail): boolean {
  return Boolean(
    detail.focus
    && detail.nodes.some((node) => node.symbol === detail.focus)
    && focusConnections(detail).length >= 5
  )
}

export async function loadHomeNeighborhood(): Promise<RelationshipAtlasDetail | null> {
  const now = new Date()
  const utcDate = now.toISOString().slice(0, 10)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const symbol = selectHomeNeighborhoodSubject(now, attempt)
    try {
      const detail = await getCachedNeighborhood(symbol, utcDate)
      if (isRenderableNeighborhood(detail)) return detail
    } catch {
      // The existing backend helper records the failed request. One fallback is
      // allowed; after that the section is absent rather than an empty frame.
    }
  }

  return null
}

const VIEWBOX_WIDTH = 480
const VIEWBOX_HEIGHT = 300
const VIEWBOX_PADDING = 36

type ProjectedNode = AtlasNode & { plotX: number; plotY: number }

function projectNodes(nodes: AtlasNode[]): ProjectedNode[] {
  const minX = Math.min(...nodes.map((node) => node.position.x))
  const maxX = Math.max(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))
  const maxY = Math.max(...nodes.map((node) => node.position.y))
  const rangeX = Math.max(maxX - minX, 0.0001)
  const rangeY = Math.max(maxY - minY, 0.0001)

  return nodes.map((node) => {
    const plotX = VIEWBOX_PADDING
      + ((node.position.x - minX) / rangeX) * (VIEWBOX_WIDTH - VIEWBOX_PADDING * 2)
    const plotY = VIEWBOX_HEIGHT - VIEWBOX_PADDING
      - ((node.position.y - minY) / rangeY) * (VIEWBOX_HEIGHT - VIEWBOX_PADDING * 2)

    return {
      ...node,
      plotX: Math.round(plotX * 10) / 10,
      plotY: Math.round(plotY * 10) / 10,
    }
  })
}

function nodeRadius(node: AtlasNode): number {
  return 3.5 + Math.max(0, Math.min(1, node.importance)) * 4
}

function edgeOpacity(edge: AtlasEdge): number {
  return 0.15 + Math.max(0, Math.min(1, edge.strength)) * 0.45
}

function MapLabel({ node, focus }: { node: ProjectedNode; focus: boolean }) {
  const alignRight = node.plotX > VIEWBOX_WIDTH - 120
  const x = alignRight ? node.plotX - 11 : node.plotX + 11
  const y = Math.max(18, Math.min(VIEWBOX_HEIGHT - 12, node.plotY + 4))

  return (
    <text
      x={x}
      y={y}
      textAnchor={alignRight ? 'end' : 'start'}
      className={focus ? styles.focusLabel : styles.nodeLabel}
    >
      {node.symbol}
    </text>
  )
}

function NeighborhoodMap({ detail, connections }: {
  detail: RelationshipAtlasDetail
  connections: FocusConnection[]
}) {
  const focusNode = detail.nodes.find((node) => node.symbol === detail.focus)
  if (!focusNode) return null

  const otherNodes = detail.nodes
    .filter((node) => node.symbol !== detail.focus)
    .sort((left, right) => right.importance - left.importance)
    .slice(0, MAP_NODE_LIMIT - 1)
  const projected = projectNodes([...otherNodes, focusNode])
  const bySymbol = new Map(projected.map((node) => [node.symbol, node]))
  const visibleEdges = detail.edges.filter((edge) => bySymbol.has(edge.source) && bySymbol.has(edge.target))
  const projectedFocus = bySymbol.get(detail.focus)
  if (!projectedFocus) return null

  const neighborLabels = [...connections]
    .sort((left, right) => right.node.importance - left.node.importance)
    .slice(0, 4)
    .map(({ node }) => bySymbol.get(node.symbol))
    .filter((node): node is ProjectedNode => Boolean(node))
  const labeledSymbols = new Set(neighborLabels.map((node) => node.symbol))
  const drawingOrder = projected
    .filter((node) => node.symbol !== detail.focus)
    .sort((left, right) => left.position.z - right.position.z)

  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      {visibleEdges.map((edge, index) => {
        const source = bySymbol.get(edge.source)
        const target = bySymbol.get(edge.target)
        if (!source || !target) return null
        return (
          <line
            key={`${edge.source}-${edge.target}-${index}`}
            x1={source.plotX}
            y1={source.plotY}
            x2={target.plotX}
            y2={target.plotY}
            className={styles.edge}
            strokeOpacity={edgeOpacity(edge)}
          />
        )
      })}

      {drawingOrder.map((node) => (
        <circle
          key={node.symbol}
          cx={node.plotX}
          cy={node.plotY}
          r={nodeRadius(node)}
          className={styles.node}
        />
      ))}

      <circle
        cx={projectedFocus.plotX}
        cy={projectedFocus.plotY}
        r={Math.max(9, nodeRadius(projectedFocus) + 3)}
        className={styles.focusNode}
      />

      {drawingOrder
        .filter((node) => labeledSymbols.has(node.symbol))
        .map((node) => <MapLabel key={node.symbol} node={node} focus={false} />)}
      <MapLabel node={projectedFocus} focus />
    </svg>
  )
}

type HistoryPoint = Awaited<ReturnType<typeof getHistoricalData>>[number]
type IndexedPoint = { date: string; time: number; focus: number; peer: number }

const getCachedHistory = unstable_cache(
  async (symbol: string, utcDate: string) => {
    void utcDate // The UTC date is part of the cache identity, as for the map.
    return getHistoricalData(symbol, 365)
  },
  ['home-neighborhood-history-v1'],
  { revalidate: 3600 }
)

function historyWindow(history: HistoryPoint[], utcDate: string): Map<string, number> {
  const end = Date.parse(`${utcDate}T00:00:00Z`)
  const start = end - 365 * 86_400_000
  const points = new Map<string, number>()
  for (const point of history) {
    const date = point.date.slice(0, 10)
    const time = Date.parse(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0, 10) !== date
      || time < start || time > end || !Number.isFinite(point.close)) continue
    points.set(date, point.close)
  }
  return points
}

function indexCommonDates(focus: Map<string, number>, peer: Map<string, number>): IndexedPoint[] {
  const dates = [...focus.keys()].filter((date) => peer.has(date)).sort()
  if (dates.length < 2) return []
  const focusBase = focus.get(dates[0])!
  const peerBase = peer.get(dates[0])!
  if (focusBase <= 0 || peerBase <= 0) return []
  const points = dates.map((date) => ({
    date,
    time: Date.parse(`${date}T00:00:00Z`),
    focus: focus.get(date)! / focusBase * 100,
    peer: peer.get(date)! / peerBase * 100,
  }))
  return points.every((point) => Number.isFinite(point.focus) && Number.isFinite(point.peer)) ? points : []
}

async function loadComparison(focus: string, connections: FocusConnection[]) {
  const utcDate = new Date().toISOString().slice(0, 10)
  const focusHistory = getCachedHistory(focus, utcDate).then(
    (history) => historyWindow(history, utcDate),
    () => new Map<string, number>()
  )
  // The focus and first peer load together; subsequent peers are tried only
  // after an unusable comparison, in the same strength order as the list.
  for (const { node } of connections.slice(0, 3)) {
    try {
      const [focusPoints, peerHistory] = await Promise.all([
        focusHistory,
        getCachedHistory(node.symbol, utcDate),
      ])
      if (focusPoints.size < 2) return null
      const points = indexCommonDates(focusPoints, historyWindow(peerHistory, utcDate))
      if (points.length >= 2) return { peer: node.symbol, points }
    } catch {
      // Missing history removes only the comparison, never the map or list.
    }
  }
  return null
}

function IndexedComparison({ focus, peer, points }: {
  focus: string
  peer: string
  points: IndexedPoint[]
}) {
  const values = points.flatMap((point) => [point.focus, point.peer])
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum || 1
  const first = points[0]
  const last = points[points.length - 1]
  const x = (time: number) => (time - first.time) / (last.time - first.time) * 1000
  const y = (value: number) => 32 + (maximum - value) / span * 168
  const path = (key: 'focus' | 'peer') => points.map((point, index) =>
    `${index ? 'L' : 'M'}${x(point.time).toFixed(1)},${y(point[key]).toFixed(1)}`
  ).join(' ')
  const focusY = y(last.focus)
  const peerY = y(last.peer)
  const closeLabels = Math.abs(focusY - peerY) < 16
  const focusLabelY = closeLabels ? (focusY + peerY) / 2 - 9 : focusY
  const peerLabelY = closeLabels ? (focusY + peerY) / 2 + 9 : peerY

  return (
    <figure className={styles.comparison} data-home-comparison="" data-focus={focus} data-peer={peer} data-point-count={points.length}>
      <svg className={styles.comparisonChart} aria-hidden="true" focusable="false">
        <text x="0" y="14" className={styles.window}>1Y</text>
        <svg width="calc(100% - 72px)" height="220" viewBox="0 0 1000 220" preserveAspectRatio="none">
          <path d={path('peer')} className={styles.comparisonPath} stroke="var(--content-secondary)" />
          <path d={path('focus')} className={styles.comparisonPath} stroke="var(--brand-spark)" />
        </svg>
        <text x="calc(100% - 64px)" y={focusLabelY} dominantBaseline="middle" className={styles.comparisonLabel} fill="var(--brand-spark)">{focus}</text>
        <text x="calc(100% - 64px)" y={peerLabelY} dominantBaseline="middle" className={styles.comparisonLabel} fill="var(--content-secondary)">{peer}</text>
      </svg>
      <figcaption className={styles.comparisonCaption}>{focus} and {peer}, indexed. One year.</figcaption>
    </figure>
  )
}

export default async function HomeNeighborhood({ detail }: { detail: RelationshipAtlasDetail | null }) {
  if (!detail || !isRenderableNeighborhood(detail)) return null

  const focusNode = detail.nodes.find((node) => node.symbol === detail.focus)
  if (!focusNode) return null
  const allConnections = focusConnections(detail)
  const connections = allConnections.slice(0, 5)
  const comparison = await loadComparison(detail.focus, connections)
  const visibleNodeCount = Math.min(detail.nodes.length, MAP_NODE_LIMIT)
  const visibleSymbols = new Set(
    [focusNode, ...detail.nodes
      .filter((node) => node.symbol !== detail.focus)
      .sort((left, right) => right.importance - left.importance)
      .slice(0, MAP_NODE_LIMIT - 1)]
      .map((node) => node.symbol)
  )
  const visibleEdgeCount = detail.edges.filter(
    (edge) => visibleSymbols.has(edge.source) && visibleSymbols.has(edge.target)
  ).length
  const focusHasDistinctName = focusNode.name && focusNode.name !== focusNode.symbol

  return (
    <section
      className={styles.section}
      aria-labelledby="home-neighborhood-heading"
      data-home-neighborhood=""
      data-subject={detail.focus}
      data-node-count={visibleNodeCount}
      data-edge-count={visibleEdgeCount}
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 id="home-neighborhood-heading" className={styles.heading}>Behind one name</h2>
          <p className={styles.lede}>Every ranked company sits in the same map you just scrolled through.</p>
        </header>

        <div className={styles.frame}>
          <div className={styles.mapWrap}>
            <NeighborhoodMap detail={detail} connections={allConnections} />
          </div>

          <div className={styles.content}>
            <div className={styles.focusIdentity}>
              <h3 className={styles.focusName}>
                {focusHasDistinctName ? focusNode.name : (
                  <Link href={`/stocks/${encodeURIComponent(focusNode.symbol)}`} className={styles.focusSymbol}>{focusNode.symbol}</Link>
                )}
              </h3>
              {focusHasDistinctName ? (
                <Link href={`/stocks/${encodeURIComponent(focusNode.symbol)}`} className={`${styles.focusSymbol} numeric-tabular`}>
                  {focusNode.symbol}
                </Link>
              ) : null}
              {detail.community ? <p className={styles.community}>{detail.community.displayName}</p> : null}
            </div>

            <div className={styles.connections} aria-label={`Companies connected to ${focusNode.symbol}`}>
              {connections.map(({ node }) => {
                const hasDistinctName = node.name && node.name !== node.symbol
                return (
                  <Link
                    key={node.symbol}
                    href={`/stocks/${encodeURIComponent(node.symbol)}`}
                    className={styles.connection}
                  >
                    <span className={`${styles.connectionSymbol} numeric-tabular`}>{node.symbol}</span>
                    {hasDistinctName ? <span className={styles.connectionName}>{node.name}</span> : null}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
        {comparison ? <IndexedComparison focus={detail.focus} peer={comparison.peer} points={comparison.points} /> : null}
      </div>
    </section>
  )
}
