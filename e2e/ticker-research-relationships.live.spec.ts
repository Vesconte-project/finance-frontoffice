import { expect, test, type Page, type TestInfo } from '@playwright/test'

const runLiveTickerQa = process.env.RUN_TICKER_LIVE_QA === '1'

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(name + '.png'), fullPage: true })
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function selectRelationshipView(page: Page, value: string, label: string) {
  const selector = page.locator('[data-expanding-selector]')
  const trigger = selector.locator('button[aria-expanded]')
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  const options = (await selector.getAttribute('data-options'))?.split(' ') ?? []
  if (!options.includes(value)) return false
  for (let step = 0; step < options.length; step += 1) {
    if (await selector.getAttribute('data-value') === value) {
      await expect(selector.getByRole('radio', { name: `Current view: ${label}`, exact: true })).toHaveAttribute('aria-checked', 'true')
      return true
    }
    const currentValue = await selector.getAttribute('data-value')
    await selector.getByRole('radio', { name: /^Next view:/ }).click()
    await expect.poll(() => selector.getAttribute('data-value')).not.toBe(currentValue)
  }
  throw new Error(`Relationship view ${value} did not become active`)
}

test.describe('Phase 3 relationship evidence', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend relationship coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('AAPL keeps layer and window state shareable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/relationships?layer=market&window=252')

    await expect(page.locator('[data-relationship-evidence]')).toBeVisible()
    await expect(page.locator('[data-relationship-evidence] canvas')).toBeVisible()
    await expect(page.locator('[data-company-name]')).toBeVisible()
    // Spec PRD-78 global rules: no loose legend, no summary sentence, no footnote.
    await expect(page.getByText(/Strength = closer|Confidence = clearer|How to read relationships/)).toHaveCount(0)
    await expect(page.locator('[data-company-ticker]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-relationships-market-desktop')

    await selectRelationshipView(page, 'residual', 'Moves independently')
    await expect(page).toHaveURL(/layer=residual&window=252|window=252&layer=residual/)
    await expect(page.locator('[data-ticker-research-loading]')).toHaveCount(0)
    await capture(page, testInfo, 'aapl-relationships-residual-desktop')

    for (const layer of [
      { value: 'leadLag', label: 'Moves before / after' },
      { value: 'market', label: 'Moves with the market' },
      { value: 'theme', label: 'Same investment theme' },
    ]) {
      if (await selectRelationshipView(page, layer.value, layer.label)) {
        await capture(page, testInfo, `aapl-relationships-${layer.value.toLowerCase()}`)
      }
    }

    const node = page.locator('[data-relationship-node]').nth(1)
    if (await node.count()) {
      const routeBeforeSelection = page.url()
      await node.click()
      await expect(node).toHaveAttribute('aria-pressed', 'true')
      expect(page.url()).toBe(routeBeforeSelection)
      // The inspector is the chapter's detail column, beside the map.
      await expect(page.locator('[data-research-chapter="related-companies"] [data-chapter-aside]').getByRole('link', { name: /^Explore / })).toBeVisible()
    }

    const windowSelector = page.getByRole('radiogroup', { name: 'Trading days measured' })
    await windowSelector.getByRole('radio', { name: '126 days', exact: true }).click()
    await expect(page).toHaveURL(/window=126/)
    await expect(windowSelector.getByRole('radio', { name: '126 days', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-ticker-research-loading]')).toHaveCount(0)
  })

  test('AAPL keeps a touch-first universe and its inspector on mobile', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/stocks/AAPL/relationships?window=252')
    await expect(page.locator('[data-relationship-evidence] canvas')).toBeVisible()
    await expect(page.locator('[data-relationship-node]').first()).toBeVisible()
    // The map is the list of companies: no cards repeat it.
    await expect(page.locator('[data-relationship-card]')).toHaveCount(0)
    await expect(page.locator('[data-company-name]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-relationships-mobile')

    await page.setViewportSize({ width: 320, height: 568 })
    await page.reload()
    await expect(page.locator('[data-relationship-evidence] canvas')).toBeVisible()
    await expect(page.locator('[data-company-name]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-relationships-320')
  })

  test('PFE keeps extreme return differences readable in an overlaid comparison', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/PFE/relationships?layer=leadLag&window=252')

    await expect(page.locator('[data-relationship-evidence]')).toBeVisible()
    // Both lines start at 100 on one scale, each named at its end with its return.
    await expect(page.locator('svg[aria-label*="both starting at 100"]')).toBeVisible()
    await expect(page.getByText('Overlaid paths use separate vertical scales.', { exact: false })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'pfe-relationships-independent-price-lanes')
  })

  test('fund and partial equity states stay compact and asset-aware', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/QQQ/relationships')
    // The map, the chapter's Being built block, or the retry state when the data
    // cannot be read — never internal wording.
    await expect(page.locator('[data-research-chapter="related-companies"]').or(page.getByRole('button', { name: 'Retry' }))).toBeVisible()
    await expect(page.getByText(/relationship endpoint|Dataset /)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'qqq-relationships-partial')

    await page.goto('/stocks/0005.HK/relationships')
    await expect(page.locator('[data-research-chapter="related-companies"]').or(page.getByRole('button', { name: 'Retry' }))).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, '0005-relationships-partial')
  })

  test('reduced motion and keyboard focus preserve the relationship controls', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/relationships?layer=market&window=252')
    const relationshipView = page.locator('[data-expanding-selector]')
    await relationshipView.getByRole('button').focus()
    await expect(relationshipView.getByRole('button')).toBeFocused()
    const firstNode = page.locator('[data-relationship-node]').first()
    await firstNode.focus()
    await expect(firstNode).toBeFocused()
    await firstNode.press('ArrowRight')
    await expect(page.locator('[data-relationship-node]').nth(1)).toBeFocused()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-relationships-reduced-motion')
  })
})
