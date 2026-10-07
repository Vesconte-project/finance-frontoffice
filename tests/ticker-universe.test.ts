import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimUniverseHandoff,
  createUniverse,
  ensureOwnLinks,
  handOffUniverseTo,
  provideUniverse,
  offerUniverseHandoff,
  projectUniverse,
  type ProjectedNode,
  type UniverseHandoff,
} from '../lib/ticker-universe'

function seeded(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

function handoff(ticker: string, createdAt: number): UniverseHandoff {
  return {
    ticker,
    universe: createUniverse(ticker, 1440, 900, seeded(1)),
    view: { ax: 0.2, ay: 0.4, zoom: 4, x: 432, y: 450 },
    lineScale: 4,
    progress: 0,
    orb: { outer: 23.1, ring: 9.2, glow: 63, label: true },
    veil: 0.7,
    focusLinks: 1,
    createdAt,
  }
}

test('a handoff reaches only the ticker it was offered for', () => {
  offerUniverseHandoff(handoff('XOM', 1_000))
  assert.equal(claimUniverseHandoff('AAPL', 1_100), null)
  assert.equal(claimUniverseHandoff('XOM', 1_200), null, 'a mismatched claim discards it')
})

test('a handoff survives a double mount but not a later visit', () => {
  offerUniverseHandoff(handoff('XOM', 1_000))
  assert.ok(claimUniverseHandoff('xom', 1_100))
  assert.ok(claimUniverseHandoff('XOM', 1_400), 'a remount right after the first claim still arrives')
  assert.equal(claimUniverseHandoff('XOM', 5_000), null)
})

test('a stale handoff is ignored', () => {
  offerUniverseHandoff(handoff('XOM', 1_000))
  assert.equal(claimUniverseHandoff('XOM', 60_000), null)
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

test('a search hands over only while the homepage provides its network', () => {
  const asked: string[] = []
  const release = provideUniverse((ticker) => { asked.push(ticker); return handoff(ticker, 10_000) })
  handOffUniverseTo(' jpm ')
  assert.deepEqual(asked, ['JPM'])
  assert.ok(claimUniverseHandoff('JPM', 10_100))
  release()
  handOffUniverseTo('AAPL')
  assert.deepEqual(asked, ['JPM'], 'nothing is asked once the homepage is gone')
  assert.equal(claimUniverseHandoff('AAPL', 10_200), null)
})
