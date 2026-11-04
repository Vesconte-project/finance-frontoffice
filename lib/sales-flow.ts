/**
 * The "Where each dollar of sales goes" flow on the Financials tab.
 *
 * The flow runs left to right, always horizontal. Its main path is the chain
 * of reported results — sales, gross profit, operating income, net income —
 * drawn to scale, so the bands narrow from what was sold to what was kept.
 * Reported branches use the same amount scale as the main path. Missing
 * branches and breakdowns remain fixed-size outlines, never amounts inferred
 * from a difference between two reported values.
 */
import type { PlotBox } from './chart-labels'

export type FlowNodeId =
  | 'business'
  | 'sales'
  | 'costOfSales'
  | 'grossProfit'
  | 'operatingCosts'
  | 'operatingIncome'
  | 'taxes'
  | 'netIncome'
  | 'buybacks'
  | 'dividends'
  | 'retained'
  | 'costOfSalesParts'
  | 'operatingCostsParts'
  | 'taxesParts'

export type FlowValues = {
  revenue: number | null
  grossProfit: number | null
  operatingIncome: number | null
  netIncome: number | null
  costOfSales?: number | null
  operatingCosts?: number | null
  incomeTax?: number | null
}

export type FlowNodeInfo = {
  id: FlowNodeId
  label: string
  /** The reported value for the year, or null when the node is being built. */
  value: number | null
  /** The value is reported (it may still be null for a missing year). */
  reported: boolean
}

export const NODE_LABEL: Record<FlowNodeId, string> = {
  business: 'By business',
  sales: 'Sales',
  costOfSales: 'Cost of sales',
  grossProfit: 'Gross profit',
  operatingCosts: 'Operating costs',
  operatingIncome: 'Operating income',
  taxes: 'Income tax',
  netIncome: 'Net income',
  buybacks: 'Buybacks',
  dividends: 'Dividends',
  retained: 'Kept',
  costOfSalesParts: 'What it is made of',
  operatingCostsParts: 'What it is made of',
  taxesParts: 'Interest, tax and other items',
}

/** The node's reported value for the year, keyed by the flow's own names. */
export function nodeValue(id: FlowNodeId, values: FlowValues): number | null {
  switch (id) {
    case 'sales': return values.revenue
    case 'grossProfit': return values.grossProfit
    case 'operatingIncome': return values.operatingIncome
    case 'netIncome': return values.netIncome
    case 'costOfSales': return values.costOfSales ?? null
    case 'operatingCosts': return values.operatingCosts ?? null
    case 'taxes': return values.incomeTax ?? null
    default: return null
  }
}

export const REPORTED_NODES: readonly FlowNodeId[] = ['sales', 'grossProfit', 'operatingIncome', 'netIncome', 'costOfSales', 'operatingCosts', 'taxes']

export function isReportedNode(id: FlowNodeId): boolean {
  return REPORTED_NODES.includes(id)
}

/** One visual scale for supplied amounts; never an economic reconciliation. */
export function flowScale(values: FlowValues): number {
  const magnitude = (value: number | null | undefined) => Number.isFinite(value) ? Math.abs(value ?? 0) : 0
  return Math.max(
    magnitude(values.revenue),
    magnitude(values.costOfSales) + magnitude(values.grossProfit),
    magnitude(values.operatingCosts) + magnitude(values.operatingIncome),
    magnitude(values.incomeTax) + magnitude(values.netIncome),
  ) || 1
}

/** Shared by SVG bands and compact bars. Null has no quantitative geometry. */
export function flowFraction(value: number | null, scale: number): number | null {
  if (value === null || !Number.isFinite(value) || !(scale > 0)) return null
  return Math.abs(value) / scale
}

/* ---------------- Wide flow (the chart has 900px or more) ---------------- */

export type WideNode = {
  id: FlowNodeId
  x: number
  y: number
  width: number
  height: number
  /** Being built: drawn outlined, at a fixed size. */
  pending: boolean
  /** Labels sit right of the node, except in the last column. */
  labelSide: 'right' | 'left'
}

