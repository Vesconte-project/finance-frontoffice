import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'modern-mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide-desktop', width: 1920, height: 1080 },
] as const

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const hasDocumentOverflow = root.scrollWidth > root.clientWidth + 1
    const offenders = hasDocumentOverflow
      ? Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.right > root.clientWidth + 1 || rect.left < -1
          })
          .slice(0, 8)
          .map((element) => ({
            element: element.tagName.toLowerCase(),
            id: element.id,
            className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
          }))
      : []

    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      offenders,
    }
  })
}

for (const viewport of viewports) {
  test(`homepage loads without horizontal overflow at ${viewport.name}`, async ({ page }, testInfo) => {
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
    })
    await page.route('**/api/tickers/index', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      })
    )
    await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 204 }))

    await page.setViewportSize(viewport)
    const response = await page.goto('/', { waitUntil: 'load' })

    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('main')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve())
          })
        })
    )

    const overflow = await horizontalOverflow(page)
    expect(overflow, JSON.stringify(overflow, null, 2)).toMatchObject({
      clientWidth: viewport.width,
      scrollWidth: viewport.width,
      offenders: [],
    })
    expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])

    if (process.env.PLAYWRIGHT_CAPTURE === '1') {
      await page.screenshot({
        path: testInfo.outputPath(`homepage-${viewport.name}.png`),
        fullPage: false,
      })
    }
  })
}

test('homepage turns the field while the sections scroll over it, reversibly', async ({ page }) => {
  await page.route('**/api/tickers/index', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  )
  await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 204 }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'load' })

  await expect(page.locator('html')).toHaveAttribute('data-scroll-runtime', 'smooth')
  await expect(page.locator('html')).toHaveAttribute('data-scroll-profile', 'narrative')

  await page.mouse.wheel(0, 900)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(120)
  const forwardState = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('#hc-stage')
    const progress = document.querySelector<HTMLElement>('#hc-prog')
    return {
      progress: progress ? Number.parseFloat(progress.style.width) : 0,
      stageTop: stage?.getBoundingClientRect().top ?? 0,
      pinned: stage?.parentElement?.classList.contains('pin-spacer') ?? false,
    }
  })
  // The stage is not pinned: the sections rise over the field while it turns.
  expect(forwardState.pinned).toBe(false)
  expect(forwardState.stageTop).toBeLessThan(-100)
  expect(forwardState.progress).toBeGreaterThan(0)
  expect(forwardState.progress).toBeLessThan(100)

  await page.mouse.wheel(0, -900)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(20)
  await expect.poll(() => page.locator('#hc-prog').evaluate((element) => Number.parseFloat((element as HTMLElement).style.width))).toBeLessThan(1)
})

test('reduced motion keeps the homepage narrative in native static flow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/tickers/index', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  )
  await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 204 }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'load' })

  await expect(page.locator('html')).toHaveAttribute('data-scroll-runtime', 'native-reduced')
  await expect(page.locator('html')).toHaveAttribute('data-scroll-profile', 'narrative')
  await expect(page.locator('.hc-root')).toHaveAttribute('data-reduced-motion', 'true')
  const staticScene = await page.locator('#hc-stage').evaluate((stage) => ({
    hasInlineHeight: (stage as HTMLElement).style.height !== '',
    hasPinSpacer: stage.parentElement?.classList.contains('pin-spacer') ?? false,
  }))
  expect(staticScene).toEqual({ hasInlineHeight: false, hasPinSpacer: false })
})
