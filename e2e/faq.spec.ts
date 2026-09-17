import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'laptop', width: 1366, height: 768 },
] as const

for (const viewport of viewports) {
  test(`FAQ has no horizontal overflow at ${viewport.name}`, async ({ page }, testInfo) => {
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
    })

    await page.setViewportSize(viewport)
    const response = await page.goto('/faq', { waitUntil: 'load' })

    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('main')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))

    expect(overflow, JSON.stringify(overflow)).toEqual({
      clientWidth: viewport.width,
      scrollWidth: viewport.width,
    })
    expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])

    if (process.env.PLAYWRIGHT_CAPTURE === '1') {
      await page.screenshot({
        path: testInfo.outputPath(`faq-${viewport.name}.png`),
        fullPage: false,
      })
      await page.screenshot({
        path: testInfo.outputPath(`faq-${viewport.name}-full.png`),
        fullPage: true,
      })
    }
  })
}

/**
 * The previous version of this test asserted that a list of retired strings was
 * absent. A blacklist pins the page to its past and says nothing true about its
 * present: it passed the whole time the page was routing readers to a locked
 * screener. These are positive assertions about the contract the page now holds.
 */
test('FAQ states the current availability contract', async ({ page }) => {
  await page.goto('/faq', { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: 'Find your answers.', level: 1 })).toBeVisible()

  for (const category of ['Product', 'Market data', 'Features', 'Account & plans']) {
    await expect(page.getByRole('heading', { name: category, level: 2 })).toBeVisible()
  }

  // Market-wide monitoring is described as closed, and the screener is named only
  // as the retired thing being replaced.
  const marketWide = page.getByRole('button', { name: 'Can I monitor signals across the whole market yet?' })
  await marketWide.click()
  const marketWideAnswer = page.locator('#market-wide-monitoring')
  await expect(marketWideAnswer).toContainText('Not yet.')
  await expect(marketWideAnswer).toContainText('rather than extended from the earlier screener')

  // Paid tiers are described as planned direction, echoing the pricing page.
  const planQuestion = page.getByRole('button', { name: 'What do I get with a paid plan?' })
  await planQuestion.click()
  await expect(page.locator('#paid-plan')).toContainText('not current entitlements')
  await expect(page.getByRole('link', { name: 'pricing', exact: true })).toBeVisible()

  // Alerts are described as unavailable.
  await page.getByRole('button', { name: 'Can I set up alerts?' }).click()
  await expect(page.locator('#alerts')).toContainText('not available to manage in the product today')

  // No answer asserts an update cadence, and none names the retired route.
  const answers = await page.locator('.faq-accordion__panel').allInnerTexts()
  const blob = answers.join('\n')
  expect(blob).not.toMatch(/\bdaily\b/i)
  expect(blob).not.toMatch(/signal history page/i)
})

test('FAQ accordion keeps exactly one answer open', async ({ page }) => {
  await page.goto('/faq', { waitUntil: 'load' })

  const firstQuestion = page.getByRole('button', { name: 'What is Vesconte?' })
  const secondQuestion = page.getByRole('button', { name: 'What does a signal mean?' })
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
  await expect(secondQuestion).toHaveAttribute('aria-expanded', 'false')

  await secondQuestion.focus()
  await secondQuestion.press('Enter')
  await expect(secondQuestion).toHaveAttribute('aria-expanded', 'true')
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

  await secondQuestion.press('Enter')
  await expect(secondQuestion).toHaveAttribute('aria-expanded', 'false')
})

test('FAQ renders exactly one h1 and no skipped heading level', async ({ page }) => {
  await page.goto('/faq', { waitUntil: 'load' })

  const levels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4')).map((node) =>
      Number(node.tagName.slice(1))
    )
  )

  expect(levels.filter((level) => level === 1)).toHaveLength(1)
  expect(levels[0]).toBe(1)
  // Every heading is at most one level deeper than the shallowest seen so far.
  let deepestSoFar = levels[0]
  for (const level of levels) {
    expect(level).toBeLessThanOrEqual(deepestSoFar + 1)
    deepestSoFar = Math.max(deepestSoFar, level)
  }
})

/**
 * This is what stops the visible answers and the published structured data
 * drifting apart. Both are serialised from the same in-repo constant, so a
 * mismatch here means someone authored the copy twice.
 */
