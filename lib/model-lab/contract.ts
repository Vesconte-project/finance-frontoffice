import type { ThesisSentence } from './thesis-sentence'

/**
 * The Model Lab data contract: what the frontoffice reads from and sends to the
 * platform API under `/v1/model-lab`. The backend does not serve it yet; the
 * pages are written against these shapes so they work as soon as it does.
 *
 * Rules the shapes follow:
 * - The platform shows numbers and the facts about them. No field carries a
 *   verdict on a thesis, and no text field is a forecast.
 * - Money-like amounts (`cost`, `quota`) are in the units the API names in
 *   `Unit`; the pages never assume what a unit is called.
 * - Every list is account-scoped by the server. A customer's experiment is
 *   private to the account unless a copy was submitted.
 */

export type Unit = Readonly<{ one: string; many: string }>

export type Role = 'investor' | 'team'
export type Plan = 'free' | 'pro'

export type Quota = Readonly<{
  /** `credits` for customers, `budget` for team members (an internal budget). */
  kind: 'credits' | 'budget'
  unit: Unit
  remaining: number
  limit: number
  periodEndsAt: string | null
}>

export type Viewer = Readonly<{
  role: Role
  plan: Plan
  quota: Quota
  unreadAlerts: number
  /** When the account lost Pro, premium content is kept until this date. */
  premiumDeletedAt: string | null
}>

/* ---------- theses ---------- */

export type ThesisStatus = 'watching' | 'tested' | 'draft'
export type CheckKey = 'costs' | 'periods' | 'robust' | 'recent' | 'baseline'
export type CheckState = 'holds' | 'partly' | 'fails'

export type Sparkline = Readonly<{ thesis: readonly number[]; benchmark: readonly number[] }>

export type ThesisSummary = Readonly<{
  id: string
  statement: string
  sentence: ThesisSentence
  assets: readonly string[]
  status: ThesisStatus
  checksHolding: number
  checksTotal: number
  testedAt: string | null
  returnAfterCosts: number | null
  benchmarkReturn: number | null
  sparkline: Sparkline | null
  submittedAt: string | null
}>

export type EvidenceCheck = Readonly<{
  key: CheckKey
  title: string
  state: CheckState
  line: string
  why: string
  /** Points ahead of (+) or behind (−) the benchmark in each separate test period. */
  periods?: readonly number[]
}>

export type EquitySeries = Readonly<{
  dates: readonly string[]
  thesis: readonly number[]
  baseline: readonly number[]
  benchmark: readonly number[]
}>

export type PerformanceStats = Readonly<{
  returnAfterCosts: number
  worstFall: number
  sharpe: number
  benchmarkReturn: number
}>

export type Contribution = Readonly<{ ticker: string; share: number; hitRate: number; signals: number }>

export type LimitState = 'known' | 'partly' | 'unknown'
export type LimitRow = Readonly<{ key: string; state: LimitState; title: string; text: string }>

export type OrderingMeasures = Readonly<{
  rankIc: number
  rankIcStability: number
  topMinusBottomBps: number
  positivePeriods: number
  periods: number
  permutationP: number
}>

export type HistoryPoint = Readonly<{ label: string; holding: number }>

export type WatchSettings = Readonly<{
  retest: 'weekly' | 'monthly' | 'quarterly' | 'off'
  alertOnWeaker: boolean
  alertOnBetter: boolean
  email: boolean
  inApp: boolean
}>

export type EvidenceChange = Readonly<{
  previousHolding: number
  currentHolding: number
  movedCheck: CheckKey | null
  asOf: string
}>

export type ThesisEvidence = Readonly<{
  thesisId: string
  asOf: string
  snapshot: Readonly<{ id: string; hash: string }>
  /** Days since the newest price in the snapshot, when it is older than expected. */
  staleDays: number | null
  coverage: Readonly<{ used: number; total: number; left: readonly string[] }>
  checks: readonly EvidenceCheck[]
  change: EvidenceChange
  performance: Readonly<{ series: EquitySeries; stats: PerformanceStats }>
  contributions: readonly Contribution[]
  limits: readonly LimitRow[]
  /** Present only for team members. */
  ordering: OrderingMeasures | null
  history: readonly HistoryPoint[]
  watch: WatchSettings
  fading: boolean
}>

export type Note = Readonly<{ id: string; at: string; text: string; checksHolding: number }>
export type Version = Readonly<{ id: string; label: string; at: string; summary: string; current: boolean }>

export type TestKind = 'single' | 'set' | 'reuse'
export type TestStatus = 'completed' | 'failed' | 'running' | 'cancelled'
export type TestSummary = Readonly<{
  id: string
  kind: TestKind
  at: string
  variants: number
  cost: number
  status: TestStatus
}>

export type LineageStage = Readonly<{
  stage: string
  owner: string
  id: string
  detail: string
  reused: boolean
}>
export type Lineage = Readonly<{
  configHash: string
  executionHash: string
  codeSha: string
  dataSnapshot: string
  stages: readonly LineageStage[]
  manifest: Readonly<Record<string, unknown>>
}>

