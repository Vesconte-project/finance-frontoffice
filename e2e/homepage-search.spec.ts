import { expect, test, type Page } from '@playwright/test'

const tickerItems = [
  { symbol: 'AAPL', name: 'Alpha One', exchange: 'NASDAQ', hasSignals: true },
  { symbol: 'AMZN', name: 'Alpha Two', exchange: 'NASDAQ', hasSignals: true },
  { symbol: 'AMD', name: 'Alpha Three', exchange: 'NASDAQ', hasSignals: true },
  { symbol: 'ABNB', name: 'Alpha Four', exchange: 'NASDAQ', hasSignals: false },
  { symbol: 'ADBE', name: 'Alpha Five', exchange: 'NASDAQ', hasSignals: false },
  { symbol: 'ARM', name: 'Alpha Six', exchange: 'NASDAQ', hasSignals: false },
]

const GEOMETRY_TOLERANCE_PX = 0.75
const MIN_MEASURABLE_MOVEMENT_PX = GEOMETRY_TOLERANCE_PX * 4

async function openHomepage(page: Page, viewport = { width: 1440, height: 900 }) {
  await page.route('**/api/tickers/index', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: tickerItems }),
    })
  )
  await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 204 }))
  await page.setViewportSize(viewport)
  const tickerIndexLoaded = page.waitForResponse((response) => response.url().includes('/api/tickers/index'))
  await page.goto('/', { waitUntil: 'load' })
  await tickerIndexLoaded
  await page.evaluate(() => document.fonts.ready)
}

function searchInput(page: Page) {
  return page.locator('[data-dock-search] input[role="combobox"]')
}

// The hero field sleeps until asked for (TapToActivateField), as a reader's
// tap or Tab would wake it.
async function activateSearch(page: Page) {
  await page.locator('[data-dock-search] .dock-search__field').click()
  const input = searchInput(page)
  await expect(input).toBeFocused()
  return input
}

async function openResults(page: Page) {
  const input = await activateSearch(page)
  await input.fill('alpha')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('option')).toHaveCount(4)
  return input
}

function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    }
  })
}

function expectMonotonic(samples: number[], direction: 'up' | 'down') {
  expect(samples.length, `Insufficient animation samples: ${JSON.stringify(samples)}`).toBeGreaterThan(3)
  const wrongWay = samples.slice(1).flatMap((value, index) => {
    const delta = value - samples[index]
    const reversed = direction === 'up' ? delta > GEOMETRY_TOLERANCE_PX : delta < -GEOMETRY_TOLERANCE_PX
    return reversed ? [{ index, delta }] : []
  })

  expect(wrongWay, JSON.stringify(wrongWay, null, 2)).toEqual([])
  expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(MIN_MEASURABLE_MOVEMENT_PX)
}

function expectSingleReversal(samples: number[], from: 'up' | 'down', to: 'up' | 'down') {
  const directions = samples.slice(1).flatMap((value, index) => {
    const delta = value - samples[index]
    if (Math.abs(delta) <= GEOMETRY_TOLERANCE_PX) return []
    return [delta > 0 ? 'down' as const : 'up' as const]
  })
  const phases = directions.filter((direction, index) => index === 0 || direction !== directions[index - 1])

  expect(phases, JSON.stringify({ phases, samples }, null, 2)).toEqual([from, to])
  expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(MIN_MEASURABLE_MOVEMENT_PX)
}

type GeometrySamples = {
  cta: number[]
  dock: number[]
}

type Geometry = {
  cta: number
  dock: number
}

function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.dock-search')
    const cta = document.querySelector<HTMLElement>('.dock-search__cta')
    if (!dock || !cta) throw new Error('Homepage search geometry targets are missing')
    return {
      cta: cta.getBoundingClientRect().top,
      dock: dock.getBoundingClientRect().top,
    }
  })
}

function expectStableEndpoint(actual: Geometry, baseline: Geometry) {
  expect(Math.abs(actual.cta - baseline.cta)).toBeLessThanOrEqual(1)
  expect(Math.abs(actual.dock - baseline.dock)).toBeLessThanOrEqual(1)
}

