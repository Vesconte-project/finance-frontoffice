import { expect, test, type Page } from '@playwright/test'

/**
 * The Events tab (synthetic QAS fixtures from the backend stub): the next results
 * with how long until, events on the price, results drawn against the estimate,
 * and filings with plain names.
 */

const capture = process.env.PLAYWRIGHT_CAPTURE

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function noHorizontalOverflow(page: Page) {
  const { client, scroll } = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(scroll).toBeLessThanOrEqual(client + 1)
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the events tab reads as a timeline (${viewport.width}px)`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize(viewport)
    await page.goto('/stocks/QAS/events')

    // Next results: a compact card in the timeline's side column, with how long until.
    await expect(page.locator('#timeline #next-event[data-next-event]')).toBeVisible()
    await expect(page.locator('#next-event')).toContainText(/in 2 days|tomorrow/)

    // Events on the price, with a reading for the chosen one.
    const timeline = page.locator('[data-event-timeline]')
    await expect(timeline).toBeVisible()
    const plot = timeline.locator(`[data-chart-variant="${viewport.width >= 900 ? 'wide' : 'compact'}"]`)
    await expect(plot.getByRole('button').first()).toBeVisible()
    await expect(page.locator('[data-timeline-reading]')).toBeVisible()

    // Only dividends: every marker left is a dividend.
    await timeline.getByRole('button', { name: /^Dividend/ }).first().click()
    const kinds = await plot.getByRole('button').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-category')))
    expect(kinds.length).toBeGreaterThan(0)
    expect(new Set(kinds)).toEqual(new Set(['dividends']))

    // A past event reads its next session.
    const pastMarker = plot.locator('button:not([data-upcoming])').last()
    await pastMarker.click()
    await expect(pastMarker).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-timeline-reading]')).toContainText('Dividend')
    // The chosen event says more than its title: here at least the day's close.
    await expect(page.locator('[data-timeline-reading] [data-timeline-facts]')).toContainText('Close that day')

    // Wide: the reading sits beside the chart, not under it.
    if (viewport.width >= 900) {
      const chart = await plot.boundingBox()
      const reading = await page.locator('[data-timeline-reading]').boundingBox()
      expect(reading?.x ?? 0).toBeGreaterThan((chart?.x ?? 0) + (chart?.width ?? 0) - 1)
    }

    // Results against estimate are drawn.
    await expect(page.locator('[data-earnings-measure="eps"]')).toBeVisible()

    await noHorizontalOverflow(page)
    if (capture) await page.screenshot({ path: `test-results/events-tab-${viewport.width}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('reduced motion keeps the events tab at rest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/stocks/QAS/events')
  const actual = page.locator('[data-earnings-measure="eps"] [data-chart-variant="wide"] circle').last()
  await expect(actual).toBeAttached()
  expect(await actual.evaluate((node) => getComputedStyle(node).animationName)).toBe('none')
})
