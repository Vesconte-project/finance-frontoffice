import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NARROW_GROUPS,
  WIDE_FLOW_BOX,
  connectorPath,
  flowFraction,
  flowScale,
  isReportedNode,
  narrowGroupOf,
  nodeValue,
  wideFlow,
} from '../lib/sales-flow'

const values = { revenue: 400, grossProfit: 180, operatingIncome: 120, netIncome: 96 }

function byId(flow: ReturnType<typeof wideFlow>) {
  return new Map(flow.nodes.map((node) => [node.id, node]))
}

test('the wide flow runs left to right and narrows by the reported values', () => {
  const flow = wideFlow(values)
  const nodes = byId(flow)
  const chain = ['sales', 'grossProfit', 'operatingIncome', 'netIncome'] as const
  for (let index = 1; index < chain.length; index += 1) {
    assert.ok(nodes.get(chain[index])!.x > nodes.get(chain[index - 1])!.x, `${chain[index]} sits right of ${chain[index - 1]}`)
  }
  const sales = nodes.get('sales')!
  for (const id of chain) {
    const node = nodes.get(id)!
    const reported = nodeValue(id, values)!
    assert.ok(Math.abs(node.height / sales.height - reported / values.revenue) < 1e-9, `${id} is drawn to scale`)
    assert.ok(Math.abs(node.y + node.height - (sales.y + sales.height)) < 1e-9, 'profit runs along the bottom')
    assert.equal(node.pending, false)
  }
  for (const node of flow.nodes) {
    assert.ok(node.x >= 0 && node.x + node.width <= WIDE_FLOW_BOX.width)
    assert.ok(node.y >= 0 && node.y + node.height <= WIDE_FLOW_BOX.height)
  }
})

test('branches that are not reported are fixed-size outlines, never a difference of two values', () => {
  const small = byId(wideFlow({ ...values, grossProfit: 390 }))
  const large = byId(wideFlow({ ...values, grossProfit: 100 }))
  for (const id of ['costOfSales', 'operatingCosts', 'taxes', 'buybacks', 'dividends', 'retained'] as const) {
    assert.equal(small.get(id)!.pending, true)
    assert.equal(small.get(id)!.height, large.get(id)!.height, `${id} does not change with the reported values`)
  }
  for (const id of ['buybacks', 'dividends', 'retained'] as const) assert.equal(small.get(id)!.labelSide, 'left')
  const flow = wideFlow(values)
  assert.ok(flow.links.filter((link) => !link.pending).every((link) => isReportedNode(link.from) && isReportedNode(link.to)))
})

test('the wide flow shows what the cost of sales and the operating costs are made of', () => {
  const flow = wideFlow(values)
  const nodes = byId(flow)
  for (const [parent, parts] of [['costOfSales', 'costOfSalesParts'], ['operatingCosts', 'operatingCostsParts']] as const) {
    const node = nodes.get(parts)
    assert.ok(node, `${parts} is drawn in the wide flow`)
    assert.equal(node!.pending, true)
    assert.ok(node!.x > nodes.get(parent)!.x, `${parts} sits right of ${parent}`)
    assert.ok(node!.y + node!.height <= nodes.get(parent)!.y, `${parts} sits above ${parent}`)
    assert.ok(flow.links.some((link) => link.from === parent && link.to === parts && link.pending))
  }
})

test('losses retain their magnitude, missing values are outlines and zero has no band', () => {
  const nodes = byId(wideFlow({ revenue: 400, grossProfit: null, operatingIncome: -20, netIncome: -35 }))
  assert.equal(nodes.get('grossProfit')!.pending, true)
  assert.equal(nodes.get('operatingIncome')!.pending, false)
  assert.equal(nodes.get('operatingIncome')!.height / nodes.get('netIncome')!.height, 20 / 35)
  const zero = byId(wideFlow({ ...values, incomeTax: 0 })).get('taxes')!
  assert.equal(zero.height, 0)
  assert.equal(zero.pending, false)
  const noSales = byId(wideFlow({ revenue: null, grossProfit: 50, operatingIncome: 25, netIncome: 10 }))
  assert.ok(noSales.get('grossProfit')!.height > noSales.get('netIncome')!.height)
})

