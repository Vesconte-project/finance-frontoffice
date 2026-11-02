import type { AccessRequest, Candidate, DataHealth, Lineage, PipelineKind, PipelineView, QueueRow, ThesisTrends, TrendDimension, TrendGroup } from '../contract'
import { MODEL_OPTIONS } from '../params'
import { CONDITION_OPTIONS, DOES_OPTIONS, UNIVERSE_OPTIONS, WHO_OPTIONS } from '../thesis-sentence'
import { memberFor } from './panels'
import { SNAPSHOT } from './world'
import { hash, hex } from './random'
import type { ThesisSpec } from './theses'

export function initialQueue(): QueueRow[] {
  return [
    { id: 'job-8841', owner: 'customer', variants: 2, stage: 'Checking it holds up', state: 'running', worker: 'worker-2', minutes: 4 },
    { id: 'job-8840', owner: 'team', who: 'model-review', thesis: 'gbm-v7 vs production', variants: 2, stage: 'Simulating with costs', state: 'running', worker: 'worker-1', minutes: 11 },
    { id: 'job-8839', owner: 'customer', variants: 27, stage: 'Complete', state: 'completed', worker: 'worker-1', minutes: 38 },
    { id: 'job-8838', owner: 'customer', variants: 2, stage: 'Failed at signal build', state: 'failed', worker: 'worker-2', minutes: 6 },
  ]
}

const CHECK = (label: string, state: 'holds' | 'partly' | 'fails') => ({ label, state })

export function initialCandidates(): Candidate[] {
  const all = (...states: ('holds' | 'partly' | 'fails')[]) => ['Runs end to end', 'Audit passed', 'Ahead after costs', 'Out-of-sample window of 6 months or more', 'Stable across periods'].map((l, i) => CHECK(l, states[i]))
  return [
    { id: 'cand-120', name: 'quiet-screen-v1', from: 'submission sub-31', source: 'customer-copy', status: 'candidate', checks: all('holds', 'holds', 'partly', 'holds', 'partly') },
    { id: 'cand-118', name: 'gbm-v7, momentum + quality', from: 'set-1 / gbm-10-0.55', source: 'internal', status: 'candidate', checks: all('holds', 'holds', 'holds', 'holds', 'partly') },
    { id: 'cand-117', name: 'vol-regime-v3', from: 'one-2', source: 'internal', status: 'candidate', checks: all('holds', 'partly', 'holds', 'fails', 'holds') },
    { id: 'cand-109', name: 'logit-v4 (shadow)', from: 'set-0', source: 'internal', status: 'shadow', checks: all('holds', 'holds', 'holds', 'holds', 'holds') },
  ]
}

export function initialAccessRequests(): AccessRequest[] {
  return [{ id: 'req-1', experimentId: 'exp-4417', reason: 'Owner reported a failed run and asked for help', expires: 'expires in 2 days', status: 'Logged · owner notified' }]
}

/** Below this many accounts a group is folded into "other", so no small group points at a person. */
export const TREND_MIN_ACCOUNTS = 10

type RawGroup = readonly [key: string, label: string, accounts: number, theses: number]

export function foldTrends(dimension: TrendDimension, raw: readonly RawGroup[], minAccounts = TREND_MIN_ACCOUNTS): ThesisTrends['dimensions'][number] {
  const groups: TrendGroup[] = []
  const other = { accounts: 0, theses: 0 }
  for (const [key, label, accounts, theses] of raw) {
    if (accounts >= minAccounts) groups.push({ key, label, accounts, theses })
    else {
      other.accounts += accounts
      other.theses += theses
    }
  }
  groups.sort((a, b) => b.theses - a.theses)
  return { dimension, groups, other }
}

const text = (options: readonly { key: string; text: string }[], key: string) => options.find((o) => o.key === key)?.text ?? key
const model = (key: string) => MODEL_OPTIONS.find(([k]) => k === key)?.[1] ?? key

