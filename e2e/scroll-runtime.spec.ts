import { expect, test, type Page } from '@playwright/test'

async function expectRuntime(page: Page, profile: 'standard' | 'operational', mode = 'smooth') {
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-scroll-runtime', mode)
  await expect(root).toHaveAttribute('data-scroll-profile', profile)
}

test('standard pages share the weighted document scroll and firm boundaries', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/product', { waitUntil: 'load' })

  await expectRuntime(page, 'standard')
  await expect(page.locator('html')).toHaveClass(/lenis/)
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY))
    .toBe('none')

  await page.mouse.wheel(0, 900)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)

  await page.mouse.wheel(0, -5000)
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0)
})

test('app and ticker pages opt into the operational profile without another controller', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  for (const route of ['/markets', '/stocks/AAPL']) {
    await page.goto(route, { waitUntil: 'load' })
    await expectRuntime(page, 'operational')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('html')).toHaveClass(/lenis/)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  // Scoped to the resolved hero: while the chrome's Suspense boundary is still
  // streaming, the fallback and the real section are both in the DOM and both
  // carry a selected node, so a bare locator hits two elements. Asserting on
  // the ready state is also stricter — a page stuck loading used to satisfy this.
  await expect(page.locator('[data-ticker-chrome="ready"] [data-selected-ticker-node]')).toBeVisible()
  await page.mouse.wheel(0, 700)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50)
})

test('reduced motion restores native scrolling on standard and operational pages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/product', { waitUntil: 'load' })
  await expectRuntime(page, 'standard', 'native-reduced')
  await expect(page.locator('html')).not.toHaveClass(/lenis-smooth/)

  await page.goto('/markets', { waitUntil: 'load' })
  await expectRuntime(page, 'operational', 'native-reduced')
  await expect(page.locator('.app-shell')).toBeVisible()
})