export type WideLink = {
  from: FlowNodeId
  to: FlowNodeId
  /** SVG path in plot coordinates. */
  d: string
  pending: boolean
}

export type WideFlow = {
  box: PlotBox
  nodes: WideNode[]
  links: WideLink[]
}

export const WIDE_FLOW_BOX: PlotBox = { width: 1000, height: 500 }

const NODE_WIDTH = 12
const PENDING_HEIGHT = 30
const COLUMN_X = [0, 168, 336, 504, 672, 988]

function bandPath(x1: number, top1: number, bottom1: number, x2: number, top2: number, bottom2: number): string {
  const mid = (x1 + x2) / 2
  return [
    `M${x1},${top1}`,
    `C${mid},${top1} ${mid},${top2} ${x2},${top2}`,
    `L${x2},${bottom2}`,
    `C${mid},${bottom2} ${mid},${bottom1} ${x1},${bottom1}`,
    'Z',
  ].join(' ')
}

/**
 * Lays the wide flow out. Reported nodes are bottom-aligned and scaled to
 * sales, so profit runs along the bottom and each step's height is its own
 * reported magnitude. Missing nodes are outlines; zero has no band. Signed
 * amounts retain their labels and receive a separate negative treatment.
 */
export function wideFlow(values: FlowValues, box: PlotBox = WIDE_FLOW_BOX): WideFlow {
  // Two rows of being-built nodes above the reported path: the costs that leave
  // it, and above them what those costs are made of (Spec PRD-78, wide flow:
  // "custo das vendas e componentes", "custos operacionais e componentes").
  const partsTop = 16
  const pendingTop = partsTop + PENDING_HEIGHT + 20
  const mainTop = pendingTop + PENDING_HEIGHT + 34
  const bottom = box.height - 16
  const mainHeight = bottom - mainTop
  const base = flowScale(values)
  const height = (value: number | null) => {
    const fraction = flowFraction(value, base)
    return fraction === null ? PENDING_HEIGHT : fraction * mainHeight
  }

  const main = (id: FlowNodeId, column: number, value: number | null): WideNode => {
    const h = height(value)
    return { id, x: COLUMN_X[column], y: bottom - h, width: NODE_WIDTH, height: h, pending: flowFraction(value, base) === null, labelSide: 'right' }
  }
  const pending = (id: FlowNodeId, column: number, y: number, h = PENDING_HEIGHT, side: 'right' | 'left' = 'right'): WideNode => ({
    id, x: COLUMN_X[column], y, width: NODE_WIDTH, height: h, pending: true, labelSide: side,
  })

  const sales = main('sales', 1, values.revenue)
  const gross = main('grossProfit', 2, values.grossProfit)
  const operating = main('operatingIncome', 3, values.operatingIncome)
  const net = main('netIncome', 4, values.netIncome)
  const business = pending('business', 0, sales.y, sales.height)
  const branch = (id: FlowNodeId, column: number, value: number | null): WideNode => ({
    ...pending(id, column, pendingTop, height(value)),
    pending: flowFraction(value, base) === null,
  })
  const costOfSales = branch('costOfSales', 2, values.costOfSales ?? null)
  const operatingCosts = branch('operatingCosts', 3, values.operatingCosts ?? null)
  const taxes = branch('taxes', 4, values.incomeTax ?? null)
  const costOfSalesParts = pending('costOfSalesParts', 3, partsTop)
  const operatingCostsParts = pending('operatingCostsParts', 4, partsTop)
  const uses = (['buybacks', 'dividends', 'retained'] as const).map((id, index) => {
    const slot = mainHeight / 3
    return pending(id, 5, mainTop + slot * index + (slot - PENDING_HEIGHT) / 2, PENDING_HEIGHT, 'left')
  })

  // A being-built branch leaves from the top edge of its source as a thin
  // outlined ribbon: it says where the money goes, not how much.
  const pendingLink = (from: WideNode, to: WideNode): WideLink => {
    const x1 = from.x + from.width
    const ribbon = 6
    return {
      from: from.id,
      to: to.id,
      d: bandPath(x1, from.y, from.y + ribbon, to.x, to.y + to.height / 2 - ribbon / 2, to.y + to.height / 2 + ribbon / 2),
      pending: true,
    }
  }

  const splitLinks = (from: WideNode, branch: WideNode, continuation: WideNode): WideLink[] => {
    const targetHeight = (to: WideNode, branch: boolean) => from.pending || to.pending ? 6
      : branch ? to.height : Math.min(from.height, to.height)
    const branchHeight = targetHeight(branch, true)
    const continuingHeight = targetHeight(continuation, false)
    const total = branchHeight + continuingHeight
    // Both outgoing ribbons must fit the same source edge. When supplied
    // amounts do not reconcile, taper the source ends together rather than
    // painting one ribbon over the other. Destination sizes stay untouched;
    // this routes geometry only and derives no financial amount.
    const portScale = total > 0 ? Math.min(1, from.height / total) : 0
    return [branch, continuation].map((to, index) => {
      const pending = from.pending || to.pending
      const destinationHeight = targetHeight(to, index === 0)
      const sourceHeight = destinationHeight * portScale
      const sourceTop = index === 0 ? from.y : from.y + from.height - sourceHeight
      const destinationTop = pending ? to.y + (to.height - destinationHeight) / 2
        : index === 0 ? to.y : to.y + to.height - destinationHeight
      return {
        from: from.id, to: to.id, pending,
        d: bandPath(from.x + from.width, sourceTop, sourceTop + sourceHeight,
          to.x, destinationTop, destinationTop + destinationHeight),
      }
    })
  }

  const nodes = [business, sales, costOfSales, costOfSalesParts, gross, operatingCosts, operatingCostsParts, operating, taxes, net, ...uses]
  const links: WideLink[] = [
    { from: 'business', to: 'sales', d: bandPath(business.x + business.width, business.y, business.y + business.height, sales.x, sales.y, sales.y + sales.height), pending: true },
    ...splitLinks(sales, costOfSales, gross),
    pendingLink(costOfSales, costOfSalesParts),
    pendingLink(operatingCosts, operatingCostsParts),
    ...splitLinks(gross, operatingCosts, operating),
    ...splitLinks(operating, taxes, net),
    ...uses.map((use) => pendingLink(net, use)),
  ]
  return { box, nodes, links }
}

