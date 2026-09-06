import 'server-only'

import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import type { PickItem } from '@/lib/picks'
import { PICK_READING_CONTENT } from '@/lib/picks-content'
import {
  getRelationshipAtlasNeighborhood,
  type AtlasEdge,
  type AtlasNode,
  type RelationshipAtlasDetail,
} from '@/lib/network'
import styles from './HomeNeighborhood.module.css'

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

async function loadHomeNeighborhood(items: PickItem[]) {
  const utcDate = new Date().toISOString().slice(0, 10)

  for (const item of items.slice(0, 5)) {
    try {
      const detail = await getCachedNeighborhood(item.symbol, utcDate)
      if (detail.focus === item.symbol && isRenderableNeighborhood(detail)) return { detail, item }
    } catch {
      // Try only the next visible long-term name. No usable answer means no section.
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

export default async function HomeNeighborhood({ items }: { items: PickItem[] }) {
  const subject = await loadHomeNeighborhood(items)
  if (!subject) return null
  const { detail, item } = subject

  const focusNode = detail.nodes.find((node) => node.symbol === detail.focus)
  if (!focusNode) return null
  const allConnections = focusConnections(detail)
  const connections = allConnections.slice(0, 5)
  const components = item.components.filter((component) =>
    component.available && typeof component.score === 'number' && Number.isFinite(component.score)
  )
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

            {components.length > 0 ? (
              <dl className={styles.breakdown} aria-label="Long-term ranking components">
                {components.map((component) => {
                  const weight = PICK_READING_CONTENT.longTerm.measures.find(
                    (measure) => measure.label === component.label
                  )?.weight
                  return (
                    <div key={component.key} className={styles.component} title={component.detail || undefined}>
                      <dt>{component.label}</dt>
                      <dd className="numeric-tabular">{component.score}</dd>
                      {weight ? <dd className={`${styles.weight} numeric-tabular`}>{weight}</dd> : null}
                    </div>
                  )
                })}
              </dl>
            ) : null}

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
      </div>
    </section>
  )
}
