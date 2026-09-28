import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'short-laptop', width: 1366, height: 768 },
  { name: 'scaled-desktop', width: 1536, height: 800 },
  { name: 'wide-desktop', width: 1920, height: 1080 },
] as const

for (const viewport of viewports) {
  test(`sign-up composition fits at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const response = await page.goto('/sign-up', { waitUntil: 'load' })
    expect(response?.ok()).toBeTruthy()
    await page.evaluate(() => document.fonts.ready)

    const story = page.locator('.auth-page__story')
    const form = page.locator('.auth-page__form-inner')
    await expect(story).toBeVisible()
    await expect(form).toBeVisible()

    const geometry = await page.evaluate(() => {
      const story = document.querySelector('.auth-page__story')?.getBoundingClientRect()
      const form = document.querySelector('.auth-page__form-inner')?.getBoundingClientRect()
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        story: story && { top: story.top, right: story.right, bottom: story.bottom, height: story.height },
        form: form && { left: form.left, top: form.top, width: form.width },
      }
    })

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
    expect(geometry.story).not.toBeNull()
    expect(geometry.form).not.toBeNull()
    if (viewport.width > 850) {
      expect(geometry.story!.height).toBeLessThanOrEqual(681)
      expect(geometry.story!.bottom).toBeLessThanOrEqual(viewport.height)
      expect(geometry.story!.right).toBeLessThan(geometry.form!.left)
    } else {
      expect(geometry.story!.bottom).toBeLessThan(geometry.form!.top)
    }

    await page.screenshot({ path: testInfo.outputPath(`sign-up-${viewport.name}.png`), fullPage: true })
  })
}
