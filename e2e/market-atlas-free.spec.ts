import { expect, test, type Page } from '@playwright/test'

// A free (signed-in) reader, served by the fixture backend started with E2E_STUB_SIGNED_IN=1:
// themes and map accuracy are open; history, movement, the Pro layers and the tools are locked and carry no data.
test.skip(process.env.E2E_STUB_SIGNED_IN !== '1' || process.env.E2E_STUB_TIER === 'pro', 'needs the fixture backend answering as a free reader')

// Under `next dev` the first request to a dynamic route can answer the 404 page while it compiles;
// ask each one until it answers as itself, so the specs test the atlas and not the compiler.
test.beforeAll(async ({ request }) => {
  for (const path of ['/api/atlas/companies/FXA1', '/api/atlas/zones/fx-zone-alpha', '/api/atlas/themes/fx-ai']) {
    await expect.poll(async () => (await request.get(path)).headers()['content-type'] ?? '', { timeout: 60_000 }).toContain('application/json')
  }
})

function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function openAtlas(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto('/markets/network')
  const map = page.getByRole('application', { name: /Relationship atlas/ })
  await expect(map).toBeVisible({ timeout: 30_000 })
  // Server-rendered controls precede hydration; geometry needs the painted canvas.
  await expect.poll(() => map.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, 8).data
    return pixels ? pixels.some((value, index) => index % 4 === 3 && value > 0) : false
  })).toBe(true)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  return map
}

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1536, 800], [1440, 900], [1920, 1080]]) {
  test(`the free atlas locks the Pro tools and fits the screen at ${width}px`, async ({ page }) => {
    const errors = watchConsole(page)
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    const map = await openAtlas(page, width, height)
    await expect(page.getByText('You are seeing a sketch')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Earlier weeks: Pro' })).toBeVisible()
    const time = page.getByRole('group', { name: 'Earlier weeks', exact: true })
    const summary = page.getByRole('group', { name: 'Latest map snapshot', exact: true })
    await expect(summary).toContainText('Week of')
    await expect(summary).toContainText('18 companies · 3 regions')
    await expect(summary).toContainText('Average correlation')
    const timeBox = await time.boundingBox()
    expect(timeBox!.x + timeBox!.width / 2).toBeCloseTo(width / 2, 0)
    expect(timeBox!.width).toBeGreaterThanOrEqual(width > 1024 ? Math.min(928, width - 544) - 1 : Math.min(928, width - 32) - 1)
    const ruler = await page.getByRole('button', { name: 'Earlier weeks: Pro' }).boundingBox()
    expect(ruler!.height).toBeGreaterThanOrEqual(60)
    expect(ruler!.x + ruler!.width / 2).toBeCloseTo(width / 2, 0)
    if (width > 1024) expect(ruler!.width).toBeGreaterThan(650)
    await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select companies: Pro' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const frame = await map.boundingBox()
    expect(frame).not.toBeNull()
    expect(frame!.x).toBe(0)
    expect(frame!.width).toBe(width)
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(height + 1)
    // The grid must reach every canvas edge, even beyond the atlas's data bounds.
    await expect.poll(() => map.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context) return false
      const { width: w, height: h } = canvas
      return [[0, 0, 8, h], [w - 8, 0, 8, h], [0, 0, w, 8], [0, h - 8, w, 8]].every(([x, y, width, height]) => {
        const { data } = context.getImageData(x, y, width, height)
        let painted = 0
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted += 1
        return painted > 8
      })
    })).toBe(true)
    expect(frame!.y).toBe(0)
    expect(frame!.height).toBe(height)
    await expect.poll(() => page.locator('.site-header__row').evaluate((row) => getComputedStyle(row, '::before').opacity)).toBe('0')
    const tools = await page.getByRole('navigation', { name: 'Tools' }).boundingBox()
    const view = await page.getByRole('group', { name: 'Zoom and reading' }).boundingBox()
    expect(tools!.y).toBeGreaterThanOrEqual(72)
    expect(tools!.y + tools!.height).toBeLessThan(height / 2)
    expect(tools!.width).toBeGreaterThan(tools!.height)
    expect(view!.x + view!.width).toBeGreaterThanOrEqual(width - 17)
    expect(view!.y + view!.height).toBeGreaterThanOrEqual(height - 17)
    expect(view!.width).toBeGreaterThan(view!.height)
    const zoomIn = await page.getByRole('button', { name: 'Zoom in', exact: true }).boundingBox()
    const zoomOut = await page.getByRole('button', { name: 'Zoom out', exact: true }).boundingBox()
    expect(zoomIn!.y).toBeCloseTo(zoomOut!.y)
    expect(zoomOut!.x).toBeGreaterThan(zoomIn!.x)
    await expect(page.getByRole('button', { name: 'Key', exact: true })).toHaveCount(0)
    if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: `test-results/market-atlas-free-layout-${width}.png` })
    const legend = page.getByRole('button', { name: 'Legend', exact: true })
    if ((await legend.getAttribute('aria-expanded')) === 'false') await legend.click()
    const anchor = await legend.boundingBox()
    expect(anchor!.x).toBeLessThanOrEqual(16)
    const legendGroup = await page.getByRole('group', { name: 'Map key', exact: true }).boundingBox()
    expect(legendGroup!.y + legendGroup!.height).toBeGreaterThanOrEqual(height - 17)
    expect(anchor!.y).toBeCloseTo(legendGroup!.y)
    await expect(legend).toHaveAttribute('aria-expanded', 'true')
    expect(await page.locator('#atlas-legend li > span').evaluateAll((rows) => rows.every((row) => {
      const rect = row.getBoundingClientRect()
      const line = parseFloat(getComputedStyle(row).lineHeight)
      return rect.height <= line + 1
    }))).toBe(true)
    expect(await page.locator('#atlas-legend').evaluate((list) => list.scrollWidth <= list.clientWidth)).toBe(true)
    await expect(page.getByText('Select a company or region to explore its links.', { exact: true })).toHaveCount(0)
    await legend.click()
    await expect(page.locator('#atlas-legend')).toBeHidden()
    const closed = await legend.boundingBox()
    expect(closed!.y + closed!.height).toBeCloseTo(legendGroup!.y + legendGroup!.height)
    if (process.env.PLAYWRIGHT_CAPTURE && [320, 1440].includes(width)) await page.screenshot({ path: `test-results/market-atlas-legend-closed-${width}.png` })
    await legend.click()
    await expect(page.locator('#atlas-legend')).toBeVisible()
    const list = await page.locator('#atlas-legend').boundingBox()
    expect(list!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height)
    if (width === 1440) {
      const today = page.locator('.site-header').getByRole('button', { name: 'Today', exact: true })
      await today.click()
      await expect(today).toHaveAttribute('aria-expanded', 'true')
      await today.click()
    }
    expect(errors).toEqual([])
  })
}

