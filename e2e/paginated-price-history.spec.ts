import { expect, test } from '@playwright/test'
import { tickerPricePageFixture } from './fixtures/ticker-page.mjs'

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`))

for (const currency of [null, 'EUR']) {
  test(`three backward backend pages stay chronological in history and OHLC (${currency ?? 'reported'})`, async ({ page }) => {
    const query = currency ? `?currency=${currency}` : ''
    // The normal BFF and server-component loaders talk to the paginated backend
    // stub. No browser interception supplies a pre-sorted or pre-joined series.
    await page.goto(`/stocks/QA30${query}`)
    const response = await page.request.get(`/api/stocks/QA30/history${query}`)
    expect(response.ok()).toBeTruthy()
    const points: Array<{ date: string }> = await response.json()
    expect(points).toHaveLength(1800)
    expect(new Set(points.map(point => point.date)).size).toBe(1800)
    expect(points.every((point, i) => i === 0 || point.date > points[i - 1].date)).toBeTruthy()

    const newest = tickerPricePageFixture('QA30', 'history', 0)
    const middle = tickerPricePageFixture('QA30', 'history', 0, newest.nextEnd!)
    const oldest = tickerPricePageFixture('QA30', 'history', 0, middle.nextEnd!)
    expect(oldest.nextEnd).toBeNull()
    expect(points[0].date).toBe(oldest.rows[0].date)
    expect(points.at(-1)?.date).toBe(newest.rows.at(-1)!.date)

    await page.getByRole('button', { name: 'Expand chart' }).click()
    const dialog = page.getByRole('dialog', { name: 'QA30' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('radio', { name: 'ALL', exact: true }).click()
    await expect(dialog.locator('#expanded-chart-summary')).toContainText(
      `From ${dateLabel(oldest.rows[0].date)} to ${dateLabel(newest.rows.at(-1)!.date)}:`,
    )
    await expect(dialog.locator('[data-expanded-chart-legend]')).toContainText(dateLabel(newest.rows.at(-1)!.date))
  })
}
