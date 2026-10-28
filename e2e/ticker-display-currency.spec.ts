import { expect, test, type Page } from '@playwright/test'

/*
 * Listings we track and the display currency on the ticker pages, against the
 * synthetic won-listed QAK (e2e/fixtures/ticker-page.mjs: two tracked
 * listings, one primary) and the fixture backend's synthetic rates
 * (e2e/fixtures/display-currency.mjs: no KRW rate before 2019 nor in June
 * 2026). Every conversion is the backend's: the page only shows what
 * `?currency=` returned. The currency lives in the URL only.
 *
 * PLAYWRIGHT_CAPTURE_DIR=<dir> also writes the review screenshots.
 */

const captureDir = process.env.PLAYWRIGHT_CAPTURE_DIR?.trim()

async function capture(page: Page, name: string) {
  if (!captureDir) return
  // Let the chart's draw-in finish.
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${captureDir}/${name}.png`, fullPage: false })
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const control = (page: Page) => page.getByRole('button', { name: /^Listings and currency/ })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Listings and currency' })

test.use({ viewport: { width: 1440, height: 900 } })

test('the page reads in the listing currency until a currency is chosen; nothing is remembered', async ({ page }) => {
  const currencyReads: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/currencies') currencyReads.push(request.url())
  })
  await page.goto('/stocks/QAK')
  await page.waitForLoadState('networkidle')
  expect(currencyReads).toEqual([])
  await expect(page.locator('[data-ticker-price]')).toHaveText('₩75,000')
  await expect(page.locator('[data-ticker-price-converted]')).toHaveCount(0)
  await expect(page.locator('[data-chart-currency-toggle]')).toHaveCount(0)
  await expect(control(page)).toHaveAccessibleName('Listings and currency: KRW listing')
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.includes('currency')))).toEqual([])
})

test('the control lists the listings we track, each other one linking to its page, then the currencies', async ({ page }) => {
  await page.goto('/stocks/QAK')
  await control(page).click()
  const panel = dialog(page)
  await expect(panel).toBeVisible()

  const listings = panel.locator('[data-tracked-listings="available"]')
  await expect(listings.getByRole('heading', { name: 'Listings we track' })).toBeVisible()
  const current = listings.locator('[aria-current="page"]')
  await expect(current).toContainText('QAK')
  await expect(current).toContainText('Primary')
  await expect(current).toContainText('This page')
  await expect(current).toContainText('XKRX')
  await expect(current).toContainText('South Korea')
  const other = listings.getByRole('link', { name: /QAKY/ })
  await expect(other).toHaveAttribute('href', '/stocks/QAKY')
  await expect(other).toContainText('USD')
  await expect(other).not.toContainText('Primary')
  await expect(panel).not.toContainText(/all exchanges/i)

  const currencies = panel.locator('[data-display-currencies]')
  await expect(currencies).toContainText('It is not a listing traded in that currency.')
  // The listing's own currency is the default and is not offered twice.
  await expect(currencies.locator('[data-currency-option]')).toHaveText([/KRW/, /USD/, /EUR/])
  await expect(currencies.locator('[data-currency-option=""]')).toHaveAttribute('aria-current', 'true')
  await capture(page, 'qak-1440-listings-currency')

  // Escape closes it and focus returns to the control.
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(control(page)).toBeFocused()
})

test('choosing USD adds the converted price beside the original; indicators and statements stay in won', async ({ page }) => {
  await page.goto('/stocks/QAK')
  await control(page).click()
  await dialog(page).locator('[data-currency-option="USD"]').click()
  await expect(page).toHaveURL(/\/stocks\/QAK\?currency=USD$/)
  await expect(control(page)).toBeFocused()
  await expect(control(page)).toHaveAccessibleName('Listings and currency: KRW listing, price also shown in USD')

  // Header: the original stays, the converted value is beside it.
  await expect(page.locator('[data-ticker-price]')).toHaveText('₩75,000')
  await expect(page.locator('[data-ticker-price-converted="USD"]')).toContainText('≈ $54.', { timeout: 15_000 })

  // The chart is still in won until asked; statements and net cash never convert.
  const toggle = page.locator('[data-chart-currency-toggle]')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-currency-decomposition]')).toHaveCount(0)
  await expect(page.locator('[data-fundamental-card="net-cash"]')).toContainText('₩')
  await expect(page.locator('[data-fundamental-card="revenue"]')).toContainText('₩')
  await expect(page.locator('[data-fundamental-card="revenue"]')).not.toContainText('$')

  // The tabs keep the currency, and those pages stay in won.
  await expect(page.getByRole('link', { name: 'Fundamentals', exact: true })).toHaveAttribute('href', '/stocks/QAK/fundamentals?currency=USD')
  await page.goto('/stocks/QAK/fundamentals?currency=USD')
  await expect(page.locator('[data-ticker-price-converted="USD"]')).toContainText('≈ $', { timeout: 15_000 })
  await expect(page.locator('#dividends')).toContainText('₩361')
  await expect(page.locator('#dividends')).not.toContainText(/\$\d+\.\d{2}/)
})

test('the chart in USD uses each day’s backend value and splits the range return; days without a rate are counted', async ({ page }) => {
  await page.goto('/stocks/QAK?currency=USD')
  const toggle = page.locator('[data-chart-currency-toggle]')
  await expect(toggle).toHaveText('Show in USD')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const decomposition = page.locator('[data-currency-decomposition]')
  await expect(decomposition).toBeVisible({ timeout: 15_000 })
  await expect(decomposition.locator('dt')).toHaveText(['QAK in KRW', 'Currency effect, KRW to USD', 'Return in USD'])
  for (const part of ['local', 'currency', 'converted']) {
    await expect(decomposition.locator(`[data-decomposition="${part}"]`)).toHaveText(/^[+−]?\d+\.\d{2}%$/)
  }
  // The fixture publishes no KRW rate in June 2026, inside the default one-year range.
  await expect(decomposition.locator('[data-decomposition-range]')).toContainText(/\d+ days without a USD rate are left out\./)
  await expect(page.locator('[data-chart-currency]')).toContainText('Not a listing traded in USD.')
  // Candles are only for the listing's own prices.
  await expect(page.locator('[data-chart-kind-toggle]')).toBeHidden()
  await capture(page, 'qak-1440-chart-usd')

  // The split holds: (1 + USD) = (1 + KRW)(1 + currency effect), within rounding.
  const [local, fx, usd] = await Promise.all(['local', 'currency', 'converted'].map(async (part) => {
    const value = await decomposition.locator(`[data-decomposition="${part}"]`).textContent()
    return Number((value ?? '').replace('−', '-').replace('%', '')) / 100
  }))
  expect(Math.abs((1 + usd) - (1 + local) * (1 + fx))).toBeLessThan(0.0005)

  // Before 2019 there is no KRW rate: the whole range counts more left-out days.
  await page.getByRole('radiogroup', { name: 'Chart timeframe' }).getByRole('radio', { name: 'ALL', exact: true }).click()
  await expect(decomposition.locator('[data-decomposition-range]')).toContainText(/\d{3,} days without a USD rate/)

  // Back to won.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(decomposition).toHaveCount(0)
  await expect(page.locator('[data-chart-kind-toggle]')).toBeVisible()
})

test('unavailable or absent listings fail open; a currency the backend does not list is ignored', async ({ page }) => {
  await page.goto('/stocks/QAS')
  await control(page).click()
  await expect(dialog(page).locator('[data-tracked-listings="unavailable"]')).toContainText('We can’t show the listings we track for QAS right now.')
  await expect(dialog(page).locator('[data-currency-option]')).toHaveText([/USD/, /EUR/, /KRW/])
  await page.keyboard.press('Escape')

  // QAL has no listings block at all (an older backend): the section is not shown.
  await page.goto('/stocks/QAL')
  await control(page).click()
  await expect(dialog(page).locator('[data-tracked-listings]')).toHaveCount(0)
  await expect(dialog(page).locator('[data-display-currencies]')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/stocks/QAK?currency=XYZ')
  await expect(page.locator('[data-ticker-price]')).toHaveText('₩75,000')
  await expect(page.locator('[data-ticker-price-converted]')).toHaveCount(0)
  await expect(page.locator('[data-chart-currency-toggle]')).toHaveCount(0)
})

test('a dollar listing can show its price in euros', async ({ page }) => {
  await page.goto('/stocks/QAS?currency=EUR')
  await expect(page.locator('[data-ticker-price]')).toHaveText('$341.07')
  await expect(page.locator('[data-ticker-price-converted="EUR"]')).toContainText('≈ €', { timeout: 15_000 })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('the control, the dialog and the converted chart fit a 375px screen', async ({ page }) => {
    await page.goto('/stocks/QAK?currency=USD')
    await expect(page.locator('[data-ticker-price-converted="USD"]')).toContainText('≈ $', { timeout: 15_000 })
    const box = await control(page).boundingBox()
    expect(box).not.toBeNull()
    await noHorizontalOverflow(page)
    await capture(page, 'qak-375-usd')

    await control(page).click()
    const panel = dialog(page)
    await expect(panel).toBeVisible()
    // Measure once the opening animation has settled.
    await panel.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
    const panelBox = await panel.boundingBox()
    expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(375)
    const rows = panel.locator('a[data-currency-option], a[data-listing]')
    for (const row of await rows.all()) {
      expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await capture(page, 'qak-375-dialog')
    await page.keyboard.press('Escape')

    await page.locator('[data-chart-currency-toggle]').tap()
    await expect(page.locator('[data-currency-decomposition]')).toBeVisible({ timeout: 15_000 })
    await noHorizontalOverflow(page)
    await capture(page, 'qak-375-chart-usd')
  })
})

test('with reduced motion the dialog opens and closes without animation and keeps its content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/stocks/QAK')
  await control(page).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).locator('[data-tracked-listings="available"]')).toBeVisible()
  expect(await dialog(page).evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(control(page)).toBeFocused()
})
