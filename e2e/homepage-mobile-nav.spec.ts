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

test('mobile nav menu exposes Today and Correlation, and closes on outside click / Escape', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  const toggle = page.getByRole('button', { name: 'Menu' })
  await expect(toggle).toBeVisible()
  await toggle.click()

  const panel = page.getByRole('menu')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('menuitem', { name: 'Today' })).toBeVisible()
  await expect(panel.getByRole('menuitem', { name: 'Correlation' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  await toggle.click()
  await expect(panel).toBeVisible()
  await page.mouse.click(200, 500)
  await expect(panel).toBeHidden()
})

test('mobile nav Correlation link navigates to the network page', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('menuitem', { name: 'Correlation' }).click()
  await expect(page).toHaveURL(/\/markets\/network$/)
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