export type ThesisDetail = Readonly<{
  summary: ThesisSummary
  notes: readonly Note[]
  versions: readonly Version[]
  tests: readonly TestSummary[]
  /** Present only for team members. */
  lineage: Lineage | null
}>

/* ---------- tests, quotes and runs ---------- */

export type ParamValue = number | string
export type Rigor = 'quick' | 'standard' | 'thorough'

export type Draft = Readonly<{
  sentence: ThesisSentence
  /** Present when the universe is "my stocks". */
  assets: readonly string[]
  rigor: Rigor
  /** Parameter id to the values being tested. More than one value is a set. */
  values: Readonly<Record<string, readonly ParamValue[]>>
  families: readonly string[]
  diagnostics: Readonly<{ scout: boolean; decay: boolean; robust: boolean; lookahead: boolean }>
  /** Reuse the trained model from an earlier test. */
  reuseTestId: string | null
  /** The thesis this test belongs to; null starts a new thesis. */
  thesisId: string | null
  registerCandidate: boolean
}>

export type QuoteLine = Readonly<{ label: string; amount: number; note: string | null }>
export type PreflightSeverity = 'block' | 'warn'
export type PreflightFinding = Readonly<{
  severity: PreflightSeverity
  title: string
  detail: string
  fix: Readonly<{ key: string; label: string }> | null
}>
export type Quote = Readonly<{
  unit: Unit
  lines: readonly QuoteLine[]
  total: number
  naiveTotal: number
  variants: number
  trainings: number
  ruleSets: number
  simulations: number
  findings: readonly PreflightFinding[]
}>

export type RunState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type RunStage = Readonly<{ index: number; name: string; owner: string; detail: string; skipped: boolean }>
export type Run = Readonly<{
  id: string
  thesisId: string | null
  statement: string
  state: RunState
  progress: number
  stages: readonly RunStage[]
  currentStage: number
  cost: number
  unit: Unit
  reused: boolean
  isSet: boolean
  failure: Readonly<{ stage: string; message: string; refunded: boolean }> | null
  resultTestId: string | null
  receipt: Quote | null
}>

export type VariantValues = Readonly<Record<string, ParamValue>>
export type Variant = Readonly<{
  id: string
  values: VariantValues
  excessPoints: number
  netReturn: number
  sharpe: number
  hitRate: number
  series: readonly number[]
}>
export type ResultDimension = Readonly<{ id: string; label: string; values: readonly ParamValue[]; labels: readonly string[] }>
export type TestResults = Readonly<{
  id: string
  thesisId: string
  statement: string
  dimensions: readonly ResultDimension[]
  variants: readonly Variant[]
  benchmarkSeries: readonly number[]
  dates: readonly string[]
  receipt: Quote | null
}>

/* ---------- panels ---------- */

export type PanelRule = 'agree' | 'spec' | 'blend'
export type PanelBelow = 'flat' | 'half'
export type ConditionKey = string

export type ModelSkill = Readonly<Record<ConditionKey, number>>
export type PanelMember = Readonly<{
  id: string
  name: string
  how: string
  skill: ModelSkill
  runId: string
}>
export type ConditionInfo = Readonly<{ key: ConditionKey; label: string; days: number }>

export type PanelAlertKey = 'reached' | 'flip' | 'collapse' | 'spec' | 'blind'
export type PanelSummary = Readonly<{
  id: string
  name: string
  members: readonly PanelMember[]
  rule: PanelRule
  agreementNeeded: number
  below: PanelBelow
  holdDays: number
  quietDays: number
  weeklyCap: number
  alerts: Readonly<Record<PanelAlertKey, boolean>>
  channels: readonly ('email' | 'push' | 'app')[]
  assets: readonly string[]
  status: 'watching' | 'paused'
}>

export type TodayRow = Readonly<{
  ticker: string
  flagged: readonly boolean[]
  scores: readonly number[]
  fits: readonly boolean[]
  votes: number
  previousVotes: number
  exposure: number
  changed: boolean
}>
export type TodayCondition = Readonly<{ label: string; value: string; detail: string }>
export type PanelToday = Readonly<{
  panelId: string
  asOf: string
  conditions: readonly TodayCondition[]
  activeConditions: readonly ConditionKey[]
  rows: readonly TodayRow[]
}>

export type AgreementBucket = Readonly<{ votes: number; days: number; averageMove: number | null; hitRate: number | null }>
export type PanelRow = Readonly<{ name: string; returnAfterCosts: number; worstFall: number; invested: number; positionChanges: number }>
export type HeldOutRow = Readonly<{
  name: string
  chosenOnReturn: number
  chosenOnPlace: number
  heldOutReturn: number
  heldOutPlace: number
  heldOutWorstFall: number
  isPanel: boolean
}>
export type ConditionFit = Readonly<{ name: string; pointsPerMonth: readonly number[] }>
export type PanelEvidence = Readonly<{
  panelId: string
  series: Readonly<{ dates: readonly string[]; panel: readonly number[]; best: readonly number[]; benchmark: readonly number[] }>
  rows: readonly PanelRow[]
  heldOut: Readonly<{ chosenOnFrom: string; chosenOnTo: string; days: number; rows: readonly HeldOutRow[]; agreementHitRate: number | null; agreementDays: number }>
  agreement: readonly AgreementBucket[]
  conditions: readonly ConditionInfo[]
  fit: Readonly<{ panel: readonly number[]; models: readonly ConditionFit[] }>
  independentOpinions: number
  correlations: readonly (readonly number[])[]
}>

