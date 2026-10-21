import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { handleModelLabRequest, type BffRequest } from '../lib/model-lab/bff'
import { camelizeKeys, snakeizeKeys } from '../lib/model-lab/case'
import { DEFAULT_FIXTURE_STATE, FixtureSource, resetFixtureWorld } from '../lib/model-lab/fixtures/source'
import { defaultValues } from '../lib/model-lab/params'
import { DEFAULT_SENTENCE } from '../lib/model-lab/thesis-sentence'
import { parseDraft, parsePanelPatch, parseWatch } from '../lib/model-lab/validate'

const source = () => new FixtureSource(DEFAULT_FIXTURE_STATE)
const call = (request: Partial<BffRequest> & Pick<BffRequest, 'method' | 'parts'>) =>
  handleModelLabRequest(source(), { body: undefined, idempotencyKey: null, ...request })

const goodDraft = () => ({
  sentence: { ...DEFAULT_SENTENCE },
  assets: [],
  rigor: 'standard',
  values: { ...defaultValues() },
  families: ['Momentum'],
  diagnostics: { scout: true, decay: true, robust: true, lookahead: true },
  reuseTestId: null,
  thesisId: null,
  registerCandidate: false,
})

beforeEach(() => resetFixtureWorld())

test('keys convert between snake_case and camelCase without touching values', () => {
  const wire = { account_id: 'a', check_list: [{ is_open: true, nested_value: { deep_key: 1 } }], values: { exec: 'signal_close' } }
  const local = camelizeKeys<Record<string, unknown>>(wire)
  assert.deepEqual(local, { accountId: 'a', checkList: [{ isOpen: true, nestedValue: { deepKey: 1 } }], values: { exec: 'signal_close' } })
  assert.deepEqual(snakeizeKeys(local), wire)
})

test('list routes wrap their rows and detail routes return the object', async () => {
  const list = await call({ method: 'GET', parts: ['theses'] })
  assert.equal(list.status, 200)
  const { theses } = list.body as { theses: { id: string }[] }
  assert.equal(theses.length, 3)
  const detail = await call({ method: 'GET', parts: ['theses', theses[0].id] })
  assert.equal(detail.status, 200)
  assert.equal(((detail.body as { summary: { id: string } }).summary).id, theses[0].id)
  assert.equal((await call({ method: 'GET', parts: ['theses', theses[0].id, 'evidence'] })).status, 200)
})

test('unknown routes and malformed ids are not found, never a crash', async () => {
  for (const parts of [['nope'], ['theses', 'not-a-uuid'], ['admin', 'users'], ['admin', 'pipeline', 'secret'], ['runs'], ['tests', '3f2b8c1e-6d4a-4b7e-9c10-2a5d7e8f9b01']]) {
    const res = await call({ method: 'GET', parts })
    assert.equal(res.status, 404, parts.join('/'))
  }
  assert.equal((await call({ method: 'POST', parts: ['theses'] })).status, 404)
  assert.equal((await call({ method: 'PATCH', parts: ['theses'] })).status, 404)
})

test('a run needs a valid idempotency key and answers 202', async () => {
  assert.equal((await call({ method: 'POST', parts: ['runs'], body: goodDraft() })).status, 422)
  assert.equal((await call({ method: 'POST', parts: ['runs'], body: goodDraft(), idempotencyKey: 'short' })).status, 422)
  const ok = await call({ method: 'POST', parts: ['runs'], body: goodDraft(), idempotencyKey: 'run-bff-0001' })
  assert.equal(ok.status, 202)
  assert.equal((ok.body as { state: string }).state, 'running')
})

test('errors carry a code and a fixed message, never the detail', async () => {
  const res = await call({ method: 'POST', parts: ['quotes'], body: { sentence: 'drop table' } })
  assert.equal(res.status, 422)
  assert.deepEqual(Object.keys(res.body as object).sort(), ['error', 'message'])
  assert.equal(JSON.stringify(res.body).includes('drop table'), false)
})

test('team routes answer 403 to everyone else', async () => {
  assert.equal((await call({ method: 'GET', parts: ['admin', 'queue'] })).status, 403)
})

test('a draft is checked field by field', () => {
  assert.doesNotThrow(() => parseDraft(goodDraft()))
  const cases: Record<string, (d: ReturnType<typeof goodDraft>) => unknown> = {
    'unknown who': (d) => ({ ...d, sentence: { ...d.sentence, who: 'nobody' } }),
    'horizon out of range': (d) => ({ ...d, sentence: { ...d.sentence, horizons: [500] }, values: { ...d.values, horizon: [500] } }),
    'sentence and values disagree': (d) => ({ ...d, values: { ...d.values, horizon: [20] } }),
    'unknown parameter': (d) => ({ ...d, values: { ...d.values, hack: [1] } }),
    'several values for a fixed setting': (d) => ({ ...d, values: { ...d.values, lag: [1, 2] } }),
    'bad ticker': (d) => ({ ...d, assets: ['aapl; drop'] }),
    'duplicate tickers': (d) => ({ ...d, assets: ['AAPL', 'AAPL'] }),
    'bad rigor': (d) => ({ ...d, rigor: 'extreme' }),
    'bad family': (d) => ({ ...d, families: ['Magic'] }),
    'bad reuse id': (d) => ({ ...d, reuseTestId: 'nope' }),
    'missing diagnostics': (d) => ({ ...d, diagnostics: undefined }),
    'not an object': () => 'text',
  }
  for (const [name, mutate] of Object.entries(cases)) assert.throws(() => parseDraft(mutate(goodDraft())), undefined, name)
})

test('settings the reader can compare accept several values, in range and without repeats', () => {
  const d = goodDraft()
  assert.doesNotThrow(() => parseDraft({ ...d, values: { ...d.values, conf: [50, 55, 60], model: ['logit', 'gbm'] } }))
  assert.throws(() => parseDraft({ ...d, values: { ...d.values, conf: [50, 50] } }))
  assert.throws(() => parseDraft({ ...d, values: { ...d.values, conf: [10] } }))
  assert.throws(() => parseDraft({ ...d, values: { ...d.values, model: ['alchemy'] } }))
})

test('watch settings and panel changes reject anything outside their options', () => {
  assert.deepEqual(parseWatch({ retest: 'weekly', alertOnWeaker: true, alertOnBetter: false, email: false, inApp: true }).retest, 'weekly')
  assert.throws(() => parseWatch({ retest: 'hourly', alertOnWeaker: true, alertOnBetter: false, email: false, inApp: true }))
  assert.throws(() => parsePanelPatch({ agreementNeeded: 0 }))
  assert.throws(() => parsePanelPatch({ alerts: { bogus: true } }))
  assert.throws(() => parsePanelPatch({ channels: ['sms'] }))
  assert.deepEqual(parsePanelPatch({ holdDays: 3, channels: ['app', 'app'] }), { holdDays: 3, channels: ['app'] })
})
