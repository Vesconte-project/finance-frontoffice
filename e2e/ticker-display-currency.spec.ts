import { expect, test, type Page } from '@playwright/test'

/*
 * Display currency on the ticker pages, against the synthetic won-listed QAK
 * (e2e/fixtures/ticker-page.mjs) and the fixture backend's synthetic rates
 * (e2e/fixtures/display-currency.mjs). Every conversion is the backend's: the
 * page only shows what `?currency=` returned.
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

test.use({ viewport: { width: 1440, height: 900 } })

const selector = (page: Page) => page.getByRole('combobox', { name: 'Show amounts in' })

test('amounts show as reported until a currency is chosen; the options are the listed ones', async ({ page }) => {
  await page.goto('/stocks/QAK')
  const price = page.locator('[data-ticker-price]')
  await expect(price).toHaveText('₩75,000')
  await expect(selector(page)).toBeEnabled()
  await expect(selector(page)).toHaveValue('')
  const options = await selector(page).locator('option').allTextContents()
  // The listing's own currency is the default; KRW is not offered twice.
  expect(options).toEqual(['KRW · as reported', 'USD', 'EUR'])
  await expect(page.locator('[data-display-currency-note]')).toHaveCount(0)
  await capture(page, 'qak-1440-reported')
})

test('choosing USD converts every amount through the backend, keeps the original beside it and marks what has no rate', async ({ page }) => {
  await page.goto('/stocks/QAK')
  await expect(selector(page)).toBeEnabled()
  await selector(page).selectOption('USD')
  await expect(page).toHaveURL(/\/stocks\/QAK\?currency=USD$/)

  // The chrome: converted price first, the reported price beside it.
  const price = page.locator('[data-ticker-price-converted]')
  await expect(price).toContainText('$54.11', { timeout: 15_000 })
  await expect(price).toContainText('₩75,000')

  // The page says what the figures are.
  await expect(page.locator('[data-display-currency-note="USD"]')).toContainText('Amounts in USD')
  await capture(page, 'qak-1440-usd')

  // Net cash is not an amount the backend converts: shown as reported, marked, with the reason.
  const netCash = page.locator('[data-fundamental-card="net-cash"]')
  await expect(netCash.locator('[data-money="unconverted"]')).toContainText('not in USD')
  await expect(netCash.locator('[data-money-marker] .sr-only')).toContainText('not offered in other currencies')

  // The quote's market cap is preformatted won text: kept as reported and marked.
  await expect(page.locator('[data-money="unconverted"]').filter({ hasText: '₩447.7T' })).toContainText('not in USD')

  // Revenue: the latest year converted, with the won amount beside it.
  const revenue = page.locator('[data-fundamental-card="revenue"] [data-money="converted"]')
  await expect(revenue).toContainText('$')
  await expect(revenue).toContainText('₩')

  // The marker's reason can be reached from the keyboard.
  await netCash.locator('[data-money-marker]').focus()
  await expect(netCash.locator('[data-money-marker] [role="tooltip"]')).toBeVisible()
  await capture(page, 'qak-1440-usd-unconverted-marker')

  // The tabs keep the currency.
  await expect(page.getByRole('link', { name: 'Fundamentals', exact: true })).toHaveAttribute('href', '/stocks/QAK/fundamentals?currency=USD')

  // The expanded chart draws the converted bars, labelled in USD.
  await page.getByRole('button', { name: 'Expand chart' }).click()
  await expect(page.getByText('Price chart · daily · USD')).toBeVisible()
})

test('the choice is remembered in this browser and older amounts without a rate are counted, not hidden', async ({ page }) => {
  await page.goto('/stocks/QAK')
  await expect(selector(page)).toBeEnabled()
  await selector(page).selectOption('USD')
  await expect(page).toHaveURL(/\?currency=USD$/)
  await page.goto('/stocks/QAK/fundamentals')
  // Opened without `?currency=`, the page follows the remembered choice.
  await expect(page).toHaveURL(/\/stocks\/QAK\/fundamentals\?currency=USD$/)
  const note = page.locator('[data-display-currency-note="USD"]')
  await expect(note).toBeVisible()
  // The fixture has no KRW rate before 2019: the earliest years are counted.
  await expect(note.locator('[data-display-currency-gaps]')).toContainText('no exchange rate within 10 business days')
  await expect(page.locator('#cash-and-debt [data-money="unconverted"]')).toContainText('not in USD')
  await expect(page.locator('#dividends [data-money="converted"]')).toContainText('₩361')
  await capture(page, 'qak-1440-usd-fundamentals-unconverted')

  // Back to the listing's currency: the URL loses the parameter and the choice is kept.
  await selector(page).selectOption('')
  await expect(page).toHaveURL(/\/stocks\/QAK\/fundamentals$/)
  await expect(note).toHaveCount(0)
  await page.goto('/stocks/QAK')
  await expect(page).toHaveURL(/\/stocks\/QAK$/)
  await expect(page.locator('[data-ticker-price]')).toHaveText('₩75,000')
})

test('a currency the backend does not list is ignored', async ({ page }) => {
  await page.goto('/stocks/QAK?currency=XYZ')
  await expect(page.locator('[data-ticker-price]')).toHaveText('₩75,000')
  await expect(page.locator('[data-display-currency-note]')).toHaveCount(0)
  await expect(selector(page)).toHaveValue('')
})

test('a dollar listing can be shown in euros', async ({ page }) => {
  await page.goto('/stocks/QAS?currency=EUR')
  await expect(page.locator('[data-ticker-price-converted]')).toContainText('€')
  await expect(page.locator('[data-ticker-price-converted]')).toContainText('$341.07')
  await page.goto('/stocks/QAS/ownership?currency=EUR')
  await expect(page.locator('[data-display-currency-note="EUR"]')).toBeVisible()
  await expect(page.locator('[data-buyback-lead]')).toBeVisible()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('the selector and the converted amounts fit a 375px screen', async ({ page }) => {
    await page.goto('/stocks/QAK?currency=USD')
    await expect(page.locator('[data-ticker-price-converted]')).toContainText('$54.11')
    await expect(selector(page)).toBeVisible()
    const box = await selector(page).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await noHorizontalOverflow(page)
    await capture(page, 'qak-375-usd')
    await page.goto('/stocks/QAK/fundamentals?currency=USD')
    await expect(page.locator('[data-display-currency-note="USD"]')).toBeVisible()
    await noHorizontalOverflow(page)
    await capture(page, 'qak-375-usd-fundamentals')
  })
})
