import { test, expect, type Page } from '@playwright/test'
import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { createClerkClient } from '@clerk/backend'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const backend = `http://127.0.0.1:${process.env.FINANCE_BACKEND_PORT || '18095'}`
const run = Date.now().toString()
const emails = [0, 1].map(i => `vesconte-platform-${run}-${i}+clerk_test@example.com`)
const users: string[] = []
const ownership: { run: string; users: string[]; checkout_id?: string; account_id?: string } = { run, users }
function recordOwnership() {
  mkdirSync('.platform-qa', { recursive: true, mode: 0o700 })
  writeFileSync(`.platform-qa/${run}.json`, JSON.stringify(ownership), { mode: 0o600 })
}
const api = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const execute = promisify(execFile)

test.beforeAll(async () => {
  await clerkSetup()
  for (const email of emails) {
    const user = await api.users.createUser({ emailAddress: [email], skipPasswordRequirement: true })
    users.push(user.id)
    recordOwnership()
  }
  mkdirSync('test-results/platform', { recursive: true })
  writeFileSync('test-results/platform/owned-test-users.json', JSON.stringify({ run, users }), { mode: 0o600 })
})

test('real Clerk sessions require an expiring explicit administrative grant and lose access on revocation', async ({ page }) => {
  await page.goto('/'); await clerk.signIn({ page, emailAddress: emails[0] })
  await request(page, '/me')
  expect((await request(page, '/admin/me')).status).toBe(403)
  const repos = resolve(process.env.FINANCE_REPOS_DIR || '..')
  const admin = async (...args: string[]) => execute('python3', [
    resolve(repos, 'finance-infra/platform-local/admin.py'), '--repos-dir', repos, ...args,
  ], { timeout: 60_000 })
  const role = `qa-contract-reader-${run}`
  await admin('role', '--role', role, '--permission', 'backoffice.access',
    '--permission', 'GET /admin/contracts', '--reason', 'Temporary local real-Clerk administrative proof')
  const inputPath = process.env.FINANCE_PLATFORM_INPUTS || resolve(repos, 'finance-infra/platform-local/.state/dev-input.json')
  const issuer = JSON.parse(readFileSync(inputPath, 'utf8')).CLERK_JWT_ISSUER as string
  const granted = await admin('grant', '--role', role, '--issuer', issuer,
    '--subject', users[0], '--valid-until', new Date(Date.now() + 60 * 60_000).toISOString(),
    '--reason', 'Temporary local QA grant, not organization privileges')
  const grant = granted.stdout.match(/Administrative grant ID: ([0-9a-f-]{36})/)?.[1]
  expect(grant).toBeTruthy()
  try {
    expect((await request(page, '/admin/me')).status).toBe(200)
    expect((await request(page, '/admin/admin/contracts')).status).toBe(200)
    expect((await request(page, '/admin/admin/data-control/calendar')).status).toBe(403)
  } finally {
    await admin('revoke', '--grant-id', grant!, '--reason', 'Local QA grant cleanup')
  }
  expect((await request(page, '/admin/me')).status).toBe(403)
  writeFileSync('test-results/platform/admin-rbac-proof.json', JSON.stringify({
    clerk: 'Real Development session', explicitGrant: 'PASS', leastPrivilege: 'PASS',
    immediateRevocation: 'PASS', scope: 'Backend administrative API; backoffice browser remains separate',
  }, null, 2))
})
test.afterAll(async () => {
  for (const id of users) await api.users.deleteUser(id)
})

