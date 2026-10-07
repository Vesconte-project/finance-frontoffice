import { expect, test } from '@playwright/test'

/**
 * The rankings gate, checked where it actually matters: the bytes sent to the browser.
 *
 * Asserting that ten cards are visible proves nothing — the failure this guards
 * against is a page that renders ten rows while shipping twenty-five in the RSC
 * payload, where anyone can read them from devtools. So these tests read the raw
 * response body, which contains both the HTML and the inline flight data, and count
 * what is in it rather than what is on screen.
 */

const READINGS = ['long-term', 'income', 'short-term'] as const

/** Every ranked card links to /stocks/{symbol}; nothing else on the page does. */
function symbolsInPayload(body: string): string[] {
  const found = new Set<string>()
  for (const match of body.matchAll(/\/stocks\/([A-Za-z0-9.\-%]{1,20})/g)) {
    const symbol = decodeURIComponent(match[1]!).toUpperCase()
    if (/^[A-Z0-9.\-]+$/.test(symbol)) found.add(symbol)
  }
  return [...found]
}

for (const reading of READINGS) {
  test(`anonymous visitors receive no ranked names on ${reading}`, async ({ page, request }) => {
    const response = await page.goto(`/picks/${reading}`)
    expect(response?.status()).toBe(200)
    await page.waitForLoadState('networkidle')

    const lockedBlock = page.locator('[data-picks-locked]')
    if ((await lockedBlock.count()) === 0) {
      test.skip(true, 'ranking unavailable or empty; nothing to assert')
    }

    // What the reader sees.
    expect(await page.locator('main a[href^="/stocks/"]').count()).toBe(0)

    // What was actually sent. This is the assertion that matters.
    const raw = await (await request.get(`/picks/${reading}`)).text()
    const symbols = symbolsInPayload(raw)
    expect(symbols, `payload carried ${symbols.join(', ')}`).toEqual([])
  })
}

test('the locked block advertises a count and the free surfaces, never a name', async ({ page }) => {
  await page.goto('/picks/long-term')
  await page.waitForLoadState('networkidle')

  const locked = page.getByRole('heading', { name: /companies ranked/i })
  if ((await locked.count()) === 0) test.skip(true, 'ranking unavailable')

  await expect(locked).toBeVisible()
  await expect(page.getByRole('link', { name: /see plans/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /this week's free ranking/i })).toHaveAttribute('href', '/picks/weekly')
  await expect(page.locator('[data-pick-disclosure]')).toContainText('not personal advice')

  // The placeholder rows must be decorative: no ticker text, and hidden from AT.
  const placeholders = page.locator('ul[aria-hidden="true"] li')
  expect(await placeholders.count()).toBeGreaterThan(0)
  for (const text of await placeholders.allInnerTexts()) {
    expect(text.trim()).toMatch(/^\d*$/)
  }
})

test('the weekly ranking is public and never mislabels the market as a sector', async ({ page }) => {
  const response = await page.goto('/picks/weekly')
  expect(response?.status()).toBe(200)
  const state = await page.locator('[data-weekly-cut]').getAttribute('data-weekly-cut')
  expect(['ok', 'unpublished', 'unavailable']).toContain(state)
  if (state === 'ok') {
    expect(await page.locator('main a[href^="/stocks/"]').count()).toBeLessThanOrEqual(10)
    await expect(page.locator('[data-pick-disclosure]')).toBeVisible()
  }
})

test('a company standing is free to an anonymous reader', async ({ page }) => {
  const response = await page.goto('/stocks/AAPL/rankings')
  expect(response?.status()).toBe(200)
  const view = page.locator('[data-ticker-rankings]')
  await expect(view).toBeVisible()
  await expect(view.getByRole('heading', { name: 'Where AAPL stands' })).toBeVisible()
  await expect(view.locator('[data-reading]')).toHaveCount(3)
  await expect(view.locator('[data-reading="longTerm"]')).toContainText(/Top \d+%|Bottom \d+%/)
  await expect(page.locator('[data-pick-disclosure]')).toContainText('not personal advice')
})

test('an unknown reading is a 404 rather than a fallback ranking', async ({ request }) => {
  const response = await request.get('/picks/nonsense')
  expect(response.status()).toBe(404)
})

test('Signals is locked and kept out of the index while it is rebuilt', async ({ page }) => {
  await page.goto('/screener')

  await expect(page.getByRole('heading', { name: /signals is in development/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /come back in the near future/i })).toBeVisible()
  const robotsTags = page.locator('meta[name="robots"]')
  expect(await robotsTags.count()).toBeGreaterThan(0)
  for (const tag of await robotsTags.all()) {
    await expect(tag).toHaveAttribute('content', /noindex/)
  }
})
