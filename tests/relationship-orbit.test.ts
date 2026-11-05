import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPACT_BOX, ORBIT_RINGS, WIDE_BOX, centreOut, orbitGeometry, orbitReach, orbitStrength, type OrbitTie } from '../lib/relationship-orbit'

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

test('distance and strength follow one fixed scale, so weak ties always read as weak', () => {
  assert.equal(orbitReach(1), 0)
  assert.equal(orbitReach(0), 1)
  assert.equal(orbitReach(-0.2), 1)
  assert.equal(orbitReach(Number.NaN), 1)
  // The square root keeps weak ties apart: 0.15 and 0.25 differ by more than a tenth of the band.
  assert.ok(orbitReach(0.15) - orbitReach(0.25) > 0.1)
  assert.equal(orbitStrength(0.6), 1)
  assert.equal(orbitStrength(0.3), 0.5)
  assert.deepEqual([...ORBIT_RINGS], [0.5, 0.25, 0.1])
})

test('a company whose ties are all weak draws them far out, not next to it', () => {
  const weak = TIES.map((tie) => ({ ...tie, correlation: tie.correlation / 2 }))
  const strong = orbitGeometry({ zoneId: 'soft', ties: TIES, hidden: 0 }, WIDE_BOX)
  const faint = orbitGeometry({ zoneId: 'soft', ties: weak, hidden: 0 }, WIDE_BOX)
  for (const tie of TIES) assert.ok(distance(faint, tie.symbol) > distance(strong, tie.symbol), tie.symbol)
  // The same correlation sits at the same distance whatever the company's other ties are.
  const alone = orbitGeometry({ zoneId: 'soft', ties: [TIES[2]], hidden: 0 }, WIDE_BOX)
  assert.ok(Math.abs(distance(alone, 'NBIX') - distance(strong, 'NBIX')) < 0.2)
  // Rings are fixed and never stack: each further out than the last.
  const radii = strong.rings.map((ring) => ring.radius)
  assert.deepEqual(strong.rings.map((ring) => ring.value), [0.5, 0.25, 0.1])
  assert.ok(radii[0] < radii[1] && radii[1] < radii[2])
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
  // Their directions do not depend on the visible ties' regions or values; only how far out they start.
  const other = orbitGeometry({ ...input, ties: TIES.map((tie) => ({ ...tie, correlation: tie.correlation + 0.3 })) }, WIDE_BOX)
  const angles = (g: typeof geometry) => g.ghosts.map((ghost) => Math.atan2(ghost.y - g.centre.y, ghost.x - g.centre.x))
  angles(other).forEach((angle, index) => assert.ok(Math.abs(angle - angles(geometry)[index]) < 1e-3))
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