async function request(page: Page, path: string, body?: unknown, key?: string) {
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session))
  return page.evaluate(async ({ base, path, body, key }) => {
    const session = (window as unknown as { Clerk: { session: { getToken: () => Promise<string> } } }).Clerk.session
    const token = await session.getToken()
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (key) headers['Idempotency-Key'] = key
    const response = await fetch(`${base}/v1${path}`, { method: body === undefined ? 'GET' : 'POST',
      credentials: 'omit', cache: 'no-store', redirect: 'error', headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
    return { status: response.status, body: await response.json() }
  }, { base: backend, path, body, key })
}

test('real Clerk identities receive internal accounts; Free and cross-account requests are denied', async ({ page, browser }) => {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: emails[0] })
  const me = await request(page, '/me')
  expect(me.status).toBe(200)
  expect(me.body.user.id).toMatch(/^[0-9a-f-]{36}$/)
  expect(me.body.user.id).not.toBe(users[0])
  const account = me.body.accounts.find((row: { type: string }) => row.type === 'personal')
  expect(account.role).toBe('owner')
  const access = await request(page, `/accounts/${account.id}/access`)
  expect(access.status).toBe(200)
  for (const feature of ['signals.export', 'rankings.read', 'research.ai']) expect(access.body.features[feature].allowed).toBe(false)
  expect((await request(page, '/signals/export', { account_id: account.id, ticker: 'ACME' })).status).toBe(403)
  expect((await request(page, `/rankings?account_id=${account.id}&reading=growth`)).status).toBe(403)
  expect((await request(page, '/research/jobs', { account_id: account.id, comparison: {
    experiment_name: 'native_local_proof', fixture: 'synthetic-market-v1', variants: [
      { name: 'baseline', model: 'logistic_regression', probability_threshold: 0.5 },
      { name: 'forest', model: 'random_forest_classifier', probability_threshold: 0.6 },
    ],
  } }, `native-${run}`)).status).toBe(403)
  await page.goto('/dashboard/research/synthetic')
  await expect(page.getByRole('heading', { name: 'Compare synthetic variants' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeDisabled()
  await expect(page.getByText('Research requires Pro access.')).toBeVisible()
  await expect(page.getByText('No comparisons have been submitted for this account.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Subscribe to Pro' })).toBeEnabled()
  mkdirSync('test-results/platform', { recursive: true })
  mkdirSync(`.platform-qa/${run}`, { recursive: true, mode: 0o700 })
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `.platform-qa/${run}/free-research-${width}.png`, fullPage: true })
  }
  const context = await browser.newContext()
  try {
    const other = await context.newPage()
    await other.goto('/')
    await clerk.signIn({ page: other, emailAddress: emails[1] })
    expect((await request(other, `/accounts/${account.id}/access`)).status).toBe(404)
    expect((await request(other, `/research/jobs?account_id=${account.id}`)).status).toBe(404)
  } finally { await context.close() }
  mkdirSync('test-results/platform', { recursive: true })
  writeFileSync('test-results/platform/identity-proof.json', JSON.stringify({
    clerk: 'Development, two real browser sessions', internalIdentity: 'PASS',
    freePremiumDenied: 'PASS', accountIsolation: 'PASS',
    scope: 'Identity and negative authorization only; paid model execution remains a separate proof',
  }, null, 2))
})

async function fillCheckout(page: Page, selector: string, value: string, required = true) {
  for (const frame of page.frames()) {
    const input = frame.locator(selector).first()
    if (await input.count() && await input.isVisible()) { await input.fill(value); return }
  }
  if (required) throw Error('Required Stripe test checkout field is unavailable')
}

