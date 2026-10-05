/**
 * The "Where each dollar of sales goes" flow on the Financials tab.
 *
 * The flow runs left to right, always horizontal. Its main path is the chain
 * of reported results — sales, gross profit, operating income, net income —
 * drawn to scale, so the bands narrow from what was sold to what was kept. The
 * branches between them (cost of sales, operating costs, taxes) and the uses
 * of profit (buybacks, dividends, what was kept), and what the costs are made
 * of, are not reported line items yet (ENG-88, ENG-163); they are drawn as
 * outlined "being built" nodes of a fixed size, never sized from a difference
 * of two reported values.
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
  taxes: 'Taxes and other',
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
    default: return null
  }
}

export const REPORTED_NODES: readonly FlowNodeId[] = ['sales', 'grossProfit', 'operatingIncome', 'netIncome']

export function isReportedNode(id: FlowNodeId): boolean {
  return REPORTED_NODES.includes(id)
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
 * reported value. A reported node with no value for the year, or with a loss,
 * keeps a thin line at the bottom: a loss has no width to flow.
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
  const base = values.revenue !== null && values.revenue > 0
    ? values.revenue
    : Math.max(...[values.grossProfit, values.operatingIncome, values.netIncome].map((value) => value ?? 0), 1)
  const height = (value: number | null) => (value !== null && value > 0 ? Math.max(2, (Math.min(value, base) / base) * mainHeight) : 2)

  const main = (id: FlowNodeId, column: number, value: number | null): WideNode => {
    const h = height(value)
    return { id, x: COLUMN_X[column], y: bottom - h, width: NODE_WIDTH, height: h, pending: false, labelSide: 'right' }
  }
  const pending = (id: FlowNodeId, column: number, y: number, h = PENDING_HEIGHT, side: 'right' | 'left' = 'right'): WideNode => ({
    id, x: COLUMN_X[column], y, width: NODE_WIDTH, height: h, pending: true, labelSide: side,
  })

  const sales = main('sales', 1, values.revenue)
  const gross = main('grossProfit', 2, values.grossProfit)
  const operating = main('operatingIncome', 3, values.operatingIncome)
  const net = main('netIncome', 4, values.netIncome)
  const business = pending('business', 0, sales.y, sales.height)
  const costOfSales = pending('costOfSales', 2, pendingTop)
  const operatingCosts = pending('operatingCosts', 3, pendingTop)
  const taxes = pending('taxes', 4, pendingTop)
  const costOfSalesParts = pending('costOfSalesParts', 3, partsTop)
  const operatingCostsParts = pending('operatingCostsParts', 4, partsTop)
  const uses = (['buybacks', 'dividends', 'retained'] as const).map((id, index) => {
    const slot = mainHeight / 3
    return pending(id, 5, mainTop + slot * index + (slot - PENDING_HEIGHT) / 2, PENDING_HEIGHT, 'left')
  })

  const reportedLink = (from: WideNode, to: WideNode): WideLink => {
    const thickness = Math.min(from.height, to.height)
    const x1 = from.x + from.width
    return {
      from: from.id,
      to: to.id,
      d: bandPath(x1, from.y + from.height - thickness, from.y + from.height, to.x, to.y + to.height - thickness, to.y + to.height),
      pending: false,
    }
  }
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

  const nodes = [business, sales, costOfSales, costOfSalesParts, gross, operatingCosts, operatingCostsParts, operating, taxes, net, ...uses]
  const links: WideLink[] = [
    { from: 'business', to: 'sales', d: bandPath(business.x + business.width, business.y, business.y + business.height, sales.x, sales.y, sales.y + sales.height), pending: true },
    pendingLink(sales, costOfSales),
    pendingLink(costOfSales, costOfSalesParts),
    pendingLink(operatingCosts, operatingCostsParts),
    reportedLink(sales, gross),
    pendingLink(gross, operatingCosts),
    reportedLink(gross, operating),
    pendingLink(operating, taxes),
    reportedLink(operating, net),
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
