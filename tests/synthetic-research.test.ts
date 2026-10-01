import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseComparison, projectRun } from '../lib/synthetic-research'
import { proxySynthetic, allowedPath } from '../lib/synthetic-research-proxy'
import { syntheticResearchEnabled } from '../lib/synthetic-research-access'
const requestBody = { experiment_name: 'idea', fixture: 'synthetic-market-v1', variants: [ { name: 'baseline', model: 'logistic_regression', probability_threshold: 0.5 }, { name: 'forest', model: 'random_forest_classifier', probability_threshold: 0.6 } ] }
const job = { experiment_id: 'research-job-one', experiment_name: 'idea_baseline', status: 'queued', parameters: { model: 'logistic_regression', probability_threshold: 0.5 }, definition_hash: 'a'.repeat(64), fixture_sha256: 'b'.repeat(64), public_request: requestBody, comparison_id: 'c'.repeat(32) }
const req = (method = 'GET', suffix = 'experiments', body: unknown = requestBody, headers: Record<string, string> = {}) => new Request(`https://site.test/api/research/synthetic/${suffix}`, { method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), headers: { 'content-type': 'application/json', ...headers } })
function boundary(user: string | null = 'user_12345678') { return { viewer: async () => user, secret: () => 'server-secret', enabled: () => true, upstream: async () => Response.json({ jobs: [job] }) } }
test('allowlist admits only the six owned operations', () => {
  for (const parts of [['experiments'], ['experiments', 'one'], ['experiments', 'one', 'events'], ['experiments', 'one', 'artifacts'], ['experiments', 'one', 'artifacts', 'two']]) assert.ok(allowedPath('GET', parts))
  assert.equal(allowedPath('POST', ['comparisons']), '/comparisons')
  for (const parts of [['experiments', '..'], ['experiments', 'a/b'], ['experiments', 'one', 'cancel'], ['experiments', 'one', 'artifacts', 'two', 'content'], ['comparisons']]) assert.equal(allowedPath('GET', parts), null)
})
test('no session, disabled proof and absent secret fail closed with no-store', async () => {
  for (const [b, code] of [[boundary(null), 401], [{ ...boundary(), enabled: () => false }, 503], [{ ...boundary(), secret: () => '' }, 503]] as const) {
    const response = await proxySynthetic(req(), ['experiments'], { ...b, upstream: async () => { throw Error('must not fetch') } })
    assert.equal(response.status, code); assert.match(response.headers.get('cache-control')!, /no-store/)
  }
  const oldFlag = process.env.RESEARCH_SYNTHETIC_ENABLED, oldEnv = process.env.VERCEL_ENV
  try { process.env.RESEARCH_SYNTHETIC_ENABLED = 'true'; process.env.VERCEL_ENV = 'production'; assert.equal(syntheticResearchEnabled(), false); process.env.VERCEL_ENV = 'preview'; assert.equal(syntheticResearchEnabled(), true); delete process.env.RESEARCH_SYNTHETIC_ENABLED; assert.equal(syntheticResearchEnabled(), false) }
  finally { if (oldFlag === undefined) delete process.env.RESEARCH_SYNTHETIC_ENABLED; else process.env.RESEARCH_SYNTHETIC_ENABLED = oldFlag; if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv }
})
test('Clerk identity and secrets are server-owned; two viewers cannot read one another', async () => {
  const upstream = async (_path: string, init: RequestInit) => {
    const h = new Headers(init.headers); assert.equal(h.get('x-research-bff-secret'), 'server-secret'); assert.equal(h.get('cookie'), null)
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.ok(init.signal)
    return h.get('x-research-viewer-id') === 'user_12345678' ? Response.json({ ...job, stderr: 'private', command: '/srv/secret', config_json: { env: 'server-secret' } }) : Response.json({ detail: 'secret' }, { status: 404 })
  }
  for (const [user, code] of [['user_12345678', 200], ['user_87654321', 404]] as const) {
    const response = await proxySynthetic(req('GET', 'experiments/one', undefined, { 'x-research-viewer-id': 'user_12345678', 'x-research-bff-secret': 'forged' }), ['experiments', 'one'], { ...boundary(user), upstream })
    assert.equal(response.status, code); const text = await response.text(); assert.doesNotMatch(text, /stderr|command|config_json|secret|\/srv/)
  }
})
test('payload, identity, query, cross-origin and byte limits reject before upstream', async () => {
  const b = { ...boundary(), upstream: async () => { throw Error('must not fetch') } }
  for (const bad of [{ ...requestBody, viewer_id: 'user_87654321' }, { ...requestBody, env: {} }, { ...requestBody, variants: [requestBody.variants[0], requestBody.variants[0]] }]) assert.equal((await proxySynthetic(req('POST', 'comparisons', bad), ['comparisons'], b)).status, 422)
  assert.equal((await proxySynthetic(req('POST', 'comparisons', 'x'.repeat(4097)), ['comparisons'], b)).status, 413)
  assert.equal((await proxySynthetic(req('POST', 'comparisons', requestBody, { origin: 'https://evil.test' }), ['comparisons'], b)).status, 403)
  for (const query of ['limit=51', 'limit=0', 'limit=1&limit=2', 'viewer_id=forged']) assert.equal((await proxySynthetic(req('GET', `experiments?${query}`), ['experiments'], b)).status, 400)
})
test('partial enqueue preserves successful IDs; malformed upstream and sensitive errors are recoverable', async () => {
  const partial = { status: 'partial_failure', members: [{ variant: 'baseline', experiment_id: 'research-job-one', status: 'queued' }, { variant: 'forest', status: 'failed', stderr: '/srv/private' }] }
  const r = await proxySynthetic(req('POST', 'comparisons'), ['comparisons'], { ...boundary(), upstream: async (_path, init) => { assert.deepEqual(JSON.parse(init.body as string), requestBody); return Response.json(partial, { status: 202 }) } })
  assert.equal(r.status, 202); const p = await r.json(); assert.equal(p.status, 'partial_failure'); assert.equal(p.members[0].experiment_id, 'research-job-one'); assert.equal(p.members[1].stderr, undefined)
  for (const code of [422, 429, 503]) {
    const r = await proxySynthetic(req(), ['experiments'], { ...boundary(), upstream: async () => Response.json({ detail: [{ input: 'server-secret /srv/private' }] }, { status: code }) }); assert.equal(r.status, code); assert.doesNotMatch(await r.text(), /secret|\/srv/)
  }
  assert.equal((await proxySynthetic(req(), ['experiments'], { ...boundary(), upstream: async () => new Response('<html>login</html>') })).status, 502)
  const unknown = await proxySynthetic(req('POST', 'comparisons'), ['comparisons'], { ...boundary(), upstream: async () => { throw Error('timeout private') } }); assert.match((await unknown.json()).error, /outcome is unknown/)
})
test('closed public projections cover states and never forward execution internals', () => {
  for (const state of ['queued', 'running', 'completed', 'failed', 'cancelled']) assert.equal(projectRun({ ...job, status: state }).status, state)
  const run = projectRun({ ...job, result_json: { metrics_summary_json: { sharpe: 1.2, stderr: 'secret', trade_count: 2 } } }); assert.deepEqual(run.result_json, { metrics_summary_json: { sharpe: 1.2, trade_count: 2 } })
  assert.throws(() => projectRun({ ...job, public_request: { ...requestBody, executable: 'private' } }))
  assert.deepEqual(parseComparison(requestBody), requestBody)
})
test('real route wiring resolves server auth and matcher supplies Clerk context without middleware redirecting API errors', () => {
  const middleware = readFileSync('proxy.ts', 'utf8'), route = readFileSync('app/api/research/synthetic/[...parts]/route.ts', 'utf8')
  assert.match(middleware.split('matcher:')[1], /api\/research\/synthetic/)
  assert.doesNotMatch(middleware.split('export default')[0], /api\/research\/synthetic/)
  assert.match(route, /viewer: getViewerUserId/); assert.match(route, /enabled: syntheticResearchEnabled/)
})

