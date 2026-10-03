import { expect, test } from '@playwright/test'

const suggestions = [
  { symbol: 'AAPL', name: 'Alpha One', exchange: 'NASDAQ', hasSignals: true },
  { symbol: 'AMZN', name: 'Alpha Two', exchange: 'NASDAQ', hasSignals: true },
  { symbol: 'AMD', name: 'Alpha Three', exchange: 'NASDAQ', hasSignals: false },
]

for (const colorScheme of ['light', 'dark'] as const) {
  test(`reading hierarchy and search surface in ${colorScheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('**/api/tickers/index', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: suggestions }),
    }))

    await page.goto('/faq', { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const typography = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>('#faq-questions-heading')!
      const question = document.querySelector<HTMLElement>('[data-faq-question]')!
      const answer = document.querySelector<HTMLElement>('.faq-accordion__panel .reading-copy')!
      const small = document.querySelector<HTMLElement>('.faq-accordion article button > span:first-child')!
      const root = getComputedStyle(document.documentElement)
      const brightness = (value: string) => {
        const modern = value.match(/^color\(srgb\s+([^)]+)\)$/)
        const channels = modern
          ? modern[1].split('/')[0].trim().split(/\s+/).map(Number)
          : value.match(/^rgba?\(([^)]+)\)$/)?.[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3).map((channel) => Number(channel) / 255)
        return channels ? channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 : 0
      }
      return {
        title: getComputedStyle(title).fontFamily,
        question: getComputedStyle(question).fontFamily,
        interface: getComputedStyle(document.body).fontFamily,
        answer: getComputedStyle(answer).color,
        answerBrightness: brightness(getComputedStyle(answer).color),
        smallBrightness: brightness(getComputedStyle(small).color),
        body: root.getPropertyValue('--text-body').trim(),
        page: getComputedStyle(document.querySelector<HTMLElement>('.marketing-faq')!).backgroundColor,
        open: getComputedStyle(document.querySelector<HTMLElement>('.faq-accordion article')!).backgroundColor,
      }
    })
    expect(typography.title.split(',')[0]).toBe(typography.question.split(',')[0])
    expect(typography.question).not.toBe(typography.interface)
    if (colorScheme === 'dark') expect(typography.smallBrightness).toBeGreaterThan(typography.answerBrightness)
    expect(typography.answer).not.toBe('')
    expect(typography.open).not.toBe(typography.page)
    await page.screenshot({ path: testInfo.outputPath(`faq-${colorScheme}.png`) })

    await page.goto('/', { waitUntil: 'load' })
    await expect(page.locator('.dock-search[data-reveal-ready="true"]')).toBeVisible()
    await page.waitForTimeout(1900)
    const input = page.locator('.dock-search__field input[role="combobox"]')
    // The hero field sleeps until asked for (TapToActivateField); focusing
    // its wrapper wakes it, as Tab would.
    await page.locator('.dock-search__field').focus()
    await expect(input).toBeFocused()
    await input.fill('alpha')
    await expect(page.getByRole('option')).toHaveCount(3)
    await expect(page.getByRole('option').first()).toBeVisible()
    await expect(input).toHaveCSS('outline-style', 'solid')
    const surface = await page.locator('.dock-search .ticker-search__panel').evaluate((panel) => ({
      panel: getComputedStyle(panel).backgroundColor,
      option: getComputedStyle(panel.querySelector('[role="option"]')!).backgroundColor,
    }))
    expect(surface.panel).not.toBe(surface.option)
    await page.locator('.dock-search__field').screenshot({ path: testInfo.outputPath(`search-${colorScheme}.png`) })
  })
}

test('compact internal header opens enough room for search', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/faq', { waitUntil: 'load' })
  await page.mouse.wheel(0, 700)
  await expect(page.locator('html')).toHaveClass(/chrome-scrolled/)
  const search = page.locator('[data-header-search]')
  await expect.poll(() => search.evaluate((node) => node.getBoundingClientRect().width)).toBeLessThanOrEqual(48)
  await search.locator('input').focus()
  await expect.poll(() => search.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(200)
  const fit = await search.evaluate((node) => {
    const input = node.querySelector('input')!
    const panel = node.querySelector('.ticker-search__panel')!
    const style = getComputedStyle(input)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    context.font = style.font
    const needed = context.measureText(input.placeholder).width + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
    const panelRect = panel.getBoundingClientRect()
    return { placeholderFits: needed <= input.getBoundingClientRect().width, panelFits: panelRect.right <= window.innerWidth }
  })
  expect(fit).toEqual({ placeholderFits: true, panelFits: true })
  await page.screenshot({ path: testInfo.outputPath('compact-header-dark.png') })
})
