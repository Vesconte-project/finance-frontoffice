import { expect, test } from '@playwright/test'

test.describe('progressive market universe', () => {
  test('loads communities first and opens one bounded company constellation', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await page.setViewportSize({ width: 1440, height: 920 })
    await page.goto('/markets/network')

    await expect(page.getByRole('region', { name: 'Market relationship map' })).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    if (process.env.PLAYWRIGHT_CAPTURE === '1') {
      await page.waitForTimeout(800)
      await page.screenshot({ path: testInfo.outputPath('economic-atlas-overview.png'), fullPage: false })
    }
    const navigator = page.getByLabel('Browse economic atlas')
    await navigator.getByText('Browse atlas').click()
    const community = navigator.getByRole('button').first()
    await expect(community).toBeVisible()
    await community.click()

    await expect(page.getByRole('button', { name: 'Full economy' })).toBeVisible()
    await expect(page.getByText(/companies$/).first()).toBeVisible()
    const companyGrid = page.getByLabel('Companies in this field')
    await expect(companyGrid).toBeVisible()
    if (process.env.PLAYWRIGHT_CAPTURE === '1') {
      await page.waitForTimeout(700)
      await page.screenshot({ path: testInfo.outputPath('economic-atlas-field.png'), fullPage: false })
    }
    await companyGrid.getByRole('button').first().click()
    await expect(page.getByRole('button', { name: 'Economic field' })).toBeVisible()
    if (process.env.PLAYWRIGHT_CAPTURE === '1') {
      await page.waitForTimeout(700)
      await page.screenshot({ path: testInfo.outputPath('economic-atlas-company.png'), fullPage: false })
    }
    await page.getByRole('button', { name: 'Economic field' }).click()
    await expect(page.getByLabel('Companies in this field')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    expect(consoleErrors).toEqual([])
  })

  test('keeps the static reading and touch controls on mobile with reduced motion', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/markets/network?window=126&view=residual')

    await expect(page.getByRole('region', { name: 'Market relationship map' })).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: /View/ })).toBeVisible()
    await expect(page.getByLabel('Evidence window')).toBeVisible()
    await expect(page.getByLabel('How to read the economic atlas')).toBeVisible()
    if (process.env.PLAYWRIGHT_CAPTURE === '1') {
      await page.waitForTimeout(200)
      await page.screenshot({ path: testInfo.outputPath('economic-atlas-mobile-reduced.png'), fullPage: false })
    }
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    expect(consoleErrors).toEqual([])
  })
})
