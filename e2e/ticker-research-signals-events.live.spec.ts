import { expect, test, type Page, type TestInfo } from '@playwright/test'

const runLiveTickerQa = process.env.RUN_TICKER_LIVE_QA === '1'

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function expectResearchContext(page: Page, active: 'Signals' | 'Events') {
  // Every tab is a plain link: the navigation has no menus or buttons.
  const nav = page.getByRole('navigation', { name: 'Ticker research' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page')
}

test.describe('ticker Signals & Events Phase 2 slice', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('directional signals are withdrawn while the events page remains public', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/signals')
    await expect(page.getByRole('heading', { name: 'Directional signals', exact: true })).toBeVisible()
    await expect(page.getByText('Directional signals are currently unavailable. Price history and company research remain available.')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page,testInfo,'directional-signals-withdrawn')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/events')
    await expectResearchContext(page, 'Events')
    await expect(page.getByRole('heading', { name: 'Next earnings', exact: true })).toBeVisible()
    // Chapters in their order: next results, calendar, results against estimates, documents.
    const chapters = await page.locator('[data-research-chapter]').evaluateAll((nodes) => nodes.map((node) => node.id))
    expect(chapters.slice(0, 3)).toEqual(['next-event', 'calendar', 'reported-against-estimate'])
    // One entry per filed document, not one per time we observed it: the read model is bitemporal.
    const documents = await page.locator('[data-event-documents] li strong').allTextContents()
    expect(new Set(documents).size).toBe(documents.length)
    // No source ids and no blank cells in the table.
    await expect(page.getByText(/^Source: /)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-events-aapl-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-events-aapl-mobile')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/QQQ/events')
    await expect(page.getByRole('heading', { name: 'Reported against estimate', exact: true })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-events-qqq-fund')
  })
})
