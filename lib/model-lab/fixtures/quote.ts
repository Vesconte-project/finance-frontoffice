import type { Draft, PreflightFinding, Quote, QuoteLine, Unit } from '../contract'
import { PARAMS, isSetOfTests, type Layer } from '../params'

export const CREDIT_UNIT: Unit = { one: 'coin', many: 'coins' }

const MODEL_BASE: Readonly<Record<string, number>> = { logit: 1, ridge: 1, knn: 1.5, svm: 2, forest: 2.5, gbm: 3 }
const RIGOR_FACTOR = { quick: 0.5, standard: 1, thorough: 2 } as const
const CHECK_COST = { quick: 0, standard: 0.03, thorough: 0.08 } as const

const ASSETS_BY_UNIVERSE: Readonly<Record<string, number>> = { watchlist: 14, covered: 686, us: 300, eu: 150, apac: 120 }

export function assetCount(draft: Draft): number {
  return draft.sentence.universe === 'picks' ? draft.assets.length : ASSETS_BY_UNIVERSE[draft.sentence.universe] ?? 14
}

function layerCount(values: Draft['values'], layer: Layer, skip?: string): number {
  let count = 1
  for (const p of PARAMS) {
    if (p.layer !== layer || p.id === skip) continue
    if ((p.id === 'gain' || p.id === 'loss') && !(values.label ?? []).includes('barrier')) continue
    count *= Math.max(1, (values[p.id] ?? []).length)
  }
  return count
}

/** The synthetic price list. A real quote comes from the platform. */
export function quoteDraft(draft: Draft, remaining: number, data: 'ok' | 'stale' | 'partial', resetsOn: string): Quote {
  const v = draft.values
  const assets = assetCount(draft)
  const reuse = draft.reuseTestId !== null
  const rf = RIGOR_FACTOR[draft.rigor]
  const sf = assets <= 10 ? 1 : assets <= 50 ? 1.5 : 2
  const chk = CHECK_COST[draft.rigor]
  const modelCombos = layerCount(v, 'model', 'model')
  const signalCombos = layerCount(v, 'signal')
  const tradeCombos = layerCount(v, 'backtest')
  const models = (v.model ?? ['gbm']).map(String)
  const baseSum = models.reduce((a, m) => a + (MODEL_BASE[m] ?? 2), 0)
  const trainings = reuse ? 0 : models.length * modelCombos
  const runs = reuse ? 1 : trainings
  const train = reuse ? 0 : baseSum * modelCombos * rf * sf
  const builds = runs * signalCombos
  const sims = builds * tradeCombos
  const rules = builds * 0.05
  const trade = sims * 0.02
  const checks = sims * chk
  const total = Math.max(0.1, train + rules + trade + checks)
  const naive = Math.max(total, sims * ((baseSum / models.length) * rf * sf + 0.07 + chk))

  const lines: QuoteLine[] = [
    { label: 'Data', amount: 0, note: 'Today’s snapshot' },
    { label: trainings === 1 ? 'Training · 1 model' : `Training · ${trainings} models`, amount: train, note: reuse ? 'Reused, not charged' : null },
    { label: `Rules · ${builds} ${builds === 1 ? 'set' : 'sets'}`, amount: rules, note: null },
    { label: `Simulations · ${sims}`, amount: trade, note: null },
    { label: 'Checks', amount: checks, note: draft.rigor === 'quick' ? 'Quick runs skip the extra checks' : null },
  ]

  const findings: PreflightFinding[] = []
  const hist = Number((v.history ?? [3])[0])
  const train_ = Math.max(...(v.train ?? [504]).map(Number))
  const testLen = Number((v.test ?? [63])[0])
  const folds = Math.floor((hist * 252 - train_) / testLen)
  if (data === 'partial' && draft.families.includes('Growth')) {
    findings.push({ severity: 'block', title: 'Growth signals are out of date', detail: 'The latest Growth snapshot is 4 days old and tests need data from the last 3 days.', fix: { key: 'dropGrowth', label: 'Leave Growth out' } })
  }
  if (data === 'stale') findings.push({ severity: 'warn', title: 'Prices are 2 days old', detail: 'Results will use data up to 12 Oct. Run again tomorrow for the latest.', fix: null })
  if (folds < 4) {
    findings.push({ severity: 'block', title: 'Not enough history for four test periods', detail: `With ${hist} ${hist === 1 ? 'year' : 'years'} of history and a ${train_}-day learning window there are ${Math.max(0, folds)} separate test periods. Four is the minimum.`, fix: { key: 'moreHistory', label: 'Use 5 years of history' } })
  }
  if (draft.sentence.universe === 'picks' && assets >= 2 && assets < 5) {
    findings.push({ severity: 'warn', title: `Only ${assets} stocks`, detail: 'With so few stocks, one name can drive the whole result. Five or more is steadier.', fix: null })
  }
  if (draft.sentence.universe === 'picks' && assets < 2) {
    findings.push({ severity: 'block', title: 'Choose at least two stocks', detail: 'A test needs a few stocks to compare. Add more below.', fix: null })
  }
  if ((draft.sentence.universe === 'eu' || draft.sentence.universe === 'apac') && (v.bench ?? []).includes('market') && ((v.label ?? []).includes('outperform') || (v.label ?? []).includes('fall-less'))) {
    findings.push({ severity: 'warn', title: 'US benchmark for non-US stocks', detail: 'Currency and market hours differ, so the comparison may mislead.', fix: null })
  }
  if (sims > 60) findings.push({ severity: 'warn', title: `${sims} variants is a lot`, detail: 'Large sets are easy to over-read. The best of many will often be luck.', fix: null })
  if (draft.sentence.universe === 'covered' && isSetOfTests(v)) {
    findings.push({ severity: 'warn', title: 'A set across every covered stock is expensive', detail: 'Try it on a smaller list first, then widen.', fix: null })
  }
  if (total > remaining) {
    findings.push({ severity: 'block', title: 'Not enough credit', detail: `This needs ${total.toFixed(1)} and you have ${remaining.toFixed(1)}. Your allowance resets on ${resetsOn}.`, fix: { key: 'quick', label: 'Switch to Quick' } })
  }
  return { unit: CREDIT_UNIT, lines, total, naiveTotal: naive, variants: sims, trainings, ruleSets: builds, simulations: sims, findings }
}
