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

/** The site search: on the atlas it selects the company on the map instead of opening its page. */
async function findOnAtlas(page: Page, symbol: string) {
  const search = page.getByRole('combobox', { name: 'Search tickers or companies' }).first()
  await search.fill(symbol)
  await expect(page.getByRole('option', { name: new RegExp(symbol, 'i') }).first()).toBeVisible({ timeout: 30_000 })
  await search.press('Enter')
}

/** The browse panel starts open on a wide screen; open it only if a test has folded it. */
async function openBrowse(page: Page) {
  const browse = page.getByRole('button', { name: 'Browse atlas', exact: true })
  if ((await browse.getAttribute('aria-expanded')) === 'false') await browse.click()
  await expect(browse).toHaveAttribute('aria-expanded', 'true')
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
    // the map's facts live behind "This map", by How to read and Aa, not over the map
    const compact = width < 896
    await page.getByRole('button', { name: 'This map', exact: true }).click()
    const info = page.getByRole('region', { name: 'This map' })
    await expect(info).toContainText('Week of')
    await expect(info.getByText('18', { exact: true })).toBeVisible()
    await expect(info).toContainText('Average correlation')
    if (compact) {
      // a bottom sheet over a dimmed map, the full width of a phone
      const sheet = await info.boundingBox()
      expect(sheet!.y + sheet!.height).toBeGreaterThanOrEqual(height - 1)
      if (width < 640) expect(sheet!.width).toBeGreaterThanOrEqual(width - 1)
    }
    await info.getByRole('button', { name: 'Close This map' }).click()
    await expect(info).toHaveCount(0)
    // the time bar is one slim capsule: centred between the legend and the zoom, beside the zoom on a phone
    const timeBox = await time.boundingBox()
    expect(timeBox!.height).toBeLessThanOrEqual(48)
    if (width >= 640) expect(timeBox!.x + timeBox!.width / 2).toBeCloseTo(width / 2, 0)
    expect(timeBox!.width).toBeGreaterThanOrEqual(width >= 640 ? Math.min(576, width - 2 * (width > 1024 ? 304 : 204)) - 1 : width - 120)
    expect(timeBox!.width).toBeLessThanOrEqual(577)
    // nothing on the bottom edge overlaps: the folded legend, the capsule and the zoom
    const browseToggle = page.getByRole('button', { name: 'Browse atlas', exact: true })
    if ((await browseToggle.getAttribute('aria-expanded')) === 'true') await browseToggle.click()
    const zoomButtons = await page.getByRole('group', { name: 'Zoom and reading' }).getByRole('button').evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }))
    const legendToggle = await browseToggle.boundingBox()
    const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1
    // info, help, names and fit everywhere; plus and minus only where there is no pinch to zoom
    expect(zoomButtons.length).toBe(compact ? 4 : 6)
    for (const button of zoomButtons) {
      expect(apart(timeBox!, button)).toBe(true)
      expect(apart(legendToggle!, button)).toBe(true)
    }
    expect(apart(timeBox!, legendToggle!)).toBe(true)
    await browseToggle.click()
    if (compact) {
      // on a small screen the tools are a named list in a sheet, behind one button
      await browseToggle.click()
      await page.getByRole('button', { name: 'Tools', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Tools' }).getByRole('button', { name: 'Select companies: Pro' })).toBeVisible()
      await page.getByRole('button', { name: 'Close Tools' }).click()
      await browseToggle.click()
    } else {
      await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Select companies: Pro' })).toBeVisible()
    }
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
    const view = await page.getByRole('group', { name: 'Zoom and reading' }).boundingBox()
    if (compact) {
      // one row of controls above the map: tools, layers, ETF themes
      const row = await page.getByRole('button', { name: 'Tools', exact: true }).boundingBox()
      const layersButton = await page.getByRole('button', { name: 'Layers', exact: true }).boundingBox()
      expect(row!.y).toBeGreaterThanOrEqual(72)
      expect(layersButton!.y).toBeCloseTo(row!.y)
      await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeHidden()
    } else {
      // the tools stand down the left edge, clear of the details panel
      const tools = await page.getByRole('navigation', { name: 'Tools' }).boundingBox()
      expect(tools!.y).toBeGreaterThanOrEqual(72)
      expect(tools!.y + tools!.height).toBeLessThan(height / 2)
      expect(tools!.x).toBeLessThanOrEqual(17)
      expect(tools!.height).toBeGreaterThan(tools!.width)
      // zoom stands up the right edge
      const zoomIn = await page.getByRole('button', { name: 'Zoom in', exact: true }).boundingBox()
      const zoomOut = await page.getByRole('button', { name: 'Zoom out', exact: true }).boundingBox()
      expect(zoomIn!.x).toBeCloseTo(zoomOut!.x)
      expect(zoomOut!.y).toBeGreaterThan(zoomIn!.y)
    }
    expect(view!.x + view!.width).toBeGreaterThanOrEqual(width - 17)
    expect(view!.y + view!.height).toBeGreaterThanOrEqual(height - 17)
    // This map, How to read and Aa in one corner row
    const infoButton = await page.getByRole('button', { name: 'This map', exact: true }).boundingBox()
    const helpButton = await page.getByRole('button', { name: 'How to read', exact: true }).boundingBox()
    const names = await page.getByRole('button', { name: 'Names on the map', exact: true }).boundingBox()
    expect(helpButton!.y).toBeCloseTo(names!.y)
    expect(infoButton!.y).toBeCloseTo(names!.y)
    expect(helpButton!.x).toBeGreaterThan(infoButton!.x)
    expect(names!.x).toBeGreaterThan(helpButton!.x)
    await expect(page.getByRole('button', { name: 'Key', exact: true })).toHaveCount(0)
    if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: `test-results/market-atlas-free-layout-${width}.png` })
    // Browse atlas is the legend: the regions in their colours, anchored bottom left
    const browse = page.getByRole('button', { name: 'Browse atlas', exact: true })
    if ((await browse.getAttribute('aria-expanded')) === 'false') await browse.click()
    const legendBox = await page.locator('#atlas-key').boundingBox()
    // bottom left on a wide screen, a bottom sheet on a phone, inset and centred on a tablet
    expect(legendBox!.x).toBeLessThanOrEqual(width >= 640 && compact ? (width - 640) / 2 + 1 : 16)
    expect(legendBox!.y + legendBox!.height).toBeGreaterThanOrEqual(height - 17)
    const list = page.getByRole('region', { name: 'Browse the market' })
    await expect(list.getByRole('button', { name: /Fixture Alpha/ })).toBeVisible()
    expect(await page.locator('#atlas-browse').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true)
    await expect(page.getByText('Select a company or region to explore its links.', { exact: true })).toHaveCount(0)
    await browse.click()
    await expect(page.locator('#atlas-browse')).toBeHidden()
    const closed = await browse.boundingBox()
    expect(closed!.x).toBeLessThanOrEqual(17)
    expect(closed!.y + closed!.height).toBeGreaterThanOrEqual(height - 17)
    if (process.env.PLAYWRIGHT_CAPTURE && [320, 1440].includes(width)) await page.screenshot({ path: `test-results/market-atlas-legend-closed-${width}.png` })
    await browse.click()
    await expect(page.locator('#atlas-browse')).toBeVisible()
    const body = await page.locator('#atlas-browse').boundingBox()
    expect(body!.y).toBeGreaterThanOrEqual(legendBox!.y)
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
  test(`the most connected companies head the legend and open their details at ${width}px`, async ({ page }) => {
    await openAtlas(page, width)
    await openBrowse(page)
    const hubs = page.getByRole('region', { name: 'Browse the market' }).getByRole('list', { name: 'Most connected companies' })
    await expect(hubs.getByRole('button')).not.toHaveCount(0)
    const box = await hubs.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    const first = hubs.getByRole('button').first()
    const symbol = (await first.textContent())!
    await first.click()
    await expect(page.getByRole('complementary', { name: 'Details' }).getByText(symbol, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
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

  // This map: accuracy is open, the cohesion chart is locked with no chart behind it
  await page.getByRole('button', { name: 'This map', exact: true }).click()
  await expect(page.getByRole('region', { name: 'This map' }).getByText(/of 10/).first()).toBeVisible()
  await expect(page.getByRole('img', { name: /Average correlation over the last year/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Average correlation across the market/ }).click()
  await expect(page.getByRole('dialog', { name: 'Market cohesion' })).toBeVisible()
  await page.keyboard.press('Escape')
  await openBrowse(page)
  await page.getByRole('tab', { name: 'Groups' }).click()
  await expect(page.getByRole('button', { name: 'Groups are a Pro tool.' })).toBeVisible()
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-free-locked-1440.png' })
  expect(errors).toEqual([])
})

test('a free reader picks a theme and reads a company’s accuracy and themes, without trends', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  const themeButton = page.getByRole('button', { name: /ETF theme/ })
  await themeButton.click()
  // a panel beside the dock with every theme, its size, and whether prices confirm it
  const themes = page.getByRole('region', { name: 'ETF themes' })
  const choices = themes.getByRole('radiogroup', { name: 'ETF theme' })
  await expect(choices.getByRole('radio', { name: 'All companies' })).toBeFocused()
  await expect(choices.getByRole('radio', { name: /Fixture AI/ })).toContainText('4')
  await page.keyboard.press('ArrowDown')
  await expect(choices.getByRole('radio', { name: /Fixture AI/ })).toBeFocused()
  await choices.getByRole('radio', { name: /Fixture AI/ }).click()
  await expect(themes).toHaveCount(0)
  await expect(themeButton).toBeFocused()
  await expect(themeButton).toHaveAttribute('aria-label', 'ETF theme: Fixture AI · 4')
  const card = page.getByRole('region', { name: 'ETF theme: Fixture AI' })
  await expect(card.getByText('Moves together')).toBeVisible()
  await expect(card.getByText('0.31 vs 0.42 in a typical region')).toBeVisible()
  await expect(card.getByText(/Mostly in: Fixture Alpha 50%/)).toBeVisible()

  await findOnAtlas(page, 'FXA1')
  await expect(page).toHaveURL(/\/markets\/network/)
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
  await openBrowse(page)
  const sheet = page.getByRole('region', { name: 'Browse the market' })
  // dots, market value and four lead tickers per region; no six-month changes without Pro
  await expect(sheet.getByRole('img', { name: 'Moves together: 5 of 5' })).toBeVisible()
  await expect(sheet.getByText('$3.6T')).toBeVisible()
  await expect(sheet.getByText(/−out/)).toHaveCount(0)
  // one order, the one the map draws with: no sort or filter to choose
  await expect(sheet.getByRole('combobox')).toHaveCount(0)
  await expect(sheet.getByRole('searchbox')).toHaveCount(0)
  const regions = sheet.getByRole('button', { name: / companies$/ })
  await expect(regions).toHaveCount(3)
  await expect(regions.first()).toContainText('Fixture Alpha')

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

/** The site search: on the atlas it selects the company on the map instead of opening its page. */
async function pageSearch(page: Page, symbol: string) {
  const search = page.getByRole('combobox', { name: 'Search tickers or companies' }).first()
  await search.fill(symbol)
  await expect(page.getByRole('option', { name: new RegExp(symbol, 'i') }).first()).toBeVisible({ timeout: 30_000 })
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
    // on a desktop screen the whole guide fits without scrolling
    if (width === 1440) expect(await help.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
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
    // the legend's symbols live in the guide, with what each extra layer draws
    await expect(help.getByText('Wells', { exact: true })).toBeVisible()
    await expect(help.getByText('ETF themes', { exact: true })).toBeVisible()
    await help.getByRole('button', { name: 'Got it, explore the map' }).click()
    await expect(help).not.toBeVisible()
    await expect(trigger).toBeFocused()
  })
}
