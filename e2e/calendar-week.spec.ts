import { expect, test, type Page } from '@playwright/test'

/**
 * The public calendar: this week for everyone, other weeks and the month view with
 * an account. Runs anonymously against the synthetic calendar served by the fixture
 * backend (e2e/fixtures/calendar.mjs). The lock is checked in the bytes sent to the
 * browser, not only on screen.
 */

const STOCK_EVENT_LINK = /\/stocks\/[A-Za-z0-9.%-]+\/events/g

function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

function monday(offsetWeeks = 0): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + offsetWeeks * 7)
  return date.toISOString().slice(0, 10)
}

for (const width of [375, 1440]) {
  test(`this week is open to a signed-out reader at ${width}px`, async ({ page }) => {
    const errors = watchConsole(page)
    await page.setViewportSize({ width, height: 900 })
    const response = await page.goto('/calendar')
    expect(response?.status()).toBe(200)

    const calendar = page.getByRole('region', { name: 'Event calendar' })
    // The page opens on the week itself, with no introductory copy above it.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^This week · [A-Z][a-z]{2} \d{1,2} – .+ · \d+ events$/)
    // Every earnings group says what it counts, and the long day opens in place.
    await expect(calendar.getByRole('heading', { name: /^Earnings \d+$/ }).first()).toBeVisible()
    const showAll = calendar.locator('summary', { hasText: /^Show all \d+ earnings$/ })
    await expect(showAll).toBeVisible()
    await showAll.click()
    await expect(showAll.locator('xpath=..').locator('a').first()).toBeVisible()
    // Tiles carry the company name from the ticker index.
    await expect(calendar.locator('a[href^="/stocks/"]').first()).toHaveAttribute('aria-label', /^[A-Z0-9.]+, .+: Earnings/)
    await expect(calendar.getByText('Other weeks and the month view open with a free account.')).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // The stage clips sideways, so also check that nothing is cut off by it.
    const rightmost = await calendar.evaluate((node) => Math.max(...[...node.querySelectorAll('*')].map((child) => child.getBoundingClientRect().right)))
    expect(rightmost).toBeLessThanOrEqual(width)
    if (process.env.PLAYWRIGHT_CAPTURE) {
      // A screenshot hides the caret with an inline style; taken before hydration it reads as a mismatch.
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `test-results/calendar-week-${width}.png`, fullPage: true })
    }
    expect(errors).toEqual([])
  })
}

test('another week is locked and carries no events', async ({ page, request }) => {
  const errors = watchConsole(page)
  const path = `/calendar?week=${monday(1)}`
  const body = await (await request.get(path)).text()
  expect(body.match(STOCK_EVENT_LINK) ?? []).toEqual([])

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Every week, every month' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create free account' })).toHaveAttribute('href', /^\/sign-up\?redirect_url=/)
  if (process.env.PLAYWRIGHT_CAPTURE) {
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/calendar-locked-1440.png', fullPage: true })
  }
  await page.getByRole('link', { name: 'Back to this week' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^This week · /)
  expect(errors).toEqual([])
})

test('the month view is locked for a signed-out reader', async ({ request }) => {
  for (const path of ['/calendar?view=month', '/calendar/earnings?view=month&month=2026-11']) {
    const body = await (await request.get(path)).text()
    expect(body).toContain('Every week, every month')
    expect(body.match(STOCK_EVENT_LINK) ?? []).toEqual([])
  }
})
