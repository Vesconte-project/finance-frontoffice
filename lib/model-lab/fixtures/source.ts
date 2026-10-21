import {
  ModelLabError,
  type AccessRequest,
  type AlertItem,
  type Candidate,
  type DataHealth,
  type Draft,
  type LibraryModel,
  type Note,
  type PanelAlerts,
  type PanelDraft,
  type PanelEvidence,
  type PanelSummary,
  type PanelToday,
  type PipelineKind,
  type PipelineView,
  type Plan,
  type QueueRow,
  type Quote,
  type Role,
  type Run,
  type RunStage,
  type TestResults,
  type TestSummary,
  type ThesisDetail,
  type ThesisEvidence,
  type ThesisSummary,
  type Version,
  type Viewer,
  type WatchSettings,
} from '../contract'
import { defaultValues, isSetOfTests, type ParamValues } from '../params'
import type { ModelLabSource, PanelPatch } from '../source'
import { describeThesis } from '../thesis-sentence'
import { libraryModels, memberFor, memberKeyOfRun, initialPanels, panelAlerts, panelEvidence, panelToday } from './panels'
import { CREDIT_UNIT, quoteDraft } from './quote'
import { buildResults, resultsId, seedFor } from './sets'
import { dataHealth, initialAccessRequests, initialCandidates, initialQueue, lineageOf, pipelineOf } from './team'
import { DEFAULT_WATCH, THESIS_SPECS, evidenceOf, specId, summaryOf, testId, type ThesisSpec } from './theses'
import { fixtureId, hash, rng } from './random'

export type FixtureState = Readonly<{
  role: Role
  plan: Plan
  account: 'full' | 'empty'
  credits: 'plenty' | 'low'
  run: 'ok' | 'fail'
  data: 'fresh' | 'partial' | 'stale'
}>

export const DEFAULT_FIXTURE_STATE: FixtureState = { role: 'investor', plan: 'pro', account: 'full', credits: 'plenty', run: 'ok', data: 'fresh' }

const CHOICES = {
  role: ['investor', 'team'],
  plan: ['pro', 'free'],
  account: ['full', 'empty'],
  credits: ['plenty', 'low'],
  run: ['ok', 'fail'],
  data: ['fresh', 'partial', 'stale'],
} as const

export const FIXTURE_STATE_COOKIE = 'model_lab_preview'

/** The state is kept in one cookie, `role=team;plan=free`, set by the preview panel. */
export function parseFixtureState(raw: string | undefined): FixtureState {
  const out: Record<string, string> = { ...DEFAULT_FIXTURE_STATE }
  for (const part of (raw ?? '').split(';')) {
    const [k, v] = part.split('=')
    const allowed = (CHOICES as Record<string, readonly string[]>)[k]
    if (allowed && allowed.includes(v)) out[k] = v
  }
  return out as unknown as FixtureState
}

export function serializeFixtureState(state: FixtureState): string {
  return Object.entries(state).map(([k, v]) => `${k}=${v}`).join(';')
}

const RUN_SECONDS = 8
const FAIL_AT = 50
const WATCHLIST_SAMPLE = ['AAPL', 'MSFT', 'NVDA', 'COST', 'V', 'LLY']
const STAGES: readonly (readonly [string, string, string])[] = [
  ['Preparing your assets and data', 'feature-store', 'Snapshot snap-2026-10-14 attached'],
  ['Training on past periods only', 'ml-lab', 'Walk-forward folds trained'],
  ['Turning predictions into positions', 'strategy-lab', 'Signal panel built'],
  ['Simulating trades with costs', 'backtest', 'Equity curve and costs recorded'],
  ['Checking it holds up', 'ml-lab robustness', 'Robustness suite complete'],
]

type RunRecord = {
  id: string
  draft: Draft
  quote: Quote
  startedAt: number
  failAt: number | null
  finalized: boolean
  cancelled: boolean
  thesisId: string | null
  testId: string | null
  isSet: boolean
  key: string
}

