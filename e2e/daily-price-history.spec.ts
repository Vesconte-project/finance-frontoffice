import { expect, test } from '@playwright/test'
import { annotateFixture } from './fixtures/display-currency.mjs'
import { tickerPricePageFixture } from './fixtures/ticker-page.mjs'

for (const ticker of ['QAHIST', 'QANEW']) {
  for (const currency of [null, 'EUR']) {
    test(`${ticker} (${currency ?? 'reported'}): short ranges use daily prices and ALL retains ordered complete history`, async ({ page }, testInfo) => {
      if (ticker === 'QANEW') {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.emulateMedia({ reducedMotion: 'reduce' })
      }
      await page.goto(`/stocks/${ticker}${currency ? `?currency=${currency}` : ''}`)
      await page.getByRole('button', { name: 'Expand chart', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: ticker, exact: true })
      const chart = dialog.locator('[data-expanded-chart-canvas]')
      await expect(dialog).toBeVisible()
      const requests: string[] = []
      page.on('request', request => {
        if (/\/api\/stocks\/.*\/(history|ohlc)/.test(request.url())) requests.push(request.url())
      })
      await dialog.getByRole('radio', { name: '1M', exact: true }).click()
      await expect(chart).toHaveAttribute('data-price-resolution', 'daily')
      const count = Number(await chart.getAttribute('data-visible-price-count'))
      expect(count).toBeGreaterThanOrEqual(21)
      expect(count).toBeLessThanOrEqual(24)
      const dailyDates = (await chart.getAttribute('data-price-dates'))!.split(',')
      expect(dailyDates.every((date, i) => i === 0 || date > dailyDates[i - 1])).toBeTruthy()
      await expect(dialog.locator('canvas')).toBeVisible()
      await dialog.getByRole('radio', { name: 'ALL', exact: true }).click()
      await expect(chart).toHaveAttribute('data-price-resolution', 'weekly')
      const dates = (await chart.getAttribute('data-price-dates'))!.split(',')
      expect(new Set(dates).size).toBe(dates.length)
      expect(dates.every((date, i) => i === 0 || date > dates[i - 1])).toBeTruthy()
      const pages = []
      let end: string | undefined
      do {
        const result = tickerPricePageFixture(ticker, 'ohlc', 0, end)
        pages.unshift(...result.rows)
        end = result.nextEnd ?? undefined
      } while (end)
      const shownRows = currency ? annotateFixture('ohlc', pages, { listingCurrency: 'USD', target: currency }).filter((row: { money?: { close?: { converted?: unknown } } }) => row.money?.close?.converted) : pages
      expect(dates).toEqual(shownRows.map((row: { date: string }) => row.date))
      if (ticker === 'QAHIST') expect(dates[0]).toMatch(currency ? /^2010-/ : /^2000-/)
      else expect(Date.parse(dates.at(-1)!) - Date.parse(dates[0])).toBeLessThan(365 * 86_400_000)
      const label = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
      await expect(dialog.locator('#expanded-chart-summary')).toContainText(`From ${label(dates[0])} to ${label(dates.at(-1)!)}:`)
      await expect(dialog.locator('[data-expanded-chart-legend]')).toContainText(label(dates.at(-1)!))
      await page.screenshot({ path: testInfo.outputPath('all.png') })
      await dialog.getByRole('radio', { name: '1M', exact: true }).click()
      await expect(chart).toHaveAttribute('data-price-resolution', 'daily')
      await page.screenshot({ path: testInfo.outputPath('daily.png') })
      expect(requests).toEqual([])
    })
  }
}