/* ---------------- Narrow flow (three columns) ---------------- */

export type NarrowGroup = { id: FlowNodeId; children: FlowNodeId[] }

/** The four parts of sales in the narrow flow, and what each opens into. */
export const NARROW_GROUPS: readonly NarrowGroup[] = [
  { id: 'costOfSales', children: ['costOfSalesParts'] },
  { id: 'operatingCosts', children: ['operatingCostsParts'] },
  { id: 'taxes', children: ['taxesParts'] },
  { id: 'netIncome', children: ['buybacks', 'dividends', 'retained'] },
]

/** The group a node belongs to in the narrow flow (a child opens its parent). */
export function narrowGroupOf(id: FlowNodeId): FlowNodeId | null {
  for (const group of NARROW_GROUPS) {
    if (group.id === id || group.children.includes(id)) return group.id
  }
  return null
}

/**
 * Connector between two stacked columns, in a 0–100 square stretched over the
 * gap: from the centre of slot `from` of `fromCount` to slot `to` of `toCount`.
 */
export function connectorPath(from: number, fromCount: number, to: number, toCount: number): string {
  const y1 = ((from + 0.5) / Math.max(1, fromCount)) * 100
  const y2 = ((to + 0.5) / Math.max(1, toCount)) * 100
  return `M0,${y1} C50,${y1} 50,${y2} 100,${y2}`
}
