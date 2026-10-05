import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NARROW_GROUPS,
  WIDE_FLOW_BOX,
  connectorPath,
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

test('a loss or a missing year keeps a thin line rather than a negative band', () => {
  const nodes = byId(wideFlow({ revenue: 400, grossProfit: null, operatingIncome: -20, netIncome: -35 }))
  assert.equal(nodes.get('grossProfit')!.height, 2)
  assert.equal(nodes.get('operatingIncome')!.height, 2)
  assert.equal(nodes.get('netIncome')!.height, 2)
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
