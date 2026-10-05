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

test.describe('live ticker architecture', () => {
  test.skip(!runLiveTickerQa, 'Set RUN_TICKER_LIVE_QA=1 to exercise finance-backend coverage states.')
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('the same equity keeps one stable research view with a selected relationship node', async ({ page }, testInfo) => {
    const runtimeWarnings = watchForReactRuntimeWarnings(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL')

    await expect(page.getByText('AAPL', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Equity', { exact: true }).first()).toBeVisible()
    await expect(page.locator('[data-selected-ticker-node]')).toBeVisible()
    await expect(page.locator('[data-ticker-relationship-field]')).toBeVisible()
    await expect(page.locator('[data-ticker-relationship-field] canvas')).toBeVisible()
    await expect(page.locator('[data-ticker-relationship-field]')).toHaveAttribute('data-projection', 'focused-3d')
    await expect(page.locator('[data-ticker-relationship-field]')).toHaveAttribute('data-anchor-source', 'selected-ticker-node')
    await expect(page.locator('[data-ticker-relationship-field]')).toHaveAttribute('data-motion', 'ambient')

    const anchorGeometry = await page.locator('[data-ticker-relationship-field] canvas').evaluate((canvas) => {
      const anchor = document.querySelector<HTMLElement>('[data-selected-ticker-anchor]')
      const canvasBounds = canvas.getBoundingClientRect()
      const anchorBounds = anchor?.getBoundingClientRect()
      if (!anchorBounds) return null
      return {
        x: anchorBounds.left + anchorBounds.width / 2 - canvasBounds.left,
        y: anchorBounds.top + anchorBounds.height / 2 - canvasBounds.top,
        width: canvasBounds.width,
        height: canvasBounds.height,
      }
    })
    expect(anchorGeometry).not.toBeNull()
    expect(anchorGeometry?.x).toBeGreaterThan(0)
    expect(anchorGeometry?.x).toBeLessThan(anchorGeometry?.width ?? 0)
    expect(anchorGeometry?.y).toBeGreaterThan(0)
    expect(anchorGeometry?.y).toBeLessThan(anchorGeometry?.height ?? 0)

    const firstAmbientFrame = await page.locator('[data-ticker-relationship-field] canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())
    await page.waitForTimeout(280)
    const secondAmbientFrame = await page.locator('[data-ticker-relationship-field] canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())
    expect(secondAmbientFrame).not.toBe(firstAmbientFrame)
    await expect(page.getByRole('button', { name: /Perspective/ })).toHaveCount(0)
    await expect(page.getByRole('radiogroup', { name: 'Investment perspective' })).toHaveCount(0)

    // Beside the chart: the score disc (its slices are the axis buttons) and the two verdict lines.
    const researchScore = page.getByRole('complementary', { name: 'Research score and verdicts' })
    await expect(researchScore).toBeVisible()
    await expect(researchScore.getByRole('group', { name: /^Scorecard/ })).toBeVisible()
    await expect(page.locator('dl[aria-label="Current research snapshot"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Technicals', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fundamentals', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Relationships', exact: true })).toBeVisible()
    // Spec PRD-78: the hero opens on 1Y; the Technicals on 1D.
    await expect(page.getByRole('radiogroup', { name: 'Chart timeframe' }).getByRole('radio', { name: '1Y', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radiogroup', { name: 'Technical timeframe' }).getByRole('radio', { name: '1D', exact: true })).toHaveAttribute('aria-checked', 'true')

    const topOrder = await page.locator('[data-ticker-identity], [data-ticker-price], [data-ticker-navigation]').evaluateAll((nodes) =>
      Object.fromEntries(nodes.map((node) => [node.getAttribute('data-ticker-identity') !== null ? 'identity' : node.getAttribute('data-ticker-price') !== null ? 'price' : 'navigation', node.getBoundingClientRect().top + window.scrollY])),
    )
    expect(topOrder.identity).toBeLessThan(topOrder.price)
    expect(topOrder.price).toBeLessThan(topOrder.navigation)

    const researchNav = page.getByRole('navigation', { name: 'Ticker research' })
    await expect(researchNav.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
    const activeRail = page.locator('[data-stock-research-nav] [data-ready="true"]')
    await expect(activeRail).toBeVisible()
    expect((await activeRail.boundingBox())?.width ?? 0).toBeGreaterThan(20)
    await expect(researchNav.getByRole('link', { name: 'Financials', exact: true })).toHaveAttribute('href', '/stocks/AAPL/financials')
    await expect(researchNav.getByRole('link', { name: 'Signals', exact: true })).toHaveAttribute('href', '/stocks/AAPL/signals')
    await expect(researchNav.getByRole('link', { name: 'Ownership & Capital', exact: true })).toHaveAttribute('href', '/stocks/AAPL/ownership')
    await expect(researchNav.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('menu')).toHaveCount(0)

    const layout = await page.locator('#signals, #fundamentals, #relationships').evaluateAll((nodes) => nodes.map((node) => ({ id: node.id, top: node.getBoundingClientRect().top + window.scrollY, width: node.getBoundingClientRect().width })))
    expect(Math.abs((layout.find((item) => item.id === 'signals')?.width ?? 0) - (layout.find((item) => item.id === 'fundamentals')?.width ?? 0))).toBeLessThan(2)
    expect(layout.find((item) => item.id === 'signals')?.top).toBeLessThan(layout.find((item) => item.id === 'fundamentals')?.top ?? 0)
    expect(layout.find((item) => item.id === 'fundamentals')?.top).toBeLessThan(layout.find((item) => item.id === 'relationships')?.top ?? 0)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-overview-selected-node-desktop')

    const responsiveCaptures = [
      { width: 320, height: 568, name: 'aapl-overview-compact-mobile' },
      { width: 390, height: 844, name: 'aapl-overview-selected-node-mobile' },
      { width: 720, height: 450, name: 'aapl-overview-200-zoom' },
      { width: 768, height: 1024, name: 'aapl-overview-tablet' },
      { width: 1366, height: 768, name: 'aapl-overview-laptop' },
      { width: 1920, height: 1080, name: 'aapl-overview-wide-desktop' },
    ]

    for (const viewport of responsiveCaptures) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await expect(page.locator('[data-selected-ticker-node]')).toBeVisible()
      await expect(page.locator('[data-ticker-relationship-field]')).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await capture(page, testInfo, viewport.name)
    }
    expect(runtimeWarnings).toEqual([])
  })

  test('reduced motion keeps the relationship field static and readable', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL')
    const relationshipField = page.locator('[data-ticker-relationship-field="canvas"]:visible')
    await expect(relationshipField).toHaveCount(1)
    await expect(relationshipField).toBeVisible()
    await expect(relationshipField).toHaveAttribute('data-motion', 'static')
    await expect(page.locator('[data-ticker-relationship-field="fallback"]:visible')).toHaveCount(0)
    await expect(page.locator('[data-stock-research-nav] [data-ready="true"]')).toHaveCSS('transition-duration', '0s')
    await expect(page.locator('[data-selected-ticker-node] > span').first()).toHaveCSS('animation-name', 'none')
    const firstStaticFrame = await relationshipField.locator('canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())
    await page.waitForTimeout(280)
    const secondStaticFrame = await relationshipField.locator('canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())
    expect(secondStaticFrame).toBe(firstStaticFrame)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-overview-selected-node-reduced-motion')

    await page.goto('/stocks/MSFT')
    await expect(relationshipField).toHaveCount(1)
    await expect(relationshipField).toHaveAttribute('data-motion', 'static')
    await expect(page.locator('[data-ticker-relationship-field="fallback"]:visible')).toHaveCount(0)
    const differentTickerFrame = await relationshipField.locator('canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())
    expect(differentTickerFrame).not.toBe(firstStaticFrame)
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'msft-overview-selected-node-reduced-motion')
  })

  test('ETF with no relationship coverage stays a complete mobile page', async ({ page }, testInfo) => {
    const runtimeWarnings = watchForReactRuntimeWarnings(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/stocks/QQQ')
    await expect(page.getByText('QQQ', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('ETF', { exact: true }).first()).toBeVisible()
    await expect(page.locator('[data-selected-ticker-node]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fundamentals', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Relationships', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    expect(runtimeWarnings).toEqual([])
    await capture(page, testInfo, 'qqq-overview-mobile')
  })

  test('partial equity keeps an intentional research composition without a current signal', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/stocks/0005.HK')
    await expect(page.getByText('0005.HK', { exact: true }).first()).toBeVisible()
    await expect(page.locator('[data-selected-ticker-node]')).toHaveAttribute('data-tone', 'brand')
    const researchSnapshot = page.locator('dl[aria-label="Current research snapshot"]')
    await expect(researchSnapshot.getByText('Model signal', { exact: true })).toBeVisible()
    await expect(researchSnapshot.getByText('Unavailable', { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, '0005-partial-equity-desktop')
  })

  test('Relationships keeps the universe and its inspector across viewports', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/AAPL/relationships')
    await expect(page.locator('[data-relationship-evidence] canvas')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-relationships-desktop')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.locator('[data-relationship-evidence] canvas')).toBeVisible()
    await expect(page.locator('[data-relationship-node]').first()).toBeVisible()
    await expect(page.locator('[data-ticker-chrome] [data-ticker-relationship-field] canvas')).toBeVisible()
    await expect(page.locator('[data-company-name]')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await capture(page, testInfo, 'aapl-relationships-mobile')
  })

  test('legacy ticker routes redirect to their stable research destinations', async ({ page }) => {
    const redirects = [
      { legacy: '/stocks/AAPL/signal-history', destination: /\/stocks\/AAPL\/signals$/ },
      { legacy: '/stocks/AAPL/performance', destination: /\/stocks\/AAPL\/signals$/ },
      { legacy: '/stocks/AAPL/holdings-dividends', destination: /\/stocks\/AAPL\/fundamentals$/ },
      { legacy: '/stocks/AAPL/financials/fund-profile', destination: /\/stocks\/AAPL\/financials$/ },
    ]
    for (const route of redirects) {
      await page.goto(route.legacy)
      await expect(page).toHaveURL(route.destination)
      await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeVisible()
    }
  })
})
