import { expect, test } from '@playwright/test'

// ENG-272 review: the complete history streams after the page. While it is on its way, or when
// it fails, the last year must never pose as the complete history, and ALL must not open over it.
const heroRange = (page: import('@playwright/test').Page, range: string) =>
  page.getByRole('radiogroup', { name: 'Chart timeframe' }).getByRole('radio', { name: range, exact: true })

test('a delayed complete history: the page renders first, says so, then upgrades to ALL', async ({ page }) => {
  await page.goto('/stocks/QASLOW', { waitUntil: 'commit' })
  await expect(page.getByRole('radiogroup', { name: 'Chart timeframe' })).toBeVisible()

  await heroRange(page, 'ALL').click()
  const notice = page.locator('[data-full-history]')
  await expect(notice).toHaveAttribute('data-full-history', 'loading')
  await expect(notice).toContainText('Loading the full price history')
  await expect(page.getByRole('button', { name: 'Expand chart' })).toHaveCount(0)
  await page.getByRole('radiogroup', { name: 'Technical timeframe' }).getByRole('radio', { name: '1W', exact: true }).click()
  await expect(page.locator('[data-technical-base]')).toContainText('until the full price history loads')

  await expect(notice).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('[data-technical-base]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Expand chart' }).click()
  const dialog = page.getByRole('dialog', { name: 'QASLOW' })
  await dialog.getByRole('radio', { name: 'ALL', exact: true }).click()
  // ALL reaches the fixture's first weekly bar, ten years back, not the last year.
  await expect(dialog.locator('#expanded-chart-summary')).toContainText(/From \w{3} \d{1,2}, 2016 to /)
})

test('a failed complete history is an error, never the complete history', async ({ page }) => {
  await page.goto('/stocks/QAFAIL')
  await heroRange(page, 'ALL').click()
  const notice = page.locator('[data-full-history]')
  await expect(notice).toHaveAttribute('data-full-history', 'error')
  await expect(notice).toContainText('The full price history is unavailable right now')
  await expect(page.getByRole('button', { name: 'Expand chart' })).toHaveCount(0)
  await page.getByRole('radiogroup', { name: 'Technical timeframe' }).getByRole('radio', { name: '1M', exact: true }).click()
  await expect(page.locator('[data-technical-base]')).toContainText('Based on the last year only')
  await heroRange(page, '1Y').click()
  await expect(notice).toHaveCount(0) // the last year itself is complete
})

test('the display currency streams: the page does not wait for the conversion', async ({ page }) => {
  await page.goto('/stocks/QASLOW?currency=EUR', { waitUntil: 'commit' })
  await expect(page.getByRole('radiogroup', { name: 'Chart timeframe' })).toBeVisible()
  await expect(page.locator('[data-chart-currency-loading]')).toContainText('Converting the chart to EUR')
  await expect(page.locator('[data-chart-currency-loading]')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('[data-chart-currency-error]')).toHaveCount(0)
})


test('a successful complete history recovers after the initial year fails', async ({ page }) => {
  await page.goto('/stocks/QARECOVER')
  await expect(page.getByRole('radiogroup', { name: 'Chart timeframe' })).toBeVisible()
  await heroRange(page, 'ALL').click()
  await expect(page.getByRole('button', { name: 'Expand chart' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Expand chart' }).click()
  const dialog = page.getByRole('dialog', { name: 'QARECOVER' })
  await dialog.getByRole('radio', { name: 'ALL', exact: true }).click()
  await expect(dialog.locator('#expanded-chart-summary')).toContainText(/From \w{3} \d{1,2}, 2016 to /)
})
