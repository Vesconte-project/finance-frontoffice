import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  PICK_FULL_LIST,
  PICK_VISIBLE_LIMITS,
  cutToTier,
  tierFor,
  type PickTier,
} from '../lib/picks-access-rules'
import { PICK_READING_KEYS, PICK_READING_TO_SLUG } from '../lib/picks-content'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const RANKING = Array.from({ length: PICK_FULL_LIST }, (_, index) => ({
  symbol: `SYM${index + 1}`,
  score: 100 - index,
}))

test('an anonymous viewer receives five rows and no more', () => {
  const cut = cutToTier(RANKING, 'anonymous')

  assert.equal(cut.items.length, 5)
  assert.equal(cut.lockedCount, 20)
  assert.equal(cut.totalRanked, PICK_FULL_LIST)
})

test('the rows above the cut are absent, not merely unrendered', () => {
  // The defect this guards against is returning the full list alongside a count
  // and trusting the view to stop at five. Anything in the returned object reaches
  // the browser, so the sixth symbol must not appear anywhere in it.
  const cut = cutToTier(RANKING, 'anonymous')
  const serialized = JSON.stringify(cut)

  assert.doesNotMatch(serialized, /SYM6(?:"|,)/)
  for (const row of RANKING.slice(5)) {
    assert.equal(
      cut.items.some((item) => item.symbol === row.symbol),
      false,
      `${row.symbol} must not survive the cut`
    )
  }
})

test('signing in unlocks the full list', () => {
  for (const tier of ['free', 'pro'] as PickTier[]) {
    const cut = cutToTier(RANKING, tier)
    assert.equal(cut.items.length, PICK_FULL_LIST)
    assert.equal(cut.lockedCount, 0)
  }
})

test('a short ranking never reports negative locked rows', () => {
  const cut = cutToTier(RANKING.slice(0, 4), 'anonymous')

  assert.equal(cut.items.length, 4)
  assert.equal(cut.lockedCount, 0)
  assert.equal(cut.totalRanked, 4)
})

test('no tier is allowed to see more than the ranking holds', () => {
  for (const [tier, limit] of Object.entries(PICK_VISIBLE_LIMITS)) {
    assert.ok(limit <= PICK_FULL_LIST, `${tier} may not exceed the fetched list`)
    assert.ok(limit > 0, `${tier} must see something`)
  }
  assert.ok(
    PICK_VISIBLE_LIMITS.anonymous < PICK_VISIBLE_LIMITS.free,
    'the gate does nothing if an anonymous viewer sees as much as a member'
  )
})

test('viewer state maps to the intended tier', () => {
  assert.equal(tierFor({ isSignedIn: false, isPro: false }), 'anonymous')
  assert.equal(tierFor({ isSignedIn: true, isPro: false }), 'free')
  assert.equal(tierFor({ isSignedIn: true, isPro: true }), 'pro')
})

test('each reading is a real route, so an unknown path misses the router', () => {
  // Not a [reading] segment. A dynamic segment can only reject an unknown slug
  // during render, and a force-dynamic response has already begun streaming by
  // then — which serves the 404 body under a 200 status. Verified: it did.
  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'app/(app)/picks/[reading]')),
    false,
    'a dynamic segment here reintroduces the soft 404'
  )

  for (const reading of PICK_READING_KEYS) {
    const route = `app/(app)/picks/${PICK_READING_TO_SLUG[reading]}/page.tsx`
    assert.ok(fs.existsSync(path.join(process.cwd(), route)), `${route} must exist`)
  }
})

test('the modules that touch ranking data are server-only', () => {
  // Without this the full ranking could be imported by a Client Component and
  // serialised into the RSC payload, which is exactly the leak the gate prevents.
  for (const file of ['lib/picks.ts', 'lib/picks-access.ts']) {
    assert.match(readRepoFile(file), /^import 'server-only'/, `${file} must be server-only`)
  }
})

test('every picks route is dynamic, so one viewer never gets another viewer cache', () => {
  for (const reading of PICK_READING_KEYS) {
    const source = readRepoFile(`app/(app)/picks/${PICK_READING_TO_SLUG[reading]}/page.tsx`)

    assert.match(source, /export const dynamic = 'force-dynamic'/, `${reading} must be dynamic`)
    assert.doesNotMatch(source, /export const revalidate/, `${reading} must not be revalidated`)
  }
})

test('no client component reaches the gate or the raw ranking', () => {
  const roots = ['components', 'app']
  const offenders: string[] = []

  const walk = (relativeDir: string) => {
    const dir = path.join(process.cwd(), relativeDir)
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name)
      if (entry.isDirectory()) {
        walk(relativePath)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue

      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
      if (!/^['"]use client['"]/m.test(source)) continue
      if (/from '@\/lib\/picks-access'|from '@\/lib\/picks'/.test(source)) {
        offenders.push(relativePath)
      }
    }
  }

  for (const root of roots) walk(root)
  assert.deepEqual(offenders, [])
})
