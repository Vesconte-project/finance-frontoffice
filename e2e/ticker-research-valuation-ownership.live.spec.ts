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

  test('Valuation reads as four chapters, with the reported multiples drawn', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/valuation')
    const chapters = await page.locator('[data-research-chapter]').evaluateAll((nodes) => nodes.map((node) => node.id))
    expect(chapters).toEqual(['multiples', 'peers', 'price-assumes', 'analysts'])
    await expect(page.getByRole('heading', { name: 'All four', exact: true })).toBeVisible()
    await expect(page.locator('[data-multiple]')).toHaveCount(4)
    await expect(page.getByRole('link', { name: 'Valuation', exact: true })).toHaveAttribute('aria-current', 'page')
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase4-valuation-aapl-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase4-valuation-aapl-mobile')
  })

  test('Ownership and Fund Structure preserve asset-aware semantics', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/ownership')
    await expect(page.getByRole('heading', { name: 'Ownership & Capital', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Who owns the shares', exact: true })).toBeVisible()
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
    await expect(page.getByText(/company measures such as insider ownership/)).toBeVisible()
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