test('the narrow flow is sales, its four parts and what the open part is made of', () => {
  assert.deepEqual(NARROW_GROUPS.map((group) => group.id), ['costOfSales', 'operatingCosts', 'taxes', 'netIncome'])
  assert.deepEqual(NARROW_GROUPS.at(-1)!.children, ['buybacks', 'dividends', 'retained'])
  assert.equal(narrowGroupOf('dividends'), 'netIncome')
  assert.equal(narrowGroupOf('taxes'), 'taxes')
  assert.equal(narrowGroupOf('grossProfit'), null)
  assert.equal(connectorPath(0, 1, 3, 4), 'M0,50 C50,50 50,87.5 100,87.5')
})


test('new cost and tax nodes expose only explicit reported values', () => {
  const explicit = {...values, costOfSales:220, operatingCosts:60, incomeTax:24}
  const nodes = byId(wideFlow(explicit))
  for (const id of ['costOfSales','operatingCosts','taxes'] as const) assert.equal(nodes.get(id)?.pending,false)
  assert.equal(nodeValue('costOfSales',explicit),220)
  assert.equal(nodeValue('operatingCosts',explicit),60)
  assert.equal(nodeValue('taxes',explicit),24)
  assert.equal(nodeValue('costOfSales',values),null)
  assert.equal(nodeValue('retained',explicit),null)
})

test('reported branches and ribbons use the same scale as sales, including a dominant cost', () => {
  const explicit = { revenue: 19510, grossProfit: 2340, operatingIncome: 2140, netIncome: 1120,
    costOfSales: 17200, operatingCosts: 207, incomeTax: 685 }
  const flow = wideFlow(explicit)
  const nodes = byId(flow)
  const sales = nodes.get('sales')!
  for (const id of ['grossProfit', 'operatingIncome', 'netIncome', 'costOfSales', 'operatingCosts', 'taxes'] as const) {
    const node = nodes.get(id)!
    assert.ok(Math.abs(node.height / sales.height - nodeValue(id, explicit)! / explicit.revenue) < 1e-9, id)
    assert.ok(node.y + node.height <= WIDE_FLOW_BOX.height)
  }
  assert.ok(nodes.get('costOfSales')!.height > nodes.get('grossProfit')!.height * 7)
  for (const [from, to] of [['sales', 'costOfSales'], ['grossProfit', 'operatingCosts'], ['operatingIncome', 'taxes']] as const) {
    const link = flow.links.find(link => link.from === from && link.to === to)!
    assert.equal(link.pending, false)
    const numbers = link.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number)
    // The ribbon's target vertical edge encodes the full reported amount.
    assert.ok(Math.abs(numbers[9] - numbers[7] - nodes.get(to)!.height) < 1e-9)
  }
  const percent = Object.fromEntries(Object.entries(explicit).map(([key, value]) => [key, value / explicit.revenue]))
  const percentNodes = byId(wideFlow(percent as typeof explicit))
  for (const [id, node] of nodes) assert.ok(Math.abs(node.height - percentNodes.get(id)!.height) < 1e-9, `${id}: amount and percent agree`)
})

test('compact bars share the wide scale without imposing a minimum size or inferring missing inputs', () => {
  const explicit = { ...values, costOfSales: 220, operatingCosts: 60, incomeTax: 0.01 }
  const scale = flowScale(explicit)
  const nodes = byId(wideFlow(explicit))
  for (const id of ['costOfSales', 'operatingCosts', 'taxes', 'netIncome'] as const) {
    const value = nodeValue(id, explicit)!
    assert.equal(flowFraction(value, scale), value / scale)
    assert.ok(Math.abs(nodes.get(id)!.height / nodes.get('sales')!.height - value / explicit.revenue) < 1e-9)
  }
  assert.equal(flowFraction(null, scale), null)
  assert.equal(flowFraction(Number.NaN, scale), null)
  assert.equal(flowFraction(0, scale), 0)
  assert.equal(flowFraction(-60, scale), flowFraction(60, scale))
  const oversized = byId(wideFlow({ ...explicit, costOfSales: 900 }))
  assert.ok(oversized.get('costOfSales')!.y + oversized.get('costOfSales')!.height < oversized.get('grossProfit')!.y)
})
