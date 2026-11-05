import { expect, test, type Page } from '@playwright/test'

/**
 * The Relationships tab draws a company's strongest ties as an orbit in the
 * atlas's region colours (synthetic FX fixtures from the backend stub). Without
 * an account the five strongest are drawn and the rest share one locked sector;
 * opening it invites the reader to create an account.
 */

const capture = process.env.PLAYWRIGHT_CAPTURE

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function noHorizontalOverflow(page: Page) {
  const { client, scroll } = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(scroll).toBeLessThanOrEqual(client + 1)
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`signed out, the orbit shows five ties and locks the rest (${viewport.width}px)`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize(viewport)
    await page.goto('/stocks/FXA1/relationships')
    const orbit = page.locator('[data-relationship-orbit]')
    await expect(orbit).toBeVisible()
    const plot = orbit.locator(`[data-chart-variant="${viewport.width >= 900 ? 'wide' : 'compact'}"]`)
    await expect(plot.getByRole('link')).toHaveCount(5)
    await expect(plot.getByRole('button', { name: /10 more/ })).toBeVisible()
    await expect(page.locator('[data-research-chapter="related-companies"] ol li')).toHaveCount(5)
    await expect(page.locator('[data-relationships-locked]')).toContainText('10 more companies move with FXA1')
    await noHorizontalOverflow(page)
    if (capture) await page.screenshot({ path: `test-results/relationships-orbit-signed-out-${viewport.width}.png`, fullPage: true })

    // The company's own region and the week are labelled facts, not a sentence.
    await expect(page.locator('[data-atlas-facts]')).toContainText('FXA1’s region')

    // On a wide page a pointer on a company reads its tie in the side column, not under the orbit.
    if (viewport.width >= 900) {
      const reading = page.locator('[data-orbit-reading][data-variant="aside"]')
      await expect(reading).toContainText('Point at a company')
      const first = plot.getByRole('link').first()
      const symbol = (await first.textContent())?.trim() ?? ''
      await first.hover()
      await expect(reading).toContainText(symbol)
      await expect(reading).toContainText(/0\.\d\d/)
      await expect(page.locator('[data-orbit-reading][data-variant="overlay"]')).toHaveCount(0)
    }

    await plot.getByRole('button', { name: /10 more/ }).click()
    const dialog = page.getByRole('dialog', { name: 'See every company FXA1 moves with' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Create account' })).toBeFocused()
    await expect(dialog.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', /\/sign-up\?redirect_url=%2Fstocks%2FFXA1%2Frelationships/)
    if (capture) await page.screenshot({ path: `test-results/relationships-orbit-locked-dialog-${viewport.width}.png` })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(errors).toEqual([])
  })
}

test('reduced motion draws the orbit at rest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/stocks/FXA1/relationships')
  const orbit = page.locator('[data-relationship-orbit]')
  await expect(orbit).toBeVisible()
  const animation = await orbit.locator('[data-chart-variant="wide"] svg path').first().evaluate((node) => getComputedStyle(node).animationName)
  expect(animation).toBe('none')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('a tap reads a company over the orbit, a second tap opens it', async ({ page }) => {
    await page.goto('/stocks/FXA1/relationships')
    const plot = page.locator('[data-relationship-orbit] [data-chart-variant="compact"]')
    const first = plot.getByRole('link').first()
    const symbol = (await first.textContent())?.trim() ?? ''
    await first.tap()
    await expect(page).toHaveURL(/\/stocks\/FXA1\/relationships$/)
    const reading = page.locator('[data-orbit-reading][data-variant="overlay"]')
    await expect(reading).toBeVisible()
    await expect(reading).toContainText(symbol)
    await noHorizontalOverflow(page)
    if (capture) await page.screenshot({ path: 'test-results/relationships-orbit-tap-390.png' })
    await reading.getByRole('button', { name: 'Close the reading' }).tap()
    await expect(reading).toHaveCount(0)
    await first.tap()
    await first.tap()
    await expect(page).toHaveURL(new RegExp(`/stocks/${symbol}/relationships$`))
  })
})
