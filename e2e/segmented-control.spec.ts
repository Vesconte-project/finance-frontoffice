import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * The liquid-glass timeframe selector on a synthetic ticker page (see
 * e2e/fixtures/ticker-page.mjs). Selection must work by tap, keyboard, mouse
 * drag and touch drag; a drag commits only on release.
 */

const TICKER = 'QAM'

function timeframe(page: Page): Locator {
  return page.getByRole('radiogroup', { name: 'Chart timeframe' })
}

async function openTicker(page: Page) {
  await page.goto(`/stocks/${TICKER}`)
  await expect(page.locator('[data-ticker-chrome="ready"] [data-ticker-price]')).toBeVisible()
  await expect(timeframe(page).locator('[data-segmented-drop][data-placed="true"]')).toBeVisible()
}

/** Horizontal centre of the drop relative to the centre of an option. */
async function dropOffsetFrom(option: Locator): Promise<number> {
  return option.evaluate((button) => {
    const drop = button.parentElement!.querySelector('[data-segmented-drop]')!
    const dropBox = drop.getBoundingClientRect()
    const buttonBox = button.getBoundingClientRect()
    return Math.abs(dropBox.left + dropBox.width / 2 - (buttonBox.left + buttonBox.width / 2))
  })
}

async function centreOf(option: Locator) {
  const box = (await option.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('tap selects an option and the drop settles on it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openTicker(page)
  const group = timeframe(page)
  // The hero chart opens on 1Y (Spec PRD-78).
  await expect(group.getByRole('radio', { name: '1Y', exact: true })).toHaveAttribute('aria-checked', 'true')

  const fiveYears = group.getByRole('radio', { name: '5Y', exact: true })
  await fiveYears.click()
  await expect(fiveYears).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => dropOffsetFrom(fiveYears)).toBeLessThan(1)
})

test('mouse drag previews without committing, and commits on release', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openTicker(page)
  const group = timeframe(page)
  const historyRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(`/api/stocks/${TICKER}/history`)) historyRequests.push(request.url())
  })

  const start = await centreOf(group.getByRole('radio', { name: '1Y', exact: true }))
  const all = await centreOf(group.getByRole('radio', { name: 'ALL', exact: true }))
  const threeMonths = group.getByRole('radio', { name: '3M', exact: true })
  const end = await centreOf(threeMonths)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  // Across 10Y and ALL, which would load full history if they were committed.
  for (let step = 1; step <= 12; step += 1) await page.mouse.move(start.x + ((all.x - start.x) * step) / 12, start.y)
  await expect(group).toHaveAttribute('data-dragging', 'true')
  await expect(group.getByRole('radio', { name: '1Y', exact: true })).toHaveAttribute('aria-checked', 'true')
  for (let step = 1; step <= 8; step += 1) await page.mouse.move(all.x + ((end.x - all.x) * step) / 8, start.y)
  await page.mouse.up()

  await expect(group).toHaveAttribute('data-dragging', 'false')
  await expect(threeMonths).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => dropOffsetFrom(threeMonths)).toBeLessThan(1)
  expect(historyRequests).toEqual([])
})

test('touch drag on a phone-sized screen moves the selection', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await openTicker(page)
  const group = timeframe(page)
  const target = group.getByRole('radio', { name: 'YTD', exact: true })
  const start = await centreOf(group.getByRole('radio', { name: '1Y', exact: true }))
  const end = await centreOf(target)

  const cdp = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', start.x, start.y)
  for (let step = 1; step <= 10; step += 1) await touch('touchMove', start.x + ((end.x - start.x) * step) / 10, start.y)
  await expect(group).toHaveAttribute('data-dragging', 'true')
  await touch('touchEnd', end.x, end.y)

  await expect(target).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => dropOffsetFrom(target)).toBeLessThan(1)
  await context.close()
})

test('arrow keys, Home and End move the selection and focus', async ({ page }) => {
  await openTicker(page)
  const group = timeframe(page)
  const current = group.getByRole('radio', { name: '1Y', exact: true })
  await current.focus()
  await page.keyboard.press('ArrowRight')
  await expect(group.getByRole('radio', { name: '5Y', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(group.getByRole('radio', { name: '5Y', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(group.getByRole('radio', { name: '1D', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(group.getByRole('radio', { name: 'ALL', exact: true })).toBeFocused()
  // Only the selected option is in the tab order.
  await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1)
})

test('reduced motion places the drop without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openTicker(page)
  const group = timeframe(page)
  const target = group.getByRole('radio', { name: '3M', exact: true })
  await target.click()
  // One frame later the drop is already on the new option.
  const offset = await target.evaluate((button) => new Promise<number>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const drop = button.parentElement!.querySelector('[data-segmented-drop]')!.getBoundingClientRect()
      const box = button.getBoundingClientRect()
      resolve(Math.abs(drop.left + drop.width / 2 - (box.left + box.width / 2)))
    }))
  }))
  expect(offset).toBeLessThan(1)
})

test('touch pointers get 44px targets without a taller track', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await openTicker(page)
  const group = timeframe(page)
  const result = await group.evaluate((root) => {
    const buttons = [...root.querySelectorAll<HTMLElement>('[role="radio"]')]
    // Each option answers a tap 22px above and below its centre: a 44px target.
    const reachable = buttons.every((button) => {
      const box = button.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      return [y - 21, y + 21].every((probe) => button.contains(document.elementFromPoint(x, probe)))
    })
    return { reachable, trackHeight: root.getBoundingClientRect().height }
  })
  expect(result.reachable).toBe(true)
  expect(result.trackHeight).toBeLessThan(40)
  await context.close()
})
