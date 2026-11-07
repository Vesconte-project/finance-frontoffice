import { expect, test } from '@playwright/test'
import { tickerPricePageFixture } from './fixtures/ticker-page.mjs'

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`))

for (const currency of [null, 'USD', 'EUR']) {
  test(`all backward backend pages stay chronological in history and OHLC (${currency ?? 'reported'})`, async ({ page }) => {
    const query = currency ? `?currency=${currency}` : ''
    // The normal BFF and server-component loaders talk to the paginated backend
    // stub. No browser interception supplies a pre-sorted or pre-joined series.
    await page.goto(`/stocks/QA30${query}`)
    const response = await page.request.get(`/api/stocks/QA30/history${query}`)
    expect(response.ok()).toBeTruthy()
    const points: Array<{ date: string; converted?: number | null }> = await response.json()
    const pages = []
    let end: string | undefined
    do {
      const next = tickerPricePageFixture('QA30', 'history', 0, end)
      pages.push(next)
      end = next.nextEnd ?? undefined
    } while (end)
    const expected = pages.flatMap(page => page.rows).sort((a, b) => a.date.localeCompare(b.date))
    expect(points.map(point => point.date)).toEqual(expected.map(point => point.date))
    expect(new Set(points.map(point => point.date)).size).toBe(points.length)
    expect(points.every((point, i) => i === 0 || point.date > points[i - 1].date)).toBeTruthy()

    expect(points[0].date.slice(0, 4)).toBe('1991')
    const visible = currency ? points.filter(point => typeof point.converted === 'number') : points

    await page.getByRole('button', { name: 'Expand chart' }).click()
    const dialog = page.getByRole('dialog', { name: 'QA30' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('radio', { name: 'ALL', exact: true }).click()
    await expect(dialog.locator('#expanded-chart-summary')).toContainText(
      `From ${dateLabel(visible[0].date)} to ${dateLabel(visible.at(-1)!.date)}:`,
    )
    await expect(dialog.locator('[data-expanded-chart-legend]')).toContainText(dateLabel(visible.at(-1)!.date))
    if (currency === 'EUR') {
      expect(visible[0].date.slice(0, 4)).toBe('2010') // The fixture deliberately has no earlier EUR rates.
      await expect(dialog.locator('[data-conversion-coverage]')).toBeVisible()
      await expect(dialog.locator('[data-conversion-coverage]')).toContainText(`${points.length - visible.length} sessions have no currency conversion`)
      await expect(dialog.locator('[data-conversion-coverage]')).toContainText(`Reported history in USD starts ${dateLabel(points[0].date)}`)
    } else {
      expect(visible[0].date).toBe(points[0].date)
      await expect(dialog.locator('[data-conversion-coverage]')).toHaveCount(0)
    }
  })
}
