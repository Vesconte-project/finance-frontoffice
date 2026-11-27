import { expect, test } from '@playwright/test'

/**
 * PRD-84 (founder decision 2026-11-23): on a phone the ticker page has one band
 * at the top instead of the site header plus the ticker header. The band holds
 * the brand mark, the identity with the watchlist star, search and the menu,
 * with the tabs beneath; it stays at the top while the page scrolls and the
 * company name folds away. The ticker's other actions live in the menu.
 */

const band = '[data-ticker-chrome="ready"]'

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('one band replaces the site header and stays at the top', async ({ page }) => {
    await page.goto('/stocks/QAS')
    await expect(page.locator(`${band} [data-ticker-price]`)).toBeVisible()

    await expect(page.locator('.site-header')).toBeHidden()
    const chrome = page.locator(band)
    await expect(chrome.locator('[data-ticker-brand]')).toBeVisible()
    await expect(chrome.getByRole('button', { name: 'Add to watchlist' })).toBeVisible()
    await expect(chrome.getByRole('button', { name: 'Search tickers or companies' })).toBeVisible()
    await expect(chrome.getByRole('button', { name: 'Menu' })).toBeVisible()
    // Currency and export are not in the band on a phone.
    await expect(chrome.getByRole('button', { name: /^Listings and currency/ })).toBeHidden()
    await expect(chrome.getByRole('button', { name: 'Export QAS data as CSV' })).toBeHidden()

    const atRest = await chrome.boundingBox()
    expect(atRest?.y ?? -1).toBeLessThanOrEqual(1)
    await expect(chrome.locator('[data-ticker-name]')).toBeVisible()

    await page.mouse.wheel(0, 900)
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('chrome-scrolled'))).toBe(true)
    await expect.poll(async () => (await chrome.boundingBox())?.y ?? -1).toBeLessThanOrEqual(1)
    await expect(chrome.locator('[data-ticker-navigation]')).toBeInViewport()
    // The name folds away; the ticker and price stay.
    await expect.poll(async () => (await chrome.locator('[data-ticker-name]').boundingBox())?.height ?? 0).toBeLessThan(2)
    await expect(chrome.locator('[data-ticker-price]')).toBeInViewport()

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('the menu opens with the ticker actions, then the site and joining', async ({ page }) => {
    await page.goto('/stocks/QAS')
    const trigger = page.locator(band).getByRole('button', { name: 'Menu' })
    await trigger.click()
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await expect(menu).toBeVisible()

    const actions = menu.locator('[data-ticker-mobile-menu-actions]')
    await expect(actions).toContainText('QAS')
    await expect(actions.getByRole('button', { name: /^Listings and currency/ })).toBeVisible()
    await expect(actions.getByRole('button', { name: 'Export QAS data as CSV' })).toBeVisible()
    for (const row of await actions.locator('button[data-appearance="row"]').all()) {
      expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    const site = menu.getByRole('navigation', { name: 'Site' })
    await expect(site.getByRole('link', { name: 'Today', exact: true })).toHaveAttribute('href', '/dashboard')
    await expect(site.getByRole('link', { name: 'Correlation', exact: true })).toHaveAttribute('href', '/markets/network')
    await expect(menu.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/sign-up')

    const box = await menu.boundingBox()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('search opens over the page with the field ready', async ({ page }) => {
    await page.goto('/stocks/QAS')
    await page.locator(band).getByRole('button', { name: 'Search tickers or companies' }).click()
    const search = page.getByRole('dialog', { name: 'Search' })
    await expect(search).toBeVisible()
    await expect(search.locator('input')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(search).toBeHidden()
  })
})

test('from tablet width up the site header stays and the band has no phone controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/stocks/QAS')
  await expect(page.locator(`${band} [data-ticker-price]`)).toBeVisible()
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.locator(`${band} [data-ticker-brand]`)).toBeHidden()
  await expect(page.locator(`${band} [data-ticker-mobile-controls]`)).toBeHidden()
  await expect(page.locator(band).getByRole('button', { name: /^Listings and currency/ })).toBeVisible()
  await expect(page.locator(band).getByRole('button', { name: 'Export QAS data as CSV' })).toBeVisible()
})
