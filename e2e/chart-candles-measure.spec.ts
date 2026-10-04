import { expect, test, type Page } from '@playwright/test'

/*
 * Candles in the ticker hero and measurement between two days (PRD-76), on
 * the synthetic fixture ticker QAS (e2e/fixtures/ticker-page.mjs).
 */

async function openTicker(page: Page) {
  await page.goto('/stocks/QAS')
  const chart = page.locator('[data-temporal-line-chart]').first()
  await expect(chart.locator('svg')).toBeVisible({ timeout: 60_000 })
  return chart
}

/** One-finger touch path through CDP; `holdMs` keeps the finger still first. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, holdMs: number) {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  if (holdMs) await page.waitForTimeout(holdMs)
  for (let step = 1; step <= 8; step += 1) {
    const point = { x: from.x + ((to.x - from.x) * step) / 8, y: from.y + ((to.y - from.y) * step) / 8 }
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the candle icon switches the hero and carries into the expanded chart', async ({ page }) => {
    const chart = await openTicker(page)
    const toggle = page.getByRole('button', { name: 'Show candles' })
    await toggle.click()
    await expect(chart).toHaveAttribute('data-chart-mode', 'candles')
    await expect(page.getByRole('button', { name: 'Show line' })).toHaveAttribute('aria-pressed', 'true')

    const box = (await chart.locator('svg').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5)
    const tooltip = chart.locator('[data-chart-tooltip]')
    for (const label of ['Open', 'High', 'Low', 'Close']) await expect(tooltip).toContainText(label)

    await page.getByRole('button', { name: 'Expand chart' }).click()
    const dialog = page.getByRole('dialog', { name: 'QAS' })
    await expect(dialog.getByRole('radio', { name: 'Candles' })).toBeChecked()
    await dialog.getByRole('radio', { name: 'Line' }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(chart).toHaveAttribute('data-chart-mode', 'line')
    await expect(page.getByRole('button', { name: 'Show candles' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('candles sweep in from the left when the hero switches to them', async ({ page }) => {
    const chart = await openTicker(page)
    await page.getByRole('button', { name: 'Show candles' }).click()
    await expect(chart).toHaveAttribute('data-chart-mode', 'candles')
    const sweeps = await page.evaluate(() =>
      document.getAnimations().filter((animation) => (animation as CSSAnimation).animationName?.includes('sweep-in')).length)
    expect(sweeps).toBe(1)
    await expect(chart.locator('g[mask]')).toHaveCount(1)
  })

  test('a mouse drag on the hero measures between two days; Escape clears it', async ({ page }) => {
    const chart = await openTicker(page)
    const box = (await chart.locator('svg').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 8 })
    await page.mouse.up()

    const summary = chart.locator('[data-measure-summary]')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('%')
    await expect(summary).toContainText(/\d+ days · \d+ sessions/)
    await expect(summary).toContainText('→')
    await expect(chart.locator('[data-measure-band]')).toHaveCount(1)

    // Nothing stacks: the corner buttons step aside, no price reading shows,
    // and the summary sits clear of the measured span.
    await expect(page.getByRole('button', { name: 'Expand chart' })).toBeHidden()
    await expect(chart.locator('[data-chart-tooltip]')).toHaveCount(0)
    const band = (await chart.locator('[data-measure-band] rect').boundingBox())!
    const card = (await summary.boundingBox())!
    expect(card.x + card.width <= band.x || card.x >= band.x + band.width).toBe(true)

    await page.keyboard.press('Escape')
    await expect(summary).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Expand chart' })).toBeVisible()
  })

  test('a click on the chart clears a finished measurement', async ({ page }) => {
    const chart = await openTicker(page)
    const box = (await chart.locator('svg').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 })
    await page.mouse.up()
    const summary = chart.locator('[data-measure-summary]')
    await expect(summary).toBeVisible()
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5)
    await expect(summary).toHaveCount(0)
  })

  test('Shift and drag measures in the expanded chart; Escape clears it before closing', async ({ page }) => {
    await openTicker(page)
    await page.getByRole('button', { name: 'Expand chart' }).click()
    const dialog = page.getByRole('dialog', { name: 'QAS' })
    const canvas = dialog.locator('[data-expanded-chart-canvas] canvas')
    const box = (await canvas.boundingBox())!

    await page.keyboard.down('Shift')
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.up('Shift')

    const summary = dialog.locator('[data-measure-summary]')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(/\d+ days · \d+ sessions/)
    // The summary takes the legend line above the chart instead of covering it.
    const card = (await summary.boundingBox())!
    expect(card.y + card.height).toBeLessThanOrEqual(box.y + 1)

    await canvas.focus()
    await page.keyboard.press('Escape')
    await expect(summary).toHaveCount(0)
    await expect(dialog).toBeVisible()
  })
})

test.describe('touch phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

  test('a held touch and drag measures on the hero without scrolling the page', async ({ page }) => {
    const chart = await openTicker(page)
    const box = (await chart.locator('svg').boundingBox())!
    const scrollBefore = await page.evaluate(() => window.scrollY)
    await touchDrag(
      page,
      { x: box.x + box.width * 0.25, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.75, y: box.y + box.height * 0.6 },
      600,
    )
    const summary = chart.locator('[data-measure-summary]')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(/\d+ days · \d+ sessions/)
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)

    // A tap on the chart clears it and reads that day instead.
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await expect(summary).toHaveCount(0)
    await expect(chart.locator('[data-chart-tooltip]')).toBeVisible()
  })

  test('a tap reading stays inside the chart and clear of the corner buttons', async ({ page }) => {
    const chart = await openTicker(page)
    await page.getByRole('button', { name: 'Show candles' }).click()
    const box = (await chart.locator('svg').boundingBox())!
    const buttons = (await page.getByRole('button', { name: 'Expand chart' }).locator('..').boundingBox())!
    for (const fraction of [0.04, 0.5, 0.97]) {
      await page.touchscreen.tap(box.x + box.width * fraction, box.y + box.height * 0.4)
      const tooltip = chart.locator('[data-chart-tooltip]')
      await expect(tooltip).toBeVisible()
      await expect(tooltip).toHaveCSS('opacity', '1')
      const card = (await tooltip.boundingBox())!
      expect(card.x).toBeGreaterThanOrEqual(box.x)
      expect(card.x + card.width).toBeLessThanOrEqual(box.x + box.width)
      const clearOfButtons = card.x >= buttons.x + buttons.width || card.y >= buttons.y + buttons.height
      expect(clearOfButtons).toBe(true)
    }
  })

  test('a hold that never moves keeps reading that day after release', async ({ page }) => {
    const chart = await openTicker(page)
    const box = (await chart.locator('svg').boundingBox())!
    const at = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.5 }
    await touchDrag(page, at, at, 700)
    await expect(chart.locator('[data-chart-tooltip]')).toBeVisible()
    await expect(chart.locator('[data-measure-summary]')).toHaveCount(0)
  })

  test('a quick drag still scrubs and does not measure', async ({ page }) => {
    const chart = await openTicker(page)
    const box = (await chart.locator('svg').boundingBox())!
    await touchDrag(
      page,
      { x: box.x + box.width * 0.25, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.6, y: box.y + box.height * 0.5 },
      0,
    )
    await expect(chart.locator('[data-chart-tooltip]')).toBeVisible()
    await expect(chart.locator('[data-measure-summary]')).toHaveCount(0)
  })

  test('a held touch and drag measures in the expanded chart', async ({ page }) => {
    await openTicker(page)
    await page.getByRole('button', { name: 'Expand chart' }).click()
    const dialog = page.getByRole('dialog', { name: 'QAS' })
    const box = (await dialog.locator('[data-expanded-chart-canvas] canvas').boundingBox())!
    await touchDrag(
      page,
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.5 },
      600,
    )
    await expect(dialog.locator('[data-measure-summary]')).toBeVisible()
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await expect(dialog.locator('[data-measure-summary]')).toHaveCount(0)
  })
})
