import 'server-only'

import Link from 'next/link'
import { cache } from 'react'
import { getViewerUserId } from '@/lib/auth'
import type { PickItem } from '@/lib/picks'
import { PICK_READING_CONTENT } from '@/lib/picks-content'
import { getAtlasCompany } from '@/lib/atlas'
import type { AtlasCompanyPanel, AtlasNeighbour } from '@/lib/atlas-model'
import styles from './HomeNeighborhood.module.css'

const MAP_NODE_LIMIT = 10
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const getCachedCompany = cache(async (symbol: string, utcDate: string) => {
  void utcDate
  return getAtlasCompany(symbol)
})

async function loadHomeNeighborhood(items: PickItem[]): Promise<{ panel: AtlasCompanyPanel; item: PickItem } | null> {
  const utcDate = new Date().toISOString().slice(0, 10)

  for (const item of items.slice(0, 5)) {
    const result = await getCachedCompany(item.symbol, utcDate)
    // Only a name with enough ties to draw; no usable answer means no section.
    if (result.status === 'ok' && result.data.neighbours.length >= 5) return { panel: result.data, item }
  }

  return null
}

const VIEWBOX_WIDTH = 480
const VIEWBOX_HEIGHT = 300
const VIEWBOX_PADDING = 36

type ProjectedNeighbour = AtlasNeighbour & { plotX: number; plotY: number }

/**
 * The company at the centre and its strongest ties around it: the closer a
 * company sits, the more it moves with the centre (distance is 1 - correlation).
 * Angles follow the rank, so the drawing says nothing the list does not.
 */
function projectNeighbours(neighbours: AtlasNeighbour[]): ProjectedNeighbour[] {
  const centreX = VIEWBOX_WIDTH / 2
  const centreY = VIEWBOX_HEIGHT / 2
  const reach = VIEWBOX_HEIGHT / 2 - VIEWBOX_PADDING
  const distances = neighbours.map((neighbour) => 1 - Math.max(0, Math.min(1, neighbour.correlation)))
  const nearest = Math.min(...distances)
  const farthest = Math.max(...distances)
  const span = Math.max(farthest - nearest, 0.0001)
  return neighbours.map((neighbour, rank) => {
    const radius = reach * (0.35 + 0.65 * ((distances[rank] - nearest) / span))
    const angle = rank * GOLDEN_ANGLE - Math.PI / 2
    return {
      ...neighbour,
      plotX: Math.round((centreX + radius * Math.cos(angle) * 1.45) * 10) / 10,
      plotY: Math.round((centreY + radius * Math.sin(angle)) * 10) / 10,
    }
  })
}

function edgeOpacity(correlation: number): number {
  return 0.15 + Math.max(0, Math.min(1, correlation)) * 0.45
}

function MapLabel({ x: plotX, y: plotY, symbol, focus }: { x: number; y: number; symbol: string; focus: boolean }) {
  const alignRight = plotX > VIEWBOX_WIDTH - 120
  const x = alignRight ? plotX - 11 : plotX + 11
  const y = Math.max(18, Math.min(VIEWBOX_HEIGHT - 12, plotY + 4))

  return (
    <text x={x} y={y} textAnchor={alignRight ? 'end' : 'start'} className={focus ? styles.focusLabel : styles.nodeLabel}>
      {symbol}
    </text>
  )
}

function NeighborhoodMap({ panel, neighbours }: { panel: AtlasCompanyPanel; neighbours: AtlasNeighbour[] }) {
  const projected = projectNeighbours(neighbours)
  const centreX = VIEWBOX_WIDTH / 2
  const centreY = VIEWBOX_HEIGHT / 2

  return (
    <svg className={styles.map} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} aria-hidden="true" focusable="false">
      {projected.map((node) => (
        <line
          key={`edge-${node.symbol}`}
          x1={centreX}
          y1={centreY}
          x2={node.plotX}
          y2={node.plotY}
          className={styles.edge}
          strokeOpacity={edgeOpacity(node.correlation)}
        />
      ))}
      {projected.map((node) => (
        <circle key={node.symbol} cx={node.plotX} cy={node.plotY} r={3.5 + Math.max(0, Math.min(1, node.correlation)) * 4} className={styles.node} />
      ))}
      <circle cx={centreX} cy={centreY} r={9} className={styles.focusNode} />
      {projected.slice(0, 4).map((node) => <MapLabel key={node.symbol} x={node.plotX} y={node.plotY} symbol={node.symbol} focus={false} />)}
      <MapLabel x={centreX} y={centreY} symbol={panel.symbol} focus />
    </svg>
  )
}

export default async function HomeNeighborhood({ items }: { items: PickItem[] }) {
  if (!(await getViewerUserId())) return <section className={styles.section}><p>Sign in to explore company relationships.</p><Link href="/sign-in">Sign in</Link></section>
  const subject = await loadHomeNeighborhood(items)
  if (!subject) return null
  const { panel, item } = subject

  const neighbours = panel.neighbours.slice(0, MAP_NODE_LIMIT - 1)
  const connections = neighbours.slice(0, 5)
  const components = item.components.filter((component) =>
    component.available && typeof component.score === 'number' && Number.isFinite(component.score)
  )
  const focusHasDistinctName = panel.name && panel.name !== panel.symbol

  return (
    <section
      className={styles.section}
      aria-labelledby="home-neighborhood-heading"
      data-home-neighborhood=""
      data-subject={panel.symbol}
      data-node-count={neighbours.length + 1}
      data-edge-count={neighbours.length}
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 id="home-neighborhood-heading" className={styles.heading}>Behind one name</h2>
          <p className={styles.lede}>Every ranked company sits in the same map you just scrolled through.</p>
        </header>

        <div className={styles.frame}>
          <div className={styles.mapWrap}>
            <NeighborhoodMap panel={panel} neighbours={neighbours} />
          </div>

          <div className={styles.content}>
            <div className={styles.focusIdentity}>
              <h3 className={styles.focusName}>
                {focusHasDistinctName ? panel.name : (
                  <Link href={`/stocks/${encodeURIComponent(panel.symbol)}`} className={styles.focusSymbol}>{panel.symbol}</Link>
                )}
              </h3>
              {focusHasDistinctName ? (
                <Link href={`/stocks/${encodeURIComponent(panel.symbol)}`} className={`${styles.focusSymbol} numeric-tabular`}>
                  {panel.symbol}
                </Link>
              ) : null}
              {panel.zoneLabel ? <p className={styles.community}>{panel.zoneLabel}</p> : null}
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

            <div className={styles.connections} aria-label={`Companies connected to ${panel.symbol}`}>
              {connections.map((node) => {
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