async function sampleGeometryTransition(
  page: Page,
  action: 'open' | 'close',
  duration: number
): Promise<GeometrySamples> {
  return page.evaluate(async ({ action, duration }) => {
    const input = document.querySelector<HTMLInputElement>('[data-dock-search] input[role="combobox"]')
    const dock = document.querySelector<HTMLElement>('.dock-search')
    const cta = document.querySelector<HTMLElement>('.dock-search__cta')
    if (!input || !dock || !cta) throw new Error('Homepage search geometry targets are missing')

    const samples: GeometrySamples = {
      cta: [cta.getBoundingClientRect().top],
      dock: [dock.getBoundingClientRect().top],
    }
    const startedAt = performance.now()
    if (action === 'open') document.querySelector<HTMLElement>('[data-dock-search] .dock-search__field')?.focus()
    else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    await new Promise<void>((resolve) => {
      function sample(now: number) {
        samples.dock.push(dock!.getBoundingClientRect().top)
        samples.cta.push(cta!.getBoundingClientRect().top)
        if (now - startedAt >= duration) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return samples
  }, { action, duration })
}

async function sampleMidOpeningReversal(
  page: Page,
  motionDuration: number
): Promise<GeometrySamples & { reversalIndex: number }> {
  return page.evaluate(async ({ motionDuration }) => {
    const input = document.querySelector<HTMLInputElement>('[data-dock-search] input[role="combobox"]')
    const dock = document.querySelector<HTMLElement>('.dock-search')
    const cta = document.querySelector<HTMLElement>('.dock-search__cta')
    if (!input || !dock || !cta) throw new Error('Homepage search geometry targets are missing')

    const samples: GeometrySamples = {
      cta: [cta.getBoundingClientRect().top],
      dock: [dock.getBoundingClientRect().top],
    }
    const startedAt = performance.now()
    const reverseAt = motionDuration * 0.5
    let reversalIndex = -1
    document.querySelector<HTMLElement>('[data-dock-search] .dock-search__field')?.focus()

    await new Promise<void>((resolve) => {
      function sample(now: number) {
        samples.dock.push(dock!.getBoundingClientRect().top)
        samples.cta.push(cta!.getBoundingClientRect().top)

        const elapsed = now - startedAt
        if (reversalIndex < 0 && elapsed >= reverseAt) {
          reversalIndex = samples.cta.length - 1
          input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
        }

        if (elapsed >= motionDuration * 1.5) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })

    return { ...samples, reversalIndex }
  }, { motionDuration })
}

test('homepage search exposes four stable options and complete combobox semantics', async ({ page }) => {
  await openHomepage(page)
  const input = await openResults(page)
  const listboxId = await input.getAttribute('aria-controls')

  expect(listboxId).toBeTruthy()
  await expect(page.locator(`#${listboxId}`)).toHaveRole('listbox')
  await expect(page.getByRole('option')).toHaveCount(4)

  const retainedOption = await page.getByRole('option', { name: /Alpha One/ }).elementHandle()
  expect(retainedOption).toBeTruthy()
  await input.fill('alpha one')
  await expect(page.getByRole('option')).toHaveCount(1)
  expect(await retainedOption!.evaluate((element) => element.isConnected)).toBe(true)
  await input.fill('alpha')
  await expect(page.getByRole('option')).toHaveCount(4)

  const relationships = await page.evaluate(() => {
    const root = document.querySelector('.ticker-search__root')
    const listbox = document.querySelector('[role="listbox"]')
    const cta = document.querySelector('.dock-search__cta')
    return {
      ctaOutsideCombobox: Boolean(root && cta && !root.contains(cta)),
      ctaOutsideListbox: Boolean(listbox && cta && !listbox.contains(cta)),
    }
  })
  expect(relationships).toEqual({ ctaOutsideCombobox: true, ctaOutsideListbox: true })
  await expect(page.getByRole('link', { name: 'Open correlations network' })).toBeVisible()

  await input.press('ArrowDown')
  const firstActiveId = await input.getAttribute('aria-activedescendant')
  expect(firstActiveId).toBeTruthy()
  await expect(page.locator(`#${firstActiveId}`)).toHaveAttribute('aria-selected', 'true')

  await input.press('ArrowDown')
  const secondActiveId = await input.getAttribute('aria-activedescendant')
  expect(secondActiveId).toBeTruthy()
  expect(secondActiveId).not.toBe(firstActiveId)

  await input.press('ArrowUp')
  await expect(input).toHaveAttribute('aria-activedescendant', firstActiveId!)
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input).not.toHaveAttribute('aria-activedescendant', /.+/)

  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await page.route('**/stocks/AAPL*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><main>Selected AAPL</main></body></html>',
    })
  )
  await Promise.all([
    page.waitForURL(/\/stocks\/AAPL$/),
    input.press('Enter'),
  ])
})

for (const viewport of [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`open homepage search has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
    await openHomepage(page, viewport)
    await openResults(page)

    expect(await horizontalOverflow(page)).toEqual({
      clientWidth: viewport.width,
      scrollWidth: viewport.width,
    })
  })
}

test('homepage search removes transitions and row animation for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openHomepage(page)
  await openResults(page)

  const motion = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.dock-search')
    const panel = document.querySelector<HTMLElement>('.dock-search .ticker-search__panel')
    const option = document.querySelector<HTMLElement>('.dock-search [role="option"]')
    return {
      dockTransition: dock ? getComputedStyle(dock).transitionDuration : null,
      panelTransition: panel ? getComputedStyle(panel).transitionDuration : null,
      optionAnimation: option ? getComputedStyle(option).animationName : null,
    }
  })

  expect(motion).toEqual({
    dockTransition: '0s',
    panelTransition: '0s',
    optionAnimation: 'none',
  })
})

for (const viewport of [
  { name: 'small-mobile', width: 320, height: 568, motionDuration: 280 },
  { name: 'desktop', width: 1440, height: 900, motionDuration: 500 },
]) {
  test(`homepage search and CTA follow stable paths at ${viewport.name}`, async ({ page }) => {
    await openHomepage(page, viewport)
    const input = await openResults(page)
    await input.press('Escape')
    await page.waitForTimeout(viewport.motionDuration + 100)
    await input.evaluate((element) => element.blur())
    const closedBaseline = await readGeometry(page)

    const opening = await sampleGeometryTransition(page, 'open', viewport.motionDuration + 150)
    expectMonotonic(opening.dock, 'up')
    expectMonotonic(opening.cta, 'down')
    await page.waitForTimeout(viewport.motionDuration + 100)

    const closing = await sampleGeometryTransition(page, 'close', viewport.motionDuration + 150)
    expectMonotonic(closing.dock, 'down')
    expectMonotonic(closing.cta, 'up')
    await page.waitForTimeout(viewport.motionDuration + 100)
    await input.evaluate((element) => element.blur())
    expectStableEndpoint(await readGeometry(page), closedBaseline)

    const reversal = await sampleMidOpeningReversal(page, viewport.motionDuration)
    expect(reversal.reversalIndex).toBeGreaterThan(1)
    expectSingleReversal(reversal.cta, 'down', 'up')
    await page.waitForTimeout(viewport.motionDuration + 100)
    expectStableEndpoint(await readGeometry(page), closedBaseline)
  })
}