test('combined public request, comparison identity and bounded audit survive detail and list BFF projections', async () => {
  const audit = { status: 'failed', validated: false, diagnostics: [{ diagnostic_type: 'lead_lag_audit', status: 'warning', fail_count: 1, unchecked_count: 2, command: 'private-command', path: '/srv/private', stderr: 'server-secret', findings: [{ feature: 'ret_5d', severity: 'fail', classification: 'inconclusive', audit_reason: 'missing_feature_availability_contract', payload_json: { secret: 'server-secret' }, message: '/srv/private' }] }] }
  const combined = { ...job, status: 'completed', audit_summary: audit }
  for (const parts of [['experiments'], ['experiments', 'one']]) {
    const response = await proxySynthetic(req('GET', parts.join('/')), parts, { ...boundary(), upstream: async () => Response.json(parts.length === 1 ? { jobs: [combined] } : combined) })
    assert.equal(response.status, 200)
    const payload = await response.json(), run = parts.length === 1 ? payload.jobs[0] : payload
    assert.equal(run.status, 'completed'); assert.equal(run.audit_summary.status, 'failed'); assert.equal(run.audit_summary.validated, false)
    assert.deepEqual(run.public_request, requestBody); assert.equal(run.comparison_id, 'c'.repeat(32))
    assert.deepEqual(run.audit_summary.diagnostics[0].findings, [{ feature: 'ret_5d', severity: 'fail', classification: 'inconclusive', audit_reason: 'missing_feature_availability_contract' }])
    assert.doesNotMatch(JSON.stringify(payload), /private|stderr|command|payload_json|server-secret|\/srv\//)
  }
})

test('actual combined Backend #18+#19 fixture projects through BFF without losing identity or the declarative request', async () => {
  // Produced by five owner-scoped FastAPI fixture tests on combined Backend
  // commit 40f7c30 (de36a2c #18 plus the #19 audit contract). No host services.
  const fixtures = JSON.parse(readFileSync('tests/fixtures/synthetic-audit-combined.json', 'utf8')) as Record<string, typeof job & { status: string; audit_summary: { status: string; validated: boolean } }>
  const expected: Record<string, string> = { completed_failed_audit: 'failed', failed_inconclusive_audit: 'inconclusive', historical_missing_audit: 'not_available', queued_missing_audit: 'not_available', completed_passed_audit: 'ok' }
  for (const [name, fixture] of Object.entries(fixtures)) {
    const response = await proxySynthetic(req('GET', 'experiments/one'), ['experiments', 'one'], { ...boundary(), upstream: async () => Response.json(fixture) })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.audit_summary.status, expected[name]); assert.equal(result.status, fixture.status)
    assert.equal(result.audit_summary.validated, name === 'completed_passed_audit')
    assert.deepEqual(result.public_request, fixture.public_request); assert.equal(result.comparison_id, fixture.comparison_id)
    assert.doesNotMatch(JSON.stringify(result), /config_json|stderr|command|artifact_ref|\/srv\//)
  }
  const legacy = projectRun({ ...fixtures.historical_missing_audit, audit_summary: undefined, public_request: undefined, comparison_id: undefined })
  assert.equal(legacy.audit_summary.status, 'not_available'); assert.equal(legacy.audit_summary.validated, false); assert.equal(legacy.public_request, null); assert.equal(legacy.comparison_id, null)
})
