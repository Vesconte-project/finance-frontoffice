import { expect, test } from '@playwright/test'

/**
 * The picks gate, checked where it actually matters: the bytes sent to the browser.
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
  test(`anonymous visitors receive ten ranked names and no more on ${reading}`, async ({ page, request }) => {
    const response = await page.goto(`/picks/${reading}`)
    expect(response?.status()).toBe(200)
    await page.waitForLoadState('networkidle')

    const lockedBlock = page.getByText(/Ranks 11–\d+/)
    if ((await lockedBlock.count()) === 0) {
      test.skip(true, 'ranking unavailable or shorter than the gate; nothing to assert')
    }

    // What the reader sees.
    const renderedCards = await page.locator('a[href^="/stocks/"]').count()
    expect(renderedCards).toBe(10)

    // What was actually sent. This is the assertion that matters.
    const raw = await (await request.get(`/picks/${reading}`)).text()
    const symbols = symbolsInPayload(raw)
    expect(
      symbols.length,
      `payload carried ${symbols.length} symbols: ${symbols.join(', ')}`
    ).toBe(10)
  })
}

test('the locked block advertises a count, never the names behind it', async ({ page }) => {
  await page.goto('/picks/long-term')
  await page.waitForLoadState('networkidle')

  const locked = page.getByRole('heading', { name: /more long term names/i })
  if ((await locked.count()) === 0) test.skip(true, 'ranking unavailable')

  await expect(locked).toBeVisible()
  await expect(page.getByRole('link', { name: /create a free account/i })).toBeVisible()

  // The placeholder rows must be decorative: no ticker text, and hidden from AT.
  const placeholders = page.locator('ul[aria-hidden="true"] li')
  expect(await placeholders.count()).toBeGreaterThan(0)
  for (const text of await placeholders.allInnerTexts()) {
    expect(text.trim()).toMatch(/^\d*$/)
  }
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
