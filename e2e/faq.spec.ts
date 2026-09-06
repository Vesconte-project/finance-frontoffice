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

test('FAQ accordion keeps one answer open and removes legacy copy', async ({ page }) => {
  await page.goto('/faq', { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: 'Find your answers.' })).toBeVisible()

  for (const category of ['Product', 'Market data', 'Features', 'Account & plans']) {
    await expect(page.getByRole('heading', { name: category })).toBeVisible()
  }

  const bodyText = await page.locator('body').innerText()
  for (const legacyText of [
    'Weekly signal before the open',
    'Markets, watchlists, and research context',
    'Weekly cadence, never intraday',
    '€49 / month, cancel anytime',
    'Current scope',
    'Signal workspace',
    'S&P 500 exposure',
    '09 answers',
    'FAQ / Longbrunch',
    'Answers, without the noise.',
    'A clear guide to signals, data, features, and access.',
    'The guide',
  ]) {
    expect(bodyText).not.toContain(legacyText)
  }

  const firstQuestion = page.getByRole('button', { name: 'What is Longbrunch?' })
  const secondQuestion = page.getByRole('button', { name: 'What does a signal mean?' })
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
  await expect(secondQuestion).toHaveAttribute('aria-expanded', 'false')

  await secondQuestion.focus()
  await secondQuestion.press('Enter')
  await expect(secondQuestion).toHaveAttribute('aria-expanded', 'true')
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

  await secondQuestion.press('Enter')
  await expect(secondQuestion).toHaveAttribute('aria-expanded', 'false')

  const planQuestion = page.getByRole('button', { name: 'What do I get with a paid plan?' })
  await planQuestion.click()
  await expect(page.getByRole('link', { name: 'pricing', exact: true })).toBeVisible()
})

test('FAQ removes accordion transitions for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/faq', { waitUntil: 'load' })

  const panel = page.locator('[role="region"]').first()
  const icon = page.getByRole('button', { name: 'What is Longbrunch?' }).locator('svg')

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
