import { expect, test } from '@playwright/test'

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme}: the four Plex faces load without Google Fonts requests`, async ({ page }, info) => {
    const googleRequests: string[] = []
    page.on('request', request => {
      if (/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//.test(request.url())) googleRequests.push(request.url())
    })
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/stocks/QAS/financials')
    const faces = await page.evaluate(async () => {
      const css = getComputedStyle(document.documentElement)
      const result = []
      for (const variable of ['--font-plex-sans', '--font-plex-mono']) {
        const family = css.getPropertyValue(variable).split(',')[0].trim()
        for (const weight of ['400', '500']) {
          const loaded = await document.fonts.load(`${weight} 16px ${family}`, 'Vesconte € ações 0123456789')
          result.push({ variable, weight, family, count: loaded.length, ready: loaded.every(face => face.status === 'loaded' && face.weight === weight) })
        }
      }
      await document.fonts.ready
      return result
    })
    expect(faces).toHaveLength(4)
    for (const face of faces) {
      expect(face.family).not.toBe('')
      expect(face.count, `${face.variable} ${face.weight}: real font face rather than fallback`).toBeGreaterThan(0)
      expect(face.ready).toBe(true)
    }
    expect(googleRequests).toEqual([])
    await page.screenshot({ path: info.outputPath(`local-plex-${colorScheme}.png`), fullPage: true })
  })
}
