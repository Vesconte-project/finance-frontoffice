import { expect, test, type Page } from '@playwright/test'

// A free (signed-in) reader, served by the fixture backend started with E2E_STUB_SIGNED_IN=1:
// themes and map accuracy are open; history, movement, the Pro layers and the tools are locked and carry no data.
test.skip(process.env.E2E_STUB_SIGNED_IN !== '1' || process.env.E2E_STUB_TIER === 'pro', 'needs the fixture backend answering as a free reader')

function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function openAtlas(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/markets/network')
  const map = page.getByRole('application', { name: /Relationship atlas/ })
  await expect(map).toBeVisible({ timeout: 30_000 })
  return map
}

for (const width of [375, 1440]) {
  test(`the free atlas locks the Pro tools and fits the screen at ${width}px`, async ({ page }) => {
    const errors = watchConsole(page)
    await openAtlas(page, width)
    await expect(page.getByText('You are seeing a sketch')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Earlier weeks: Pro' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select companies: Pro' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
  })
}

test('every locked feature opens its upsell, which closes and gives focus back', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)

  const timeline = page.getByRole('button', { name: 'Earlier weeks: Pro' })
  await timeline.click()
  const upsell = page.getByRole('dialog', { name: 'A year of history' })
  await expect(upsell.getByText('Earlier weeks, and how companies moved between regions, are part of Pro.')).toBeVisible()
  await expect(upsell.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing')
  await expect(upsell.getByRole('link', { name: 'See plans' })).toBeFocused()
  // a signed-in reader already has an account
  await expect(upsell.getByText('Pro tools need an account.')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(upsell).toHaveCount(0)
  await expect(timeline).toBeFocused()

  await page.getByRole('button', { name: 'Movement over the last year: Pro' }).click()
  await expect(page.getByRole('dialog', { name: 'Movement over a year' })).toBeVisible()
  await page.getByRole('button', { name: 'Not now' }).click()

  await page.getByRole('button', { name: 'Compare: Pro' }).click()
  await expect(page.getByRole('dialog', { name: 'Compare' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Layers: the Pro sections are tagged and dimmed, and any press opens the upsell instead
  await page.getByRole('button', { name: 'Layers' }).click()
  const layers = page.getByRole('region', { name: 'Layers' })
  await expect(layers.getByText('Pro', { exact: true })).toHaveCount(4)
  await layers.getByRole('button', { name: 'Total co-movement' }).click()
  await expect(page.getByRole('dialog', { name: 'Total co-movement' })).toBeVisible()
  await page.keyboard.press('Escape')
  await layers.getByLabel('Influence arrows').click()
  await expect(page.getByRole('dialog', { name: 'Influence arrows' })).toBeVisible()
  await expect(layers.getByLabel('Influence arrows')).not.toBeChecked()
  await page.keyboard.press('Escape')
  // a locked feature carries no data
  await expect(layers.getByText(/report days/)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(layers).toHaveCount(0)

  // Browse › Market: accuracy is open, the cohesion chart is locked with no chart behind it
  await page.getByRole('button', { name: 'Browse atlas' }).click()
  await page.getByRole('tab', { name: 'Market' }).click()
  await expect(page.getByText(/of 10/).first()).toBeVisible()
  await expect(page.getByRole('img', { name: /Average correlation over the last year/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Average correlation across the market/ }).click()
  await expect(page.getByRole('dialog', { name: 'Market cohesion' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Groups' }).click()
  await expect(page.getByRole('button', { name: 'Groups are a Pro tool.' })).toBeVisible()
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-free-locked-1440.png' })
  expect(errors).toEqual([])
})

test('a free reader picks a theme and reads a company’s accuracy and themes, without trends', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  const themeButton = page.getByRole('button', { name: /Theme/ })
  await themeButton.click()
  const menu = page.getByRole('menu', { name: 'Theme' })
  await expect(menu.getByRole('menuitemradio', { name: 'All companies' })).toBeFocused()
  await menu.getByRole('menuitemradio', { name: /Fixture AI/ }).click()
  await expect(themeButton).toContainText('Fixture AI · 4')
  const card = page.getByRole('region', { name: 'Theme: Fixture AI' })
  await expect(card.getByText('Moves together')).toBeVisible()
  await expect(card.getByText('0.31 vs 0.42 in a typical region')).toBeVisible()
  await expect(card.getByText(/Mostly in: Fixture Alpha 50%/)).toBeVisible()

  const search = page.getByRole('combobox', { name: 'Find a company or region on the map' })
  await search.fill('FXA1')
  await search.press('Enter')
  const panel = page.getByRole('complementary', { name: 'Details' })
  await expect(panel.getByText('Map accuracy here')).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('9 of 10', { exact: true })).toBeVisible()
  await expect(panel.getByText(/Thematic funds group it as/)).toContainText('Fixture AI')
  await expect(panel.getByText('beyond market · total')).toBeVisible()
  await expect(panel.getByText(/stronger|weaker/)).toHaveCount(0)
  await expect(panel.getByText('Then and now')).toHaveCount(0)
  await panel.getByRole('button', { name: '+ Selection: Pro' }).click()
  await expect(page.getByRole('dialog', { name: 'Select companies' })).toBeVisible()
  expect(errors).toEqual([])
})

test('Browse lists regions and links, and the panels read every region and company fact', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  await page.getByRole('button', { name: 'Browse atlas' }).click()
  const sheet = page.getByRole('region', { name: 'Browse the market' })
  // dots, market value and four lead tickers per region; no six-month changes without Pro
  await expect(sheet.getByRole('img', { name: 'Moves together: 5 of 5' })).toBeVisible()
  await expect(sheet.getByText('$3.6T')).toBeVisible()
  await expect(sheet.getByRole('option', { name: 'Changed most (6 mo)' })).toHaveCount(0)
  await expect(sheet.getByText(/in 6 months/)).toHaveCount(0)
  await sheet.getByRole('combobox', { name: 'Sort regions' }).selectOption('tight')
  await expect(sheet.getByRole('button', { name: / companies/ }).first()).toContainText('Fixture Alpha')
  await sheet.getByRole('combobox', { name: 'Sort regions' }).selectOption('value')
  await expect(sheet.getByRole('button', { name: / companies/ }).last()).toContainText('Fixture Gamma')
  await sheet.getByRole('searchbox', { name: 'Filter regions or tickers' }).fill('fxc')
  await expect(sheet.getByRole('button', { name: /Fixture Gamma/ })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Fixture Alpha/ })).toHaveCount(0)
  await sheet.getByRole('searchbox', { name: 'Filter regions or tickers' }).fill('')

  await sheet.getByRole('tab', { name: 'Links' }).click()
  await expect(sheet.getByText('The strongest links between regions: how many strong ties join them and how strong they are on average. Select one to see its bundle.')).toBeVisible()
  await sheet.getByRole('button', { name: /Fixture Alpha and Fixture Beta: 9 ties · 0\.31/ }).click()

  const panel = page.getByRole('complementary', { name: 'Details' })
  await expect(panel.getByRole('heading', { name: 'Fixture Alpha' })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('6 companies', { exact: true })).toBeVisible()
  await expect(panel.getByText('1 shared with other regions')).toBeVisible()
  await expect(panel.getByText('map accuracy 81%')).toBeVisible()
  await expect(panel.getByText('Named after the industry "Fixture Alpha", which 67% of its companies share. The name is a guide; the region itself comes from prices.')).toBeVisible()
  await expect(panel.getByText(/The line holds 80% of its weight/)).toBeVisible()
  await expect(panel.getByText('Fixture Software')).toBeVisible()
  await expect(panel.getByRole('button', { name: /Fixture Beta 9 · 0\.31/ })).toBeVisible()
  await expect(panel.getByText('Market value here')).toBeVisible()
  await expect(panel.getByText('Fixture Technology')).toBeVisible()
  await expect(panel.getByRole('button', { name: /FXC2 .*40% here/ })).toBeVisible()

  await panel.getByRole('button', { name: /FXA6/ }).first().click()
  await expect(panel.getByRole('heading', { name: 'Fixture Alpha Holding 6' })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('Moves on its own')).toBeVisible()
  await expect(panel.getByText(/On the map: Fixture Alpha, because its price moves with those companies\./)).toBeVisible()
  await expect(panel.getByText('20d volatility')).toHaveCount(0)
  await pageSearch(page, 'FXA2')
  await expect(panel.getByRole('heading', { name: 'Fixture Alpha Holding 2' })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('Between regions')).toBeVisible()
  await expect(panel.getByText('Fixture Chips')).toBeVisible()
  await expect(panel.getByRole('button', { name: /Fixture Beta 15%/ })).toBeVisible()
  await expect(panel.getByText('20d volatility')).toBeVisible()
  await expect(panel.getByText('28%')).toBeVisible()
  await expect(panel.getByText('Moves with others')).toBeVisible()
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-free-company-1440.png' })
  expect(errors).toEqual([])
})

async function pageSearch(page: Page, symbol: string) {
  const search = page.getByRole('combobox', { name: 'Find a company or region on the map' })
  await search.fill(symbol)
  await search.press('Enter')
}

test('the local routes keep the backend refusals for Pro answers', async ({ request }) => {
  for (const path of ['/api/atlas/weeks', '/api/atlas/influence', '/api/atlas/movement?from=2026-04-17', '/api/atlas/compare?a=zone:fx-zone-alpha&b=FXB1', '/api/atlas?level=1&lens=total', '/api/atlas?level=1&asOf=2026-04-17']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(403)
    expect(await response.json()).toEqual({ detail: 'pro_required' })
  }
  const test = await request.get('/api/atlas/test?from=zone:fx-zone-alpha&to=FXB1&testsRun=1')
  expect(test.status()).toBe(403)
  expect((await request.get('/api/atlas/zones/fx-zone-alpha?lens=total')).status()).toBe(403)
  expect((await request.get('/api/atlas/themes')).status()).toBe(200)
  expect((await request.get('/api/atlas/test?from=../x&to=FXB1&testsRun=1')).status()).toBe(400)
  expect((await request.get('/api/atlas/compare?a=zone:..&b=FXB1')).status()).toBe(400)
})
