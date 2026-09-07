import { expect, test, type Page, type TestInfo } from '@playwright/test'

const runLiveTickerQa = process.env.RUN_TICKER_LIVE_QA === '1'

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function capture(page: Page, testInfo: TestInfo, name: string, fullPage = true) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage })
}

test.describe('ticker valuation and ownership Phase 2 slice', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('Valuation shows every multiple the contract answers for, and omits the rest', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/valuation')
    await expect(page.getByRole('heading', { name: 'P/E', exact: true })).toBeVisible()
    await expect(page.locator('[data-temporal-line-chart]').first()).toBeVisible()
    await expect(page.locator('[data-chart-state="available"]').first()).toBeVisible()
    const valuationChart = page.locator('[data-temporal-line-chart]').first()
    const chartBox = await valuationChart.boundingBox()
    if (!chartBox) throw new Error('Valuation chart has no bounding box')
    await page.mouse.move(chartBox.x + chartBox.width * 0.72, chartBox.y + chartBox.height * 0.5)
    await expect(page.locator('[data-chart-tooltip]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Valuation', exact: true })).toHaveAttribute('aria-current', 'page')
    // A multiple the contract does not answer for is still listed, so the
    // reader can tell one we do not track from one we track and have nothing
    // for. P/S is the one with no observations.
    await expect(page.getByRole('heading', { name: 'P/S', exact: true })).toBeVisible()
    await expect(page.getByText('Not covered for AAPL yet').first()).toBeVisible()
    await expect(page.locator('[data-chart-state="empty"]')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-valuation-aapl-trade-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-valuation-aapl-trade-mobile')
  })

  test('Ownership and Fund Structure preserve asset-aware semantics', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/ownership')
    await expect(page.getByRole('heading', { name: 'Ownership & Capital', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ownership breakdown', exact: true })).toBeVisible()
    await expect(page.getByText('Enterprise value', { exact: true })).toBeVisible()
    await expect(page.getByText('Market cap', { exact: true }).first()).toBeVisible()
    const researchNav = page.getByRole('navigation', { name: 'Ticker research' })
    await expect(researchNav.getByRole('link', { name: 'Ownership & Capital', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(researchNav.getByRole('button')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ownership-aapl-long-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ownership-aapl-long-mobile')

    await page.goto('/stocks/QQQ/ownership')
    await expect(page.getByRole('heading', { name: 'Fund Structure', exact: true })).toBeVisible()
    await expect(page.getByText(/no corporate ownership model applied/)).toBeVisible()
    await expect(page.getByText('Insider', { exact: true })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ownership-qqq-fund-structure')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('2')
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ownership-qqq-200-zoom')
  })
})
