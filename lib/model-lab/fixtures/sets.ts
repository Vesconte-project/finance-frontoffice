import type { ParamValue, Quote, ResultDimension, TestResults, Variant, VariantValues } from '../contract'
import { PARAMS, comparedParams, formatParam, paramById, type ParamValues } from '../params'
import { BENCH, BENCH_STATS, DATES, shaped } from './world'
import { fixtureId, gauss, hash, rng, round } from './random'

const EFFECT_BY_MODEL: Readonly<Record<string, number>> = { logit: 0, ridge: -0.2, knn: -0.4, svm: 0.3, forest: 0.6, gbm: 1.0 }

function num(v: VariantValues, id: string, fallback: number): number {
  const x = v[id]
  return typeof x === 'number' ? x : fallback
}

/** How a combination of settings moves the result, in the synthetic world. */
function effect(v: VariantValues): number {
  let e = 0.2 + (EFFECT_BY_MODEL[String(v.model)] ?? 0.4)
  e += 0.6 - Math.abs(num(v, 'conf', 55) - 55) * 0.06
  e -= Math.abs(num(v, 'horizon', 10) - 10) * 0.045
  e -= (num(v, 'cost', 5) - 5) * 0.08 + (num(v, 'slip', 2) - 2) * 0.1
  e -= Math.abs(num(v, 'smooth', 5) - 5) * 0.05
  e += Math.min(num(v, 'minhold', 0), 10) * 0.07
  e -= Math.abs(num(v, 'train', 504) - 504) / 1000
  e -= v.exec === 'signal_close' ? -0.3 : v.exec === 'next_open' ? 0.1 : 0
  return e
}

const PRIORITY = ['model', 'conf', 'horizon']

export function dimensionsOf(values: ParamValues): ResultDimension[] {
  const ids = PARAMS.map((p) => p.id)
  const order = [...PRIORITY, ...ids.filter((i) => !PRIORITY.includes(i))]
  return comparedParams(values)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((id) => {
      const p = paramById(id)
      const vals = [...(values[id] ?? [])]
      if (p.kind === 'num') vals.sort((a, b) => Number(a) - Number(b))
      return { id, label: p.label, values: vals, labels: vals.map((v) => formatParam(id, v)) }
    })
}

function cartesian(dims: readonly ResultDimension[]): Record<string, ParamValue>[] {
  let out: Record<string, ParamValue>[] = [{}]
  for (const d of dims) {
    const next: Record<string, ParamValue>[] = []
    for (const o of out) for (const value of d.values) next.push({ ...o, [d.id]: value })
    out = next
  }
  return out
}

export function buildResults(args: {
  id: string
  thesisId: string
  statement: string
  values: ParamValues
  seed: number
  base: number
  receipt: Quote | null
}): TestResults {
  const dims = dimensionsOf(args.values)
  const combos = cartesian(dims).slice(0, 400)
  const r = rng(args.seed)
  const spikeAt = combos.length >= 9 ? args.seed % combos.length : -1
  const variants: Variant[] = combos.map((c, i) => {
    const v: Record<string, ParamValue> = { ...c }
    for (const p of PARAMS) if (v[p.id] == null) v[p.id] = (args.values[p.id] ?? [p.def[0]])[0]
    const ex = args.base + effect(v) + (i === spikeAt ? 2.6 : 0) + gauss(r) * 0.7
    return {
      id: dims.map((d) => v[d.id]).join('|') || 'single',
      values: v,
      excessPoints: round(ex, 1),
      netReturn: round(BENCH_STATS.ret * 100 + ex, 1),
      sharpe: round(0.55 + ex * 0.16 + gauss(r) * 0.08, 2),
      hitRate: round(0.505 + ex * 0.004 + gauss(r) * 0.004, 3),
      series: shaped(args.seed + i * 7, ex, 1.2),
    }
  })
  return {
    id: args.id,
    thesisId: args.thesisId,
    statement: args.statement,
    dimensions: dims,
    variants,
    benchmarkSeries: BENCH,
    dates: DATES,
    receipt: args.receipt,
  }
}

export function resultsId(key: string): string {
  return fixtureId(`results:${key}`)
}

export function seedFor(text: string): number {
  return hash(text) % 900
}
