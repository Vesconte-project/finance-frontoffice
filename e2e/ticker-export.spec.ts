import { expect, test } from '@playwright/test'

for (const width of [320, 390, 1366, 1920]) {
  test(`CSV export sign-in recovery and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/stocks/QAK')
    const trigger = page.getByRole('button', { name: 'Export QAK data as CSV' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Export QAK' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', /\/sign-in\?redirect_url=/)
    await expect(dialog.getByRole('link', { name: 'explore Pro', exact: true })).toHaveAttribute('href', '/pricing')
    await expect(dialog.getByRole('button', { name: 'Download CSV' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    const response = await page.request.get('/api/stocks/QAK/export?dataset=prices')
    expect(response.status()).toBe(401)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(response.headers()['content-disposition']).toBeUndefined()
  })
}
