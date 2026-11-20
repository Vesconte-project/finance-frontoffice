import { sectorPath } from '@/lib/relationship-orbit'
import { ATLAS_CLUSTERS, ATLAS_HEIGHT, ATLAS_ROUTES, ATLAS_PORTFOLIOS, ATLAS_WIDTH, ORBIT_CENTRE, ORBIT_COLOURS, ORBIT_NODES, atlasRouteControl } from './home-story-geometry'
import styles from './HomeMarketStory.module.css'

type FlowTone = 'sales' | 'cost' | 'profit'
type Band = [start: number, top: number, bottom: number, end: number, endTop: number, endBottom: number]
type FlowNode = [label: string, value: number, tone: FlowTone, x: number, top: number, bottom: number, labelPosition?: number]

const FLOW_NODES: FlowNode[] = [
  ['Products', 58, 'sales', 0, 0, 255],
  ['Services', 27, 'sales', 0, 269, 388],
  ['Subscriptions', 10, 'sales', 0, 402, 446],
  ['Other', 5, 'sales', 0, 460, 482],
  ['Revenue', 100, 'sales', 240, 20, 460],
  ['Cost of revenue', 54, 'cost', 470, 0, 238],
  ['Gross profit', 46, 'profit', 470, 268, 470],
  ['Cost of products', 45, 'cost', 720, 0, 198, 78],
  ['Cost of services', 9, 'cost', 720, 210, 250, 209],
  ['R&D', 8, 'cost', 720, 262, 297, 261],
  ['Sales & admin', 7, 'cost', 720, 311, 342, 310],
  ['Operating profit', 31, 'profit', 720, 360, 496],
  ['Income tax', 5, 'cost', 940, 340, 362, 324],
  ['Net profit', 26, 'profit', 940, 390, 504],
  ['Dividends', 4, 'profit', 1150, 360, 378, 347],
  ['Buybacks', 17, 'profit', 1150, 392, 467],
  ['Kept', 5, 'profit', 1150, 481, 503, 479],
]

const FLOW_BANDS: Record<FlowTone, Band[]> = {
  sales: [
    [14, 0, 255, 240, 20, 275], [14, 269, 388, 240, 275, 394],
    [14, 402, 446, 240, 394, 438], [14, 460, 482, 240, 438, 460],
  ],
  cost: [
    [254, 20, 258, 470, 0, 238], [484, 0, 198, 720, 0, 198],
    [484, 198, 238, 720, 210, 250], [484, 268, 303, 720, 262, 297],
    [484, 303, 334, 720, 311, 342], [734, 360, 382, 940, 340, 362],
  ],
  profit: [
    [254, 258, 460, 470, 268, 470], [484, 334, 470, 720, 360, 496],
    [734, 382, 496, 940, 390, 504], [954, 390, 408, 1150, 360, 378],
    [954, 408, 483, 1150, 392, 467], [954, 483, 504, 1150, 481, 503],
  ],
}

function bandPath([start, top, bottom, end, endTop, endBottom]: Band, compact: boolean) {
  const middle = (start + end) / 2
  const point = (x: number, y: number) => compact ? `${y} ${x}` : `${x} ${y}`
  return `M${point(start, top)}C${point(middle, top)} ${point(middle, endTop)} ${point(end, endTop)}L${point(end, endBottom)}C${point(middle, endBottom)} ${point(middle, bottom)} ${point(start, bottom)}Z`
}

const COMPACT_FLOW_NODES: FlowNode[] = [
  ['Revenue', 100, 'sales', 25, 0, 325],
  ['Cost of revenue', 54, 'cost', 105, 0, 175.5],
  ['Gross profit', 46, 'profit', 105, 194, 343.5],
  ['Operating costs', 15, 'cost', 185, 136, 184.75, 111],
  ['Operating profit', 31, 'profit', 185, 243, 343.75, 233],
  ['Income tax', 5, 'cost', 265, 167, 183.25, 154],
  ['Net profit', 26, 'profit', 265, 259, 343.5, 253],
  ['Dividends', 4, 'profit', 345, 0, 13],
  ['Buybacks', 17, 'profit', 345, 157, 212.25],
  ['Kept', 5, 'profit', 345, 302, 318.25],
]

