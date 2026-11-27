import { expect, test, type Page } from '@playwright/test'

/**
 * A sideways swipe over a ticker page moves between research tabs in the order
 * of the tab bar (TickerTabSwipe). Touch is driven through CDP, because
 * Playwright's touchscreen only taps. QAS supplies an active lifecycle summary;
 * an unmodelled ticker must not be treated as active just to render rankings.
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
  const box = await page.getByRole('heading', { name: 'Where QAS stands' }).boundingBox()
  if (!box) throw new Error('heading not laid out')
  return { x: 195, y: box.y + box.height / 2 }
}

test('swiping left opens the next tab, swiping right the previous one', async ({ page }) => {
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)

  const start = await headingCentre(page)
  await swipe(page, { x: 320, y: start.y }, { x: 80, y: start.y + 8 })
  await expect(page).toHaveURL(/\/stocks\/QAS\/events$/)

  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const again = await headingCentre(page)
  await swipe(page, { x: 70, y: again.y }, { x: 320, y: again.y })
  await expect(page).toHaveURL(/\/stocks\/QAS\/signals$/)
})

test('the page follows the finger and the next tab slides in beside it', async ({ page }) => {
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const start = await headingCentre(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: start.y }] })
  for (const x of [290, 260, 230, 200]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start.y }] })
  }
  const peek = page.locator('[data-ticker-tab-peek="next"]')
  await expect(peek).toHaveAttribute('data-visible', 'true')
  // The same loading a tab shows while its route loads, in the same place.
  await expect(peek.locator('[data-loading-pulse]')).toHaveCount(1)
  // One to one: the page has moved as far as the finger has since the swipe began.
  const offset = await page.locator('[data-stock-ticker-layout] [data-arrival-part="content"]').evaluate(
    (el) => new DOMMatrix(getComputedStyle(el).transform).m41,
  )
  expect(offset).toBeLessThan(-50)
  // Let go short of a commit, slowly: it springs back.
  await page.waitForTimeout(150)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(600)
  await expect(page).toHaveURL(/\/stocks\/QAS\/rankings$/)
  await expect(peek).toHaveAttribute('data-visible', 'false')
})

test('a vertical or short gesture never changes the tab', async ({ page }) => {
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const start = await headingCentre(page)

  await swipe(page, { x: 200, y: start.y + 200 }, { x: 150, y: start.y })
  await swipe(page, { x: 220, y: start.y }, { x: 180, y: start.y })
  await page.waitForTimeout(600)
  await expect(page).toHaveURL(/\/stocks\/QAS\/rankings$/)
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

async function quickSwipe(page: Page, y: number) {
  await swipe(page, { x: 330, y }, { x: 90, y })
}

test('swipes that follow one another faster than tabs load are never ignored', async ({ page }) => {
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const { y } = await headingCentre(page)

  // Two in a row, the second before the first tab has arrived.
  await quickSwipe(page, y)
  await quickSwipe(page, y)
  await expect(page).toHaveURL(/\/stocks\/QAS\/relationships$/)

  // Three in a row the other way: Rankings, Signals, Valuation, Financials.
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  const back = async () => swipe(page, { x: 90, y }, { x: 330, y })
  await back()
  await back()
  await back()
  await expect(page).toHaveURL(/\/stocks\/QAS\/financials$/)
})

// A swipe that starts while the panel in front is still sliding picks it up where
// it is. Where it is must not decide the tab: the finger does. The panel is put
// at the offset by hand, so the case does not depend on the runner's timing.
for (const offset of [-170, -300]) {
  test(`a swipe over a panel still ${-offset}px from its place follows the finger`, async ({ page }) => {
    await page.goto('/stocks/QAS/rankings')
    await page.waitForLoadState('networkidle')
    await swipeReady(page)
    const { y } = await headingCentre(page)
    const back = async () => swipe(page, { x: 90, y }, { x: 330, y })

    await back()
    await expect(page).toHaveURL(/\/stocks\/QAS\/signals$/)
    await expect(page.locator('[data-ticker-tab-peek][data-visible="true"]')).toHaveCount(0, { timeout: 5000 })

    // Valuation stays on its way until the third gesture has been let go.
    let arrive!: () => void
    const held = new Promise<void>((resolve) => { arrive = resolve })
    await page.route(/\/stocks\/QAS\/valuation\?_rsc/, async (route) => {
      await held
      await route.continue()
    })
    await back()
    const cover = page.locator('[data-ticker-tab-peek][data-visible="true"]')
    await expect(cover).toHaveCount(1)
    await page.waitForTimeout(400)
    await cover.evaluate((el, x) => {
      el.style.transition = 'none'
      el.style.transform = `translate3d(${x}px, 0, 0)`
    }, offset)

    await back()
    arrive()
    await expect(page).toHaveURL(/\/stocks\/QAS\/financials$/)
  })
}

test('a swipe while the next tab is still on its way works anywhere below the tab bar', async ({ page }) => {
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  // Hold the Events tab back, so the second swipe happens while it is loading.
  await page.route(/\/stocks\/QAS\/events\?_rsc/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  const { y } = await headingCentre(page)
  await quickSwipe(page, y)
  await page.waitForTimeout(300)
  // Low on the screen, where a loading tab has no content of its own.
  await quickSwipe(page, 780)
  await expect(page).toHaveURL(/\/stocks\/QAS\/relationships$/)
  // Nothing is left covering the page once it has arrived.
  await expect(page.locator('[data-ticker-tab-peek][data-visible="true"]')).toHaveCount(0, { timeout: 5000 })
})

test('the tab bar selects the chosen tab at once, before its route arrives', async ({ page }) => {
  await page.goto('/stocks/QAS/rankings')
  await page.waitForLoadState('networkidle')
  await swipeReady(page)
  await page.route(/\/stocks\/QAS\/events\?_rsc/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  const bar = page.locator('[data-stock-research-nav]')
  const selected = bar.locator('[data-active="true"]')

  // A swipe that commits.
  const { y } = await headingCentre(page)
  await quickSwipe(page, y)
  await expect(selected).toHaveText('Events', { timeout: 400 })
  // The page on screen is still Rankings until Events arrives.
  await expect(bar.locator('[aria-current="page"]')).toHaveText('Rankings')
  await expect(page).toHaveURL(/\/stocks\/QAS\/rankings$/)
  await expect(page).toHaveURL(/\/stocks\/QAS\/events$/)
  await expect(bar.locator('[aria-current="page"]')).toHaveText('Events')

  // A click on a tab, while it loads.
  await page.route(/\/stocks\/QAS\/relationships\?_rsc/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  await bar.getByRole('link', { name: 'Relationships' }).click()
  await expect(selected).toHaveText('Relationships', { timeout: 400 })
  await expect(page).toHaveURL(/\/stocks\/QAS\/relationships$/)
  await expect(selected).toHaveText('Relationships')
})
