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
  // they open the same menu panel, laid out as a vertical list.
  await expect(page.locator('.site-header__bar nav button')).toHaveText(['Today', 'Correlation'])
  await expect(page.locator('.site-header__bar nav a')).toHaveCount(0)
})

test('mobile Correlation opens the shared menu panel as a vertical list', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/faq', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  const trigger = page.getByRole('button', { name: 'Correlation', exact: true })
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page).toHaveURL(/\/faq$/)

  const panel = page.locator('#site-header-menu')
  await expect(panel.locator('.site-header__tile--text')).toContainText('Correlation')
  const tiles = panel.locator('a.site-header__tile')
  await expect(tiles).toHaveText(['Network', 'Pairs', 'Sectors', 'Signals'])

  // One column: every row starts at the same x and stacks downwards.
  const boxes = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, height: rect.height }
    })
  )
  for (let index = 1; index < boxes.length; index++) {
    expect(Math.abs(boxes[index].left - boxes[0].left)).toBeLessThanOrEqual(1)
    expect(boxes[index].top).toBeGreaterThan(boxes[index - 1].top)
  }
  for (const box of boxes) {
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.right).toBeLessThanOrEqual(390)
  }

  // The page underneath is locked and the docked search row stands down.
  // Lenis clips the root when the runtime lock stops it; native mode hides it.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toMatch(/^(hidden|clip)$/)
  await expect(page.locator('.site-header__inner > .mt-3')).toBeHidden()

  await tiles.filter({ hasText: 'Network' }).click()
  // The first visit compiles the route under `next dev`.
  await expect(page).toHaveURL(/\/markets\/network$/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Correlation', exact: true })).toHaveAttribute('aria-expanded', 'false')
})

test('mobile menu panel closes on an outside tap and on Escape', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/faq', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  const today = page.getByRole('button', { name: 'Today', exact: true })
  await today.click()
  await expect(today).toHaveAttribute('aria-expanded', 'true')
  await page.touchscreen.tap(195, 800)
  await expect(today).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toMatch(/^(hidden|clip)$/)

  await today.click()
  await expect(today).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(today).toHaveAttribute('aria-expanded', 'false')
})

test('keyboard opening moves focus into the menu and Escape returns it', async ({ page }) => {
  await stubBackends(page)
  await page.goto('/faq', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  const today = page.getByRole('button', { name: 'Today', exact: true })
  await today.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#site-header-menu').getByRole('link', { name: 'View' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(today).toBeFocused()
})

test('opening hero search results on mobile clears the title and leaves room for suggestions', async ({ page }, testInfo) => {
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
  await expect(page.locator('.dock-search__intro')).toHaveCSS('opacity', '0')
  await expect(page.locator('[data-dock-search] .ticker-search__scroll')).toBeVisible()

  await page.screenshot({ path: testInfo.outputPath('homepage-mobile-search-open.png') })
})

test('homepage suggestions fit above a simulated mobile keyboard', async ({ page }, testInfo) => {
  await stubBackends(page)
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  const field = page.locator('[data-dock-search] input')
  await field.click()
  await field.fill('a')
  await expect(page.locator('[data-dock-search] .ticker-search__scroll')).toBeVisible()
  await expect(page.locator('.dock-search__intro')).toHaveCSS('opacity', '0')

  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) throw new Error('visualViewport is unavailable')
    Object.defineProperty(viewport, 'height', { configurable: true, value: 480 })
    viewport.dispatchEvent(new Event('resize'))
  })

  await expect.poll(async () => {
    const bounds = await page.locator('[data-dock-search] .ticker-search__scroll').boundingBox()
    return bounds ? bounds.y + bounds.height : Number.POSITIVE_INFINITY
  }).toBeLessThanOrEqual(480)

  await page.screenshot({ path: testInfo.outputPath('homepage-mobile-search-keyboard-simulated.png') })
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
