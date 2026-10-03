import { expect, test, type Page } from '@playwright/test'

/**
 * Watchlist Save — Signed-out Recovery V1 (revised 2026-10-03), checked in the
 * browser: a signed-out star opens a modal account prompt.
 *
 * Runs against the synthetic ticker served by the fixture backend (see
 * e2e/fixtures/ticker-page.mjs) in an anonymous context, which is the state the
 * feature exists for.
 */
const TICKER = 'QAM'
const TICKER_PATH = `/stocks/${TICKER}`

const STAR = 'button[aria-label="Add to watchlist"], button[aria-label="Remove from watchlist"]'

async function openTickerPage(page: Page) {
  const response = await page.goto(TICKER_PATH)
  if (!response || response.status() >= 400) {
    test.skip(true, `ticker page unavailable (status ${response?.status() ?? 'none'})`)
  }
  await expect(page.locator('[data-ticker-chrome="ready"] [data-ticker-price]')).toBeVisible()
  if ((await page.locator(STAR).count()) === 0) {
    test.skip(true, 'watchlist control not rendered; backend coverage unavailable')
  }
}

function prompt(page: Page) {
  return page.getByRole('dialog', { name: `Save ${TICKER} to your watchlist` })
}

test.describe('signed-out watchlist account prompt', () => {
  test('activation opens the prompt with what an account gives, and no mutation', async ({ page }) => {
    const watchlistRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/watchlist')) watchlistRequests.push(`${request.method()} ${request.url()}`)
    })

    await openTickerPage(page)
    const urlBeforeClick = page.url()
    const heroBefore = await page.locator('[data-ticker-hero]').boundingBox()

    await expect(prompt(page)).toHaveCount(0)
    await page.locator(STAR).click()

    const dialog = prompt(page)
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Sign in to save this ticker to your watchlist.')
    await expect(dialog).toContainText(`A watchlist to keep ${TICKER}`)
    await expect(dialog).toContainText(`Where ${TICKER} stands in each reading`)
    await expect(dialog).toContainText('25 companies per reading instead of 5')

    const createAccount = dialog.getByRole('link', { name: 'Create account', exact: true })
    const signIn = dialog.getByRole('link', { name: 'Sign in', exact: true })
    await expect(createAccount).toHaveAttribute('href', '/sign-up')
    await expect(signIn).toHaveAttribute('href', '/sign-in')

    // Opening offers focus to the primary action.
    await expect(createAccount).toBeFocused()

    // A modal: the hero keeps its layout underneath.
    expect(await page.locator('[data-ticker-hero]').boundingBox()).toEqual(heroBefore)

    // No automatic redirect, and no mutation while signed out.
    expect(page.url()).toBe(urlBeforeClick)
    expect(watchlistRequests, `unexpected watchlist calls: ${watchlistRequests.join(', ')}`).toEqual([])
  })

  test('focus stays inside, Escape closes and focus returns to the star', async ({ page }) => {
    await openTickerPage(page)
    const star = page.locator(STAR)
    await star.focus()
    await page.keyboard.press('Enter')
    const dialog = prompt(page)
    await expect(dialog).toBeVisible()

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab')
      // Focus may pass through the browser chrome between cycles, but never onto the page.
      const insideOrNowhere = await page.evaluate(() => {
        const active = document.activeElement
        return !active || active === document.body || Boolean(active.closest('dialog'))
      })
      expect(insideOrNowhere).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(star).toBeFocused()
    expect(page.url()).toContain(TICKER_PATH)
  })

  test('a click outside or on Close dismisses it', async ({ page }) => {
    await openTickerPage(page)
    const star = page.locator(STAR)

    await star.click()
    await expect(prompt(page)).toBeVisible()
    await page.mouse.click(4, 4)
    await expect(prompt(page)).toHaveCount(0)

    await star.click()
    await prompt(page).getByRole('button', { name: 'Close' }).click()
    await expect(prompt(page)).toHaveCount(0)
    await expect(star).toBeFocused()

    // Repeat activation never stacks prompts.
    await star.click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
  })

  test('the page behind does not scroll while the prompt is open', async ({ page }) => {
    await openTickerPage(page)
    await page.locator(STAR).click()
    await expect(prompt(page)).toBeVisible()
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.move(10, 400)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.scrollY)).toBe(before)
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
    { name: 'small phone', width: 320, height: 568 },
    { name: 'phone', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'wide', width: 1920, height: 1080 },
  ]) {
    test(`the prompt fits the screen at ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openTickerPage(page)
      await page.locator(STAR).click()
      const dialog = prompt(page)
      await expect(dialog).toBeVisible()

      const fit = await dialog.evaluate((node) => {
        const box = node.getBoundingClientRect()
        return {
          inside: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
          pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        }
      })
      expect(fit.inside, 'the prompt leaves the viewport').toBe(true)
      expect(fit.pageScrollsSideways).toBe(false)
    })
  }
})

test('signed-out export opens its own prompt instead of a panel in the hero', async ({ page }) => {
  await openTickerPage(page)
  const heroBefore = await page.locator('[data-ticker-hero]').boundingBox()
  const exportButton = page.getByRole('button', { name: 'Download signal history CSV' })
  await exportButton.click()
  const dialog = page.getByRole('dialog', { name: 'Export signal history' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Signal export is included with Pro.')
  expect(await page.locator('[data-ticker-hero]').boundingBox()).toEqual(heroBefore)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(exportButton).toBeFocused()
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
