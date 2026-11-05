import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

test('ticker events does not prefetch adjacent tabs, and choosing an event stays on the page', async ({ page }) => {
  const requests: { path: string; prefetch: boolean; rsc: boolean }[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/stocks/')) return
    // Record only public calendar filters; never persist Clerk handshakes or tokens.
    const filters = new URLSearchParams()
    for (const key of ['month', 'day', 'type']) {
      const value = url.searchParams.get(key)
      if (value) filters.set(key, value)
    }
    requests.push({
      path: url.pathname + (filters.size ? `?${filters}` : ''),
      prefetch: Boolean(request.headers()['next-router-prefetch']),
      rsc: request.headers().rsc === '1',
    })
  })
  await page.goto('/stocks/QAM/events')
  await expect(page.locator('[data-events-research]')).toBeVisible()
  const timeline = page.locator('[data-event-timeline], #timeline').first()
  await timeline.scrollIntoViewIfNeeded()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  mkdirSync('test-results/resource-audit', { recursive: true })
  writeFileSync('test-results/resource-audit/requests.json', JSON.stringify(requests, null, 2))
  console.log('RESOURCE_MEASUREMENT ' + JSON.stringify({ total: requests.length, prefetch: requests.filter(r => r.prefetch).length }))
  expect(requests.filter(r => r.prefetch)).toEqual([])

  // Choosing an event on the timeline reads it in place: no navigation and no new page request.
  const marker = page.locator('[data-event-timeline] [data-chart-variant="wide"] button').first()
  if (await marker.count()) {
    const before = requests.length
    await marker.hover()
    await marker.click()
    await expect(page.locator('[data-timeline-reading]')).toBeVisible()
    await page.waitForTimeout(500)
    expect(requests.length).toBe(before)
    await expect(page).toHaveURL(/\/stocks\/QAM\/events$/)
  }
})
