import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { ModelLabError, type Draft } from '../lib/model-lab/contract'
import { DEFAULT_FIXTURE_STATE, FixtureSource, parseFixtureState, resetFixtureWorld, serializeFixtureState } from '../lib/model-lab/fixtures/source'
import { defaultValues } from '../lib/model-lab/params'
import { DEFAULT_SENTENCE } from '../lib/model-lab/thesis-sentence'

let clock = 0
const now = () => clock
const make = (patch: Partial<typeof DEFAULT_FIXTURE_STATE> = {}) => new FixtureSource({ ...DEFAULT_FIXTURE_STATE, ...patch }, undefined, now)

function draft(patch: Partial<Draft> = {}): Draft {
  return {
    sentence: { ...DEFAULT_SENTENCE, universe: 'picks' },
    assets: ['AAPL', 'MSFT', 'NVDA', 'COST', 'V', 'LLY'],
    rigor: 'standard',
    values: { ...defaultValues(), label: ['outperform'], regime: ['any'], bench: ['market'], horizon: [10] },
    families: ['Momentum'],
    diagnostics: { scout: true, decay: true, robust: true, lookahead: true },
    reuseTestId: null,
    thesisId: null,
    registerCandidate: false,
    ...patch,
  }
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ModelLabError) return error.code
    throw error
  }
  return 'none'
}

beforeEach(() => {
  resetFixtureWorld()
  clock = 1_000_000
})

test('the preview state survives a round trip and ignores anything unknown', () => {
  const state = { ...DEFAULT_FIXTURE_STATE, role: 'team', plan: 'free', data: 'stale' } as const
  assert.deepEqual(parseFixtureState(serializeFixtureState(state)), state)
  assert.deepEqual(parseFixtureState('role=admin;plan=pro;x=1;data'), DEFAULT_FIXTURE_STATE)
  assert.deepEqual(parseFixtureState(undefined), DEFAULT_FIXTURE_STATE)
})

test('an empty account has no theses and no alerts', async () => {
  const source = make({ account: 'empty' })
  assert.equal((await source.listTheses()).length, 0)
  assert.equal((await source.listAlerts()).length, 0)
})

test('every thesis has five checks, a change, and no verdict field', async () => {
  const source = make()
  for (const thesis of await source.listTheses()) {
    const evidence = await source.getEvidence(thesis.id)
    assert.equal(evidence.checks.length, 5)
    assert.equal(thesis.checksHolding, evidence.checks.filter((c) => c.state === 'holds').length)
    assert.ok(evidence.change.currentHolding === thesis.checksHolding)
    assert.ok(!('strength' in thesis) && !('verdict' in evidence))
    assert.ok(evidence.limits.some((l) => l.key === 'survivors' && l.state === 'unknown'))
  }
})

test('ordering measures and lineage are for team members only', async () => {
  const investor = make()
  const team = make({ role: 'team' })
  const [first] = await investor.listTheses()
  assert.equal((await investor.getEvidence(first.id)).ordering, null)
  assert.equal((await investor.getThesis(first.id)).lineage, null)
  assert.ok((await team.getEvidence(first.id)).ordering)
  assert.ok((await team.getThesis(first.id)).lineage)
})

test('stale and partial data show up in the evidence', async () => {
  const [first] = await make().listTheses()
  assert.equal((await make({ data: 'stale' }).getEvidence(first.id)).staleDays, 2)
  const partial = await make({ data: 'partial' }).getEvidence(first.id)
  assert.equal(partial.coverage.left.length, 2)
  assert.equal(partial.coverage.used, partial.coverage.total - 2)
})

test('a quote prices a set above a single test, and reuse below a new model', async () => {
  const source = make()
  const single = await source.quote(draft())
  const set = await source.quote(draft({ values: { ...draft().values, model: ['logit', 'forest', 'gbm'], horizon: [5, 10, 20] }, sentence: { ...DEFAULT_SENTENCE, universe: 'picks', horizons: [5, 10, 20] } }))
  assert.ok(set.total > single.total)
  assert.equal(set.variants, 9)
  const reuse = await source.quote(draft({ reuseTestId: '3f2b8c1e-6d4a-4b7e-9c10-2a5d7e8f9b01' }))
  assert.ok(reuse.total < single.total)
  assert.equal(reuse.trainings, 0)
})

