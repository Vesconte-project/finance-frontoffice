import { expect, test } from '@playwright/test'

test('description provenance and reported earnings render from published summary fields', async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/stocks/QAS/business')
    await expect(page.locator('[data-business-description]')).toHaveText('A synthetic company description for browser QA.')
    await expect(page.locator('[data-description-source]')).toHaveText('Source: Yahoo Finance · retrieved Oct 30, 2026')
    await expect(page.locator('[data-business-description]').locator('..').getByText('Being built', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`description-${width}.png`), fullPage: true })
    await page.goto('/stocks/QAS/events')
    const nextDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(Date.now() + 2 * 86_400_000)
    await expect(page.locator('#next-event')).toContainText(nextDate)
    await expect(page.locator('#reported-against-estimate tbody tr')).toHaveCount(2)
    await expect(page.locator('#reported-against-estimate tbody')).toContainText('2026Q3')
    // EPS is drawn against its estimate; what the source does not carry yet is one sentence, not empty columns.
    await expect(page.locator('#reported-against-estimate [data-earnings-measure="eps"]')).toBeVisible()
    await expect(page.locator('#reported-against-estimate [data-earnings-measure="revenue"]')).toHaveCount(0)
    await expect(page.locator('#reported-against-estimate')).toContainText('Revenue, its estimate and the surprise for each quarter are being added.')
    await expect(page.locator('#reported-against-estimate thead')).not.toContainText('Revenue')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`earnings-${width}.png`), fullPage: true })
  }
})


test('past earnings dates keep the existing Being built state and unknown source identifiers stay hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/stocks/QAM/events')
  await expect(page.locator('#next-event').getByText('Being built', { exact: true })).toBeVisible()
  await expect(page.locator('#next-event')).not.toContainText('2000')
  await page.goto('/stocks/QAM/business')
  await expect(page.locator('[data-business-description]')).toBeVisible()
  await expect(page.locator('[data-description-source]')).toHaveCount(0)
  await expect(page.getByText('data_ops', { exact: true })).toHaveCount(0)
})
