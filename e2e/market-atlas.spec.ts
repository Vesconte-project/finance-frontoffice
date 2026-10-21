import { expect, test, type Page } from '@playwright/test'

// Synthetic fixture atlas (e2e/fixtures/market-atlas.mjs) served signed out, as browser QA has no session.
// The free and Pro specs run against the same stub started with E2E_STUB_SIGNED_IN=1 or E2E_STUB_TIER=pro.
test.skip(Boolean(process.env.E2E_STUB_SIGNED_IN || process.env.E2E_STUB_TIER), 'the fixture backend answers as a signed-in reader')

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
    // Movement and the time bar are Pro: locked, and a press says what unlocks them. On a phone movement folds behind "More".
    if (width < 640) {
      const more = page.getByRole('button', { name: 'Find and movement' })
      await expect(more).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByRole('combobox', { name: 'Find a company or region on the map' })).toBeHidden()
      await more.click()
      await expect(more).toHaveAttribute('aria-expanded', 'true')
    }
    await page.getByRole('button', { name: 'Movement over the last 6 months: Pro' }).click()
    const upsell = page.getByRole('dialog', { name: 'A year of history' })
    await expect(upsell).toBeVisible()
    await expect(upsell.getByText('Pro tools need an account.')).toBeVisible()
    await expect(upsell.getByRole('link', { name: 'See plans' })).toBeFocused()
    await upsell.getByRole('button', { name: 'Not now' }).click()
    await expect(upsell).toHaveCount(0)
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
  const list = page.getByRole('region', { name: 'Browse the market' })
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
  // Signed out the links show only how many ties, never their strength.
  await list.getByRole('tab', { name: 'Links' }).click()
  await expect(list.getByRole('button', { name: /Fixture Alpha and Fixture Beta: 9 ties$/ })).toBeVisible()
  await page.getByRole('application', { name: /Relationship atlas/ }).focus()
  // Escape closes the list first, then the details.
  await page.keyboard.press('Escape')
  await expect(list).toHaveCount(0)
  await expect(browse).toBeFocused()
  await page.getByRole('application', { name: /Relationship atlas/ }).focus()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-browse-1440.png' })
  expect(errors).toEqual([])
})

test('the map controls read, filter and find, and keep to what a signed-out reader may see', async ({ page }) => {
  const errors = watchConsole(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/markets/network')
  const map = page.getByRole('application', { name: /Relationship atlas/ })
  await expect(map).toBeVisible({ timeout: 30_000 })

  // How to read and Layers open over the map, one at a time, and Escape returns to the button.
  const help = page.getByRole('button', { name: 'How to read' })
  await help.click()
  await expect(page.getByRole('region', { name: 'How to read the atlas' })).toBeVisible()
  await page.getByRole('button', { name: 'Layers' }).click()
  await expect(page.getByRole('region', { name: 'How to read the atlas' })).toHaveCount(0)
  const layers = page.getByRole('region', { name: 'Layers' })
  await layers.getByLabel('Map key').check()
  await expect(page.getByRole('group', { name: 'Map key' })).toBeVisible()
  // Signed out the key explains only what is drawn: no wells, lines or bundles.
  await expect(page.getByRole('group', { name: 'Map key' }).getByText(/^Well/)).toHaveCount(0)
  await layers.getByLabel('Names on the map').uncheck()
  await expect(page.getByRole('button', { name: 'Names on the map' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(layers).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Layers' })).toBeFocused()
  await page.getByRole('button', { name: 'Close the map key' }).click()
  await expect(page.getByRole('group', { name: 'Map key' })).toHaveCount(0)

  // Search finds a region and a company on the map and opens its panel.
  const search = page.getByRole('combobox', { name: 'Find a company or region on the map' })
  await search.fill('fxb1')
  await expect(page.getByRole('option', { name: /FXB1/ })).toBeVisible()
  await search.press('Enter')
  const panel = page.getByRole('complementary', { name: 'Details' })
  await expect(panel.getByRole('heading', { name: /Fixture Beta Holding 1/ })).toBeVisible({ timeout: 30_000 })
  await search.fill('gamma')
  await page.getByRole('option', { name: /^Region Fixture Gamma/ }).click()
  await expect(panel.getByRole('heading', { name: 'Fixture Gamma' })).toBeVisible({ timeout: 30_000 })
  // A company not on the signed-out map is not offered, and nothing is invented for it.
  await search.fill('FXA6')
  await expect(page.getByRole('option', { name: /Only the largest companies/ })).toBeVisible()

  // Signed out there is no reach, so no "Most connected" list, and no correlation sentence.
  await expect(page.getByRole('group', { name: 'Most connected companies' })).toHaveCount(0)
  await expect(page.getByText(/Average correlation/)).toHaveCount(0)
  await expect(page.getByText(/Week of/)).toBeVisible()
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-controls-1440.png' })
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
