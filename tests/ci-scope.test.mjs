import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyChanges } from '../scripts/ci-scope.mjs'

test('robots/sitemap and unit-test-list edits require verify/build without UI browsing', () => {
  assert.deepEqual(classifyChanges(['app/robots.ts', 'app/sitemap.ts', 'lib/crawl-policy.ts', 'tests/crawl-policy.test.ts', 'docs/eng196-crawlers.md', 'package.json'],
    { dependencies: { next: '16' }, scripts: { test: 'old', build: 'next build' } },
    { dependencies: { next: '16' }, scripts: { test: 'new', build: 'next build' } }),
  { verify: true, build: true, browser: false })
})

test('mixing metadata with any UI path retains complete candidate QA', () => {
  for (const file of ['app/layout.tsx', 'app/(app)/stocks/[ticker]/page.tsx', 'components/Header.tsx', 'hooks/use-x.ts', 'public/hero.png', 'e2e/fixtures/ticker.mjs']) {
    assert.deepEqual(classifyChanges(['app/robots.ts', file]), { verify: true, build: true, browser: true }, file)
  }
})

test('dependency, build and harness changes cannot escape browser QA', () => {
  for (const file of ['package-lock.json', 'next.config.ts', 'playwright.config.ts', 'proxy.ts', 'vercel.json',
    'scripts/ci-scope.mjs', 'scripts/e2e-backend-stub.mjs', 'scripts/check-browser-qa.mjs',
    '.github/workflows/frontend-qa.yml', '.github/workflows/ci.yml']) {
    assert.equal(classifyChanges([file]).browser, true, file)
  }
  for (const next of [{ dependencies: { next: '17' } }, { scripts: { build: 'different' } }, { scripts: { 'qa:browser': 'different' } }]) {
    assert.equal(classifyChanges(['package.json'], {}, next).browser, true)
  }
  assert.equal(classifyChanges(['package.json'], undefined, {}).browser, true)
  assert.equal(classifyChanges(['package.json'], {}, undefined).browser, true)
})

test('non-visual code keeps verification and documentation needs no runtime check', () => {
  assert.deepEqual(classifyChanges(['lib/retry-policy.ts', 'tests/retry.test.ts']), { verify: true, build: false, browser: false })
  assert.deepEqual(classifyChanges(['README.md', 'docs/qa/browser-qa.md']), { verify: false, build: false, browser: false })
})
