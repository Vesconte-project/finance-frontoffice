import type { Candidate, CheckState, Lineage, PipelineKind, PipelineView, SharedModel } from '../contract'
import { memberFor } from './panels'
import { SNAPSHOT, daysAgoIso } from './world'
import { fixtureId, hash, hex } from './random'
import type { ThesisSpec } from './theses'

const CHECK = (label: string, state: CheckState) => ({ label, state })
const READINESS = ['Runs end to end', 'Audit passed', 'Ahead after costs', 'Out-of-sample window of 6 months or more', 'Stable across periods'] as const

/** The readiness list for a model with `holding` of its checks holding. */
export function readinessChecks(holding: number): Candidate['checks'] {
  return READINESS.map((l, i) => CHECK(l, i < holding ? 'holds' : i === holding ? 'partly' : 'fails'))
}

/** Models the other admins shared. Their theses are not in this account, so they are read-only here. */
export function sharedByOthers(): SharedModel[] {
  return [
    { thesisId: fixtureId('shared:gbm-v7'), statement: 'Momentum and quality leaders beat the market over 10 days, after costs', sharedBy: 'Model review', mine: false, sharedAt: daysAgoIso(3), checksHolding: 4, checksTotal: 5, returnAfterCosts: 0.142, benchmarkReturn: 0.098 },
    { thesisId: fixtureId('shared:vol-regime-v3'), statement: 'Low-volatility stocks fall less than the market when it is falling', sharedBy: 'Research', mine: false, sharedAt: daysAgoIso(12), checksHolding: 3, checksTotal: 5, returnAfterCosts: 0.061, benchmarkReturn: 0.098 },
  ]
}

export function initialCandidates(): Candidate[] {
  const [gbm, vol] = sharedByOthers()
  return [
    { id: fixtureId('candidate:gbm-v7'), thesisId: gbm.thesisId, name: gbm.statement, selectedBy: gbm.sharedBy, selectedAt: daysAgoIso(2), review: 'approved', checks: readinessChecks(4) },
    { id: fixtureId('candidate:vol-regime-v3'), thesisId: vol.thesisId, name: vol.statement, selectedBy: vol.sharedBy, selectedAt: daysAgoIso(9), review: 'waiting', checks: readinessChecks(3) },
  ]
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
        { index: 7, title: 'Candidate and registry', owner: 'backend', ids: 'candidate · approved in the backoffice', lines: ['An admin selects it as a candidate. Approval and deployment happen in the backoffice.'], reused: false, cost: null },
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
