'use client'

import { Sankey, type SankeyLinkProps, type SankeyNodeProps } from 'recharts'
import Card from '@/components/ui/Card'
import ChartContainer, {
  CHART_MARGINS,
} from '@/components/charts/ChartContainer'

export type PortfolioFlowNodeTone = 'sector' | 'portfolio' | 'holding' | 'other'

export type PortfolioFlowNodeDatum = {
  name: string
  value: number
  valueLabel: string
  tone: PortfolioFlowNodeTone
}

export type PortfolioFlowLinkDatum = {
  source: number
  target: number
  value: number
}

type PortfolioFlowSankeyProps = {
  title: string
  subtitle: string
  totalWeight: number
  topHoldingsWeight: number
  data: {
    nodes: PortfolioFlowNodeDatum[]
    links: PortfolioFlowLinkDatum[]
  }
}

function trimLabel(value: string, max = 18): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}...`
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function getNodeFill(tone: PortfolioFlowNodeTone): string {
  switch (tone) {
    case 'sector':
      return 'var(--text)'
    case 'portfolio':
      return 'var(--up)'
    case 'holding':
      return 'var(--down)'
    case 'other':
      return 'var(--text-muted)'
    default:
      return 'var(--text-muted)'
  }
}

function getLinkFill(tone: PortfolioFlowNodeTone): string {
  switch (tone) {
    case 'sector':
      return 'color-mix(in srgb, var(--text) 16%, transparent)'
    case 'portfolio':
      return 'color-mix(in srgb, var(--up) 16%, transparent)'
    case 'holding':
      return 'color-mix(in srgb, var(--down) 14%, transparent)'
    case 'other':
      return 'color-mix(in srgb, var(--text-muted) 14%, transparent)'
    default:
      return 'color-mix(in srgb, var(--text-muted) 14%, transparent)'
  }
}

function FlowNode(props: SankeyNodeProps) {
  const payload = props.payload as SankeyNodeProps['payload'] & PortfolioFlowNodeDatum & { depth?: number }
  const fill = getNodeFill(payload.tone)
  const depth = payload.depth ?? 0
  const anchor = depth === 0 ? 'start' : depth === 1 ? 'middle' : 'end'
  const labelX = depth === 0 ? props.x : depth === 1 ? props.x + props.width / 2 : props.x + props.width

  return (
    <g>
      <rect
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        rx={4}
        fill={fill}
        opacity={0.9}
      />
      <text
        x={labelX}
        y={Math.max(18, props.y - 8)}
        textAnchor={anchor}
        fontSize={12}
        fontWeight={500}
        fill="var(--content-primary)"
      >
        {trimLabel(payload.name, depth === 1 ? 20 : 18)}
      </text>
      <text
        x={labelX}
        y={Math.max(34, props.y + 8)}
        textAnchor={anchor}
        fontSize={12}
        fontWeight={500}
        fill="var(--content-muted)"
      >
        {trimLabel(payload.valueLabel, 18)}
      </text>
    </g>
  )
}

function FlowLink(props: SankeyLinkProps) {
  const payload = props.payload as SankeyLinkProps['payload'] & {
    source: PortfolioFlowNodeDatum
  }
  const fill = getLinkFill(payload.source.tone)
  const curvature = 0.5
  const controlPointA = props.sourceX + (props.targetX - props.sourceX) * curvature
  const controlPointB = props.targetX - (props.targetX - props.sourceX) * curvature
  const halfWidth = props.linkWidth / 2

  const path = [
    `M ${props.sourceX} ${props.sourceY - halfWidth}`,
    `C ${controlPointA} ${props.sourceY - halfWidth}, ${controlPointB} ${props.targetY - halfWidth}, ${props.targetX} ${props.targetY - halfWidth}`,
    `L ${props.targetX} ${props.targetY + halfWidth}`,
    `C ${controlPointB} ${props.targetY + halfWidth}, ${controlPointA} ${props.sourceY + halfWidth}, ${props.sourceX} ${props.sourceY + halfWidth}`,
    'Z',
  ].join(' ')

  return <path d={path} fill={fill} stroke="none" />
}

export default function PortfolioFlowSankey({
  title,
  subtitle,
  totalWeight,
  topHoldingsWeight,
  data,
}: PortfolioFlowSankeyProps) {
  const residualWeight = Math.max(0, totalWeight - topHoldingsWeight)

  return (
    <Card className="section-gap" padding="lg">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-section-title text-content-primary">{title}</h2>
          <p className="text-body mt-1 max-w-3xl">{subtitle}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-border bg-surface-elevated px-3 py-2">
            <div className="text-filter-label">Sector Coverage</div>
            <div className="mt-1 font-semibold text-content-primary">{formatPercent(totalWeight)}</div>
          </div>
          <div className="rounded-md border border-border bg-surface-elevated px-3 py-2">
            <div className="text-filter-label">Top Holdings</div>
            <div className="mt-1 font-semibold text-content-primary">{formatPercent(topHoldingsWeight)}</div>
          </div>
          <div className="rounded-md border border-border bg-surface-elevated px-3 py-2">
            <div className="text-filter-label">Residual</div>
            <div className="mt-1 font-semibold text-content-primary">{formatPercent(residualWeight)}</div>
          </div>
        </div>
      </div>

      <ChartContainer className="h-[520px] w-full min-w-0">
        {({ width, height }) => (
          <Sankey
            width={width}
            height={height}
            data={data}
            node={FlowNode}
            link={FlowLink}
            nodePadding={28}
            nodeWidth={18}
            margin={CHART_MARGINS.sankey}
            sort
          />
        )}
      </ChartContainer>

      <div className="flex flex-wrap items-center gap-3 text-[12px] text-content-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getNodeFill('sector') }} />
          Sector exposure
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getNodeFill('portfolio') }} />
          Portfolio node
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getNodeFill('holding') }} />
          Holdings
        </span>
      </div>
    </Card>
  )
}
