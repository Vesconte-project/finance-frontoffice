import { expect, test } from '@playwright/test'

// QASUSP is a wholly synthetic listing; no production data or identity.
for (const width of [390, 1366, 1920]) {
  test(`suspended ticker preserves dated history without current metrics at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('/stocks/QASUSP')
    await expect(page.getByRole('heading', { name: 'Dados temporariamente suspensos' })).toBeVisible()
    await expect(page.getByText('Foram detetadas inconsistências nos dados do fornecedor.')).toBeVisible()
    await expect(page.locator('[data-suspended-history]')).toBeVisible()
    await expect(page.locator('[data-ticker-price]')).toHaveCount(0)
    await expect(page.locator('[data-display-currency]')).toHaveCount(0)
    await expect(page.locator('[data-suspended-history]')).not.toContainText('2026-09-24')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const line = page.locator('[data-suspended-history] path[pathLength="1"]')
    await expect(line).toHaveCSS('stroke-dashoffset', '0px')
    await page.screenshot({ path: testInfo.outputPath(`synthetic-suspended-${width}.png`), fullPage: true })
    // An old deep link must not restore a frozen current ranking.
    await page.goto('/stocks/QASUSP/rankings')
    await expect(page.getByRole('heading', { name: 'Dados temporariamente suspensos' })).toBeVisible()
    await expect(page.locator('[data-ticker-price]')).toHaveCount(0)
  })
}

// No summary is served for unmodelled tickers: never infer an active lifecycle.
test('missing lifecycle summary does not expose a current ranking', async ({ page }) => {
  await page.goto('/stocks/QAUNKNOWN/rankings')
  await expect(page.getByRole('status').filter({ hasText: 'Ticker status is temporarily unavailable.' })).toBeVisible()
  await expect(page.locator('[data-ticker-rankings]')).toHaveCount(0)
  await expect(page.locator('[data-ticker-price]')).toHaveCount(0)
  await expect(page.locator('[data-display-currency]')).toHaveCount(0)
})
