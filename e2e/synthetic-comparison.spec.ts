import { test, expect, type Page } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const require = createRequire(path.resolve('package.json'))
let bundle: string
const comparison = {
  experiment_name: 'synthetic_comparison',
  fixture: 'synthetic-market-v1',
  variants: [
    { name: 'baseline', model: 'logistic_regression', probability_threshold: 0.5 },
    { name: 'forest', model: 'random_forest_classifier', probability_threshold: 0.6 },
  ],
}
const run = (variant: string, status: string, id = variant) => ({
  experiment_id: `research-job-${id}`,
  experiment_name: `synthetic_comparison_${variant}`,
  variant,
  status,
  comparison_id: 'c'.repeat(32),
  public_request: comparison,
  created_at: '2026-10-01T00:00:00Z',
  definition_hash: 'a'.repeat(64),
  fixture_sha256: 'b'.repeat(64),
  orchestrator_config_hash: 'd'.repeat(64),
  parameters: comparison.variants.find((v) => v.name === variant) ?? {
    model: 'logistic_regression',
    probability_threshold: 0.5,
  },
  result_json:
    status === 'completed' ? { metrics_summary_json: { sharpe: 1.2, total_return: 0.04 } } : null,
})
test.beforeAll(async () => {
  // Test-only bundle of the actual client component. No app route, identity bypass,
  // secret or mock viewer is added to the shipped Next runtime.
  const { webpack } = require('next/dist/compiled/webpack/webpack')
  const output = await mkdtemp(path.join(tmpdir(), 'synthetic-component-'))
  await new Promise<void>((resolve, reject) =>
    webpack(
      {
        mode: 'development',
        devtool: false,
        entry: path.resolve('e2e/fixtures/synthetic/mount.tsx'),
        output: { path: output, filename: 'component.js' },
        resolve: {
          extensions: ['.tsx', '.ts', '.js'],
          alias: {
            '@': process.cwd(),
            'next/link': path.resolve('e2e/fixtures/synthetic/link.tsx'),
          },
        },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /node_modules/,
              use: path.resolve('e2e/fixtures/synthetic/loader.cjs'),
            },
          ],
        },
      },
      (error: Error | null, stats: { hasErrors: () => boolean; toString: () => string }) =>
        error || stats.hasErrors() ? reject(error ?? Error(stats.toString())) : resolve(),
    ),
  )
  bundle = await readFile(path.join(output, 'component.js'), 'utf8')
})
async function mount(page: Page) {
  await page.goto('/')
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLLinkElement).href))
  const rootClass = await page.evaluate(() => document.documentElement.className)
  await page.route('**/__qa/synthetic-component', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en" class="${rootClass}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><main id="synthetic-root"></main></body></html>`,
    }),
  )
  await page.goto('/__qa/synthetic-component')
  await page.addScriptTag({ content: bundle })
}
test('configure, reject duplicate variants, submit, inspect both states and repeat recorded request', async ({
  page,
}, testInfo) => {
  let jobs: ReturnType<typeof run>[] = [],
    submitted = false
  await page.route('**/api/research/synthetic/**', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual(comparison)
      submitted = true
      jobs = [run('baseline', 'queued'), run('forest', 'running')]
      return route.fulfill({
        status: 202,
        json: {
          status: 'queued',
          members: jobs.map((j) => ({
            variant: j.variant,
            experiment_id: j.experiment_id,
            status: 'queued',
          })),
        },
      })
    }
    if (url.pathname.endsWith('/experiments')) return route.fulfill({ json: { jobs } })
    if (url.pathname.endsWith('/events'))
      return route.fulfill({
        json: {
          events: [
            {
              event_id: 'event-one',
              event_type: 'ml_run_started',
              step: 'ml_run',
              status: 'running',
              created_at: '2026-10-01T00:00:00Z',
            },
          ],
        },
      })
    if (url.pathname.endsWith('/artifacts'))
      return route.fulfill({
        json: {
          artifacts: [
            {
              artifact_id: 'artifact-one',
              artifact_type: 'ml_artifact_manifest',
              artifact_hash: 'e'.repeat(64),
              created_at: '2026-10-01T00:00:00Z',
            },
          ],
        },
      })
    return route.fulfill({ json: jobs.find((j) => url.pathname.endsWith(j.experiment_id)) })
  })
  await mount(page)
  await expect(page.getByText('No synthetic comparisons yet.', { exact: false })).toBeVisible()
  await page.getByLabel('Variant name').nth(1).fill('baseline')
  await page.getByRole('button', { name: 'Submit synthetic comparison' }).click()
  await expect(page.getByRole('alert')).toContainText('Use different variant names')
  expect(submitted).toBe(false)
  await page.getByLabel('Variant name').nth(1).fill('forest')
  await page.getByRole('button', { name: 'Submit synthetic comparison' }).click()
  await expect(page.getByText('Two synthetic variants submitted.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeDisabled()
  jobs = [run('baseline', 'completed'), run('forest', 'failed')]
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page.getByText('Execution completed · Financial validity not established'),
  ).toBeVisible()
  await expect(
    page.getByText('Execution failed · No complete result.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toContainText('1.2')
  await expect(page.getByRole('table')).toContainText('Unavailable')
  await expect(page.getByText('Metadata only.', { exact: false }).first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('synthetic-results.png'), fullPage: true })
  await page.getByRole('button', { name: 'Inspect comparison' }).click()
  await expect(page.getByText('Metadata only.', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Load these options to repeat' }).click()
  await expect(page.getByLabel('Comparison name')).toBeFocused()
  expect(submitted).toBe(true)
})
test('partial submission, empty evidence, recoverable list error and session expiry', async ({
  page,
}) => {
  let state = 'empty'
  await page.route('**/api/research/synthetic/**', (route) => {
    if (state === 'session')
      return route.fulfill({ status: 401, json: { error: 'Sign in again to continue.' } })
    if (state === 'error')
      return route.fulfill({ status: 503, json: { error: 'Synthetic research is unavailable.' } })
    if (route.request().method() === 'POST') {
      state = 'partial'
      return route.fulfill({
        status: 202,
        json: {
          status: 'partial_failure',
          members: [
            { variant: 'baseline', experiment_id: 'research-job-baseline', status: 'queued' },
            { variant: 'forest', status: 'failed' },
          ],
        },
      })
    }
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/experiments'))
      return route.fulfill({
        json: { jobs: state === 'partial' ? [run('baseline', 'queued')] : [] },
      })
    if (url.pathname.endsWith('/events')) return route.fulfill({ json: { events: [] } })
    if (url.pathname.endsWith('/artifacts')) return route.fulfill({ json: { artifacts: [] } })
    return route.fulfill({ json: run('baseline', 'queued') })
  })
  await mount(page)
  await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeEnabled()
  await page.getByRole('button', { name: 'Submit synthetic comparison' }).click()
  await expect(page.getByText('Submission was partial.', { exact: false })).toBeVisible()
  await expect(page.getByText('forest: failed · no run ID returned')).toBeVisible()
  await expect(page.getByText('No events recorded yet.', { exact: false })).toBeVisible()
  state = 'error'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Showing the last successful read')
  state = 'session'
  await page.getByRole('button', { name: 'Refresh recent runs' }).click()
  await expect(page.getByText('Your session ended')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})
for (const viewport of [
  { width: 320, height: 568 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`synthetic form viewport ${viewport.width}, keyboard and reduced motion`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({
      reducedMotion: 'reduce',
      colorScheme: viewport.width === 1920 ? 'dark' : 'light',
    })
    await page.route('**/api/research/synthetic/**', (route) =>
      route.fulfill({ json: { jobs: [] } }),
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await mount(page)
    await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeEnabled()
    await page.getByLabel('Comparison name').focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Variant name').first()).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      return document.fonts.ready
    })
    await expect(page.getByRole('link', { name: 'Back to Research', exact: true })).toBeInViewport()
    await page.screenshot({
      path: testInfo.outputPath(`synthetic-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

test('shipped BFF stays disabled by default despite forged browser identity', async ({
  request,
}) => {
  const response = await request.get('/api/research/synthetic/experiments', {
    headers: { 'x-research-viewer-id': 'user_12345678', 'x-research-bff-secret': 'forged' },
  })
  expect(response.status()).toBe(503)
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(await response.json()).toEqual({ error: 'Synthetic research is unavailable.' })
})

test('unknown submission outcome blocks retry until a successful read and evidence errors recover', async ({
  page,
}) => {
  let jobs: ReturnType<typeof run>[] = [],
    evidenceError = false
  await page.route('**/api/research/synthetic/**', (route) => {
    if (route.request().method() === 'POST') {
      jobs = [run('baseline', 'queued')]
      return route.fulfill({
        status: 502,
        json: {
          error: 'Submission outcome is unknown. Refresh recent runs before submitting again.',
        },
      })
    }
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/experiments')) return route.fulfill({ json: { jobs } })
    if (evidenceError)
      return route.fulfill({
        status: 502,
        json: { error: 'Research service could not be reached. Try refreshing.' },
      })
    if (url.pathname.endsWith('/events')) return route.fulfill({ json: { events: [] } })
    if (url.pathname.endsWith('/artifacts')) return route.fulfill({ json: { artifacts: [] } })
    return route.fulfill({ json: jobs[0] })
  })
  await mount(page)
  await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeEnabled()
  await page.getByRole('button', { name: 'Submit synthetic comparison' }).click()
  await expect(page.getByRole('alert')).toContainText('outcome is unknown')
  await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeDisabled()
  await page.getByRole('button', { name: 'Refresh recent runs' }).click()
  evidenceError = true
  await page.getByRole('button', { name: 'Inspect run' }).click()
  await expect(page.getByRole('button', { name: 'Retry evidence' })).toBeVisible()
  evidenceError = false
  await page.getByRole('button', { name: 'Retry evidence' }).click()
  await expect(page.getByText('No artefacts recorded yet.', { exact: false })).toBeVisible()
})
