import { expect, test } from '@playwright/test'

const routes = [
  '/', '/about', '/community', '/faq', '/how-it-works', '/method', '/methodology',
  '/performance', '/pricing', '/product', '/markets', '/markets/network',
  '/picks/income', '/picks/long-term', '/picks/short-term', '/screener', '/stocks',
  '/stocks/AAPL',
]

for (const colorScheme of ['light', 'dark'] as const) {
  for (const route of routes) {
    test(`${colorScheme} theme text contrast: ${route}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(route, { waitUntil: 'load' })
      await expect(page.locator('main')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)

      const failures = await page.evaluate(() => {
        type Rgb = [number, number, number, number]
        const parse = (value: string): Rgb | null => {
          const match = value.match(/^rgba?\(([^)]+)\)$/)
          if (!match) return null
          const channels = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number)
          return [channels[0], channels[1], channels[2], channels[3] ?? 1]
        }
        const over = (top: Rgb, bottom: Rgb): Rgb => {
          const alpha = top[3] + bottom[3] * (1 - top[3])
          return [0, 1, 2].map((index) => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha) as Rgb
        }
        const luminance = (rgb: Rgb) => {
          const linear = rgb.slice(0, 3).map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
          return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
        }
        const contrast = (a: Rgb, b: Rgb) => {
          const values = [luminance(a), luminance(b)].sort((left, right) => left - right)
          return (values[1] + 0.05) / (values[0] + 0.05)
        }
        const background = (element: Element): Rgb => {
          let result: Rgb = parse(getComputedStyle(document.documentElement).backgroundColor) ?? [255, 255, 255, 1]
          const chain: Element[] = []
          for (let current: Element | null = element; current; current = current.parentElement) chain.unshift(current)
          for (const current of chain) {
            const layer = parse(getComputedStyle(current).backgroundColor)
            if (layer && layer[3] > 0) result = over(layer, result)
          }
          return result
        }
        const failures: Array<{ text: string; ratio: number; color: string; background: string; element: string; buttonFg: string; buttonBg: string }> = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          const text = node.textContent?.trim()
          const element = node.parentElement
          if (!text || !element || element.closest('svg, script, style, [aria-hidden="true"], [inert]')) continue
          const style = getComputedStyle(element)
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) < 0.9) continue
          if (!element.getClientRects().length) continue
          const foreground = parse(style.color)
          if (!foreground || foreground[3] < 1) continue
          const ground = background(element)
          const ratio = contrast(foreground, ground)
          const size = Number.parseFloat(style.fontSize)
          const threshold = size >= 24 || (size >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700) ? 3 : 4.5
          if (ratio < threshold) failures.push({
            text: text.slice(0, 55), ratio: Math.round(ratio * 100) / 100,
            color: style.color, background: ground.slice(0, 3).map(Math.round).join(','),
            element: `${element.tagName.toLowerCase()}.${String(element.className)}`,
            buttonFg: style.getPropertyValue('--btn-primary-fg'), buttonBg: style.getPropertyValue('--btn-primary-bg'),
          })
        }
        return failures
      })
      expect(failures, JSON.stringify(failures.slice(0, 35), null, 2)).toEqual([])
    })
  }
}