/** Synthetic counts for the last 30 days. Accounts are distinct per group, so groups do not sum to the total. */
export function thesisTrends(): ThesisTrends {
  return {
    periodDays: 30,
    accounts: 184,
    theses: 412,
    minAccounts: TREND_MIN_ACCOUNTS,
    dimensions: [
      foldTrends('who', [['momentum', text(WHO_OPTIONS, 'momentum'), 71, 138], ['value', text(WHO_OPTIONS, 'value'), 48, 87], ['quality', text(WHO_OPTIONS, 'quality'), 39, 64], ['lowvol', text(WHO_OPTIONS, 'lowvol'), 30, 52], ['growth', text(WHO_OPTIONS, 'growth'), 22, 41], ['earnings', text(WHO_OPTIONS, 'earnings'), 14, 23], ['liquid', text(WHO_OPTIONS, 'liquid'), 4, 7]]),
      foldTrends('does', [['outperform', text(DOES_OPTIONS, 'outperform'), 120, 251], ['rise', text(DOES_OPTIONS, 'rise'), 52, 88], ['fall-less', text(DOES_OPTIONS, 'fall-less'), 27, 46], ['barrier', text(DOES_OPTIONS, 'barrier'), 15, 27]]),
      foldTrends('universe', [['us', text(UNIVERSE_OPTIONS, 'us'), 88, 176], ['picks', text(UNIVERSE_OPTIONS, 'picks'), 61, 109], ['watchlist', text(UNIVERSE_OPTIONS, 'watchlist'), 33, 54], ['covered', text(UNIVERSE_OPTIONS, 'covered'), 21, 38], ['eu', text(UNIVERSE_OPTIONS, 'eu'), 17, 29], ['apac', text(UNIVERSE_OPTIONS, 'apac'), 3, 6]]),
      foldTrends('condition', [['any', text(CONDITION_OPTIONS, 'any'), 131, 270], ['falling', text(CONDITION_OPTIONS, 'falling'), 36, 61], ['pullback', text(CONDITION_OPTIONS, 'pullback'), 19, 33], ['volatile', text(CONDITION_OPTIONS, 'volatile'), 15, 26], ['rising', text(CONDITION_OPTIONS, 'rising'), 8, 13], ['calm', text(CONDITION_OPTIONS, 'calm'), 6, 9]]),
      foldTrends('horizon', [['1-5', 'Up to 5 days', 40, 72], ['6-20', '6 to 20 days', 97, 205], ['21-60', '21 to 60 days', 49, 96], ['61-120', '61 to 120 days', 23, 39]]),
      foldTrends('model', MODEL_OPTIONS.map(([k], i) => [k, model(k), [58, 31, 7, 5, 64, 73][i], [97, 50, 11, 8, 112, 134][i]] as const)),
    ],
  }
}

export function dataHealth(): DataHealth {
  return {
    snapshot: SNAPSHOT,
    families: [
      { family: 'Momentum', features: 18, coverage: 0.97, latest: 'today', state: 'ok' },
      { family: 'Quality', features: 12, coverage: 0.88, latest: 'today', state: 'ok' },
      { family: 'Value', features: 9, coverage: 0.81, latest: 'yesterday', state: 'ok' },
      { family: 'Volatility', features: 14, coverage: 0.99, latest: 'today', state: 'ok' },
      { family: 'Liquidity', features: 7, coverage: 0.95, latest: 'today', state: 'ok' },
      { family: 'Growth', features: 10, coverage: 0.62, latest: '4 days ago', state: 'warn' },
      { family: 'Sentiment', features: 6, coverage: 0, latest: 'no snapshot', state: 'bad' },
    ],
  }
}

export function lineageOf(spec: ThesisSpec): Lineage {
  const h = hex(hash(spec.statement))
  const x = hex(hash(`${spec.statement}x`))
  return {
    configHash: h,
    executionHash: x,
    codeSha: '9f3c2a7d41b86e05c1d4f7a98e3b60d2c5a1f478',
    dataSnapshot: SNAPSHOT.id,
    stages: [
      { stage: 'Manifest accepted', owner: 'orchestrator', id: `hash ${h}`, detail: 'Closed template, no free-form settings.', reused: false },
      { stage: 'Feature snapshot', owner: 'feature-store', id: SNAPSHOT.id, detail: `${SNAPSHOT.hash} · point in time`, reused: true },
      { stage: 'Model run', owner: 'ml-lab', id: `ml_run_${44 + (hash(spec.key) % 5)}`, detail: '8 walk-forward folds, prediction panel written', reused: false },
      { stage: 'Signal panel', owner: 'strategy-lab', id: `strategy_run_${31 + (hash(spec.key) % 4)}`, detail: `Built for ${spec.assets.length} stocks`, reused: false },
      { stage: 'Backtest', owner: 'backtest', id: `backtest_run_${52 + (hash(spec.key) % 4)}`, detail: 'Equity curve and costs recorded', reused: false },
      { stage: 'Checks', owner: 'ml-lab + backtest', id: 'robustness suite', detail: 'Five checks behind the evidence page', reused: false },
    ],
    manifest: { thesis: spec.statement, universe: spec.sentence.universe, assets: spec.assets, horizon: spec.sentence.horizons, condition: spec.sentence.condition, rigor: 'standard' },
  }
}