test('FAQ structured data carries exactly the rendered question set', async ({ page }) => {
  await page.goto('/faq', { waitUntil: 'load' })

  const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(raw, 'the route must emit FAQPage JSON-LD').toBeTruthy()

  const parsed = JSON.parse(raw ?? '{}') as {
    '@type': string
    mainEntity: { name: string; acceptedAnswer: { text: string } }[]
  }
  expect(parsed['@type']).toBe('FAQPage')

  const rendered = await page.locator('[data-faq-question]').allInnerTexts()
  expect(parsed.mainEntity.map((entry) => entry.name)).toEqual(rendered.map((text) => text.trim()))
  expect(parsed.mainEntity.length).toBe(20)

  for (const entry of parsed.mainEntity) {
    expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0)
    // The inline-link suffix defect rendered "create an account ." — a space
    // before the full stop. It must not survive into structured data either.
    expect(entry.acceptedAnswer.text).not.toContain(' .')
  }
})

test('FAQ opens the answer a question anchor points at', async ({ page }) => {
  await page.goto('/faq#export-data', { waitUntil: 'load' })

  const exportQuestion = page.getByRole('button', { name: 'Can I export data?' })
  await expect(exportQuestion).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'What is Vesconte?' })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#export-data')).toContainText('reserved for the Pro plan')

  // A later anchor navigation moves focus to the trigger so a reader arriving
  // from a support link lands on the answer, not at the top of the page.
  await page.evaluate(() => {
    window.location.hash = '#alerts'
  })
  const alertsQuestion = page.getByRole('button', { name: 'Can I set up alerts?' })
  await expect(alertsQuestion).toHaveAttribute('aria-expanded', 'true')
  await expect(alertsQuestion).toBeFocused()
})

test('FAQ emits view_faq', async ({ page }) => {
  const events: string[] = []
  page.on('request', (request) => {
    if (!request.url().includes('/api/analytics/event')) return
    events.push(request.postData() ?? '')
  })

  await page.goto('/faq', { waitUntil: 'load' })
  await expect.poll(() => events.some((body) => body.includes('view_faq'))).toBe(true)
})

test('FAQ removes accordion transitions for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/faq', { waitUntil: 'load' })

  const panel = page.locator('.faq-accordion__panel').first()
  const icon = page.getByRole('button', { name: 'What is Vesconte?' }).locator('svg')

  await expect(panel).toHaveCSS('transition-duration', '0s')
  await expect(icon).toBeVisible()
})

test('internal marketing headers use the larger search and homepage scroll pill', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  for (const route of ['/faq', '/pricing']) {
    await page.goto(route, { waitUntil: 'load' })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('chrome-scrolled'))).toBe(false)
    await expect.poll(() => page.locator('[data-header-search] input').evaluate((input) => input.getBoundingClientRect().width)).toBeGreaterThan(480)
    await expect(page.locator('.site-header')).toHaveAttribute('data-internal', '')

    const initial = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.site-header__row')
      const search = document.querySelector<HTMLElement>('[data-header-search] input')
      if (!row || !search) throw new Error('Internal header geometry targets are missing')
      return {
        rowWidth: row.getBoundingClientRect().width,
        searchWidth: search.getBoundingClientRect().width,
        searchHeight: search.getBoundingClientRect().height,
        surfaceOpacity: getComputedStyle(row, '::before').opacity,
      }
    })

    expect(initial.searchWidth).toBeGreaterThan(480)
    expect(initial.searchHeight).toBe(48)
    // Pricing carries its own plan cards straight under the header, so it stays
    // boxless at rest like the ticker's operational chrome; FAQ keeps the glass
    // surface from the first frame.
    expect(initial.surfaceOpacity).toBe(route === '/pricing' ? '0' : '1')

    await page.evaluate(() => window.scrollTo(0, 240))
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('chrome-scrolled'))).toBe(true)
    await expect.poll(() => page.locator('.site-header__row').evaluate((row) => row.getBoundingClientRect().width)).toBeLessThanOrEqual(430)
    await expect.poll(() => page.locator('[data-header-search] input').evaluate((input) => input.getBoundingClientRect().height)).toBeLessThanOrEqual(32.1)

    const scrolled = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.site-header__row')
      const search = document.querySelector<HTMLElement>('[data-header-search] input')
      if (!row || !search) throw new Error('Scrolled header geometry targets are missing')
      return {
        rowWidth: row.getBoundingClientRect().width,
        searchWidth: search.getBoundingClientRect().width,
        searchHeight: search.getBoundingClientRect().height,
      }
    })

    expect(scrolled.rowWidth).toBeLessThanOrEqual(430)
    expect(scrolled.searchWidth).toBeLessThan(initial.searchWidth)
    expect(scrolled.searchHeight).toBeCloseTo(32, 1)
  }
})
