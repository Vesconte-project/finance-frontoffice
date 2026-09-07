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
  const nav = page.getByRole('navigation', { name: 'Ticker research' })
  await expect(nav).toBeVisible()
  const trigger = active === 'Signals'
    ? nav.getByRole('button', { name: active, exact: true })
    : nav.getByRole('link', { name: active, exact: true })
  await expect(trigger.locator('..')).toHaveAttribute('data-active', 'true')
}

test.describe('ticker Signals & Events Phase 2 slice', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('Signals consolidates indicator families and redirects the legacy indicators route', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/signals')
    await expectResearchContext(page, 'Signals')
    await expect(page.locator('h1')).toHaveText('Signals & Indicators')
    await expect(page.locator('#current-signal-heading')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Summary', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Oscillators', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Moving Averages', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Signal History', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Regime History', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-signals-aapl-trade-desktop')

    await page.goto('/stocks/AAPL/signals?family=oscillators')
    await expectResearchContext(page, 'Signals')
    await expect(page).toHaveURL(/family=oscillators/)
    await expect(page.locator('details[open]').filter({ hasText: 'Indicator details' })).toHaveCount(1)
    await capture(page, testInfo, 'phase2-signals-aapl-long-desktop')

    await page.getByRole('button', { name: 'Signals', exact: true }).click()
    await expect(page.getByRole('menu', { name: 'Signals' })).toBeVisible()
    await capture(page, testInfo, 'phase2-signals-submenu-active')

    await page.goto('/stocks/AAPL/indicators?family=moving-averages')
    await expect(page).toHaveURL(/\/stocks\/AAPL\/signals\?family=moving-averages/)
    await expect(page.locator('h1')).toHaveText('Signals & Indicators')

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
    await expect(page.locator('h1')).toHaveText('Signals & Indicators')
    await expect(page.getByText(/Unavailable|Partial coverage|Pending integration/).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-signals-partial-equity')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/events')
    await expectResearchContext(page, 'Events')
    await expect(page.getByRole('heading', { name: 'Next earnings', exact: true })).toBeVisible()
    // One entry per event, not one per time we observed it. The read model is
    // bitemporal, and the next earnings date used to appear once per knownAt.
    await expect(page.getByRole('listitem').filter({ hasText: 'Earnings 2026Q4' })).toHaveCount(1)
    // The earnings history is on the page rather than behind a third tab.
    await expect(page.getByRole('heading', { name: 'Reported against estimate', exact: true })).toBeVisible()
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