const COMPACT_FLOW_BANDS: Record<FlowTone, Band[]> = {
  sales: [],
  cost: [
    [32, 0, 175.5, 105, 0, 175.5], [112, 194, 242.75, 185, 136, 184.75],
    [192, 243, 259.25, 265, 167, 183.25],
  ],
  profit: [
    [32, 175.5, 325, 105, 194, 343.5], [112, 242.75, 343.5, 185, 243, 343.75],
    [192, 259.25, 343.75, 265, 259, 343.5], [272, 259, 272, 345, 0, 13],
    [272, 272, 327.25, 345, 157, 212.25], [272, 327.25, 343.5, 345, 302, 318.25],
  ],
}

function FlowPlot({ compact }: { compact: boolean }) {
  const id = compact ? 'home-flow-compact' : 'home-flow-wide'
  const bands = compact ? COMPACT_FLOW_BANDS : FLOW_BANDS
  const nodes = compact ? COMPACT_FLOW_NODES : FLOW_NODES
  return (
    <svg
      className={compact ? styles.flowCompact : styles.flowWide}
      viewBox={compact ? '-5 -2 360 376' : '-2 -8 1258 535'}
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>Illustrative revenue flow</title>
      <desc id={`${id}-description`}>
        Of every 100 in revenue, 54 goes to cost of revenue, leaving 46 in gross profit.
        Operating costs take 15, leaving 31 in operating profit. After 5 in income tax,
        26 remains as net profit, split into 4 in dividends, 17 in buybacks and 5 retained.
      </desc>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect data-flow-reveal={compact ? 'height' : 'width'} x={compact ? -5 : -2} y="-8" width={compact ? 360 : 1258} height="543" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        {Object.entries(bands).map(([tone, paths]) => (
          <g key={tone} color={`var(--flow-${tone})`}>
            {paths.map((band) => <path key={band.join(',')} className={styles.flowBand} d={bandPath(band, compact)} />)}
          </g>
        ))}
        {nodes.map(([label, value, tone, x, top, bottom, labelPosition]) => (
          <g key={label} color={`var(--flow-${tone})`}>
            {compact ? (
              <>
                <rect x={top} y={x} width={bottom - top} height="7" className={styles.flowBar} />
                <text x={labelPosition ?? top} y={x + 22} className={styles.compactLabel}>
                  {label} <tspan className={styles.flowValue}>{value}%</tspan>
                </text>
              </>
            ) : (
              <>
                <rect x={x} y={top} width="14" height={bottom - top} className={styles.flowBar} />
                <text x={x + 22} y={labelPosition ?? (top + bottom) / 2 - 4} className={styles.flowLabel}>
                  {label}
                  <tspan x={x + 22} dy="18" className={styles.flowValue}>{value}%</tspan>
                </text>
              </>
            )}
          </g>
        ))}
      </g>
    </svg>
  )
}

export function RevenueFlow() {
  return (
    <figure className={styles.figure}>
      <FlowPlot compact={false} />
      <FlowPlot compact />
    </figure>
  )
}

const ORBIT_SECTORS = [[-150, -30], [-27, 61], [101, 146], [149, 207]]

