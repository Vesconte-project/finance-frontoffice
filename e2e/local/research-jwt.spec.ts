import { test, expect, type Page } from '@playwright/test'
import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { createClerkClient } from '@clerk/backend'
import { mkdirSync, writeFileSync } from 'node:fs'

const backend = `http://127.0.0.1:${process.env.FINANCE_BACKEND_PORT || '18095'}`
const emails = ['vesconte-local-owner-a+clerk_test@example.com', 'vesconte-local-owner-b+clerk_test@example.com']
const created: string[] = []
const api = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

test.beforeAll(async () => {
  await clerkSetup()
  for (const email of emails) {
    const users = await api.users.getUserList({ emailAddress: [email] })
    if (users.totalCount === 0) {
      const user = await api.users.createUser({ emailAddress: [email], skipPasswordRequirement: true })
      created.push(user.id)
    }
  }
})
test.afterAll(async () => {
  // Delete only synthetic users this test created, never pre-existing accounts.
  for (const id of created) await api.users.deleteUser(id)
})
async function userRequest(page: Page, path: string) {
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session))
  return page.evaluate(async ({ base, path }) => {
    const session = (window as unknown as { Clerk: { session: { getToken: () => Promise<string> } } }).Clerk.session
    const token = await session.getToken()
    const response = await fetch(`${base}/site/research/synthetic${path}`, { credentials: 'omit', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    return { status: response.status, body: await response.json() }
  }, { base: backend, path })
}

test('real Clerk sessions submit two models, inspect evidence and isolate owners', async ({ page, browser }) => {
  const direct: string[] = [], bff: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/research/synthetic/')) bff.push(request.url())
    if (request.url().startsWith(`${backend}/site/research/synthetic/`)) {
      const headers = request.headers()
      expect(headers.authorization?.startsWith('Bearer ')).toBe(true)
      for (const name of ['x-research-viewer-id', 'x-research-bff-secret', 'x-backend-shared-secret', 'cf-access-client-id', 'cf-access-client-secret', 'cookie']) expect(Object.keys(headers)).not.toContain(name)
      direct.push(request.url())
    }
  })
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: emails[0] })
  await page.goto('/dashboard/research/synthetic')
  await expect(page.getByRole('heading', { name: 'Compare synthetic variants' })).toBeVisible()
  const name = `clerk_local_${Date.now()}`
  await page.getByLabel('Comparison name').fill(name)
  const submit = page.getByRole('button', { name: 'Submit synthetic comparison' })
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  const accepted = page.waitForResponse(r => r.url() === `${backend}/site/research/synthetic/comparisons` && r.request().method() === 'POST')
  await submit.click()
  const response = await accepted
  expect(response.status()).toBe(202)
  const submission = await response.json()
  const ids: string[] = submission.members.map((m: { experiment_id: string }) => m.experiment_id)
  expect(ids).toHaveLength(2)
  await expect.poll(async () => {
    const results = await Promise.all(ids.map(id => userRequest(page, `/experiments/${id}`)))
    for (const result of results) { expect(result.status).toBe(200); expect(['failed', 'cancelled']).not.toContain(result.body.status) }
    return results.map(r => r.body.status)
  }, { timeout: 30 * 60_000, intervals: [5000] }).toEqual(['completed', 'completed'])
  const row = page.locator('li').filter({ has: page.getByText(name, { exact: true }) })
  await expect(row.getByText(/Execution completed/)).toHaveCount(2, { timeout: 15_000 })
  await row.getByRole('button', { name: 'Inspect comparison' }).click()
  await expect(page.getByText('Loading run evidence…')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Execution events' })).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Artefact records' })).toHaveCount(2)
  const artifactPaths: string[] = []
  const counts = []
  for (const id of ids) {
    const events = await userRequest(page, `/experiments/${id}/events`)
    const artifacts = await userRequest(page, `/experiments/${id}/artifacts`)
    expect(events.status).toBe(200); expect(events.body.events.length).toBeGreaterThan(0)
    expect(artifacts.status).toBe(200); expect(artifacts.body.artifacts.length).toBeGreaterThan(0)
    counts.push({ events: events.body.events.length, artifacts: artifacts.body.artifacts.length })
    for (const artifact of artifacts.body.artifacts) {
      const path = `/experiments/${id}/artifacts/${artifact.artifact_id}`
      expect((await userRequest(page, path)).status).toBe(200); artifactPaths.push(path)
    }
  }
  expect(bff).toEqual([]); expect(direct.length).toBeGreaterThan(0)
  const secondContext = await browser.newContext()
  try {
    const other = await secondContext.newPage()
    await other.goto('/')
    await clerk.signIn({ page: other, emailAddress: emails[1] })
    await other.goto('/dashboard/research/synthetic')
    await expect(other.getByRole('heading', { name: 'Compare synthetic variants' })).toBeVisible()
    await expect(other.getByRole('button', { name: 'Submit synthetic comparison' })).toBeEnabled({ timeout: 30_000 })
    await expect(other.getByText(name, { exact: true })).toHaveCount(0)
    const list = await userRequest(other, '/experiments?limit=50')
    expect(list.status).toBe(200)
    expect(list.body.jobs.some((job: { experiment_id: string }) => ids.includes(job.experiment_id))).toBe(false)
    for (const id of ids) for (const suffix of ['', '/events', '/artifacts']) expect((await userRequest(other, `/experiments/${id}${suffix}`)).status).toBe(404)
    for (const path of artifactPaths) expect((await userRequest(other, path)).status).toBe(404)
  } finally { await secondContext.close() }
  mkdirSync('test-results/local', { recursive: true })
  writeFileSync('test-results/local/research-proof.json', JSON.stringify({ clerk: 'Development, two real browser sessions', states: ['completed', 'completed'], evidence: counts, ownerIsolation: 'PASS', bffRequests: bff.length, directRequests: direct.length }, null, 2))
})
