import { expect, test, type Page } from '@playwright/test'

test.use({ hasTouch: true })

async function paint(page: Page, selector: string, property: 'fill' | 'backgroundColor' | 'stroke' = 'fill') {
  return page.locator(selector).first().evaluate((element, property) => {
    // Chromium resolves rgb(), color(srgb) and color-mix() through the same
    // canvas colour parser. Preserve alpha for contrast against the real panel.
    const context = document.createElement('canvas').getContext('2d')!
    context.fillStyle = getComputedStyle(element)[property]
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data)
  }, property)
}

function sameColour(actual: number[], expected: readonly number[]) {
  for (let channel = 0; channel < 3; channel++) expect(Math.abs(actual[channel] - expected[channel])).toBeLessThanOrEqual(2)
}

function contrast(paint: number[], background: readonly number[]) {
  const alpha = paint[3] / 255
  const rgb = paint.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha))
  const luminance = (rgb: readonly number[]) => rgb.map(value => {
    const channel = value / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  const [low, high] = [luminance(rgb), luminance(background)].sort((a, b) => a - b)
  return (high + .05) / (low + .05)
}

const palettes = {
  light: { sales: [37, 87, 214], profit: [15, 123, 85], down: [194, 54, 43], bg: [242, 243, 245], surface: [255, 255, 255], text: [11, 18, 32] },
  dark: { sales: [201, 154, 72], profit: [111, 175, 134], down: [208, 117, 101], bg: [15, 22, 32], surface: [23, 33, 48], text: [236, 230, 218] },
} as const

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: Financials keeps data colours across layouts, selection and unit changes`, async ({ page }, info) => {
    const palette = palettes[theme]
    const cost = palette.down.map((value, index) => value * .9 + palette.bg[index] * .1)
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/QAS/financials')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      const wide = width === 1440
      // React can retain a second copy in a hidden streaming segment (S:1).
      // Scope every assertion and interaction to the single visible layout.
      const variant = `[data-flow-variant="${wide ? 'wide' : 'narrow'}"]:visible`
      await expect(page.locator(variant)).toHaveCount(1)
      await expect(page.locator(variant)).toBeVisible()
      const property = wide ? 'fill' : 'backgroundColor'
      for (const [id, expected] of [['sales', palette.sales], ['costOfSales', cost], ['taxes', cost], ['netIncome', palette.profit]] as const) {
        const selector = wide ? `${variant} [data-flow-shape="${id}"]`
          : id === 'sales' ? `${variant} [data-flow-node="sales"]` : `${variant} [data-flow-amount="${id}"]`
        const colour = await paint(page, selector, property)
        sameColour(colour, expected)
        expect(contrast(colour, palette.bg), `${theme}: ${id} mark contrast`).toBeGreaterThanOrEqual(3)
      }
      if (wide) {
        await expect(page.locator(`${variant} [data-flow-shape="buybacks"]`)).toHaveAttribute('data-pending', 'true')
        await expect(page.locator(`${variant} [data-flow-shape="buybacks"]`)).not.toHaveCSS('stroke-dasharray', 'none')
        const link = await paint(page, `${variant} path[data-flow-role="profit"]:not([data-pending])`)
        expect(link[3]).toBeLessThan(128)
      } else {
        await expect(page.locator(`${variant} [data-flow-column="children"] [data-flow-amount]`)).toHaveCount(0)
      }
      for (const [id, expected] of [['costOfSales', cost], ['sales', palette.sales], ['netIncome', palette.profit]] as const) {
        const node = page.locator(`${variant} [data-flow-node="${id}"]`)
        await node.click()
        await expect(node).toHaveAttribute('aria-pressed', 'true')
        const history = `[data-flow-history="${id}"] [data-chart-variant]:visible`
        // Selection can commit before the inherited SVG paint has settled.
        // Re-read both bars; keep the same colour, alpha and contrast requirements.
        await expect(async () => {
          const highlighted = await paint(page, `${history} rect[data-highlighted="true"]`)
          sameColour(highlighted, expected)
          expect(highlighted[3]).toBe(255)
          const earlier = await paint(page, `${history} rect:not([data-highlighted]):first-of-type`)
          sameColour(earlier, expected)
          expect(earlier[3]).toBeLessThan(highlighted[3])
          expect(contrast(earlier, palette.surface), `${theme}: historical ${id} contrast`).toBeGreaterThanOrEqual(3)
        }).toPass({ timeout: 5_000 })
      }
      const unit = page.getByRole('radiogroup', { name: 'Show amounts or share of sales' })
      await unit.getByRole('radio', { name: '% of sales', exact: true }).click()
      await expect(page.locator(`${variant} [data-flow-node="netIncome"]`)).toContainText('24%')
      await unit.getByRole('radio', { name: 'Amount', exact: true }).click()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
      await page.screenshot({ path: info.outputPath(`financials-colours-${theme}-${width}.png`), fullPage: true })
    }
  })

  test(`${theme}: missing inputs stay neutral and losses retain the down colour`, async ({ page }, info) => {
    const palette = palettes[theme]
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/QAM/financials')
    const years = page.getByRole('radiogroup', { name: 'Fiscal year' })
    await years.getByRole('radio', { name: '2024', exact: true }).click()
    const net = '[data-flow-variant="wide"]:visible [data-flow-shape="netIncome"]'
    await expect(page.locator(net)).toHaveAttribute('data-negative', 'true')
    sameColour(await paint(page, net), palette.down)
    sameColour(await paint(page, '[data-flow-history="netIncome"] [data-chart-variant]:visible rect[data-highlighted="true"]'), palette.down)
    const tax = '[data-flow-variant="wide"]:visible [data-flow-shape="taxes"]'
    await expect(page.locator(tax)).toHaveAttribute('data-pending', 'true')
    const neutral = palette.surface.map((value, index) => value * .55 + palette.bg[index] * .45)
    sameColour(await paint(page, tax), neutral)
    await page.screenshot({ path: info.outputPath(`financials-loss-${theme}.png`), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    sameColour(await paint(page, '[data-flow-variant="narrow"]:visible [data-flow-amount="netIncome"]', 'backgroundColor'), palette.down)
    sameColour(await paint(page, '[data-flow-variant="narrow"]:visible path[data-flow-role="profit"]', 'stroke'), palette.down)
    await page.screenshot({ path: info.outputPath(`financials-loss-compact-${theme}.png`), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await years.getByRole('radio', { name: '2023', exact: true }).click()
    const gross = '[data-flow-variant="wide"]:visible [data-flow-shape="grossProfit"]'
    await expect(page.locator(gross)).toHaveAttribute('data-pending', 'true')
    // The pending attribute can arrive before SVG paint settles after returning
    // from the compact layout. Poll the actual colour with the same tolerance.
    await expect(async () => {
      sameColour(await paint(page, gross), neutral)
    }).toPass({ timeout: 5000 })
    await page.goto('/stocks/QAL/financials')
    await expect(page.locator('[data-sales-flow]')).toHaveCount(0)
  })

  test(`${theme}: Fundamentals bars take their chapter's measure colour`, async ({ page }) => {
    const palette = palettes[theme]
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('/stocks/QAS/fundamentals')
    const revenue = 'figure[aria-label^="Reported revenue by fiscal year"] [data-chart-variant]:visible path'
    await expect(page.locator(revenue).first()).toBeVisible()
    // Earlier years are an opaque, quieter tint; the latest year carries the measure in full.
    const earlier = await paint(page, revenue)
    expect(earlier[3]).toBe(255)
    expect(earlier.slice(0, 3)).not.toEqual([...palette.sales])
    const latest = await page.locator(revenue).last().evaluate((element) => {
      const context = document.createElement('canvas').getContext('2d')!
      context.fillStyle = getComputedStyle(element).fill
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data)
    })
    sameColour(latest, palette.sales)
    expect(latest[3]).toBe(255)
    sameColour(await paint(page, '#operating-margin [data-chart-variant]:visible path[data-highlighted="true"]'), palette.profit)
  })
}