test('a quote blocks on too few stocks, too little history and too little credit', async () => {
  const source = make({ credits: 'low' })
  const few = await source.quote(draft({ assets: ['AAPL'] }))
  assert.ok(few.findings.some((f) => f.severity === 'block' && f.title.includes('at least two')))
  const short = await source.quote(draft({ values: { ...draft().values, history: [1] } }))
  assert.ok(short.findings.some((f) => f.severity === 'block' && f.title.includes('history')))
  const costly = await source.quote(draft({ rigor: 'thorough' }))
  assert.ok(costly.findings.some((f) => f.severity === 'block' && f.title === 'Not enough credit'))
})

test('a free account can read but not run, and the quote says why', async () => {
  const source = make({ plan: 'free' })
  assert.ok((await source.quote(draft())).findings.some((f) => f.severity === 'block' && f.title.includes('Pro')))
  assert.equal(await code(source.submitRun(draft(), 'run-free-0001')), 'forbidden')
})

test('a run progresses, finishes, creates a thesis, and charges once', async () => {
  const source = make()
  const before = (await source.viewer()).quota.remaining
  const run = await source.submitRun(draft(), 'run-ok-00001')
  assert.equal(run.state, 'running')
  assert.equal(run.stages.length, 5)
  clock += 4_000
  const mid = await source.getRun(run.id)
  assert.equal(mid.state, 'running')
  assert.ok(mid.progress > 30 && mid.progress < 70)
  clock += 10_000
  const done = await source.getRun(run.id)
  assert.equal(done.state, 'completed')
  assert.ok(done.thesisId && done.resultTestId)
  assert.equal((await source.getRun(run.id)).thesisId, done.thesisId)
  const after = (await source.viewer()).quota.remaining
  assert.equal(Math.round((before - after) * 10), Math.round(done.cost * 10))
  const detail = await source.getThesis(done.thesisId!)
  assert.equal(detail.tests[0].id, done.resultTestId)
})

test('the same idempotency key returns the same run, and a different body conflicts', async () => {
  const source = make()
  const a = await source.submitRun(draft(), 'run-idem-0001')
  const b = await source.submitRun(draft(), 'run-idem-0001')
  assert.equal(a.id, b.id)
  assert.equal(await code(source.submitRun(draft({ rigor: 'quick' }), 'run-idem-0001')), 'conflict')
})

test('a failing run stops half way, says where, and refunds', async () => {
  const source = make({ run: 'fail' })
  const before = (await source.viewer()).quota.remaining
  const run = await source.submitRun(draft(), 'run-fail-0001')
  clock += 20_000
  const failed = await source.getRun(run.id)
  assert.equal(failed.state, 'failed')
  assert.equal(failed.failure?.refunded, true)
  assert.equal((await source.viewer()).quota.remaining, before)
  assert.equal(failed.resultTestId, null)
})

test('cancelling a running test refunds it, and a finished one stays finished', async () => {
  const source = make()
  const before = (await source.viewer()).quota.remaining
  const run = await source.submitRun(draft(), 'run-cancel-001')
  clock += 1_000
  const cancelled = await source.cancelRun(run.id)
  assert.equal(cancelled.state, 'cancelled')
  assert.equal((await source.viewer()).quota.remaining, before)
  const other = await source.submitRun(draft({ rigor: 'quick' }), 'run-cancel-002')
  clock += 20_000
  assert.equal((await source.cancelRun(other.id)).state, 'completed')
})

test('a set of tests produces a results grid with one variant per combination', async () => {
  const source = make()
  const values = { ...draft().values, model: ['logit', 'gbm'], conf: [50, 55, 60] }
  const run = await source.submitRun(draft({ values }), 'run-set-00001')
  clock += 20_000
  const done = await source.getRun(run.id)
  const results = await source.getTestResults(done.resultTestId!)
  assert.equal(results.variants.length, 6)
  assert.deepEqual(results.dimensions.map((d) => d.id), ['model', 'conf'])
})

test('notes are kept with the checks that held when they were written', async () => {
  const source = make()
  const [first] = await source.listTheses()
  const note = await source.addNote(first.id, '  Wait for the next test  ')
  assert.equal(note.text, 'Wait for the next test')
  assert.equal(note.checksHolding, first.checksHolding)
  assert.equal((await source.getThesis(first.id)).notes[0].id, note.id)
  assert.equal(await code(source.addNote(first.id, '   ')), 'invalid')
})