test('Stripe TEST checkout activates verified rights and a native comparison completes through RabbitMQ', async ({ page, browser }) => {
  page.on('response', async response => {
    if (response.status() !== 200 || !response.url().startsWith(`${backend}/v1/accounts/`)
      || !response.url().endsWith('/access')) return
    try {
      const body = await response.json()
      writeFileSync(`.platform-qa/${run}-access.json`, JSON.stringify({
        research: body.features?.['research.ai'], actions: body.research_actions,
      }, null, 2), { mode: 0o600 })
    } catch { /* Navigation can discard a diagnostic response; never retry it. */ }
  })
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: emails[0] })
  const me = await request(page, '/me')
  const account = me.body.accounts.find((row: { type: string }) => row.type === 'personal')
  await page.goto('/dashboard/research/synthetic')
  await expect(page.getByRole('button', { name: 'Subscribe to Pro' })).toBeEnabled()
  await page.route(`${backend}/v1/billing/checkout`, async route => {
    const response = await route.fetch()
    if (response.status() === 200) {
      const receipt = await response.json()
      ownership.checkout_id = receipt.id; ownership.account_id = account.id
      recordOwnership()
      writeFileSync('test-results/platform/owned-test-checkout.json', JSON.stringify({
        run, account_id: account.id, checkout_id: receipt.id,
      }), { mode: 0o600 })
    }
    // Capture only the owned ID before navigation discards the response body.
    // The authenticated request and Backend response remain unchanged.
    await route.fulfill({ response })
  })
  const checkout = page.waitForResponse(response => response.url() === `${backend}/v1/billing/checkout` && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Subscribe to Pro' }).click()
  expect((await checkout).status()).toBe(200)
  await page.waitForURL(url => url.hostname === 'checkout.stripe.com', { timeout: 60_000 })
  await expect.poll(async () => {
    for (const frame of page.frames()) if (await frame.locator('#cardNumber, input[name="number"], input[autocomplete="cc-number"]').count()) return true
    return false
  }, { timeout: 60_000 }).toBe(true)
  await fillCheckout(page, '#email, input[type="email"]', emails[0], false)
  await fillCheckout(page, '#cardNumber, input[name="number"], input[autocomplete="cc-number"]', '4242424242424242')
  await fillCheckout(page, '#cardExpiry, input[name="expiry"], input[autocomplete="cc-exp"]', '1230')
  await fillCheckout(page, '#cardCvc, input[name="cvc"], input[autocomplete="cc-csc"]', '123')
  await fillCheckout(page, '#billingName, input[name="billingName"], input[autocomplete="cc-name"]', 'Vesconte synthetic QA', false)
  for (const frame of page.frames()) {
    const country = frame.locator('#billingCountry, select[name="billingCountry"]').first()
    if (await country.count() && await country.isVisible()) await country.selectOption('PT')
  }
  await fillCheckout(page, '#billingPostalCode, input[name="billingPostalCode"], input[autocomplete="postal-code"]', '1000-001', false)
  // Hosted Checkout localizes its label using the browser/customer locale.
  // Select the payment form's submit control rather than its translated copy.
  const paymentSubmit = page.locator('button[type="submit"]').filter({ visible: true })
  await expect(paymentSubmit).toHaveCount(1)
  await paymentSubmit.click()
  await page.waitForURL(url => url.hostname === 'localhost', { timeout: 90_000 })
  await page.goto('/dashboard/research/synthetic')
  await expect.poll(async () => {
    const access = await request(page, `/accounts/${account.id}/access`)
    expect(access.status).toBe(200)
    return access.body.features['research.ai'].allowed && access.body.research_actions?.can_create === true
  }, { timeout: 120_000, intervals: [3000] }).toBe(true)
  try {
    // The UI intentionally loads only on user action. A pending snapshot does
    // not update itself when the commercial worker finishes reconciliation.
    await expect.poll(async () => {
      const loaded = page.waitForResponse(response => response.url() === `${backend}/v1/accounts/${account.id}/access`)
      await page.getByRole('button', { name: 'Refresh history' }).click()
      await loaded
      return page.getByRole('button', { name: 'Submit synthetic comparison' }).isEnabled()
    }, { timeout: 90_000, intervals: [3000] }).toBe(true)
    await expect(page.getByText('Research access is active.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeEnabled({ timeout: 30_000 })
  } catch (error) {
    writeFileSync('test-results/platform/research-access-diagnostic.json', JSON.stringify({
      alerts: await page.getByRole('alert').allTextContents(),
      statuses: await page.getByRole('status').allTextContents(),
      active: await page.getByText('Research access is active.').count(),
      remaining: await page.getByText(/comparisons available in this billing period/).allTextContents(),
    }, null, 2), { mode: 0o600 })
    throw error
  }
  const admission = { status: 0, detail: '' }
  const admissionAttempts: { status: number; detail: string }[] = []
  await page.route(`${backend}/v1/research/jobs`, async route => {
    expect(route.request().postDataJSON().account_id).toBe(account.id)
    const receipt = await route.fetch()
    const body = await receipt.json()
    admission.status = receipt.status()
    admission.detail = typeof body.detail === 'string' ? body.detail : ''
    admissionAttempts.push({ ...admission })
    writeFileSync(`.platform-qa/${run}-admission.json`, JSON.stringify(admissionAttempts, null, 2), { mode: 0o600 })
    await route.fulfill({ response: receipt })
  })
  let acceptedKey: string | undefined
  let acceptedStatus = 0
  for (let attempt = 0; attempt < 3; attempt++) {
    const accepted = page.waitForResponse(response => response.url() === `${backend}/v1/research/jobs` && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Submit synthetic comparison' }).click()
    const response = await accepted
    const key = response.request().headers()['idempotency-key']
    if (acceptedKey) expect(key).toBe(acceptedKey)
    else { expect(key).toBeTruthy(); acceptedKey = key }
    acceptedStatus = response.status()
    if (acceptedStatus === 202) break
    // An additional signed webhook may temporarily invalidate the binding
    // between /access and POST. Exercise the existing manual retry UI only
    // for this documented condition; do not retry other failures or bypass it.
    expect(acceptedStatus).toBe(503)
    expect(admission.detail).toMatch(/^Research commercial quota (reconciliation is pending|binding is unavailable)$/)
    let stable = 0
    await expect.poll(async () => {
      const access = await request(page, `/accounts/${account.id}/access`)
      stable = access.status === 200 && access.body.research_actions?.can_create === true ? stable + 1 : 0
      return stable
    }, { timeout: 90_000, intervals: [3000] }).toBeGreaterThanOrEqual(3)
    await page.getByRole('button', { name: 'Refresh history' }).click()
    await expect(page.getByRole('button', { name: 'Submit synthetic comparison' })).toBeEnabled()
  }
  expect(acceptedStatus, admission.detail).toBe(202)
  // Chromium may discard the response body after the UI consumes it. Read the
  // committed job through a separate authenticated API request in the browser.
  const history = await request(page, `/research/jobs?account_id=${account.id}`)
  expect(history.status).toBe(200); expect(history.body).toHaveLength(1)
  const job = history.body[0]
  await expect.poll(async () => {
    const result = await request(page, `/research/jobs/${job.id}?account_id=${account.id}`)
    expect(result.status).toBe(200)
    expect(['failed', 'canceled']).not.toContain(result.body.status)
    return result.body.status
  }, { timeout: 30 * 60_000, intervals: [5000] }).toBe('completed')
  const results = await request(page, `/research/jobs/${job.id}/results?account_id=${account.id}`)
  expect(results.status).toBe(200); expect(results.body.variants).toHaveLength(2)
  const events = await request(page, `/research/jobs/${job.id}/events?account_id=${account.id}`)
  const artifacts = await request(page, `/research/jobs/${job.id}/artifacts?account_id=${account.id}`)
  expect(events.status).toBe(200); expect(events.body.events.length).toBeGreaterThan(0)
  expect(artifacts.status).toBe(200); expect(artifacts.body.artifacts).toHaveLength(2)
  for (const artifact of artifacts.body.artifacts) {
    const link = await request(page, `/artifacts/${artifact.id}/download?account_id=${account.id}`)
    expect(link.status).toBe(200); expect(link.body.expires_in).toBe(60)
    const object = await fetch(link.body.url, { redirect: 'error', credentials: 'omit', cache: 'no-store' })
    expect(object.status).toBe(200)
    const bytes = Buffer.from(await object.arrayBuffer())
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256)
    const anonymous = new URL(link.body.url); anonymous.search = ''
    expect([401, 403, 404]).toContain((await fetch(anonymous, { redirect: 'error', credentials: 'omit' })).status)
  }
  await page.getByRole('button', { name: 'Refresh history' }).click()
  await expect(page.getByRole('button', { name: 'Inspect comparison' })).toBeEnabled()
  await page.getByRole('button', { name: 'Inspect comparison' }).click()
  await expect(page.getByRole('heading', { name: 'Execution events' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download artefact' })).toHaveCount(2)
  const context = await browser.newContext()
  try {
    const other = await context.newPage(); await other.goto('/')
    await clerk.signIn({ page: other, emailAddress: emails[1] })
    for (const suffix of ['', '/events', '/results', '/artifacts'])
      expect((await request(other, `/research/jobs/${job.id}${suffix}?account_id=${account.id}`)).status).toBe(404)
    for (const artifact of artifacts.body.artifacts)
      expect((await request(other, `/artifacts/${artifact.id}/download?account_id=${account.id}`)).status).toBe(404)
  } finally { await context.close() }
  writeFileSync('test-results/platform/paid-research-proof.json', JSON.stringify({
    stripe: 'TEST Checkout; signed webhook and current-state reconciliation',
    clerk: 'Development, two real browser sessions', status: 'completed', models: 2,
    events: events.body.events.length, artifacts: artifacts.body.artifacts.length, accountIsolation: 'PASS',
  }, null, 2))
})
