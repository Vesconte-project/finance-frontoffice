import { expect, test, type Page } from '@playwright/test'

/*
 * The expanded ticker chart (PRD-74) on the synthetic fixture ticker QAS. Its
 * OHLC is repository-owned and invented (e2e/fixtures/ticker-page.mjs).
 */

const TICKER = 'QAS'
const capture = process.env.PLAYWRIGHT_CAPTURE === '1'

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

/**
 * Page exceptions count from the first load. Console errors count from the
 * moment the chart opens: before that, the dev server replays the ticker
 * page's own server logs for optional datasets the fixture backend omits.
 * A prefetch of a signed-in page that Clerk sends to its hosted sign-in (CI
 * runs a real Clerk development app) fails cross-origin; that is navigation,
 * not the chart, so it is left out.
 */
function trackErrors(page: Page): { errors: string[]; watchConsole: () => void } {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  return {
    errors,
    watchConsole: () => {
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = message.text()
        const source = message.location().url
        const crossOriginLoad = source !== '' && new URL(source).origin !== new URL(page.url()).origin
        const blockedPrefetch = text.includes('?_rsc=') && text.includes('blocked by CORS policy')
        if (crossOriginLoad || blockedPrefetch) return
        errors.push(text)
      })
    },
  }
}

async function openExpandedChart(page: Page, watchConsole?: () => void) {
  await page.goto(`/stocks/${TICKER}`)
  const expand = page.getByRole('button', { name: 'Expand chart' })
  await expect(expand).toBeVisible()
  if (capture) {
    const width = page.viewportSize()?.width ?? 0
    await page.locator('[data-chart-footer]').evaluate((footer) => footer.parentElement?.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: `test-results/expanded-chart-hero-${width}.png` })
  }
  watchConsole?.()
  await expand.click()
  const dialog = page.getByRole('dialog', { name: TICKER })
  await expect(dialog).toBeVisible()
  // The dialog rises 16px into place; measure it once it has settled.
  await dialog.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  return { dialog, expand }
}

/** Counts painted pixels, so a blank canvas fails. */
async function paintedPixels(page: Page): Promise<number> {
  return page.locator('[data-expanded-chart-canvas] canvas').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let painted = 0
    for (let i = 3; i < data.length; i += 16) if (data[i] > 0) painted += 1
    return painted
  })
}

for (const viewport of VIEWPORTS) {
  test(`expanded chart fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const { errors, watchConsole } = trackErrors(page)
    await page.setViewportSize(viewport)
    const { dialog } = await openExpandedChart(page, watchConsole)

    const layout = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const canvas = element.querySelector('canvas')!.getBoundingClientRect()
      const tools = element.querySelector('[role="toolbar"]')!.getBoundingClientRect()
      return {
        dialogFits: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 0.5 && box.bottom <= innerHeight + 0.5,
        canvasHeight: canvas.height,
        toolsVisible: tools.bottom <= box.bottom + 0.5 && tools.height > 0,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
      }
    })
    expect(layout.dialogFits).toBe(true)
    expect(layout.canvasHeight).toBeGreaterThan(160)
    expect(layout.toolsVisible).toBe(true)
    expect(layout.pageOverflow).toBe(false)
    expect(await paintedPixels(page)).toBeGreaterThan(500)
    if (capture) await page.screenshot({ path: `test-results/expanded-chart-${viewport.width}.png` })
    expect(errors).toEqual([])
  })
}

test('expanded chart reads, draws and explains what is missing', async ({ page }) => {
  const { errors, watchConsole } = trackErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  const { dialog, expand } = await openExpandedChart(page, watchConsole)
  const canvas = dialog.locator('[data-expanded-chart-canvas] canvas')

  // Opens focused on the chart, at the latest bar, with the fixture's real close.
  await expect(canvas).toBeFocused()
  await expect(dialog.locator('[data-expanded-chart-legend]')).toContainText('C $341.07')

  // The fixture loads the full ten-year window, so "All" would overstate it.
  await expect(dialog.getByRole('radio', { name: '10Y' })).toHaveCount(1)
  await expect(dialog.getByRole('radio', { name: 'ALL' })).toHaveCount(0)

  // Keyboard zoom changes the announced range.
  const summary = dialog.locator('#expanded-chart-summary')
  await expect(summary).not.toHaveText('')
  const before = await summary.textContent()
  await canvas.press('+')
  await canvas.press('+')
  await expect(summary).not.toHaveText(before ?? '')

  // Hovering reads an older bar into the legend.
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4)
  await expect(dialog.locator('[data-expanded-chart-legend]')).not.toContainText('Sep 30, 2026')

  // Intraday ranges and indicators answer with an explicit error and draw nothing.
  await dialog.getByRole('button', { name: '1D, intraday prices missing' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Intraday prices are missing for 1D.')
  await dialog.getByRole('button', { name: 'RSI, not available yet' }).click()
  await expect(dialog.getByRole('alert')).toContainText('RSI is not available yet.')
  await expect(dialog.getByRole('alert')).not.toContainText('ENG-152')

  // Fibonacci: two picks on the chart draw the levels.
  await dialog.getByRole('button', { name: 'Fibonacci' }).click()
  await expect(dialog.getByRole('button', { name: 'Fibonacci' })).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6)
  await page.waitForTimeout(400)
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.2)
  await expect(dialog.getByRole('button', { name: 'Clear drawings' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fibonacci' })).toHaveAttribute('aria-pressed', 'false')

  // Line view and hiding volume keep a painted chart.
  await dialog.getByRole('radio', { name: 'Line' }).click()
  await dialog.getByRole('button', { name: 'Volume' }).click()
  await expect(dialog.getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'false')
  expect(await paintedPixels(page)).toBeGreaterThan(500)
  if (capture) await page.screenshot({ path: 'test-results/expanded-chart-flow.png' })

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(expand).toBeFocused()
  expect(errors).toEqual([])
})

test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

  test('tap reads a bar, drag pans, and the page underneath stays still', async ({ page }) => {
    const { errors, watchConsole } = trackErrors(page)
    const { dialog } = await openExpandedChart(page, watchConsole)
    const canvas = dialog.locator('[data-expanded-chart-canvas] canvas')
    const box = (await canvas.boundingBox())!
    const legend = dialog.locator('[data-expanded-chart-legend]')

    await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.4)
    await expect(legend).not.toContainText('Sep 30, 2026')

    const scrollBefore = await page.evaluate(() => window.scrollY)
    const summary = dialog.locator('#expanded-chart-summary')
    await expect(summary).not.toHaveText('')
    const before = await summary.textContent()
    // A one-finger drag through CDP touch events.
    const client = await page.context().newCDPSession(page)
    const y = box.y + box.height * 0.5
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.3, y }] })
    for (let step = 1; step <= 8; step += 1) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (0.3 + step * 0.05), y }] })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(summary).not.toHaveText(before ?? '')
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)

    const toolbar = dialog.getByRole('toolbar', { name: 'Chart tools' })
    for (const button of await toolbar.getByRole('button').all()) {
      const size = (await button.boundingBox())!
      expect(size.height).toBeGreaterThanOrEqual(44)
    }
    expect(errors).toEqual([])
  })
})

test('dark theme and reduced motion keep the chart painted', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  const { dialog } = await openExpandedChart(page)
  await expect(dialog).toBeVisible()
  expect(await paintedPixels(page)).toBeGreaterThan(500)
  if (capture) await page.screenshot({ path: 'test-results/expanded-chart-dark.png' })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})