type World = {
  specs: ThesisSpec[]
  submitted: Set<string>
  notes: Map<string, Note[]>
  watch: Map<string, WatchSettings>
  tests: Map<string, TestSummary[]>
  results: Map<string, TestResults>
  runs: Map<string, RunRecord>
  idempotency: Map<string, { body: string; runId: string }>
  panels: PanelSummary[]
  read: Set<string>
  access: AccessRequest[]
  queue: QueueRow[]
  candidates: Candidate[]
  credits: number
  counter: number
}

const SET1_VALUES: ParamValues = { ...defaultValues(), model: ['logit', 'forest', 'gbm'], conf: [50, 55, 60], horizon: [5, 10, 20] }

function isoDaysAgo(days: number): string {
  return new Date(Date.UTC(2026, 9, 14) - days * 86_400_000).toISOString()
}

function createWorld(): World {
  const specs = [...THESIS_SPECS]
  const set1Receipt = quoteDraft(
    { sentence: specs[0].sentence, assets: specs[0].assets, rigor: 'standard', values: SET1_VALUES, families: ['Momentum'], diagnostics: { scout: true, decay: true, robust: true, lookahead: true }, reuseTestId: null, thesisId: specId('winners'), registerCandidate: false },
    1000,
    'ok',
    '3 Nov'
  )
  const set1 = buildResults({ id: resultsId('set-1'), thesisId: specId('winners'), statement: specs[0].statement, values: SET1_VALUES, seed: 400, base: 1.1, receipt: set1Receipt })
  const results = new Map<string, TestResults>([[set1.id, set1]])
  const tests = new Map<string, TestSummary[]>([
    [specId('winners'), [
      { id: set1.id, kind: 'set', at: isoDaysAgo(2), variants: set1.variants.length, cost: set1Receipt.total, status: 'completed' },
      { id: testId('one-1'), kind: 'single', at: isoDaysAgo(21), variants: 1, cost: 2.4, status: 'completed' },
    ]],
    [specId('quiet'), [{ id: testId('one-2'), kind: 'single', at: isoDaysAgo(1), variants: 1, cost: 2.4, status: 'completed' }]],
    [specId('cheap'), [{ id: testId('one-3'), kind: 'single', at: isoDaysAgo(21), variants: 1, cost: 2.4, status: 'completed' }]],
  ])
  return {
    specs,
    submitted: new Set(),
    notes: new Map(),
    watch: new Map(),
    tests,
    results,
    runs: new Map(),
    idempotency: new Map(),
    panels: initialPanels(),
    read: new Set(),
    access: initialAccessRequests(),
    queue: initialQueue(),
    candidates: initialCandidates(),
    credits: 78,
    counter: 0,
  }
}

const globalRef = globalThis as unknown as { __modelLabFixtureWorld?: World }
function sharedWorld(): World {
  globalRef.__modelLabFixtureWorld ??= createWorld()
  return globalRef.__modelLabFixtureWorld
}

