import { expect, test, type Page } from '@playwright/test'

// Synthetic fixture atlas (e2e/fixtures/market-atlas.mjs) served signed out, as browser QA has no session.

function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

for (const width of [375, 1440]) {
  test(`the signed-out atlas draws the sketch and invites an account at ${width}px`, async ({ page }) => {
    const errors = watchConsole(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/markets/network')
    const map = page.getByRole('application', { name: /Relationship atlas/ })
    // The first visit compiles the route under `next dev`.
    await expect(map).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('You are seeing a sketch')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create a free account' }).first()).toHaveAttribute('href', /^\/sign-up\?redirect_url=/)
    await expect(page.getByText(/Create an account to follow the map/)).toBeVisible()
    // The canvas is painted.
    await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context) return 0
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let painted = 0
      for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) painted += 1
      return painted
    })).toBeGreaterThan(20)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: `test-results/market-atlas-signed-out-${width}.png` })
    expect(errors).toEqual([])
  })
}

test('the list path opens a region and a company by keyboard, with the signed-out panels', async ({ page }) => {
  const errors = watchConsole(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/markets/network')
  const browse = page.getByRole('button', { name: 'Browse atlas' })
  await browse.focus()
  await page.keyboard.press('Enter')
  await expect(browse).toHaveAttribute('aria-expanded', 'true')
  const list = page.getByRole('navigation', { name: 'Regions and their largest companies' })
  await list.getByRole('button', { name: /Fixture Alpha/ }).click()
  const panel = page.getByRole('complementary', { name: 'Details' })
  // The first panel compiles its local route under `next dev`.
  await expect(panel.getByRole('heading', { name: 'Fixture Alpha' })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('Largest companies')).toBeVisible()
  await expect(panel.getByRole('link', { name: /See every company in this region/ })).toBeVisible()
  await list.getByRole('button', { name: 'FXA1' }).click()
  await expect(panel.getByRole('heading', { name: /Fixture Alpha Holding 1/ })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('Largest companies in this region')).toBeVisible()
  // No ties signed out: the panel never lists what a company moves with.
  await expect(panel.getByText('Moves most with')).toHaveCount(0)
  await page.getByRole('application', { name: /Relationship atlas/ }).focus()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-browse-1440.png' })
  expect(errors).toEqual([])
})

test('the local atlas routes keep the backend refusal for hidden companies and history', async ({ request }) => {
  const hidden = await request.get('/api/atlas/companies/FXA6')
  const unknown = await request.get('/api/atlas/companies/ZZZZ')
  expect(hidden.status()).toBe(403)
  expect(await hidden.json()).toEqual({ detail: 'sign_in_required' })
  expect(await unknown.json()).toEqual(await hidden.json())
  expect((await request.get('/api/atlas?level=3')).status()).toBe(403)
  expect((await request.get('/api/atlas?level=1&bbox=0,0,1,1')).status()).toBe(403)
  expect((await request.get('/api/atlas?level=x')).status()).toBe(400)
  expect((await request.get('/api/atlas/companies/..%2Fadmin')).status()).toBe(400)
})
