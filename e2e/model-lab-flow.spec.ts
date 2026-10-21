import { expect, test, type Page } from '@playwright/test'

/*
 * The Model Lab end to end on its synthetic fixtures: pages, states and the
 * journeys between them. The QA server runs with MODEL_LAB_FIXTURES=true.
 */

test.beforeEach(async ({ page }) => {
  await page.route('**/api/tickers/index', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', hasSignals: true },
          { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', hasSignals: true },
        ],
      }),
    })
  )
  await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 204 }))
})

async function preview(page: Page, state: string, depth?: string) {
  const url = 'http://localhost:3100'
  const cookies = [{ name: 'model_lab_preview', value: state, url }]
  if (depth) cookies.push({ name: 'model_lab_depth', value: depth, url })
  await page.context().addCookies(cookies)
}

test('the home lists theses and opens one with its evidence', async ({ page }) => {
  await page.goto('/models')
  await expect(page.getByRole('heading', { name: 'Your theses', level: 1 })).toBeVisible()
  await page.locator('a[href^="/models/theses/"]').first().click()
  await expect(page.getByRole('heading', { name: 'Does it hold up?' })).toBeVisible()
  await expect(page.getByText('not a forecast', { exact: false }).first()).toBeVisible()
})

test('a first test goes from the composer to the run and on to a thesis', async ({ page }) => {
  await page.goto('/models/new')
  await page.getByRole('button', { name: 'my whole watchlist' }).click()
  await page.getByRole('button', { name: /^my stocks/ }).click()

  const run = page.getByRole('button', { name: /^Run test/ })
  await expect(run).toBeDisabled()
  await expect(page.getByText('Choose at least two stocks')).toBeVisible()

  const search = page.getByLabel('Add a stock')
  for (const symbol of ['AAPL', 'MSFT']) {
    await search.fill(symbol)
    await page.getByRole('list', { name: 'Suggestions' }).getByRole('button').first().click()
  }
  await expect(page.getByRole('list', { name: 'Chosen stocks' }).getByRole('listitem')).toHaveCount(2)
  await expect(run).toBeEnabled({ timeout: 10_000 })
  await run.click()

  await expect(page).toHaveURL(/\/models\/runs\//)
  await expect(page.getByRole('progressbar', { name: 'Test progress' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your test is ready' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('link', { name: 'See the evidence' }).click()
  await expect(page.getByRole('heading', { name: 'Does it hold up?' })).toBeVisible()
})

test('a failed run says what happened and that the cost came back', async ({ page }) => {
  await preview(page, 'run=fail')
  await page.goto('/models/new')
  await page.getByRole('button', { name: 'my whole watchlist' }).click()
  await page.getByRole('button', { name: /US stocks/ }).click()
  const run = page.getByRole('button', { name: /^Run test/ })
  await expect(run).toBeEnabled({ timeout: 10_000 })
  await run.click()
  await expect(page.getByRole('heading', { name: 'The test did not finish' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('were returned to you')).toBeVisible()
})

test('a set of variants shows a grid and draws pinned cells', async ({ page }) => {
  await page.goto('/models')
  await page.locator('a[href^="/models/theses/"]').first().click()
  await page.getByRole('link', { name: 'Test again' }).first().click()
  await page.getByRole('button', { name: 'two weeks' }).click()
  await page.getByLabel('Compare several values').check()
  await page.getByRole('button', { name: 'a week', exact: true }).click()
  await page.getByRole('button', { name: 'a month', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Your test' })).toContainText('3 tests')
})

test('panels list, build and open', async ({ page }) => {
  await page.goto('/models/panels')
  await expect(page.getByRole('heading', { name: 'Panels', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'New panel' }).click()
  await expect(page).toHaveURL(/\/models\/panels\/new/, { timeout: 30_000 })
  const create = page.getByRole('button', { name: 'Create panel' })
  await expect(create).toBeDisabled()
  await page.getByLabel('Panel name').fill('E2E panel')
  const models = page.getByRole('button', { pressed: false }).filter({ hasText: 'Logistic regression' })
  await models.nth(0).click()
  await models.nth(0).click()
  await expect(page.getByText('What these models cover')).toBeVisible()
  await create.click()
  await expect(page).toHaveURL(/\/models\/panels\/[0-9a-f-]{36}/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'E2E panel', level: 1 })).toBeVisible()
  for (const tab of ['Models and rule', 'Evidence', 'Alerts']) {
    await page.getByRole('link', { name: tab, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`tab=${tab === 'Models and rule' ? 'models' : tab.toLowerCase()}`))
  }
})

test('alerts can be filtered and marked as read', async ({ page }) => {
  await page.goto('/models/alerts')
  await expect(page.getByRole('heading', { name: 'Alerts', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Mark all as read' }).click()
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  await page.getByRole('button', { name: 'Unread' }).click()
  await expect(page.getByText('Nothing matches this filter.')).toBeVisible()
})

test('compare puts two theses side by side', async ({ page }) => {
  await page.goto('/models/compare')
  const boxes = page.getByRole('checkbox')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'Checks' })).toBeVisible()
})

test('the team console is closed to customers and open to the team', async ({ page }) => {
  await page.goto('/models/team')
  await expect(page.getByText('Not available on your account')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Team' })).toHaveCount(0)

  await preview(page, 'role=team', 'lab')
  await page.goto('/models/team')
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Access requests' }).click()
  const send = page.getByRole('button', { name: 'Request access' })
  await expect(send).toBeDisabled()
  await page.getByLabel('Experiment id').fill('00000000-0000-4000-8000-000000000001')
  await page.getByLabel(/Why you need to see it/).fill('Investigating a failed run for support')
  await expect(send).toBeEnabled()
})

test('a free account sees the upgrade path, not an empty promise', async ({ page }) => {
  await preview(page, 'plan=free')
  await page.goto('/models')
  await expect(page.getByRole('link', { name: 'Upgrade' })).toBeVisible()
})

for (const width of [320, 390, 768, 1280]) {
  test(`pages do not overflow sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const path of ['/models', '/models/new', '/models/panels', '/models/alerts', '/models/compare']) {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
}
