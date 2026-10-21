import { expect, test, type Page } from '@playwright/test'

// A Pro reader, served by the fixture backend started with E2E_STUB_TIER=pro (e2e/fixtures/market-atlas-pro.mjs):
// 53 synthetic weeks in which FXA2 and FXA3 moved from Fixture Beta to Fixture Alpha.
test.skip(process.env.E2E_STUB_TIER !== 'pro', 'needs the fixture backend answering as a Pro reader')

// Under `next dev` the first request to a dynamic route can answer the 404 page while it compiles;
// ask each one until it answers as itself, so the specs test the atlas and not the compiler.
test.beforeAll(async ({ request }) => {
  for (const path of ['/api/atlas/companies/FXA1', '/api/atlas/zones/fx-zone-alpha', '/api/atlas/themes/fx-ai']) {
    await expect.poll(async () => (await request.get(path)).headers()['content-type'] ?? '', { timeout: 60_000 }).toContain('application/json')
  }
})

const weeksAgo = (k: number) => new Date(Date.parse('2026-10-16T00:00:00Z') - k * 7 * 86400000).toISOString().slice(0, 10)

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

async function pick(page: Page, symbol: string) {
  const search = page.getByRole('combobox', { name: 'Find a company or region on the map' })
  await search.fill(symbol)
  await search.press('Enter')
  return page.getByRole('complementary', { name: 'Details' })
}

for (const width of [375, 1440]) {
  test(`the Pro atlas shows its time bar and tools without overflow at ${width}px`, async ({ page }) => {
    const errors = watchConsole(page)
    await openAtlas(page, width)
    const range = page.getByRole('slider', { name: 'Weeks before today' })
    await expect(range).toBeEnabled({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Select companies', exact: true })).toBeVisible()
    await expect(page.locator('[data-locked]')).toHaveCount(0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
  })
}

test('the time bar loads earlier weeks, shows paths, and plays', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  const range = page.getByRole('slider', { name: 'Weeks before today' })
  await expect(range).toBeEnabled({ timeout: 30_000 })
  await range.fill('-30')
  const bar = page.getByRole('group', { name: 'Earlier weeks' })
  await expect(bar.getByText('Paths: the companies that changed region over the past year · select any company to see its own')).toBeVisible({ timeout: 30_000 })
  await expect(bar.locator('output')).toHaveText(weeksAgo(30))
  const panel = await pick(page, 'FXA2')
  await expect(panel.getByRole('heading', { name: /Fixture Alpha Holding 2/ })).toBeVisible({ timeout: 30_000 })
  await expect(bar.getByText('Path of FXA2 since a year ago · it changed region')).toBeVisible()
  // Escape closes the panel; the week stays
  await page.getByRole('application', { name: /Relationship atlas/ }).focus()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)

  await range.fill('0')
  await expect(bar.locator('output')).toHaveText('Today')
  await page.getByRole('button', { name: 'Play the last year' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(bar.locator('output')).not.toHaveText('Today')
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Play the last year' })).toBeVisible()
  expect(errors).toEqual([])
})

test('movement draws arrows and a mover reads "Then and now" with tie trends', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  const six = page.getByRole('button', { name: 'Movement over the last 6 months' })
  await expect(six).toBeEnabled({ timeout: 30_000 })
  const movement = page.waitForResponse((response) => response.url().includes('/api/atlas/movement') && response.status() === 200)
  await six.click()
  await movement
  await expect(six).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Key', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Map key' }).getByText('Arrow: companies that moved between regions since 6 months ago (width = how many)')).toBeVisible()

  const panel = await pick(page, 'FXA2')
  const then = panel.getByRole('region', { name: 'Then and now' })
  await expect(then.getByText('Moved to Fixture Alpha')).toBeVisible({ timeout: 30_000 })
  await expect(then.getByText('vs 6 months ago')).toBeVisible()
  await expect(then).toContainText('Main region: Fixture Beta → Fixture Alpha')
  await expect(then).toContainText(/Moved \d+\.\d× more than a typical company/)
  await expect(then.getByRole('button', { name: 'FXA4' })).toBeVisible()
  await expect(panel.getByText('↑ stronger')).toBeVisible()
  await expect(panel.getByText('↓ weaker')).toBeVisible()
  await expect(panel.getByText(/dashed red lines|Map accuracy here/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Movement over the last year' }).click()
  await expect(then.getByText('vs a year ago')).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})

test('the Pro layers switch the lens, size regions by value, ring accuracy and draw influence', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  await page.getByRole('button', { name: 'Layers' }).click()
  const layers = page.getByRole('region', { name: 'Layers' })
  await expect(layers.getByText('Pro', { exact: true })).toHaveCount(0)

  await layers.getByRole('button', { name: 'Market value' }).click()
  await expect(layers.getByRole('button', { name: 'Market value' })).toHaveAttribute('aria-pressed', 'true')
  await layers.getByLabel(/Ring on each company/).check()
  await layers.getByLabel('Influence arrows').check()
  await expect(layers.getByText('↓ pushes down')).toBeVisible({ timeout: 30_000 })
  await expect(layers.getByText('152 report days · new this year')).toBeVisible()
  const card = page.getByRole('region', { name: 'Influence' })
  await expect(card.getByText(/When Fixture Gamma companies report results, Fixture Tools falls the same day/)).toBeVisible()
  await expect(card.getByText('Same-day evidence from prices; strong, not proof.')).toBeVisible()
  await layers.getByLabel('Map key').check()
  const key = page.getByRole('group', { name: 'Map key' })
  await expect(key.getByText('Green: placed among its ties. Red: the map had to stretch it')).toBeVisible()
  await expect(key.getByText(/^Influence: one group moves another/)).toBeVisible()
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-pro-layers-1440.png' })

  await layers.getByRole('button', { name: 'Total co-movement' }).click()
  await expect(page.getByText(/· total co-movement/)).toBeVisible({ timeout: 30_000 })
  // no history and no influence on the total map
  await expect(page.getByRole('slider', { name: 'Weeks before today' })).toHaveCount(0)
  await expect(layers.getByText('Shown with the "Beyond the market" view.')).toBeVisible()
  await layers.getByRole('button', { name: 'Beyond the market' }).click()
  await expect(page.getByText(/· total co-movement/)).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'Weeks before today' })).toBeVisible()

  // Browse › Regions: six-month changes for Pro
  await page.getByRole('button', { name: 'Browse atlas' }).click()
  const sheet = page.getByRole('region', { name: 'Browse the market' })
  await expect(sheet.getByText('+2 / −0')).toBeVisible({ timeout: 30_000 })
  await expect(sheet.getByText('+0 / −2')).toBeVisible()
  await sheet.getByRole('combobox', { name: 'Sort regions' }).selectOption('change')
  // Browse › Market: the cohesion chart
  await page.getByRole('tab', { name: 'Market' }).click()
  await expect(page.getByRole('img', { name: /Average correlation over the last year, from 0\.\d\d to 0\.\d\d; today 0\.09/ })).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})

