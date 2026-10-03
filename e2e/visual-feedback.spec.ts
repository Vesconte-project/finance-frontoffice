import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const directory = join(process.cwd(), 'artifacts', 'visual-feedback')

for (const colorScheme of ['light', 'dark'] as const) {
  test(`homepage header and pricing ${colorScheme}`, async ({ page }) => {
    mkdirSync(directory, { recursive: true })
    await page.emulateMedia({ colorScheme })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('**/api/tickers/index', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }),
    }))
    await page.goto('/', { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('.dock-search[data-reveal-ready="true"]')).toBeVisible()
    await page.waitForTimeout(1900)
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    const clerkNotice = page.getByText('Configure your application', { exact: true })
    if (await clerkNotice.count()) {
      await clerkNotice.first().evaluate((element) => {
        let current: Element | null = element
        while (current && getComputedStyle(current).position !== 'fixed') {
          current = current.parentElement ?? (current.getRootNode() instanceof ShadowRoot ? (current.getRootNode() as ShadowRoot).host : null)
        }
        current?.remove()
      })
    }
    await expect(page.locator('.site-header__row')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await page.screenshot({ path: join(directory, `homepage-top-${colorScheme}.png`) })

    const heroInput = page.locator('.dock-search__field input')
    // The hero field sleeps until asked for (TapToActivateField).
    await page.locator('.dock-search__field').focus()
    await expect(heroInput).toBeFocused()
    await page.mouse.wheel(0, 1000)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(120)
    await expect(heroInput).not.toBeFocused()
    await expect.poll(async () => page.locator('.site-header__pill-search').evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(48)
    await page.screenshot({ path: join(directory, `homepage-scrolled-${colorScheme}.png`) })
    await page.locator('.site-header__pill-search input').click()
    await expect.poll(async () => page.locator('.site-header__pill-search').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(150)

    await page.goto('/pricing', { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    await expect(page.locator('.pricing-plan-card--basic .pricing-plan-summary')).toBeVisible()
    await page.screenshot({ path: join(directory, `pricing-${colorScheme}.png`) })
  })
}

test('explicit dark theme keeps typed homepage search readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.route('**/api/tickers/index', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }),
  }))
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const input = page.locator('.dock-search__field input')
  await page.locator('.dock-search__field').focus()
  await input.fill('ASML')
  await expect(input).toHaveCSS('color', 'rgb(236, 230, 218)')
  await expect(input).toHaveCSS('background-color', 'rgb(23, 33, 48)')
})
