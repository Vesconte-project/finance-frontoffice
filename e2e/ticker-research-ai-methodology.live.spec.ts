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

test.describe('ticker AI Research and Methodology preview', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('AI Research keeps the preview honest across desktop, mobile, coverage and zoom', async ({ page }, testInfo) => {
    const aiRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/ai-analyst')) aiRequests.push(request.url())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/ai-research')
    await expect(page.getByRole('heading', { name: 'Ask about AAPL', exact: true })).toBeVisible()
    // Asking answers with an explicit message and sends nothing.
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(page.locator('[data-ask-message]')).toContainText('can’t be given yet')
    await expect(page.getByRole('heading', { name: 'Your plan', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ai-research-aapl-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ai-research-aapl-mobile')

    await page.goto('/stocks/0005.HK/ai-research')
    await expect(page.getByRole('heading', { name: 'Ask about 0005.HK', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ai-research-partial-coverage')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('2')
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-ai-research-200-zoom')
    expect(aiRequests).toEqual([])
  })

  test('Methodology preserves Lens context and editorial reading at desktop, mobile and zoom', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/methodology')
    await expect(page.getByRole('heading', { name: 'Score, signal and technical read', exact: true })).toBeVisible()
    await expect(page.getByLabel('Methodology contents').getByRole('link', { name: 'Disclosures', exact: true })).toBeVisible()
    await expect(page.getByText('Long term', { exact: true }).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-methodology-aapl-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-methodology-aapl-mobile')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('2')
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'phase2-methodology-200-zoom')
  })
})