test('a theme highlights its companies and its card says whether prices confirm it', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)
  await page.getByRole('button', { name: /Theme/ }).click()
  await page.getByRole('menuitemradio', { name: /Fixture Robotics/ }).click()
  const card = page.getByRole('region', { name: 'Theme: Fixture Robotics' })
  await expect(card.getByText("Doesn't move together")).toBeVisible({ timeout: 30_000 })
  await expect(card.getByText('A label the prices do not confirm: its companies move with their own regions.')).toBeVisible()
  await page.getByRole('button', { name: /Theme/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu', { name: 'Theme' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Theme/ })).toBeFocused()
  expect(errors).toEqual([])
})

test('the tool rail compares, tests a link, selects, saves a group and keeps a notebook', async ({ page }) => {
  const errors = watchConsole(page)
  await openAtlas(page, 1440)

  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  const compare = page.getByRole('region', { name: 'Compare' })
  await expect(compare.getByRole('img', { name: /Correlation between/ })).toBeVisible({ timeout: 30_000 })
  await expect(compare.getByText('Year')).toContainText('0.31')
  await compare.getByLabel('B', { exact: true }).selectOption({ label: 'Fixture Gamma' })
  await expect(compare.getByText(/vs \d+ companies/)).toBeVisible()

  await page.getByRole('button', { name: 'Test a link', exact: true }).click()
  const dock = page.getByRole('region', { name: 'Test a link' })
  await expect(dock.getByText('Tests run in this session: 0. Each one raises the bar for the next.')).toBeVisible()
  await dock.getByRole('button', { name: 'Run the test' }).click()
  await expect(dock.getByRole('rowheader', { name: 'Report days' })).toBeVisible({ timeout: 30_000 })
  await expect(dock.getByText(/test 1 of this session/)).toBeVisible()
  await dock.getByRole('button', { name: 'Run again' }).click()
  await expect(dock.getByText(/test 2 of this session/)).toBeVisible({ timeout: 30_000 })
  await expect(dock.getByText('< 0.025 (0.05 ÷ 2 tests)')).toBeVisible()
  if (process.env.PLAYWRIGHT_CAPTURE) await page.screenshot({ path: 'test-results/market-atlas-pro-test-1440.png' })
  await page.getByRole('application', { name: /Relationship atlas/ }).focus()
  await page.keyboard.press('Escape')
  await expect(dock).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Test a link', exact: true })).toBeFocused()

  // a lasso around most of the map selects the companies inside it
  await page.getByRole('button', { name: 'Select companies', exact: true }).click()
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('no canvas')
  const at = (x: number, y: number) => [box.x + box.width * x, box.y + box.height * y] as const
  await page.mouse.move(...at(0.12, 0.25))
  await page.mouse.down()
  for (const [x, y] of [[0.5, 0.22], [0.88, 0.25], [0.9, 0.6], [0.88, 0.85], [0.5, 0.88], [0.12, 0.85], [0.1, 0.5], [0.12, 0.26]] as const) await page.mouse.move(...at(x, y), { steps: 4 })
  await page.mouse.up()
  const tray = page.getByRole('region', { name: 'Selection' })
  await expect(tray).toContainText(/\d+ companies/, { timeout: 30_000 })
  // the selection's cohesion comes from the backend once the selection settles
  await expect(tray).toContainText(/avg corr 0\.\d\d/, { timeout: 30_000 })
  await tray.getByRole('button', { name: 'Save group' }).click()
  await tray.getByRole('textbox', { name: 'Group name' }).fill('Fixture picks')
  await tray.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Groups', exact: true }).click()
  await expect(page.getByText('Fixture picks')).toBeVisible()

  await tray.getByRole('button', { name: 'Note' }).click()
  const notebook = page.getByRole('region', { name: 'Notebook' })
  await expect(notebook.getByText(/companies/).first()).toBeVisible()
  await notebook.getByRole('textbox').first().fill('Worth a look')
  // both lists survive a reload: they live in this browser
  await page.reload()
  await expect(page.getByRole('application', { name: /Relationship atlas/ })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  const reloaded = page.getByRole('region', { name: 'Notebook' })
  await expect(reloaded.getByRole('textbox').first()).toHaveValue('Worth a look')
  await reloaded.getByRole('button', { name: /^Open / }).first().click()
  await expect(page.getByRole('region', { name: 'Selection' })).toBeVisible()
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  await page.getByRole('region', { name: 'Notebook' }).getByRole('button', { name: /^Delete / }).first().click()
  await expect(page.getByRole('region', { name: 'Notebook' }).getByText('Nothing saved yet.')).toBeVisible()
  expect(errors).toEqual([])
})

test('the local routes pass Pro answers on and validate what they forward', async ({ request }) => {
  expect((await request.get('/api/atlas/weeks')).status()).toBe(200)
  expect((await request.get('/api/atlas/set?members=FXA1,FXA2&asOf=2026-10-16')).status()).toBe(200)
  expect((await request.get(`/api/atlas/set?members=${Array.from({ length: 201 }, (_, i) => `S${i}`).join(',')}`)).status()).toBe(400)
  expect((await request.get('/api/atlas/set?members=../x')).status()).toBe(400)
  expect((await request.get(`/api/atlas?level=1&asOf=${weeksAgo(3)}`)).status()).toBe(200)
  expect((await request.get('/api/atlas?level=1&asOf=2026-13-40')).status()).toBe(400)
  expect((await request.get('/api/atlas?level=1&lens=market')).status()).toBe(400)
  expect((await request.get('/api/atlas/compare?a=FXA1&b=FXA1')).status()).toBe(422)
  const test = await request.get('/api/atlas/test?from=zone:fx-zone-gamma&to=group:FXB1,FXB2&testsRun=1&asOf=2026-10-16')
  expect(test.status()).toBe(200)
  expect((await test.json()).reportDays).toEqual({ value: 31, pass: true })
  expect((await request.get('/api/atlas/test?from=FXA1&to=FXB1&testsRun=0')).status()).toBe(400)
  expect((await request.get('/api/atlas/zones/fx-zone-alpha?lens=total')).status()).toBe(200)
})
