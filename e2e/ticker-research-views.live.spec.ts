import { expect, test, type Page, type TestInfo } from '@playwright/test'

const runLiveTickerQa = process.env.RUN_TICKER_LIVE_QA === '1'

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

function watchForReactRuntimeWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (text.includes('hydrated but some attributes') || text.includes('Each child in a list should have a unique')) {
      warnings.push(text)
    }
  })
  return warnings
}

test.describe('ticker research views Phase 2 slice', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('equity profile and horizontal Research navigation keep stable URLs', async ({ page }, testInfo) => {
    const runtimeWarnings = watchForReactRuntimeWarnings(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/profile')
    await expect(page.getByRole('heading', { name: 'Company Profile', exact: true })).toBeVisible()
    const tickerChrome = page.locator('[data-ticker-chrome="ready"]')
    await expect(tickerChrome).toBeVisible()
    await expect(tickerChrome.locator('[data-ticker-identity]')).toContainText('AAPL')
    await expect(tickerChrome.locator('[data-ticker-price]')).toBeVisible()
    await expect(tickerChrome.locator('[data-selected-ticker-node]')).toBeVisible()
    await expect(tickerChrome.locator('[data-ticker-relationship-field]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Perspective/ })).toHaveCount(0)
    await expect(page.getByText('Final grade', { exact: true })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-aapl-profile-long-desktop')

    const researchNav = page.getByRole('navigation', { name: 'Ticker research' })
    await expect(researchNav).toBeVisible()
    await expect(researchNav.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(researchNav.locator('[data-active="true"]')).toHaveCount(1)
    await expect(researchNav.getByRole('link', { name: 'Fundamentals', exact: true })).toHaveAttribute('href', '/stocks/AAPL/fundamentals')
    await expect(researchNav.getByText(/Perspective|Company & fund|Market evidence/)).toHaveCount(0)
    await capture(page, testInfo, 'phase2-research-nav-horizontal-desktop')

    const financialsLink = researchNav.getByRole('link', { name: 'Financials', exact: true })
    await expect(financialsLink).toHaveAttribute('href', '/stocks/AAPL/financials')
    await expect(researchNav.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('menu')).toHaveCount(0)

    const identityBeforeNavigation = await tickerChrome.locator('[data-ticker-identity]').textContent()
    const priceBeforeNavigation = await tickerChrome.locator('[data-ticker-price]').textContent()
    await researchNav.getByRole('link', { name: 'Fundamentals', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Fundamentals', exact: true })).toBeVisible()
    expect(await tickerChrome.locator('[data-ticker-identity]').textContent()).toBe(identityBeforeNavigation)
    expect(await tickerChrome.locator('[data-ticker-price]').textContent()).toBe(priceBeforeNavigation)
    await researchNav.getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Company Profile', exact: true })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    const ownershipLink = researchNav.getByRole('link', { name: 'Ownership & Capital', exact: true })
    await ownershipLink.scrollIntoViewIfNeeded()
    await expect(ownershipLink).toBeInViewport()
    await expect(ownershipLink).toHaveAttribute('href', '/stocks/AAPL/ownership')
    await expect(researchNav.getByRole('link', { name: 'AI Research', exact: true })).toHaveAttribute('href', '/stocks/AAPL/ai-research')
    await expect(researchNav.getByRole('link', { name: 'Methodology', exact: true })).toHaveAttribute('href', '/stocks/AAPL/methodology')
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-research-nav-horizontal-mobile')

    await page.setViewportSize({ width: 320, height: 568 })
    await expect(researchNav.getByRole('link', { name: 'Profile', exact: true })).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    expect(runtimeWarnings).toEqual([])
  })

  test('ticker navigation keeps its real chrome while research evidence streams', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/financials', { waitUntil: 'commit' })

    const loading = page.locator('[data-ticker-research-loading]')
    await expect(loading).toBeVisible()
    const pulse = loading.locator('[data-loading-pulse]')
    await expect(pulse).toBeVisible()
    await expect(pulse).toHaveAttribute('aria-label', 'Loading Financial Statements')
    await expect(pulse.locator('i')).toHaveCount(7)
    await expect(pulse.locator('i').first()).toHaveCSS('animation-name', /loading-point-phase/)
    await expect(loading).toHaveText('')
    await capture(page, testInfo, 'ticker-research-node-loading')
    await expect(page.locator('[data-ticker-chrome]')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Ticker research' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await expect(page.getByRole('heading', { name: 'Where each dollar of sales goes', exact: true })).toBeVisible()
    await expect(loading).toHaveCount(0)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/stocks/MSFT/valuation', { waitUntil: 'commit' })
    const reducedLoading = page.locator('[data-ticker-research-loading]')
    await expect(reducedLoading).toBeVisible()
    const reducedPulse = reducedLoading.locator('[data-loading-pulse]')
    await expect(reducedPulse.locator('i').first()).toHaveCSS('animation-name', 'none')
    await capture(page, testInfo, 'ticker-research-node-loading-mobile-reduced')
    await expectNoHorizontalOverflow(page)
    await expect(page.getByRole('heading', { name: 'Multiples, last 10 years', exact: true })).toBeVisible()
  })

  test('Fundamentals reads as four chapters in the Spec order', async ({ page }, testInfo) => {
    const runtimeWarnings = watchForReactRuntimeWarnings(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/fundamentals')
    const chapters = await page.locator('[data-research-chapter]').evaluateAll((nodes) => nodes.map((node) => node.id))
    expect(chapters).toEqual(['revenue', 'operating-margin', 'cash-and-debt', 'dividends'])
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase3-aapl-fundamentals-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase3-aapl-fundamentals-mobile')
    expect(runtimeWarnings).toEqual([])
  })

  test('Financials shows where each dollar of sales went, by year', async ({ page }, testInfo) => {
    const runtimeWarnings = watchForReactRuntimeWarnings(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    // An old link with a period still lands on the page.
    await page.goto('/stocks/AAPL/financials?period=quarterly')
    await expect(page.getByRole('heading', { name: 'Where each dollar of sales goes', exact: true })).toBeVisible()
    const researchNav = page.getByRole('navigation', { name: 'Ticker research' })
    await expect(researchNav.getByRole('link', { name: 'Financials', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-flow-variant="wide"]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase3-aapl-financials-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('[data-flow-variant="narrow"]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase3-aapl-financials-mobile')
    expect(runtimeWarnings).toEqual([])
  })

  test('ETF and partial equity use intentional asset-aware research states', async ({ page }, testInfo) => {
    const runtimeWarnings = watchForReactRuntimeWarnings(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/stocks/QQQ/profile')
    await expect(page.getByRole('heading', { name: 'Fund Profile', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Portfolio structure', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-qqq-fund-profile-mobile')

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/stocks/0005.HK/profile')
    await expect(page.getByRole('heading', { name: /Company Profile|Fund Profile/ })).toBeVisible()
    await expect(page.getByText(/Partial coverage|Being built/).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-0005-partial-profile-desktop')
    expect(runtimeWarnings).toEqual([])
  })
})
