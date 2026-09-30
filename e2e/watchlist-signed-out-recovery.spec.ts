import { expect, test, type Page } from '@playwright/test'

/**
 * Watchlist Save — Signed-out Recovery V1, checked in the browser.
 *
 * These run against an anonymous context, which is the state the feature
 * exists for. If the ticker chrome cannot render — the page depends on
 * finance-backend — the specs skip rather than assert on an empty shell.
 */
const TICKER = 'AAPL'
const TICKER_PATH = `/stocks/${TICKER}`

const STAR = 'button[aria-label="Add to watchlist"], button[aria-label="Remove from watchlist"]'
const RECOVERY = '[data-watchlist-recovery="open"]'

async function openTickerPage(page: Page) {
  const response = await page.goto(TICKER_PATH)
  if (!response || response.status() >= 400) {
    test.skip(true, `ticker page unavailable (status ${response?.status() ?? 'none'})`)
  }
  await page.waitForLoadState('networkidle')
  if ((await page.locator(STAR).count()) === 0) {
    test.skip(true, 'watchlist control not rendered; backend coverage unavailable')
  }
}

test.describe('signed-out watchlist recovery', () => {
  test('activation opens recovery in place, with both actions and no mutation', async ({ page }) => {
    const watchlistRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/watchlist')) {
        watchlistRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    await openTickerPage(page)
    const urlBeforeClick = page.url()

    await expect(page.locator(RECOVERY)).toHaveCount(0)
    await page.locator(STAR).click()

    const recovery = page.locator(RECOVERY)
    await expect(recovery).toBeVisible()
    await expect(recovery).toContainText('Sign in to save this ticker to your watchlist.')

    const signIn = recovery.getByRole('link', { name: 'Sign in', exact: true })
    const createAccount = recovery.getByRole('link', { name: 'Create account', exact: true })
    await expect(signIn).toHaveAttribute('href', '/sign-in')
    await expect(createAccount).toHaveAttribute('href', '/sign-up')

    // No automatic redirect: the click itself navigates nowhere.
    expect(page.url()).toBe(urlBeforeClick)

    // No mutation is attempted while signed out.
    expect(watchlistRequests, `unexpected watchlist calls: ${watchlistRequests.join(', ')}`).toEqual([])

    // Entering the state offers focus to the primary action.
    await expect(signIn).toBeFocused()
  })

  test('repeat activation never stacks recovery states', async ({ page }) => {
    await openTickerPage(page)
    const star = page.locator(STAR)

    for (let i = 0; i < 3; i += 1) {
      await star.click()
      await star.click()
    }
    await star.click()

    await expect(page.locator(RECOVERY)).toHaveCount(1)
  })

  test('the recovery state is keyboard operable and escapable', async ({ page }) => {
    await openTickerPage(page)
    const star = page.locator(STAR)

    await star.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator(RECOVERY)).toBeVisible()

    const signIn = page.locator(RECOVERY).getByRole('link', { name: 'Sign in', exact: true })
    await expect(signIn).toBeFocused()

    // Reading order inside the state runs explanation, primary, secondary.
    await page.keyboard.press('Tab')
    await expect(
      page.locator(RECOVERY).getByRole('link', { name: 'Create account', exact: true })
    ).toBeFocused()

    // Escapable by keyboard, without leaving the page.
    await page.keyboard.press('Escape')
    await expect(page.locator(RECOVERY)).toHaveCount(0)
    await expect(star).toBeFocused()
    expect(page.url()).toContain(TICKER_PATH)
  })

  test('the control keeps its 36px geometry and announces state politely', async ({ page }) => {
    await openTickerPage(page)

    // R-3: the existing 36px star is unchanged in size.
    const box = await page.locator(STAR).boundingBox()
    expect(box?.width).toBeCloseTo(36, 0)
    expect(box?.height).toBeCloseTo(36, 0)

    const liveRegion = page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion.first()).toHaveCount(1)
  })

  for (const viewport of [
    { name: 'mobile', width: 320, height: 568 },
    { name: 'phone', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'wide', width: 1920, height: 1080 },
  ]) {
    test(`recovery fits the ticker chrome at ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openTickerPage(page)
      await page.locator(STAR).click()
      await expect(page.locator(RECOVERY)).toBeVisible()

      // The page body must never scroll horizontally as a result.
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

      // The recovery state is not clipped by the chrome's overflow.
      const clipped = await page.locator(RECOVERY).evaluate((node) => {
        const panel = node.getBoundingClientRect()
        const chrome = node.closest('[data-ticker-hero]')!.getBoundingClientRect()
        return panel.bottom > chrome.bottom + 1 || panel.right > chrome.right + 1 || panel.left < chrome.left - 1
      })
      expect(clipped, 'recovery state is clipped by the ticker chrome').toBe(false)

      // It must not obscure the ticker identity or the research navigation.
      const overlaps = await page.locator(RECOVERY).evaluate((node) => {
        const panel = node.getBoundingClientRect()
        const hits = ['[data-selected-ticker-node]', '[data-ticker-navigation]']
        return hits.some((selector) => {
          const target = document.querySelector(selector)
          if (!target) return false
          const rect = target.getBoundingClientRect()
          return !(panel.right <= rect.left || panel.left >= rect.right || panel.bottom <= rect.top || panel.top >= rect.bottom)
        })
      })
      expect(overlaps, 'recovery state overlaps ticker identity or navigation').toBe(false)
    })
  }
})

/**
 * R-4 — error-token contrast on the real ticker surface.
 *
 * The error colour must come from the current semantic token and meet WCAG AA
 * on the actual ticker surface in each theme.
 */
test('records the error-token contrast measured on the real ticker surface', async ({ page }, testInfo) => {
  await openTickerPage(page)

  const measurement = await page.evaluate(() => {
    const rail = document.querySelector('[data-ticker-hero]')!
    const probe = document.createElement('span')
    probe.className = 'signal-bearish text-caption'
    probe.textContent = 'contrast probe'
    rail.appendChild(probe)

    const parse = (value: string): [number, number, number, number] => {
      const parts = value.match(/[\d.]+/g)!.map(Number)
      return [parts[0]!, parts[1]!, parts[2]!, parts.length > 3 ? parts[3]! : 1]
    }

    const color = getComputedStyle(probe).color
    const fontSize = getComputedStyle(probe).fontSize
    const fontWeight = getComputedStyle(probe).fontWeight

    // Composite every painted background-color from the page down to the probe.
    let backdrop: [number, number, number] = [255, 255, 255]
    const chain: Element[] = []
    for (let node: Element | null = probe; node; node = node.parentElement) chain.unshift(node)
    for (const node of chain) {
      const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor)
      if (a === 0) continue
      backdrop = [
        a * r + (1 - a) * backdrop[0],
        a * g + (1 - a) * backdrop[1],
        a * b + (1 - a) * backdrop[2],
      ]
    }

    probe.remove()
    const [r, g, b] = parse(color)
    const tokenProbe = document.createElement('span')
    tokenProbe.style.color = 'var(--down)'
    rail.appendChild(tokenProbe)
    const token = parse(getComputedStyle(tokenProbe).color)
    tokenProbe.remove()
    return { color: [r, g, b] as [number, number, number], token: token.slice(0, 3), backdrop, fontSize, fontWeight }
  })

  const luminance = ([r, g, b]: [number, number, number]) => {
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  const foreground = luminance(measurement.color)
  const background = luminance(measurement.backdrop)
  const ratio =
    (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)

  const report = [
    `error token       rgb(${measurement.color.map(Math.round).join(', ')})`,
    `painted backdrop  rgb(${measurement.backdrop.map(Math.round).join(', ')})`,
    `type              ${measurement.fontSize} / ${measurement.fontWeight} (normal text)`,
    `contrast          ${ratio.toFixed(2)}:1`,
    `WCAG AA 4.5:1     ${ratio >= 4.5 ? 'PASS' : 'FAIL'}`,
  ].join('\n')

  console.log(`\n[R-4 contrast on ${TICKER_PATH}]\n${report}\n`)
  await testInfo.attach('r4-error-token-contrast', { body: report, contentType: 'text/plain' })

  expect(measurement.color.map(Math.round)).toEqual(measurement.token.map(Math.round))
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})
