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

  test('Signals consolidates indicator families and redirects the legacy indicators route', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/signals')
    await expectResearchContext(page, 'Signals')
    await expect(page.getByRole('heading', { name: 'Model signal', exact: true })).toBeVisible()
    await expect(page.locator('#signal-timeline')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Summary', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Oscillators', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Moving averages', exact: true })).toBeVisible()
    // Spec PRD-78 global rules: no loose legend, no static range pill.
    await expect(page.getByLabel('Signal direction legend')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Signal history', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Regime history', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-signals-aapl-trade-desktop')

    await page.goto('/stocks/AAPL/signals?family=oscillators')
    await expectResearchContext(page, 'Signals')
    await expect(page).toHaveURL(/family=oscillators/)
    await expect(page.locator('details[open]').filter({ hasText: 'Each indicator' })).toHaveCount(1)
    await capture(page, testInfo, 'phase2-signals-aapl-long-desktop')

    await page.goto('/stocks/AAPL/indicators?family=moving-averages')
    await expect(page).toHaveURL(/\/stocks\/AAPL\/signals\?family=moving-averages/)
    await expect(page.getByRole('heading', { name: 'Model signal', exact: true })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-signals-aapl-mobile')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('2')
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-signals-aapl-200-zoom')
  })

  test('Signals and Events keep asset-aware partial states', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/stocks/0005.HK/signals')
    await expectResearchContext(page, 'Signals')
    await expect(page.getByRole('heading', { name: 'Model signal', exact: true })).toBeVisible()
    await expect(page.getByText(/Unavailable|Partial coverage|Not enough price history|Being built/).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-signals-partial-equity')

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
