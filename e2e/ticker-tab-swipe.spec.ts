import { expect, test, type Page } from '@playwright/test'

/**
 * A sideways swipe over a ticker page moves between research tabs in the order
 * of the tab bar (TickerTabSwipe). Touch is driven through CDP, because
 * Playwright's touchscreen only taps.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page)
  const steps = 8
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= steps; i += 1) {
    const point = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** The swipe handler is attached once it has turned off the browser's own overscroll. */
async function swipeReady(page: Page) {
  await page.waitForFunction(() => document.documentElement.style.overscrollBehaviorX === 'none')
}

async function headingCentre(page: Page) {
  const box = await page.getByRole('heading', { name: 'Where AAPL stands' }).boundingBox()
  if (!box) throw new Error('heading not laid out')
  return { x: 195, y: box.y + box.height / 2 }
}

test('swiping left opens the next tab, swiping right the previous one', async ({ page }) => {
  await page.goto('/stocks/AAPL/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)

  const start = await headingCentre(page)
  await swipe(page, { x: 320, y: start.y }, { x: 80, y: start.y + 8 })
  await expect(page).toHaveURL(/\/stocks\/AAPL\/events$/)

  await page.goto('/stocks/AAPL/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const again = await headingCentre(page)
  await swipe(page, { x: 70, y: again.y }, { x: 320, y: again.y })
  await expect(page).toHaveURL(/\/stocks\/AAPL\/signals$/)
})

test('a vertical or short gesture never changes the tab', async ({ page }) => {
  await page.goto('/stocks/AAPL/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const start = await headingCentre(page)

  await swipe(page, { x: 200, y: start.y + 200 }, { x: 150, y: start.y })
  await swipe(page, { x: 220, y: start.y }, { x: 180, y: start.y })
  await page.waitForTimeout(600)
  await expect(page).toHaveURL(/\/stocks\/AAPL\/rankings$/)
  // The content is back in place after an abandoned swipe.
  const transform = await page.locator('[data-stock-ticker-layout] [data-arrival-part="content"]').evaluate((el) => el.style.transform)
  expect(transform).toBe('')
})

test('a swipe that starts on a chart stays with the chart', async ({ page }) => {
  // QAM is a repository fixture with a full hero chart.
  await page.goto('/stocks/QAM')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const chart = page.locator('[data-stock-ticker-layout] [data-arrival-part="content"] svg').first()
  const box = await chart.boundingBox()
  test.skip(!box || box.width < 200, 'no chart drawn on this fixture')
  const y = box!.y + box!.height / 2
  await swipe(page, { x: box!.x + box!.width - 30, y }, { x: box!.x + 30, y })
  await page.waitForTimeout(600)
  await expect(page).toHaveURL(/\/stocks\/QAM$/)
})
