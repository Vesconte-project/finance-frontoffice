import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createUniverse,
  ensureOwnLinks,
  projectUniverse,
  type ProjectedNode,
} from '../lib/ticker-universe'
import { flyToTicker, planCamera, provideUniverse, REST_ZOOM } from '../lib/universe-flight'

function seeded(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

test('arriving from the homepage, the camera turns a short way towards its rest', () => {
  const universe = createUniverse('XOM', 1440, 900, seeded(2))
  const fn = universe.nodes[universe.focus]
  const facing = Math.atan2(fn.z, -fn.x)
  for (const ay of [facing, facing + 0.1, facing - 2, facing + 3, facing + 9]) {
    const plan = planCamera(universe, { ax: 0.3, ay, zoom: 4, x: 400, y: 450 })
    const turn = Math.abs(plan.end.ay - plan.start.ay)
    assert.ok(turn >= 0.25 - 1e-9 && turn <= 0.7 + 1e-9, 'turn ' + turn)
    assert.equal(plan.start.zoom, 4)
    assert.equal(plan.end.zoom, REST_ZOOM)
  }
})

test('without a flight the camera rests facing the universe from the node', () => {
  const universe = createUniverse('XOM', 1440, 900, seeded(4))
  const plan = planCamera(universe, null)
  assert.deepEqual(plan.start, plan.end)
  const out: ProjectedNode[] = []
  projectUniverse(universe, { ...plan.end, x: 0, y: 0 }, out)
  // The node is on the universe's left: most of the world projects to its right.
  const right = out.filter((p, i) => i !== universe.focus && p.sx > 0).length
  assert.ok(right > out.length * 0.6, right + ' of ' + out.length)
})

test('a built universe centres on the ticker and gives it links of its own', () => {
  const universe = createUniverse('NVDA', 1440, 900, seeded(7))
  assert.equal(universe.nodes[universe.focus].label, 'NVDA')
  assert.equal(universe.nodes.filter((n) => n.label === 'NVDA').length, 1)
  let own = 0
  for (let k = 0; k < universe.pairs.length; k += 2) if (universe.pairs[k] === universe.focus || universe.pairs[k + 1] === universe.focus) own++
  assert.ok(own >= 4)
  assert.equal(universe.pairLengths.length, universe.pairs.length / 2)
  assert.ok(universe.nodes.some((n) => n.signal && n.light === 1))
})

test('projection pins the focused node where the view puts it', () => {
  const universe = createUniverse('XOM', 1440, 900, seeded(3))
  const out: ProjectedNode[] = []
  for (const view of [{ ax: 0.1, ay: 0, zoom: 1, x: 56, y: 172 }, { ax: -0.3, ay: 2.4, zoom: 4, x: 432, y: 450 }]) {
    projectUniverse(universe, view, out)
    assert.ok(Math.abs(out[universe.focus].sx - view.x) < 1e-9)
    assert.ok(Math.abs(out[universe.focus].sy - view.y) < 1e-9)
  }
})

test('a focused node with too few links gains links to its nearest nodes', () => {
  const universe = createUniverse('XOM', 1440, 900, seeded(5))
  const own = () => { let n = 0; for (let k = 0; k < universe.pairs.length; k += 2) if (universe.pairs[k] === universe.focus || universe.pairs[k + 1] === universe.focus) n++; return n }
  // Strip the node's links, as a homepage draw sometimes leaves it.
  const kept: number[] = [], lengths: number[] = []
  for (let k = 0; k < universe.pairs.length; k += 2) {
    if (universe.pairs[k] === universe.focus || universe.pairs[k + 1] === universe.focus) continue
    kept.push(universe.pairs[k], universe.pairs[k + 1]); lengths.push(universe.pairLengths[k / 2])
  }
  universe.pairs = kept; universe.pairLengths = lengths
  const before = kept.length
  const from = ensureOwnLinks(universe)
  assert.equal(from, before)
  assert.equal(own(), 3)
  assert.equal(universe.pairLengths.length, universe.pairs.length / 2)
  assert.equal(ensureOwnLinks(universe), universe.pairs.length, 'nothing more to add')
})

test('a search asks the homepage for its network only while it is mounted', () => {
  const asked: string[] = []
  const release = provideUniverse((ticker) => { asked.push(ticker); return null })
  flyToTicker(' jpm ')
  assert.deepEqual(asked, ['JPM'])
  release()
  flyToTicker('AAPL')
  assert.deepEqual(asked, ['JPM'], 'nothing is asked once the homepage is gone')
})
