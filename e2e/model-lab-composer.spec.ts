import { expect, test, type Page } from '@playwright/test'

/*
 * The thesis composer: a sentence whose blanks are choices, and value lines on
 * which every point is a value to compare. It builds a sentence only; nothing is
 * run or saved, so these tests need no backend.
 */

async function open(page: Page) {
  await page.goto('/models/lab/new')
  await expect(page.getByRole('heading', { name: 'Test a thesis', level: 1 })).toBeVisible()
}

function summary(page: Page) {
  return page.getByRole('complementary', { name: 'Your test' })
}

test('the summary reads back the sentence and follows each choice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await open(page)
  await expect(summary(page)).toContainText(
    'Among my whole watchlist, recent winners will outperform the market over two weeks.'
  )

  await page.getByRole('button', { name: 'recent winners' }).click()
  await page.getByRole('button', { name: /cheap, profitable companies/ }).click()
  await expect(summary(page)).toContainText('cheap, profitable companies will outperform')

  await page.getByRole('button', { name: 'in any conditions' }).click()
  await page.getByRole('button', { name: /when the market is falling/ }).click()
  await expect(summary(page)).toContainText('when the market is falling over two weeks.')
})

test('a verb without a comparison drops the benchmark blank', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('button', { name: 'the market' })).toBeVisible()
  await page.getByRole('button', { name: 'outperform' }).first().click()
  await page.getByRole('button', { name: /^go up/ }).click()
  await expect(page.getByRole('button', { name: 'the market' })).toHaveCount(0)
  await expect(summary(page)).toContainText('will go up over two weeks.')
})

test('the gain and loss version turns both targets into blanks', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'outperform' }).first().click()
  await page.getByRole('button', { name: /reach a gain before a loss/ }).click()
  await expect(page.getByRole('button', { name: '+5%' })).toBeVisible()
  await expect(page.getByRole('button', { name: '−3%' })).toBeVisible()
  await expect(summary(page)).toContainText('reach a gain of +5% before a loss of −3% over two weeks.')
})

test('several values can be compared, and the number of tests follows', async ({ page }) => {
  await open(page)
  await expect(summary(page)).toContainText('One test.')

  await page.getByRole('button', { name: 'two weeks' }).click()
  await page.getByLabel('Compare several values').check()
  await page.getByRole('button', { name: 'a week', exact: true }).click()
  await page.getByRole('button', { name: 'a month', exact: true }).click()

  await expect(page.getByRole('slider')).toHaveCount(3)
  await expect(summary(page)).toContainText('3 tests')
  await expect(summary(page)).toContainText('over 5, 10 and 20 days.')
})

test('a point moves and is removed from the keyboard, and the last point stays', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'two weeks' }).click()
  await page.getByLabel('Compare several values').check()
  await page.getByRole('button', { name: 'a month', exact: true }).click()

  const first = page.getByRole('slider', { name: /point 1 of 2/ })
  await first.focus()
  await expect(first).toHaveAttribute('aria-valuenow', '10')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow', '11')
  await page.keyboard.press('Shift+ArrowLeft')
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow', '1')

  await page.keyboard.press('Delete')
  await expect(page.getByRole('slider')).toHaveCount(1)
  await page.keyboard.press('Delete')
  await expect(page.getByRole('slider')).toHaveCount(1)
})

test('clicking the line places a point, and an exact value can be typed', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'two weeks' }).click()
  await page.getByLabel('Compare several values').check()

  const line = page.getByRole('group', { name: 'Over how long, value line' })
  const box = (await line.boundingBox())!
  await line.click({ position: { x: box.width * 0.85, y: 22 } })
  await expect(page.getByRole('slider')).toHaveCount(2)

  await page.getByLabel(/Exact value/).fill('45')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('slider')).toHaveCount(3)
  await expect(page.getByRole('slider', { name: /point 3 of 3/ })).toHaveAttribute('aria-valuenow', /^(45|[0-9]+)$/)
})

test('with one value the line sets it instead of adding', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'two weeks' }).click()
  const line = page.getByRole('group', { name: 'Over how long, value line' })
  const box = (await line.boundingBox())!
  await line.click({ position: { x: box.width * 0.6, y: 22 } })
  await expect(page.getByRole('slider')).toHaveCount(1)
})

for (const width of [320, 390, 768]) {
  test(`nothing overflows sideways at ${width}px with a line open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await open(page)
    await page.getByRole('button', { name: 'two weeks' }).click()
    await page.getByLabel('Compare several values').check()
    await page.getByRole('button', { name: 'a week', exact: true }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