test('submitting a copy marks the thesis and nothing else', async () => {
  const source = make()
  const [first, second] = await source.listTheses()
  assert.equal(first.submittedAt, null)
  assert.ok((await source.submitCopy(first.id)).submittedAt)
  const again = await source.listTheses()
  assert.ok(again[0].submittedAt)
  assert.equal(again[1].submittedAt, null)
  assert.equal(again[1].id, second.id)
})

test('panels validate their members and clamp the agreement needed', async () => {
  const source = make()
  const library = await source.libraryModels()
  assert.equal(await code(source.createPanel({ name: 'x', memberRunIds: [library[0].runId], rule: 'agree', agreementNeeded: 1, assets: [] })), 'invalid')
  assert.equal(await code(source.createPanel({ name: 'x', memberRunIds: [library[0].runId, 'nope'], rule: 'agree', agreementNeeded: 1, assets: [] })), 'invalid')
  const panel = await source.createPanel({ name: '  Crisis aware ', memberRunIds: library.slice(0, 3).map((m) => m.runId), rule: 'spec', agreementNeeded: 6, assets: [] })
  assert.equal(panel.name, 'Crisis aware')
  assert.equal(panel.agreementNeeded, 3)
  const updated = await source.updatePanel(panel.id, { agreementNeeded: 2, alerts: { flip: false } })
  assert.equal(updated.agreementNeeded, 2)
  assert.equal(updated.alerts.flip, false)
  assert.equal(updated.alerts.reached, true)
})

test('a panel reads in flags and keeps its held-out check apart from the early months', async () => {
  const source = make()
  const [panel] = await source.listPanels()
  const today = await source.panelToday(panel.id)
  assert.equal(today.rows.length, panel.assets.length)
  assert.ok(today.rows.every((r) => r.flagged.length === panel.members.length))
  const evidence = await source.panelEvidence(panel.id)
  assert.equal(evidence.heldOut.rows[0].isPanel, true)
  assert.equal(evidence.heldOut.rows.length, panel.members.length + 1)
  assert.equal(evidence.agreement.length, panel.members.length + 1)
  assert.ok(evidence.independentOpinions > 0 && evidence.independentOpinions <= panel.members.length)
  const alerts = await source.panelAlerts(panel.id)
  assert.equal(alerts.replays.length, 5)
})

test('alerts can be marked read one at a time or all at once', async () => {
  const source = make()
  const alerts = await source.listAlerts()
  const unread = alerts.filter((a) => !a.read)
  assert.ok(unread.length > 0)
  await source.markAlertsRead([unread[0].id])
  assert.equal((await source.listAlerts()).filter((a) => !a.read).length, unread.length - 1)
  await source.markAlertsRead('all')
  assert.equal((await source.listAlerts()).filter((a) => !a.read).length, 0)
  assert.equal((await source.viewer()).unreadAlerts, 0)
})

test('the team console is closed to everyone else', async () => {
  const investor = make()
  for (const call of [() => investor.teamQueue(), () => investor.teamCandidates(), () => investor.teamAccessRequests(), () => investor.teamDataHealth(), () => investor.teamPipeline('panel')])
    assert.equal(await code(call()), 'forbidden')
  assert.equal(await code(investor.requestAccess('exp-5001', 'why', '24h')), 'forbidden')
})

test('access to an unsubmitted experiment needs a real id and a reason, and is logged', async () => {
  const team = make({ role: 'team' })
  assert.equal(await code(team.requestAccess('anything', 'why', '24h')), 'invalid')
  assert.equal(await code(team.requestAccess('exp-5001', '  ', '24h')), 'invalid')
  const request = await team.requestAccess('exp-5001', 'Owner reported a failed run', '7d')
  assert.equal(request.expires, 'expires in 7 days')
  assert.equal((await team.teamAccessRequests())[0].id, request.id)
  assert.ok((await team.teamCandidates()).some((c) => c.source === 'customer-copy'))
})

test('team members see a budget, everyone else sees credits', async () => {
  assert.equal((await make().viewer()).quota.kind, 'credits')
  assert.equal((await make({ role: 'team' }).viewer()).quota.kind, 'budget')
})
