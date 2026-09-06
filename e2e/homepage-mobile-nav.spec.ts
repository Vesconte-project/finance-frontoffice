import { expect, test } from '@playwright/test'

const mobileContext = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
} as const

async function stubBackends(page: import('@playwright/test').Page) {
  await page.route('**/api/tickers/index', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { symbol: 'AAPL', name: 'Apple Inc.' },
          { symbol: 'MSFT', name: 'Microsoft Corporation' },
          { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        ],
      }),
    })
  )
  await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 204 }))
}

test.use(mobileContext)

test('mobile hero sits within the visible viewport, not pushed far below the fold', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  // Regression guard: this used to land at ~300px on an 844px-tall viewport
  // (top: clamp(210px, 44vh, 370px) minus the dock offset), eating most of a
  // real device's visible height once browser chrome is accounted for.
  await expect.poll(() => page.locator('.dock-search').evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(260)
  const dockTop = await page.locator('.dock-search').evaluate((el) => el.getBoundingClientRect().top)
  expect(dockTop).toBeGreaterThan(0)
})

test('mobile search is reachable again after scrolling the homepage', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)

  await page.mouse.wheel(0, 400)
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('chrome-scrolled'))).toBe(true)

  const mobileSearchInput = page.locator('.site-header__inner > .mt-3 input')
  await expect(mobileSearchInput).toBeVisible()
  const box = await mobileSearchInput.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(0)
})

test('mobile header exposes the same Today and Correlation triggers as desktop, no toggle/menu icon', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  // Same buttons as desktop (not a separate mobile-only element) — below md
  // they just navigate directly instead of opening the tile mega-menu.
  await expect(page.locator('.site-header__bar nav button')).toHaveText(['Today', 'Correlation'])
  await expect(page.locator('.site-header__bar nav a')).toHaveCount(0)
})

test('mobile Correlation trigger navigates directly to the network page', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  await page.getByRole('button', { name: 'Correlation', exact: true }).click()
  await expect(page).toHaveURL(/\/markets\/network$/)
})

test('opening hero search results on mobile lifts the field toward the top, clearing room below it', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)

  const field = page.locator('[data-dock-search] input')
  const before = await field.boundingBox()
  expect(before?.y ?? 0).toBeGreaterThan(150)

  await field.click()
  await field.fill('a')
  await expect(page.locator('[data-dock-search] .ticker-search__root')).toHaveAttribute('data-open', 'true')
  await expect.poll(() => field.boundingBox().then((box) => box?.y ?? 9999)).toBeLessThan(130)
})

test('suggestion panel shrinks to fit the visible viewport instead of overflowing it', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/faq', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  const input = page.locator('.site-header__inner > .mt-3 input')
  await input.click()
  await input.fill('a')
  await expect.poll(() => page.locator('.site-header__inner > .mt-3 .ticker-search__scroll').isVisible()).toBe(true)

  // Simulate the on-screen keyboard: visualViewport shrinks, window.innerHeight does not.
  await page.evaluate(() => {
    const vv = window.visualViewport
    if (!vv) return
    Object.defineProperty(vv, 'height', { configurable: true, value: 300 })
    vv.dispatchEvent(new Event('resize'))
  })
  await page.waitForTimeout(150)

  const panelHeight = await page.locator('.site-header__inner > .mt-3 .ticker-search__scroll').evaluate((el) => el.getBoundingClientRect().height)
  expect(panelHeight).toBeLessThan(300)
})