export function pipelineOf(kind: PipelineKind, agreementNeeded: number, holdDays: number): PipelineView {
  const snapshot = { index: 1, title: 'Feature snapshot', owner: 'feature-store', ids: `${SNAPSHOT.id} · ${SNAPSHOT.hash}`, lines: ['7 families, 78 features, 686 stocks. Point-in-time, so nothing from the future leaks in.', 'Includes the market-condition flags: volatility, trend, credit stress.'], reused: true, cost: null } as const
  if (kind === 'thesis') {
    return {
      kind, title: 'One thesis test', note: null,
      steps: [
        snapshot,
        { index: 2, title: 'Train on past periods only', owner: 'ml-lab', ids: 'ml_run_44 · walk-forward, 8 folds', lines: ['Label: ahead of the benchmark after 10 days. Features frozen at each fold date.'], reused: false, cost: 6.4 },
        { index: 3, title: 'Prediction panel', owner: 'ml-lab', ids: 'predictions · date × stock × score', lines: ['One score per stock per day, written out of sample. Decay and calibration summaries stored beside it.'], reused: false, cost: null },
        { index: 4, title: 'Turn scores into positions', owner: 'strategy-lab', ids: 'strategy_run_31 · route: binary, threshold 0.55', lines: ['Reliability gate and cooldown applied. Changing only this stage reuses the trained model.'], reused: false, cost: 0.8 },
        { index: 5, title: 'Simulate with costs', owner: 'backtest', ids: 'backtest_run_52 · 5 bps + 2 bps slippage', lines: ['Equity curve, turnover, cost drag, benchmark-relative stats.', 'Reports: cost scenarios, time slices, per-stock contribution.'], reused: false, cost: 1.1 },
        { index: 6, title: 'Checks that feed the evidence page', owner: 'ml-lab + backtest', ids: 'robustness suite · 5 checks', lines: ['Costs, periods, small changes, recent strength, obvious-rule baseline.'], reused: false, cost: null },
        { index: 7, title: 'Candidate and registry', owner: 'backend', ids: 'cand-118 · shadow after review', lines: ['Moves toward production only through the readiness list on the Candidates tab.'], reused: false, cost: null },
      ],
    }
  }
  if (kind === 'reuse') {
    return {
      kind, title: 'Same model, new rules', note: 'Total 1.9 credits instead of 8.3. Stages 1 to 3 are identical by hash, so they are not run again.',
      steps: [
        snapshot,
        { index: 2, title: 'Trained model', owner: 'ml-lab', ids: 'ml_run_44 · from set-1', lines: ['Found in your earlier test. Nothing retrained.'], reused: true, cost: null },
        { index: 3, title: 'Prediction panel', owner: 'ml-lab', ids: 'predictions · same file as before', lines: ['Same scores, same dates.'], reused: true, cost: null },
        { index: 4, title: 'New rules on the same scores', owner: 'strategy-lab', ids: 'strategy_run_32 · threshold 0.60', lines: ['Only the rule changed. Hashes show exactly what differs.'], reused: false, cost: 0.8 },
        { index: 5, title: 'Simulate with costs', owner: 'backtest', ids: 'backtest_run_53 · 5 bps + 2 bps', lines: ['Compared against backtest_run_52 in the Tests tab.'], reused: false, cost: 1.1 },
      ],
    }
  }
  return {
    kind, title: 'A panel', note: null,
    steps: [
      snapshot,
      { index: 2, title: 'Models you already trained', owner: 'ml-lab', ids: '4 runs', lines: [], reused: true, cost: null, members: ['m1', 'm2', 'm3', 'm4'].map((k, i) => { const m = memberFor(k); return { name: m.name, id: `ml_run_${41 + i}`, how: m.how, note: '' } }) },
      { index: 3, title: 'Combine predictions', owner: 'orchestrator', ids: 'panel merge · join on date and stock', lines: ['Each model’s prediction panel is lined up on the same date and stock. Missing scores stay missing and are counted, never filled in.'], reused: false, cost: null },
      { index: 4, title: 'Panel rule', owner: 'strategy-lab', ids: `agreement ${agreementNeeded} of 4 · hold ${holdDays} days`, lines: ['Counts how many models flag each stock on each day, then applies the same gates and cooldowns as a single model.'], reused: false, cost: 1.2 },
      { index: 5, title: 'Simulate with costs', owner: 'backtest', ids: 'panel backtest · held-out window', lines: ['Rule chosen on the early part, judged on the late part. Panel against each model and against the best single model.'], reused: false, cost: 1.1 },
      { index: 6, title: 'Performance by market condition', owner: 'backtest', ids: 'grouped by regime flag', lines: ['Return per condition for the panel and for each model. This is the table behind “who covers which conditions”.'], reused: false, cost: null },
      { index: 7, title: 'Alerts and registry bundle', owner: 'backend', ids: 'panel manifest', lines: ['Alert rules replayed on history before they are switched on.'], reused: false, cost: null },
    ],
  }
}
