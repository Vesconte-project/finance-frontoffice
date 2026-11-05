import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPACT_BOX, WIDE_BOX, centreOut, orbitDomain, orbitGeometry, type OrbitTie } from '../lib/relationship-orbit'

const TIES: OrbitTie[] = [
  { symbol: 'KO', zoneId: 'soft', correlation: 0.24 },
  { symbol: 'PSFE', zoneId: 'soft', correlation: 0.24 },
  { symbol: 'NBIX', zoneId: 'bio', correlation: 0.22 },
  { symbol: 'GILD', zoneId: 'bio', correlation: 0.21 },
  { symbol: 'PHM', zoneId: 'homes', correlation: 0.17 },
]

const distance = (geometry: ReturnType<typeof orbitGeometry>, symbol: string) => {
  const node = geometry.nodes.find((item) => item.symbol === symbol)
  assert.ok(node, symbol)
  return Math.hypot(node.x - geometry.centre.x, node.y - geometry.centre.y)
}

test('the ring range is whole steps around the values, at least 0.1 wide and never below zero', () => {
  assert.deepEqual(orbitDomain([0.24, 0.17]), { lo: 0.15, hi: 0.25, step: 0.05 })
  assert.deepEqual(orbitDomain([0.62, 0.3]), { lo: 0.3, hi: 0.7, step: 0.1 })
  assert.deepEqual(orbitDomain([0.25, 0.2]), { lo: 0.15, hi: 0.25, step: 0.05 })
  assert.deepEqual(orbitDomain([0.04]), { lo: 0, hi: 0.1, step: 0.05 })
  assert.deepEqual(orbitDomain([]), { lo: 0, hi: 0.1, step: 0.05 })
})

test('stronger ties sit closer to the company, every tie inside its own region', () => {
  for (const box of [WIDE_BOX, COMPACT_BOX]) {
    const geometry = orbitGeometry({ zoneId: 'soft', ties: TIES, hidden: 0, zoneOrder: ['soft', 'bio', 'homes'] }, box)
    assert.equal(geometry.nodes.length, TIES.length)
    assert.ok(distance(geometry, 'KO') < distance(geometry, 'NBIX'))
    assert.ok(distance(geometry, 'NBIX') < distance(geometry, 'PHM'))
    assert.deepEqual(geometry.sectors.map((sector) => sector.zoneId), ['soft', 'bio', 'homes'])
    for (const node of geometry.nodes) {
      const sector = geometry.sectors.find((item) => item.zoneId === node.zoneId)
      assert.ok(sector && node.angle > sector.start && node.angle < sector.end, node.symbol)
      const r = Math.hypot(node.x - geometry.centre.x, node.y - geometry.centre.y)
      assert.ok(r > geometry.inner && r < geometry.outer, node.symbol)
      assert.ok(node.x > 0 && node.x < box.width && node.y > 0 && node.y < box.height)
    }
    // The company's own region is centred at the top.
    const own = geometry.sectors[0]
    assert.ok(Math.abs((own.start + own.end) / 2 + Math.PI / 2) < 1e-9)
    assert.equal(geometry.ghosts.length, 0)
  }
})

test('hidden ties share one locked sector, outside the weakest visible tie, placed by count alone', () => {
  const input = { zoneId: 'soft', ties: TIES, hidden: 10, zoneOrder: ['soft', 'bio', 'homes'] }
  const geometry = orbitGeometry(input, WIDE_BOX)
  const locked = geometry.sectors.filter((sector) => sector.zoneId === null)
  assert.equal(locked.length, 1)
  assert.equal(geometry.ghosts.length, 10)
  const weakest = Math.max(...geometry.nodes.map((node) => Math.hypot(node.x - geometry.centre.x, node.y - geometry.centre.y)))
  for (const ghost of geometry.ghosts) {
    assert.ok(Math.hypot(ghost.x - geometry.centre.x, ghost.y - geometry.centre.y) > weakest)
  }
  // The ghosts do not depend on which ties are visible.
  const other = orbitGeometry({ ...input, ties: TIES.map((tie) => ({ ...tie, correlation: tie.correlation + 0.3 })) }, WIDE_BOX)
  const angles = (g: typeof geometry) => g.ghosts.map((ghost) => Math.atan2(ghost.y - g.centre.y, ghost.x - g.centre.x).toFixed(4))
  assert.deepEqual(angles(other), angles(geometry))
})

test('a single region still gets a sector with room for its name', () => {
  const geometry = orbitGeometry({ zoneId: 'soft', ties: [TIES[0]], hidden: 14 }, COMPACT_BOX)
  const own = geometry.sectors.find((sector) => sector.zoneId === 'soft')
  assert.ok(own && own.end - own.start >= 0.42 - 1e-9)
  for (const sector of geometry.sectors) assert.match(sector.path, /^M [\d.-]+ [\d.-]+ A /)
})

test('ties in one region take distinct slots, the strongest in the middle', () => {
  assert.deepEqual(centreOut(1), [0])
  assert.deepEqual(centreOut(2), [0, 1])
  assert.deepEqual(centreOut(5), [2, 3, 1, 4, 0])
  for (let count = 1; count <= 15; count += 1) assert.equal(new Set(centreOut(count)).size, count)
  const geometry = orbitGeometry({ zoneId: 'soft', ties: TIES, hidden: 10 }, COMPACT_BOX)
  const scale = 350 / COMPACT_BOX.width
  for (const [i, a] of geometry.nodes.entries()) {
    for (const b of geometry.nodes.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) * scale > 16, `${a.symbol}/${b.symbol}`)
  }
})