export function RelationshipField() {
  const { x, y } = ORBIT_CENTRE
  return (
    <figure className={styles.figure}>
      <svg data-story-orbit viewBox="80 0 520 502" role="img" aria-labelledby="home-orbit-title home-orbit-description">
        <title id="home-orbit-title">Illustrative company relationship field</title>
        <desc id="home-orbit-description">Companies gather around a central company. The rings show example correlation levels and each colour identifies a different region.</desc>
        <defs>
          <radialGradient id="home-orbit-shade" cx="32%" cy="26%" r="70%">
            <stop stopColor="white" stopOpacity="0.78" />
            <stop offset="0.48" stopColor="white" stopOpacity="0.08" />
            <stop offset="1" stopColor="black" stopOpacity="0.24" />
          </radialGradient>
        </defs>
        <g>
          {ORBIT_SECTORS.map(([start, end], index) => (
            <path key={start} d={sectorPath(x, y, 32, 222, start * Math.PI / 180, end * Math.PI / 180)} color={ORBIT_COLOURS[index]} className={styles.orbitWedge} />
          ))}
          {[91, 142, 193].map((radius, index) => (
            <g key={radius}>
              <circle cx={x} cy={y} r={radius} fill="none" stroke="var(--network-node)" strokeOpacity="0.46" strokeDasharray="2 5" />
              <text x={x - radius * 0.86} y={y - radius * 0.50 - 5} textAnchor="middle" className={styles.ringLabel}>
                {['0.50', '0.25', '0.10'][index]}
              </text>
            </g>
          ))}
          {ORBIT_NODES.map((node) => (
            <line data-story-static key={node.x} x1={x} y1={y} x2={node.x} y2={node.y} color={ORBIT_COLOURS[node.region]} className={styles.orbitEdge} />
          ))}
          <text x={x} y="17" textAnchor="middle" className={styles.networkLabel}>Its own region</text>
        </g>
        <g data-story-static>
          {ORBIT_NODES.map((node) => <circle key={node.x} cx={node.x} cy={node.y} r="7.5" fill={ORBIT_COLOURS[node.region]} />)}
          <circle cx={x} cy={y} r="15" fill="var(--accent)" />
        </g>
        <g data-story-static fill="url(#home-orbit-shade)">
          {ORBIT_NODES.map((node) => <circle key={node.x} cx={node.x} cy={node.y} r="7.5" />)}
          <circle cx={x} cy={y} r="15" />
        </g>
      </svg>
    </figure>
  )
}

export function MarketClusters() {
  return (
    <figure className={`${styles.figure} ${styles.atlasFigure}`}>
      <svg data-story-atlas viewBox={`0 0 ${ATLAS_WIDTH} ${ATLAS_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="home-clusters-title home-clusters-description">
        <title id="home-clusters-title">Illustrative Market Atlas map</title>
        <desc id="home-clusters-description">
          Dots gather into linked market regions across an archipelago: {ATLAS_CLUSTERS.map(({ name }) => name).join(', ')}.
        </desc>
        {ATLAS_CLUSTERS.map((cluster) => (
          <g key={cluster.name} color={cluster.colour}>
            {cluster.islands.map(({ path }, index) => (
              <path key={index} d={path} className={styles.atlasLand} />
            ))}
            {cluster.edges.map(({ id, from, to }) => (
              <line data-story-static key={id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={styles.atlasEdge} />
            ))}
            {cluster.dots.map(({ x, y, radius }, index) => (
              <circle data-story-static key={index} cx={x} cy={y} r={radius} fill="var(--network-node)" />
            ))}
            {cluster.label && (
              <text x={cluster.label.x} y={cluster.label.y} textAnchor="middle" dominantBaseline="middle" className={styles.atlasLabel}>
                {cluster.name}
              </text>
            )}
          </g>
        ))}
        {ATLAS_ROUTES.map(({ id, from, to, bend }) => {
          const control = atlasRouteControl(from, to, bend)
          return <path key={id} data-story-static d={`M${from.x} ${from.y}Q${control.x} ${control.y} ${to.x} ${to.y}`} className={styles.atlasRoute} />
        })}
        {Object.entries(ATLAS_PORTFOLIOS).map(([name, points]) => (
          <g key={name} data-portfolio-layer={name} className={styles.portfolioLayer} aria-hidden="true">
            {name === 'tech' && <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} />}
            {points.map(({ x, y }) => (
              <g key={`${x},${y}`}>
                <circle className={styles.portfolioRing} cx={x} cy={y} r="9" />
                <circle className={styles.portfolioDot} cx={x} cy={y} r="3" />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </figure>
  )
}
