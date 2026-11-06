import { expect, test } from '@playwright/test'

test('current target range, canonical distance and recommendations fit the existing chapter', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/stocks/QAS/valuation')
  const chapter = page.locator('#analysts')
  await expect(chapter).toContainText('$400.00')
  await expect(chapter).toContainText('25% above the latest price')
  await expect(chapter).toContainText('12 analyst opinions')
  await expect(chapter.getByRole('img', { name: /Targets for QAS/ })).toBeVisible()
  await expect(chapter).toContainText('Being built')
  for (const width of [320, 390, 480, 768, 820, 1024, 1366, 1440, 1536, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }))
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1)
    if ([390, 1366, 1920].includes(width)) await chapter.screenshot({ path: info.outputPath(`analysts-${width}.png`) })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await expect(chapter.getByRole('img')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('missing median and absent snapshot do not acquire fabricated analyst content', async ({ page }) => {
  await page.goto('/stocks/QAM/valuation')
  await expect(page.locator('#analysts')).toContainText('Being built')
  await expect(page.locator('#analysts')).not.toContainText('€100')
  await expect(page.locator('#analysts').getByRole('img')).toHaveCount(0)
  await page.goto('/stocks/QAL/valuation')
  await expect(page.locator('#analysts')).toContainText('Being built')
  await expect(page.locator('#analysts').getByRole('img')).toHaveCount(0)
})
