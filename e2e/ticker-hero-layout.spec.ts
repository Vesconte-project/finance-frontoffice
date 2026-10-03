import { expect, test, type Page } from '@playwright/test'

/*
 * The ticker hero must adapt to the width it is given, not to a list of
 * devices. This sweeps every width from 280px to 1920px in 10px steps with
 * synthetic tickers whose names range from short to very long (see
 * e2e/fixtures/ticker-page.mjs) and checks the layout rules at each width.
 */

const TICKERS = ['QAS', 'QAM', 'QAL'] as const
const MIN_WIDTH = 280
const MAX_WIDTH = 1920
const STEP = 10

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number }

type Measurement = {
  pageOverflow: boolean
  nameTruncated: boolean
  nameHasRoom: boolean
  priceApart: boolean
  overlaps: string[]
  rangeVisible: boolean
  rangeScrolls: boolean
  rangeBelowFacts: boolean
  factsRightOfRange: boolean
  axisLabelsCollide: boolean
  actionsOnOwnLine: boolean
}

async function measure(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const box = (element: Element | null): Box | null => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return null
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height }
    }
    const sameLine = (a: Box, b: Box) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > Math.min(a.height, b.height) / 2
    const intersects = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1

    const viewport = document.documentElement.clientWidth
    const nameElement = document.querySelector<HTMLElement>('[data-ticker-name]')!
    const name = box(nameElement)!
    const symbol = box(document.querySelector('[data-ticker-symbol]'))!
    const price = box(document.querySelector('[data-ticker-price]'))!
    const quote = box(document.querySelector('[data-ticker-quote]'))!
    const metadata = box(document.querySelector('[data-ticker-metadata]'))
    const actions = box(document.querySelector('[data-ticker-actions]'))
    const identity = document.querySelector('[data-selected-ticker-node]')!.parentElement!
    const identityBox = box(identity)!

    // A shortened name is only acceptable when nothing else shares its line and
    // it already reaches the end of the space it is given.
    const nameTruncated = nameElement.scrollWidth > nameElement.clientWidth + 1
    const lineNeighbours = [quote, metadata, actions].filter((other): other is Box => other !== null && sameLine(name, other))
    const quoteOnNameLine = sameLine(name, quote)
    const lineEnd = Math.min(identityBox.right, ...lineNeighbours.filter((other) => other.left > name.left).map((other) => other.left))
    const nameHasRoom = !quoteOnNameLine && name.right >= lineEnd - 32

    const pieces: Array<[string, Box | null]> = [['name', name], ['quote', quote], ['metadata', metadata], ['actions', actions]]
    const overlaps: string[] = []
    for (let i = 0; i < pieces.length; i += 1) {
      for (let j = i + 1; j < pieces.length; j += 1) {
        const [aName, a] = pieces[i]
        const [bName, b] = pieces[j]
        if (a && b && intersects(a, b)) overlaps.push(`${aName}/${bName}`)
      }
    }

    const rangeElement = document.querySelector<HTMLElement>('[data-chart-range]')!
    const rangeGroup = rangeElement.querySelector<HTMLElement>('[aria-label="Chart timeframe"]')!
    const range = box(rangeGroup)!
    const facts = box(document.querySelector('[data-chart-facts]'))!
    const rangeButtonsOverflow = [...rangeGroup.querySelectorAll<HTMLElement>('button')].some((button) => button.scrollWidth > button.clientWidth + 1)

    const chart = document.querySelector('[data-temporal-line-chart] svg')!
    const chartBox = box(chart)!
    const axisLabels = [...chart.querySelectorAll('text[text-anchor="middle"]')].map((label) => box(label)!).filter(Boolean)
    const axisLabelsCollide = axisLabels.some((label, index) =>
      label.left < chartBox.left - 0.5
      || label.right > chartBox.right + 0.5
      || axisLabels.slice(index + 1).some((other) => Math.min(label.right, other.right) - Math.max(label.left, other.left) > -4))

    // The actions share a line with the name or the quote: the hero never needs a third line for them.
    const actionsOnOwnLine = actions !== null && !sameLine(actions, name) && !sameLine(actions, quote)

    return {
      pageOverflow: document.documentElement.scrollWidth > viewport,
      nameTruncated,
      nameHasRoom,
      priceApart: !sameLine(symbol, price),
      overlaps,
      rangeVisible: range.left >= -0.5 && range.right <= viewport + 0.5,
      rangeScrolls: rangeElement.scrollWidth > rangeElement.clientWidth + 1 || rangeButtonsOverflow,
      rangeBelowFacts: !sameLine(range, facts) && range.top > facts.top,
      factsRightOfRange: sameLine(range, facts) && facts.left > range.left,
      axisLabelsCollide,
      actionsOnOwnLine,
    }
  })
}

for (const ticker of TICKERS) {
  test(`ticker hero adapts at every width for ${ticker}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/stocks/${ticker}`)
    await expect(page.locator('[data-ticker-chrome="ready"] [data-ticker-price]')).toBeVisible()
    await expect(page.locator('[data-chart-range]')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    const failures: string[] = []
    for (let width = MIN_WIDTH; width <= MAX_WIDTH; width += STEP) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const result = await measure(page)
      const problems = [
        result.pageOverflow && 'page scrolls horizontally',
        result.nameTruncated && !result.nameHasRoom && 'name shortened while space was taken by other content',
        result.priceApart && 'price separated from ticker',
        result.overlaps.length > 0 && `overlap ${result.overlaps.join(', ')}`,
        !result.rangeVisible && 'timeframe control outside the viewport',
        result.rangeScrolls && 'timeframe control needs scrolling',
        result.rangeBelowFacts && 'timeframe control below the market facts',
        result.factsRightOfRange && 'market facts right of the timeframe control',
        result.axisLabelsCollide && 'chart date labels collide or leave the chart',
        // Below 360px the actions may take a third line; from there they must not.
        width >= 360 && result.actionsOnOwnLine && 'actions pushed to a line of their own',
      ].filter(Boolean)
      if (problems.length > 0) failures.push(`${width}px: ${problems.join('; ')}`)
    }
    expect(failures, failures.join('\n')).toEqual([])
  })
}
