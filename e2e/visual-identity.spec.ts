import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const phase = process.env.VISUAL_IDENTITY_PHASE

test.skip(!phase, 'Set VISUAL_IDENTITY_PHASE=before or after to capture the visual identity.')

for (const colorScheme of ['light', 'dark'] as const) {
  test(`visual identity ${colorScheme}`, async ({ page }) => {
    const directory = join(process.cwd(), 'artifacts', 'visual-identity', phase!, colorScheme)
    mkdirSync(directory, { recursive: true })
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('**/api/tickers/index', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }))

    await page.goto('/', { waitUntil: 'load' })
    await expect(page.locator('main')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    if (phase === 'after') {
      const ratios = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement)
        const channel = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        const luminance = (hex: string) => {
          const rgb = [1, 3, 5].map((offset) => channel(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255))
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
        }
        const contrast = (a: string, b: string) => {
          const values = [luminance(css.getPropertyValue(a).trim()), luminance(css.getPropertyValue(b).trim())].sort((x, y) => x - y)
          return (values[1] + 0.05) / (values[0] + 0.05)
        }
        return ['--bg', '--surface'].flatMap((background) => ['--text', '--text-muted', '--down'].map((foreground) => contrast(foreground, background)))
          .concat(contrast('--btn-primary-fg', '--btn-primary-bg'))
      })
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
    writeFileSync(join(directory, 'homepage-colors.json'), JSON.stringify(await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const main = getComputedStyle(document.querySelector('main')!)
      return { preference: matchMedia('(prefers-color-scheme: dark)').matches, rootBg: root.getPropertyValue('--bg'), mainBg: main.backgroundColor, mainToken: main.getPropertyValue('--bg'), theme: document.documentElement.dataset.theme }
    }), null, 2))
    await page.screenshot({ path: join(directory, 'homepage.png') })
    await page.locator('footer').screenshot({ path: join(directory, 'footer.png') })

    await page.goto('/stocks/AAPL', { waitUntil: 'load' })
    await expect(page.locator('main')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    if (phase === 'after') {
      await expect(page.locator('[data-ticker-identity] :is(h1, p)').first()).toHaveCSS('color', colorScheme === 'light' ? 'rgb(21, 32, 46)' : 'rgb(236, 230, 218)')
    }
    writeFileSync(join(directory, 'company-colors.json'), JSON.stringify(await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const shell = getComputedStyle(document.querySelector('.app-shell')!)
      const title = document.querySelector('[data-ticker-identity] :is(h1, p)')
      return { preference: matchMedia('(prefers-color-scheme: dark)').matches, rootBg: root.getPropertyValue('--bg'), shellBg: shell.backgroundColor, shellToken: shell.getPropertyValue('--bg'), companyTitleColor: title ? getComputedStyle(title).color : null, theme: document.documentElement.dataset.theme }
    }), null, 2))
    await page.screenshot({ path: join(directory, 'company.png') })
  })
}
