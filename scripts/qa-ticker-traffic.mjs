import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = `${root}tests/fixtures/ticker-traffic`
const next = `${root}node_modules/next/dist/bin/next`
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_BASE_URL: 'http://127.0.0.1:3101' }
for (const name of ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'VERCEL', 'BFF_IP_PROOF_KEY', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) delete env[name]
const servers = []
let browser
async function ready(url) {
  for (let i = 0; i < 200; i++) { try { const r = await fetch(url); if (r.ok) { await r.text(); return } } catch {} await pause(100) }
  throw Error(`server not ready: ${url}`)
}
const backendCalls = async () => (await fetch('http://127.0.0.1:3101/__qa/calls')).json()
const rows = []
try {
  servers.push(spawn(process.execPath, [`${root}scripts/qa-ticker-backend.mjs`], { env, stdio: 'inherit' }))
  await ready('http://127.0.0.1:3101/health')
  const build = spawn(process.execPath, [next, 'build', fixture], { env, stdio: 'inherit' })
  const [code] = await once(build, 'exit'); assert.equal(code, 0)
  servers.push(spawn(process.execPath, [next, 'start', fixture, '--port', '3100'], { env, stdio: 'inherit' }))
  await ready('http://localhost:3100/stocks/QAS')
  await backendCalls()
  for (const tab of ['', 'events', 'ownership', 'relationships', 'signals', 'financials']) {
    const url = `http://localhost:3100/stocks/QAS${tab ? '/'+tab : ''}`
    const response = await fetch(url); await response.text(); assert.equal(response.status, 200)
    const calls = await backendCalls(); rows.push({ tab: tab || 'overview', phase: 'SSR', count: calls.length, calls })
  }
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const prefetched = []
  page.on('request', request => { if (request.headers()['next-router-prefetch'] && request.url().includes('/stocks/')) prefetched.push(request.url()) })
  page.setDefaultTimeout(15000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://localhost:3100/stocks/QAS', { waitUntil: 'networkidle' })
  await pause(500)
  if (process.env.QA_SCREENSHOTS) {
    await mkdir(process.env.QA_SCREENSHOTS, { recursive: true })
    await page.screenshot({ path: `${process.env.QA_SCREENSHOTS}/desktop.png` })
  }
  const initial = await backendCalls(); rows.push({ tab: 'overview', phase: 'browser-full-load', count: initial.length, calls: initial })
  for (const tab of ['events', 'ownership', 'relationships', 'signals', 'financials']) {
    const link = page.locator(`[data-stock-research-nav] a[href="/stocks/QAS/${tab}"]`)
    assert.equal(await link.count(), 1, tab)
    await link.click(); await page.waitForURL(`**/stocks/QAS/${tab}`); await page.waitForTimeout(1000)
    const calls = await backendCalls(); rows.push({ tab, phase: 'browser-tab-navigation', count: calls.length, calls })
  }
  await page.goto('http://localhost:3100/stocks/QAS', { waitUntil: 'networkidle' })
  const returned = await backendCalls(); rows.push({ tab: 'overview', phase: 'browser-return-to-overview', count: returned.length, calls: returned })
  const expand = page.getByRole('button', { name: 'Expand chart', exact: true })
  if (await expand.count()) {
    await expand.click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(1000)
    const calls = await backendCalls(); rows.push({ tab: 'overview', phase: 'open-expanded-chart', count: calls.length, calls })
  }
  if (process.env.QA_SCREENSHOTS) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3100/stocks/QAS', { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${process.env.QA_SCREENSHOTS}/mobile.png` })
    await backendCalls() // separate responsive check, outside the measured itinerary
  }
  const ceilings = { overview: 5, events: 4, ownership: 4, relationships: 2, signals: 1, financials: 2 }
  for (const row of rows.filter(row => row.phase === 'SSR')) {
    assert.ok(row.count <= ceilings[row.tab], `${row.tab}: request budget`)
    assert.equal(row.calls.filter(path => path.includes('/summary')).length, 1, `${row.tab}: shared summary`)
  }
  for (const row of rows) for (const path of row.calls) if (path.startsWith('/v1/calendar?')) {
    const query = new URL(path, 'http://fixture').searchParams
    const days = (Date.parse(query.get('endDate')) - Date.parse(query.get('startDate'))) / 86400000 + 1
    assert.ok(days > 0 && days <= 63, 'calendar range stays within backend contract')
  }
  const completeVisit = rows.filter(row => row.phase.startsWith('browser') || row.phase === 'open-expanded-chart').reduce((sum, row) => sum + row.count, 0)
  assert.ok(completeVisit <= 25, 'complete browser visit request budget')
  assert.deepEqual(errors, [], 'no browser runtime errors')
  assert.deepEqual(prefetched, [], 'no speculative ticker page requests')
  console.log(JSON.stringify({ prefetchRequests: prefetched.length, fixture: 'real ticker routes/components, synthetic anonymous backend, isolated shell without Clerk or Google Fonts', rows }, null, 2))
} finally {
  await browser?.close()
  for (const server of servers.reverse()) { if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit') } }
}
