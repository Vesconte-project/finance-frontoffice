import { expect, test } from '@playwright/test'

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