for (const width of [320, 1440]) {
  test(`the connected-company list opens without shifting history and closes by keyboard at ${width}px`, async ({ page }) => {
    await openAtlas(page, width)
    const toggle = page.getByRole('button', { name: 'Most connected', exact: true })
    const bar = page.getByRole('group', { name: 'Earlier weeks', exact: true })
    const before = await bar.boundingBox()
    await toggle.click()
    const list = page.locator('#atlas-landmarks')
    await expect(list).toBeVisible()
    const bounds = await list.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(bounds!.y).toBeGreaterThanOrEqual(72)
    expect((await bar.boundingBox())!.y).toBeCloseTo(before!.y)
    await page.keyboard.press('Escape')
    await expect(list).toHaveCount(0)
    await expect(toggle).toBeFocused()
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
  await expect(layers.getByLabel('Map key')).toHaveCount(0)
  await expect(layers.getByLabel('Names on the map')).toHaveCount(0)
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
  for (const path of ['/api/atlas/set?members=FXA1,FXA2', '/api/atlas/weeks', '/api/atlas/influence', '/api/atlas/movement?from=2026-04-17', '/api/atlas/compare?a=zone:fx-zone-alpha&b=FXB1', '/api/atlas?level=1&lens=total', '/api/atlas?level=1&asOf=2026-04-17']) {
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

for (const width of [320, 1440]) {
  test(`help explains the map in a modal and restores focus at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await openAtlas(page, width, width === 320 ? 568 : 900)
    const trigger = page.getByRole('button', { name: 'How to read', exact: true })
    await trigger.click()
    const help = page.getByRole('dialog', { name: 'How to read the atlas', exact: true })
    await expect(help).toBeVisible()
    await expect(help.getByRole('heading', { name: 'Look at distance' })).toBeVisible()
    expect(await help.evaluate((element: HTMLDialogElement) => element.matches(':modal'))).toBe(true)
    if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: `test-results/market-atlas-help-${width}.png` })
    await page.keyboard.press('Tab')
    // Native dialogs make the map inert: even an explicit focus request is ignored.
    await page.locator('button[aria-controls="atlas-help"]').evaluate((element: HTMLButtonElement) => element.focus())
    expect(await help.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(help).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await help.getByText('Understand the other symbols', { exact: true }).click()
    await expect(help.getByText('Region outlines', { exact: true })).toBeVisible()
    await help.getByRole('button', { name: 'Got it, explore the map' }).click()
    await expect(help).not.toBeVisible()
    await expect(trigger).toBeFocused()
  })
}