export type AlertReplay = Readonly<{
  key: PanelAlertKey
  dates: readonly string[]
  market: readonly number[]
  events: readonly Readonly<{ index: number; moveAfter: number }>[]
  perMonth: number
  droppedByCap: number
}>
export type PanelAlerts = Readonly<{ panelId: string; replays: readonly AlertReplay[] }>

export type PanelDraft = Readonly<{
  name: string
  memberRunIds: readonly string[]
  rule: PanelRule
  agreementNeeded: number
  assets: readonly string[]
}>

export type LibraryModel = Readonly<{ id: string; name: string; how: string; skill: ModelSkill; runId: string }>

/* ---------- alerts ---------- */

export type AlertTone = 'ok' | 'warn' | 'bad'
export type AlertItem = Readonly<{
  id: string
  kind: 'panel' | 'thesis'
  source: string
  sourceId: string
  tone: AlertTone
  at: string
  title: string
  why: string
  rule: string
  before: Readonly<{ count: number; of: number }> | null
  after: Readonly<{ count: number; of: number }> | null
  read: boolean
}>

/* ---------- team ---------- */

export type QueueRow = Readonly<{
  id: string
  who: string
  thesis: string
  variants: number
  stage: string
  state: 'running' | 'completed' | 'failed'
  worker: string
  minutes: number
}>
export type CandidateCheck = Readonly<{ label: string; state: CheckState }>
export type Candidate = Readonly<{
  id: string
  name: string
  from: string
  source: 'internal' | 'customer-copy'
  status: 'candidate' | 'shadow'
  checks: readonly CandidateCheck[]
}>
export type AccessRequest = Readonly<{ id: string; experimentId: string; reason: string; expires: string; status: string }>
export type PipelineStep = Readonly<{ index: number; title: string; owner: string; ids: string; lines: readonly string[]; reused: boolean; cost: number | null; members?: readonly { name: string; id: string; how: string; note: string }[] }>
export type PipelineKind = 'thesis' | 'reuse' | 'panel'
export type PipelineView = Readonly<{ kind: PipelineKind; title: string; steps: readonly PipelineStep[]; note: string | null }>
export type DataFamily = Readonly<{ family: string; features: number; coverage: number; latest: string; state: 'ok' | 'warn' | 'bad' }>
export type DataHealth = Readonly<{ snapshot: Readonly<{ id: string; hash: string }>; families: readonly DataFamily[] }>

export type DepthAccess = Readonly<{ advanced: boolean; lab: boolean }>

/* ---------- errors ---------- */

export type ModelLabErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'invalid'
  | 'quota'
  | 'rate-limited'
  | 'unavailable'
  | 'upstream'

export const MODEL_LAB_ERROR_MESSAGES: Readonly<Record<ModelLabErrorCode, string>> = {
  unauthenticated: 'Sign in to use the Model Lab.',
  forbidden: 'Your account does not have access to this.',
  'not-found': 'We could not find that.',
  conflict: 'That changed while you were looking. Reload and try again.',
  invalid: 'Check what you entered and try again.',
  quota: 'You have reached your limit for this period.',
  'rate-limited': 'Too many requests. Try again in a moment.',
  unavailable: 'The Model Lab is not available right now.',
  upstream: 'Something went wrong on our side. Try again.',
}

export class ModelLabError extends Error {
  constructor(
    readonly code: ModelLabErrorCode,
    readonly retryAfter: number | null = null
  ) {
    super(MODEL_LAB_ERROR_MESSAGES[code])
  }
}

export function errorFromStatus(status: number, retryAfter: number | null = null): ModelLabError {
  if (status === 401) return new ModelLabError('unauthenticated')
  if (status === 403) return new ModelLabError('forbidden')
  if (status === 404) return new ModelLabError('not-found')
  if (status === 409) return new ModelLabError('conflict')
  if (status === 400 || status === 422) return new ModelLabError('invalid')
  if (status === 402) return new ModelLabError('quota')
  if (status === 429) return new ModelLabError('rate-limited', retryAfter)
  if (status === 503) return new ModelLabError('unavailable', retryAfter)
  return new ModelLabError('upstream')
}

export function statusFromError(error: ModelLabError): number {
  switch (error.code) {
    case 'unauthenticated': return 401
    case 'forbidden': return 403
    case 'not-found': return 404
    case 'conflict': return 409
    case 'invalid': return 422
    case 'quota': return 402
    case 'rate-limited': return 429
    case 'unavailable': return 503
    default: return 502
  }
}
