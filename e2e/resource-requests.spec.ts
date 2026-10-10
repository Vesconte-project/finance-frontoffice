import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

test('ticker events does not prefetch days or adjacent tabs before navigation', async ({ page }) => {
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
  await page.goto('/stocks/QAM/events?month=2026-10')
  await expect(page.locator('[data-events-research]')).toBeVisible()
  const calendar = page.locator('[aria-label="Event calendar"]')
  await calendar.scrollIntoViewIfNeeded()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  mkdirSync('test-results/resource-audit', { recursive: true })
  writeFileSync('test-results/resource-audit/requests.json', JSON.stringify(requests, null, 2))
  console.log('RESOURCE_MEASUREMENT ' + JSON.stringify({ total: requests.length, prefetch: requests.filter(r => r.prefetch).length }))
  expect(requests.filter(r => r.prefetch)).toEqual([])

  const day = calendar.locator('a[href*="day=2026-10-15"]').first()
  await day.hover()
  await page.waitForTimeout(500)
  expect(requests.filter(r => r.prefetch)).toEqual([])
  await day.click()
  await expect(page).toHaveURL(/day=2026-10-15/)
  await expect(calendar.locator('a[data-selected="true"]')).toHaveAttribute('href', /day=2026-10-15/)
})
