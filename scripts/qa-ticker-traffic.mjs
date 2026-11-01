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
const baseline = process.argv.includes('--baseline')
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
  const chartEventRequests = []
  page.on('request', request => { if (request.headers()['next-router-prefetch'] && request.url().includes('/stocks/')) prefetched.push(request.url()) })
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/chart-events')) chartEventRequests.push(Date.now()) })
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
  assert.equal(chartEventRequests.length, 0, 'no chart event BFF request before opening the chart')
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
    if (!baseline) assert.ok(row.count <= ceilings[row.tab], `${row.tab}: request budget`)
    assert.equal(row.calls.filter(path => path.includes('/summary')).length, 1, `${row.tab}: shared summary`)
  }
  for (const row of rows) for (const path of row.calls) if (path.startsWith('/v1/calendar?')) {
    const query = new URL(path, 'http://fixture').searchParams
    const days = (Date.parse(query.get('endDate')) - Date.parse(query.get('startDate'))) / 86400000 + 1
    assert.ok(days > 0 && days <= 63, 'calendar range stays within backend contract')
  }
  const completeVisit = rows.filter(row => row.phase.startsWith('browser') || row.phase === 'open-expanded-chart').reduce((sum, row) => sum + row.count, 0)
  let chartEventChecks = null
  if (!baseline) {
    assert.ok(completeVisit <= 25, 'complete browser visit request budget')
    assert.deepEqual(prefetched, [], 'no speculative ticker page requests')
    assert.equal(chartEventRequests.length, 1, 'opening chart makes one successful event read')
    // These refusal probes run after the measured itinerary; their technical
    // overlay reads are deliberately excluded from visit counts.
    if (await page.getByRole('dialog').count()) {
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    const retries = []
    await page.route('**/api/stocks/QAS/chart-events', async route => {
      retries.push(Date.now())
      await route.fulfill({ status: retries.length === 1 ? 429 : 200,
        headers: { 'Retry-After': '2', 'Content-Type': 'application/json' }, body: '[]' })
    })
    const refused = page.waitForResponse(response => response.url().endsWith('/chart-events') && response.status() === 429)
    const recovered = page.waitForResponse(response => response.url().endsWith('/chart-events') && response.status() === 200, { timeout: 6000 })
    await expand.click()
    await refused
    await page.waitForTimeout(250)
    assert.equal(retries.length, 1, 'no immediate retry after 429')
    await recovered
    assert.equal(retries.length, 2, 'one paused retry recovers chart events')
    assert.ok(retries[1] - retries[0] >= 2000, 'chart events respects Retry-After')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.unroute('**/api/stocks/QAS/chart-events')
    const cancelled = []
    await page.route('**/api/stocks/QAS/chart-events', async route => {
      cancelled.push(Date.now())
      await route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, body: '[]' })
    })
    const cancelRefusal = page.waitForResponse(response => response.url().endsWith('/chart-events') && response.status() === 429)
    await expand.click()
    await cancelRefusal
    await page.waitForTimeout(250)
    assert.equal(cancelled.length, 1)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.waitForTimeout(3400)
    assert.equal(cancelled.length, 1, 'closing the chart cancels its paused retry')
    chartEventChecks = { successfulReadAttempts: 1, recoveryAttempts: retries.length,
      recoveryPauseMs: retries[1] - retries[0], closeDuringBackoffAttempts: cancelled.length }
    await backendCalls()
  }
  assert.deepEqual(errors, [], 'no browser runtime errors')
  console.log(JSON.stringify({ baseline, completeVisit, chartEventChecks, prefetchRequests: prefetched.length,
    fixture: 'real ticker routes/components, synthetic anonymous backend, isolated shell without Clerk or Google Fonts', rows }, null, 2))
} finally {
  await browser?.close()
  for (const server of servers.reverse()) { if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit') } }
}