export function resetFixtureWorld(): void {
  globalRef.__modelLabFixtureWorld = createWorld()
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

export class FixtureSource implements ModelLabSource {
  constructor(
    private readonly state: FixtureState = DEFAULT_FIXTURE_STATE,
    private readonly world: World = sharedWorld(),
    private readonly now: () => number = Date.now
  ) {}

  private requireTeam(): void {
    if (this.state.role !== 'team') throw new ModelLabError('forbidden')
  }

  private spec(id: string): ThesisSpec {
    const spec = this.world.specs.find((s) => specId(s.key) === id)
    if (!spec) throw new ModelLabError('not-found')
    return spec
  }

  private remaining(): number {
    return this.state.credits === 'low' ? Math.min(2.4, this.world.credits) : this.world.credits
  }

  async viewer(): Promise<Viewer> {
    const team = this.state.role === 'team'
    return {
      role: this.state.role,
      plan: this.state.plan,
      quota: { kind: team ? 'budget' : 'credits', unit: CREDIT_UNIT, remaining: round1(this.remaining()), limit: 100, periodEndsAt: '2026-11-03T00:00:00.000Z' },
      unreadAlerts: (await this.listAlerts()).filter((a) => !a.read).length,
      premiumDeletedAt: this.state.plan === 'free' ? '2027-01-12T00:00:00.000Z' : null,
    }
  }

  async listTheses(): Promise<readonly ThesisSummary[]> {
    if (this.state.account === 'empty') return []
    return this.world.specs.map((s) => summaryOf(s, this.world.submitted.has(specId(s.key))))
  }

  async getThesis(id: string): Promise<ThesisDetail> {
    const spec = this.spec(id)
    const summary = summaryOf(spec, this.world.submitted.has(id))
    const notes = this.world.notes.get(id) ?? [{ id: fixtureId(`note:${id}:seed`), at: isoDaysAgo(21), text: 'Started this after reading the Q2 reports. I will add more stocks only if the recent-months check holds.', checksHolding: summary.checksHolding }]
    const versions: Version[] = [
      { id: fixtureId(`version:${id}:1`), label: 'v1', at: isoDaysAgo(21), summary: 'First version', current: false },
      { id: fixtureId(`version:${id}:2`), label: 'v2', at: isoDaysAgo(9), summary: `Horizon changed from 5 days to ${spec.sentence.horizons[0]} days. Two stocks added.`, current: true },
    ]
    return {
      summary,
      notes,
      versions,
      tests: this.world.tests.get(id) ?? [],
      lineage: this.state.role === 'team' ? lineageOf(spec) : null,
    }
  }

  async getEvidence(id: string): Promise<ThesisEvidence> {
    const spec = this.spec(id)
    return evidenceOf(spec, this.state.role === 'team', this.world.watch.get(id) ?? DEFAULT_WATCH, this.state.data === 'stale' ? 2 : null, this.state.data === 'partial')
  }

  async getTestResults(id: string): Promise<TestResults> {
    const found = this.world.results.get(id)
    if (!found) throw new ModelLabError('not-found')
    return found
  }

  async addNote(thesisId: string, text: string): Promise<Note> {
    const detail = await this.getThesis(thesisId)
    const clean = text.trim()
    if (!clean || clean.length > 4000) throw new ModelLabError('invalid')
    const note: Note = { id: fixtureId(`note:${thesisId}:${this.world.counter++}`), at: new Date(this.now()).toISOString(), text: clean, checksHolding: detail.summary.checksHolding }
    this.world.notes.set(thesisId, [note, ...detail.notes])
    return note
  }

  async updateWatch(thesisId: string, watch: WatchSettings): Promise<WatchSettings> {
    this.spec(thesisId)
    this.world.watch.set(thesisId, watch)
    return watch
  }

  async submitCopy(thesisId: string): Promise<ThesisSummary> {
    const spec = this.spec(thesisId)
    this.world.submitted.add(thesisId)
    return summaryOf(spec, true)
  }

  async quote(draft: Draft): Promise<Quote> {
    const quote = quoteDraft(draft, this.remaining(), this.state.data === 'stale' ? 'stale' : 'ok', '3 Nov')
    if (this.state.plan === 'free') {
      return { ...quote, findings: [{ severity: 'block', title: 'Running tests needs Pro', detail: 'Free accounts can read results but not run new tests.', fix: null }, ...quote.findings] }
    }
    return quote
  }

  async submitRun(draft: Draft, key: string): Promise<Run> {
    const body = JSON.stringify(draft)
    const earlier = this.world.idempotency.get(key)
    if (earlier) {
      if (earlier.body !== body) throw new ModelLabError('conflict')
      return this.getRun(earlier.runId)
    }
    if (this.state.plan === 'free') throw new ModelLabError('forbidden')
    const quote = await this.quote(draft)
    if (quote.findings.some((f) => f.severity === 'block')) throw new ModelLabError(quote.total > this.remaining() ? 'quota' : 'invalid')
    const id = fixtureId(`run:${this.world.counter++}`)
    const record: RunRecord = {
      id, draft, quote, startedAt: this.now(),
      failAt: this.state.run === 'fail' ? FAIL_AT : null,
      finalized: false, cancelled: false,
      thesisId: draft.thesisId, testId: null,
      isSet: isSetOfTests(draft.values), key,
    }
    this.world.runs.set(id, record)
    this.world.idempotency.set(key, { body, runId: id })
    this.world.credits = round1(this.world.credits - quote.total)
    this.world.queue.unshift({ id: `job-${8842 + this.world.counter}`, who: 'you', thesis: describeThesis(draft.sentence).slice(0, 34) + '…', variants: quote.variants, stage: STAGES[0][0], state: 'running', worker: 'worker-1', minutes: 0 })
    return this.getRun(id)
  }

  private stagesFor(rec: RunRecord): RunStage[] {
    return STAGES.map(([name, owner, detail], index) => ({ index, name, owner, detail, skipped: rec.draft.reuseTestId !== null && index < 2 }))
  }

  private finalize(rec: RunRecord): void {
    if (rec.finalized) return
    rec.finalized = true
    const draft = rec.draft
    let id = rec.thesisId
    if (!id) {
      const statement = describeThesis(draft.sentence)
      const seed = hash(statement) % 1000
      const rr = rng(seed)
      const q = [rr(), rr(), rr(), rr(), rr()].map((x) => (x > 0.62 ? 'ok' : x > 0.3 ? 'warn' : 'bad')) as unknown as ThesisSpec['checks']
      const key = `new-${this.world.specs.length + 1}`
      const spec: ThesisSpec = {
        key, sentence: draft.sentence, statement: `${statement.charAt(0).toUpperCase()}${statement.slice(1)}`,
        assets: draft.sentence.universe === 'picks' ? draft.assets : WATCHLIST_SAMPLE,
        status: 'watching', seed, ex: rr() * 8 - 2.5, checks: q, robust: 6 + Math.floor(rr() * 12), turnover: 10 + Math.floor(rr() * 25), fading: false, testedDaysAgo: 0,
      }
      this.world.specs.unshift(spec)
      id = specId(key)
      rec.thesisId = id
    }
    const tid = rec.isSet ? resultsId(`run-${rec.id}`) : testId(`run-${rec.id}`)
    rec.testId = tid
    if (rec.isSet) {
      const spec = this.spec(id)
      this.world.results.set(tid, buildResults({ id: tid, thesisId: id, statement: spec.statement, values: draft.values, seed: seedFor(rec.id), base: 0.3 + rng(hash(rec.id))() * 1.2, receipt: rec.quote }))
    }
    const list = this.world.tests.get(id) ?? []
    this.world.tests.set(id, [{ id: tid, kind: rec.isSet ? 'set' : draft.reuseTestId ? 'reuse' : 'single', at: new Date(this.now()).toISOString(), variants: rec.quote.variants, cost: rec.quote.total, status: 'completed' }, ...list])
  }

  async getRun(runId: string): Promise<Run> {
    const rec = this.world.runs.get(runId)
    if (!rec) throw new ModelLabError('not-found')
    const spec = rec.thesisId ? this.world.specs.find((s) => specId(s.key) === rec.thesisId) : undefined
    const statement = spec?.statement ?? describeThesis(rec.draft.sentence)
    const elapsed = (this.now() - rec.startedAt) / 1000
    const raw = Math.min(100, (elapsed / RUN_SECONDS) * 100)
    let state: Run['state'] = rec.cancelled ? 'cancelled' : raw >= 100 ? 'completed' : 'running'
    let progress = raw
    let failure: Run['failure'] = null
    if (!rec.cancelled && rec.failAt !== null && raw >= rec.failAt) {
      state = 'failed'
      progress = rec.failAt
      failure = { stage: 'Turning predictions into positions', message: 'The model trained fine, but no signals were produced. The thresholds may be too strict for this period.', refunded: true }
      if (!rec.finalized) {
        rec.finalized = true
        this.world.credits = round1(this.world.credits + rec.quote.total)
      }
    }
    if (state === 'completed') this.finalize(rec)
    const current = Math.min(4, Math.floor(progress / 20))
    return {
      id: rec.id,
      thesisId: rec.thesisId,
      statement,
      state,
      progress: Math.round(progress),
      stages: this.stagesFor(rec),
      currentStage: current,
      cost: rec.quote.total,
      unit: rec.quote.unit,
      reused: rec.draft.reuseTestId !== null,
      isSet: rec.isSet,
      failure,
      resultTestId: state === 'completed' ? rec.testId : null,
      receipt: state === 'completed' ? rec.quote : null,
    }
  }

  async cancelRun(runId: string): Promise<Run> {
    const rec = this.world.runs.get(runId)
    if (!rec) throw new ModelLabError('not-found')
    const before = await this.getRun(runId)
    if (before.state !== 'running') return before
    rec.cancelled = true
    rec.finalized = true
    this.world.credits = round1(this.world.credits + rec.quote.total)
    return this.getRun(runId)
  }

  async listPanels(): Promise<readonly PanelSummary[]> {
    return this.world.panels
  }

  private panel(id: string): PanelSummary {
    const found = this.world.panels.find((p) => p.id === id)
    if (!found) throw new ModelLabError('not-found')
    return found
  }

  async getPanel(id: string): Promise<PanelSummary> {
    return this.panel(id)
  }

  private membersOf(runIds: readonly string[]) {
    const members = runIds.map((r) => memberKeyOfRun(r)).map((k) => (k ? memberFor(k) : null))
    if (members.some((m) => m === null) || new Set(runIds).size !== runIds.length) throw new ModelLabError('invalid')
    return members as ReturnType<typeof memberFor>[]
  }

  async createPanel(draft: PanelDraft): Promise<PanelSummary> {
    const name = draft.name.trim() || 'New panel'
    if (draft.memberRunIds.length < 2 || draft.memberRunIds.length > 6 || name.length > 80) throw new ModelLabError('invalid')
    const members = this.membersOf(draft.memberRunIds)
    const panel: PanelSummary = {
      id: fixtureId(`panel:${this.world.counter++}`), name, members, rule: draft.rule,
      agreementNeeded: Math.min(Math.max(1, draft.agreementNeeded), members.length), below: 'flat',
      holdDays: 2, quietDays: 3, weeklyCap: 3,
      alerts: { reached: true, flip: true, collapse: false, spec: false, blind: true }, channels: ['email', 'app'],
      assets: draft.assets.length ? draft.assets : WATCHLIST_SAMPLE, status: 'watching',
    }
    this.world.panels.push(panel)
    return panel
  }

  async updatePanel(id: string, patch: PanelPatch): Promise<PanelSummary> {
    const current = this.panel(id)
    const members = patch.memberRunIds ? this.membersOf(patch.memberRunIds) : current.members
    if (members.length < 2) throw new ModelLabError('invalid')
    const next: PanelSummary = {
      ...current,
      name: patch.name?.trim() || current.name,
      members,
      rule: patch.rule ?? current.rule,
      agreementNeeded: Math.min(Math.max(1, patch.agreementNeeded ?? current.agreementNeeded), members.length),
      below: patch.below ?? current.below,
      holdDays: patch.holdDays ?? current.holdDays,
      quietDays: patch.quietDays ?? current.quietDays,
      weeklyCap: patch.weeklyCap ?? current.weeklyCap,
      alerts: { ...current.alerts, ...patch.alerts },
      channels: patch.channels ?? current.channels,
    }
    this.world.panels = this.world.panels.map((p) => (p.id === id ? next : p))
    return next
  }

  async panelToday(id: string): Promise<PanelToday> {
    return panelToday(this.panel(id))
  }

  async panelEvidence(id: string): Promise<PanelEvidence> {
    return panelEvidence(this.panel(id))
  }

  async panelAlerts(id: string): Promise<PanelAlerts> {
    return panelAlerts(this.panel(id))
  }

  async libraryModels(): Promise<readonly LibraryModel[]> {
    return libraryModels()
  }

  async listAlerts(): Promise<readonly AlertItem[]> {
    if (this.state.account === 'empty') return []
    const panel = this.world.panels[0]
    const items: Omit<AlertItem, 'read'>[] = []
    if (panel) {
      const n = panel.members.length
      const rule = `Agreement needed: ${panel.agreementNeeded} of ${n}, held ${panel.holdDays} days`
      panelToday(panel).rows.filter((r) => r.changed).slice(0, 3).forEach((row, i) => {
        const nowFlag = row.exposure > 0
        items.push({
          id: fixtureId(`alert:p:${panel.id}:${row.ticker}`), kind: 'panel', source: panel.name, sourceId: panel.id, tone: nowFlag ? 'ok' : 'warn', at: `2026-10-14T07:4${i}:00.000Z`,
          title: `${row.ticker} went from ${row.previousVotes >= panel.agreementNeeded ? 'flagged' : 'not flagged'} to ${nowFlag ? 'flagged' : 'not flagged'}`,
          why: `${row.votes} of ${n} models now flag it, against ${row.previousVotes} yesterday.`, rule,
          before: { count: row.previousVotes, of: n }, after: { count: row.votes, of: n },
        })
      })
      items.push({ id: fixtureId(`alert:cond:${panel.id}`), kind: 'panel', source: panel.name, sourceId: panel.id, tone: 'ok', at: '2026-10-14T07:40:00.000Z', title: 'Conditions changed: high volatility', why: 'The volatility flag has been on for 6 days. Two of the four models have a good record on days like this.', rule: 'Alert: conditions change, held 2 days', before: null, after: null })
      items.push({ id: fixtureId(`alert:split:${panel.id}`), kind: 'panel', source: panel.name, sourceId: panel.id, tone: 'warn', at: '2026-10-12T08:10:00.000Z', title: 'INTC: the models split', why: 'Agreement dropped from 4 of 4 to 2 of 4 in one day.', rule: 'Alert: models split', before: { count: 4, of: 4 }, after: { count: 2, of: 4 } })
    }
    items.push(
      { id: fixtureId('alert:t:quiet'), kind: 'thesis', source: 'Quiet stocks hold up', sourceId: specId('quiet'), tone: 'warn', at: '2026-10-13T18:05:00.000Z', title: 'Checks that hold: 4 to 3 of 5', why: 'The last three months were weaker than the full period. This is the third test in a row that has moved the same way.', rule: 'Monthly re-test · alert on weaker evidence', before: { count: 4, of: 5 }, after: { count: 3, of: 5 } },
      { id: fixtureId('alert:t:winners'), kind: 'thesis', source: 'Winners keep winning', sourceId: specId('winners'), tone: 'ok', at: '2026-10-13T09:20:00.000Z', title: 'Re-test finished on 27 variants', why: `${this.world.results.get(resultsId('set-1'))?.variants.filter((v) => v.excessPoints > 0).length ?? 0} of 27 stayed ahead after costs.`, rule: 'Monthly re-test', before: null, after: null },
      { id: fixtureId('alert:t:cheap'), kind: 'thesis', source: 'Cheap and sound recovers', sourceId: specId('cheap'), tone: 'bad', at: '2026-10-11T10:00:00.000Z', title: 'Still behind the benchmark after costs', why: 'Nothing has changed since the last test. We stopped re-testing it until you edit the idea.', rule: 'Monthly re-test', before: null, after: null }
    )
    items.sort((a, b) => b.at.localeCompare(a.at))
    return items.map((item, i) => ({ ...item, read: this.world.read.has(item.id) || i >= 5 }))
  }

  async markAlertsRead(ids: readonly string[] | 'all'): Promise<void> {
    const all = await this.listAlerts()
    for (const a of all) if (ids === 'all' || ids.includes(a.id)) this.world.read.add(a.id)
  }

  async teamQueue(): Promise<readonly QueueRow[]> {
    this.requireTeam()
    return this.world.queue
  }

  async teamPipeline(kind: PipelineKind): Promise<PipelineView> {
    this.requireTeam()
    const p = this.world.panels[0]
    return pipelineOf(kind, p?.agreementNeeded ?? 3, p?.holdDays ?? 2)
  }

  async teamCandidates(): Promise<readonly Candidate[]> {
    this.requireTeam()
    return this.world.candidates
  }

  async teamAccessRequests(): Promise<readonly AccessRequest[]> {
    this.requireTeam()
    return this.world.access
  }

  async requestAccess(experimentId: string, reason: string, expires: '24h' | '7d'): Promise<AccessRequest> {
    this.requireTeam()
    if (!/^exp-[0-9]{3,8}$/.test(experimentId.trim()) || !reason.trim() || reason.length > 500) throw new ModelLabError('invalid')
    const req: AccessRequest = { id: fixtureId(`access:${this.world.counter++}`), experimentId: experimentId.trim(), reason: reason.trim(), expires: `expires in ${expires === '24h' ? '24 hours' : '7 days'}`, status: 'Logged · owner notified' }
    this.world.access = [req, ...this.world.access]
    return req
  }

  async teamDataHealth(): Promise<DataHealth> {
    this.requireTeam()
    return dataHealth()
  }
}

