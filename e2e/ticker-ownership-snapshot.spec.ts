import { expect, test } from '@playwright/test'

test('aggregate ownership reads independently and fits the chapter at every width', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/stocks/QAS/valuation')
  await expect(page.locator('#analysts')).toContainText('$400.00')
  await page.goto('/stocks/QAS/ownership')
  const chapter = page.locator('#who-owns')
  await expect(chapter.locator('[data-ownership-reading="institutions"]')).toContainText('90%')
  await expect(chapter.locator('[data-ownership-reading="insiders"]')).toContainText('20%')
  await expect(chapter).toContainText('Captured')
  await expect(chapter).toContainText('Largest holders')
  await expect(chapter.locator('[data-being-built-badge]')).toHaveCount(1)
  await expect(page.locator('#insiders [data-being-built-badge]').first()).toBeVisible()
  await expect(chapter.locator('svg, canvas')).toHaveCount(0)
  for (const width of [320, 390, 480, 768, 820, 1024, 1366, 1440, 1536, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    if ([390, 1366, 1920].includes(width)) {
      await chapter.screenshot({ path: info.outputPath(`ownership-${width}.png`) })
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('partial zero, absent and stale ownership preserve Being built without guessed groups', async ({ page }) => {
  await page.goto('/stocks/QAM/ownership')
  await expect(page.locator('[data-ownership-reading="insiders"]')).toContainText('0%')
  await expect(page.locator('[data-ownership-reading="institutions"] [data-being-built-badge]')).toBeVisible()
  for (const ticker of ['QAL', 'QAK']) {
    await page.goto(`/stocks/${ticker}/ownership`)
    await expect(page.locator('[data-ownership-snapshot]')).toHaveCount(0)
    await expect(page.locator('#who-owns [data-being-built-badge]').first()).toBeVisible()
  }
})
