import assert from 'node:assert/strict'
import test from 'node:test'
import { crawlRules, publicSitemap, AI_ROBOTS } from '../lib/crawl-policy'

// Evaluate REP longest-match precedence independently of the policy's route list.
function allowed(path: string, agent = '*'): boolean {
  const rules = crawlRules()
  assert.ok(Array.isArray(rules))
  const matching = rules.filter(rule => [rule.userAgent].flat().some(token => token.toLowerCase() === agent.toLowerCase()))
  const groups = matching.length ? matching : rules.filter(rule => rule.userAgent === '*')
  const candidates = groups.flatMap(rule => (['allow', 'disallow'] as const).flatMap(kind =>
    [rule[kind] ?? []].flat().filter(Boolean).flatMap(pattern => {
      const expression = pattern.split('*').map(part => part.replace(/[.+?^{}()|[\]\\]/g, '\\$&')).join('.*')
      return new RegExp(`^${expression}`).test(path) ? [{ length: pattern.replace(/[*$]/g, '').length, allow: kind === 'allow' }] : []
    })))
  candidates.sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow))
  return candidates[0]?.allow ?? true
}

test('search engines can crawl every sitemap URL, and rendering assets', () => {
  for (const entry of publicSitemap('https://www.vesconte.com', ['AAPL', 'BRK.B', '^GSPC'])) {
    for (const agent of ['Googlebot', 'bingbot']) assert.equal(allowed(new URL(entry.url).pathname, agent), true, entry.url)
  }
  for (const path of ['/_next/static/chunks/app.js', '/marketing/hero-background-dark.png']) assert.equal(allowed(path), true)
})

test('APIs, personal routes, placeholders, all ticker subpages and filters are excluded', () => {
  for (const path of ['/api', '/api/tickers/index', '/dashboard', '/dashboard/watchlist', '/sign-in', '/sign-up',
    '/community', '/models/new', '/calendar?month=2026-10', '/stocks/AAPL?month=2026-10',
    ...['events', 'ownership', 'relationships', 'signals', 'financials', 'profile', 'financials/income-statement'].map(tab => `/stocks/AAPL/${tab}`)]) {
    assert.equal(allowed(path, 'Googlebot'), false, path)
  }
})

test('AI product tokens refuse every page, including Google-Extended', () => {
  assert.ok(AI_ROBOTS.includes('Google-Extended'))
  for (const agent of AI_ROBOTS) for (const path of ['/', '/product', '/stocks/AAPL', '/api/tickers/index']) {
    assert.equal(allowed(path, agent), false, `${agent}: ${path}`)
  }
  for (const rule of [crawlRules()].flat()) assert.equal('crawlDelay' in rule, false)
})

test('sitemap deduplicates tickers, rejects paths, and invents no modification dates', () => {
  const entries = publicSitemap('https://www.vesconte.com', ['aapl', ' AAPL ', '../events', '.', '..', 'BAD/NAME', '', 'BRK.B', '^GSPC'])
  assert.equal(entries.filter(entry => entry.url.endsWith('/stocks/AAPL')).length, 1)
  assert.equal(entries.filter(entry => entry.url.includes('/stocks/')).length, 3)
  assert.ok(entries.some(entry => entry.url.endsWith('/stocks/%5EGSPC')))
  for (const entry of entries) {
    assert.equal(entry.lastModified, undefined)
    assert.equal(allowed(new URL(entry.url).pathname), true)
    assert.equal(entry.url.includes('/community'), false)
  }
})
