import { expect, test } from '@playwright/test'

test('home and internal pages align the header brand at rest', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('hero-reveal-ready'))).toBe(true)
  await page.waitForTimeout(1500)
  const homeY = await page.locator('.site-header__brand').evaluate((brand) => {
    const rect = brand.getBoundingClientRect()
    return rect.top + rect.height / 2
  })

  await page.goto('/faq')
  const internalY = await page.locator('.site-header__brand').evaluate((brand) => {
    const rect = brand.getBoundingClientRect()
    return rect.top + rect.height / 2
  })
  expect(Math.abs(homeY - internalY)).toBeLessThanOrEqual(1)
})

for (const route of ['/', '/stocks/NFLX/financials', '/markets/network']) {
  test(`shared header menu on ${route}`, async ({ page }) => {
    test.skip(route.startsWith('/stocks/') && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      'Ticker browser QA needs the dedicated Development Clerk key to avoid keyless redirects.')
    await page.goto(route)
    const header = page.locator('.site-header')
    await expect(header).toHaveCount(1)
    await expect(header).toHaveAttribute('data-active-href', route)

    const today = header.getByRole('button', { name: 'Today' })
    await today.click()
    await expect(today).toHaveAttribute('aria-expanded', 'true')
    await expect(header.locator('.site-header__tile--text')).toContainText('Today')

  })
}

for (const width of [820, 1920]) {
  test(`shared header menu fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.locator('.site-header').getByRole('button', { name: 'Correlation' }).click()
    const grid = page.locator('.site-header__dropgrid')
    await expect(grid).toBeVisible()
    const fits = await grid.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return rect.left >= 0 && rect.right <= window.innerWidth
    })
    expect(fits).toBe(true)
  })
}

for (const width of [768, 820, 1024]) {
  test(`internal header bar fits ${width}px without clipping (PRD-70)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/faq')
    const header = page.locator('.site-header')
    await expect(header.getByRole('button', { name: 'Correlation' })).toBeVisible()
    const fit = await page.evaluate(() => {
      const bar = document.querySelector('.site-header__bar')!.getBoundingClientRect()
      const parts = {
        brand: '.site-header__brand',
        search: '[data-header-search]',
      }
      const buttons = Array.from(document.querySelectorAll('.site-header__cluster nav button'))
      const nodes: Record<string, Element | null | undefined> = {
        brand: document.querySelector(parts.brand),
        search: document.querySelector(parts.search),
        today: buttons[0],
        correlation: buttons[buttons.length - 1],
        account: document.querySelector('.site-header__cluster')?.lastElementChild,
      }
      const rects = Object.fromEntries(Object.entries(nodes).map(([name, node]) => {
        const rect = node?.getBoundingClientRect()
        return [name, rect ? { left: rect.left, right: rect.right, width: rect.width } : null]
      }))
      return { rects, barRight: bar.right, viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }
    })
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.viewport)
    for (const [name, rect] of Object.entries(fit.rects)) {
      expect(rect, `${name} is rendered`).not.toBeNull()
      expect(rect!.left, `${name} starts inside the screen`).toBeGreaterThanOrEqual(0)
      expect(rect!.right, `${name} ends inside the screen`).toBeLessThanOrEqual(fit.viewport)
    }
    expect(fit.rects.search!.width, 'search keeps a usable width').toBeGreaterThanOrEqual(160)
    expect(fit.rects.search!.right, 'search does not overlap the nav').toBeLessThanOrEqual(fit.rects.today!.left)
  })
}

