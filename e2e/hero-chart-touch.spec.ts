import { expect, test } from '@playwright/test'

/*
 * The ticker hero's line chart must read prices on touch as it does on mouse
 * hover. Uses the synthetic fixture ticker QAS (e2e/fixtures/ticker-page.mjs).
 */

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

test('a tap reads a price, a horizontal drag moves it, a tap outside closes it', async ({ page }) => {
  await page.goto('/stocks/QAS')
  const chart = page.locator('[data-temporal-line-chart]').first()
  await expect(chart.locator('svg')).toBeVisible({ timeout: 60_000 })
  const tooltip = chart.locator('[data-chart-tooltip]')
  const box = (await chart.locator('svg').boundingBox())!

  await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height * 0.5)
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('$')
  const first = await tooltip.textContent()

  // Horizontal drag through CDP touch events scrubs to another day.
  const client = await page.context().newCDPSession(page)
  const y = box.y + box.height * 0.5
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.3, y }] })
  for (let step = 1; step <= 8; step += 1) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (0.3 + step * 0.05), y }] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(tooltip).toBeVisible()
  await expect(tooltip).not.toHaveText(first ?? '')

  // The reading stays after the finger lifts, and a tap elsewhere closes it.
  await page.touchscreen.tap(20, box.y + box.height + 160)
  await expect(tooltip).toHaveCount(0)
})
