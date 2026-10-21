import { gauss, rng, series } from './random'

/**
 * One synthetic year of "market" every fixture is drawn against. Trading days run
 * from 15 Oct 2025 for 252 sessions; the benchmark is a seeded random walk.
 */

export const N = 252
export const BENCH: readonly number[] = series(29, 0.0004, 0.0085, N)

const DAY = 86_400_000
const START = Date.UTC(2025, 9, 15)
export const DATES: readonly string[] = Array.from({ length: N }, (_, i) =>
  new Date(START + Math.round((i * 365) / 251) * DAY).toISOString().slice(0, 10)
)

export const SNAPSHOT = { id: 'snap-2026-10-14', hash: 'c4e90b17a2f6' } as const

export type Stats = Readonly<{ ret: number; dd: number; sharpe: number }>

export function stats(values: readonly number[]): Stats {
  const rets: number[] = []
  let peak = values[0]
  let dd = 0
  for (let i = 1; i < values.length; i++) {
    rets.push(values[i] / values[i - 1] - 1)
    peak = Math.max(peak, values[i])
    dd = Math.min(dd, values[i] / peak - 1)
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length)
  return { ret: values[values.length - 1] - 1, dd, sharpe: sd ? (mean / sd) * Math.sqrt(252) : 0 }
}

export const BENCH_STATS = stats(BENCH)

/** A path that ends exactly `points` percentage points away from the benchmark. */
export function shaped(seed: number, points: number, amplitude = 1): number[] {
  const r = rng(seed)
  const w = [0]
  for (let i = 1; i < N; i++) w.push(w[i - 1] + gauss(r) * 0.0045)
  const end = w[N - 1]
  return BENCH.map((b, k) =>
    Math.max(0.2, b + (points / 100) * (k / (N - 1)) + (w[k] - (end * k) / (N - 1)) * amplitude)
  )
}

/** Keeps a long series small enough to send in a list. */
export function downsample(values: readonly number[], target = 60): number[] {
  if (values.length <= target) return [...values]
  const out: number[] = []
  for (let i = 0; i < target; i++) out.push(values[Math.round((i * (values.length - 1)) / (target - 1))])
  return out
}

/** Market conditions by day, from the benchmark's own trend and volatility. */
export const RET: readonly number[] = BENCH.map((b, i) => (i + 1 < N ? BENCH[i + 1] / b - 1 : 0))
export type ConditionDay = 'calm' | 'trend' | 'highvol' | 'falling' | 'choppy'
export const REG: readonly ConditionDay[] = (() => {
  const vols: number[] = []
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 19)
    let sum = 0
    let count = 0
    for (let j = a; j <= i; j++) {
      sum += j ? BENCH[j] / BENCH[j - 1] - 1 : 0
      count++
    }
    const mu = sum / count
    let v = 0
    for (let j = a; j <= i; j++) {
      const r2 = j ? BENCH[j] / BENCH[j - 1] - 1 : 0
      v += (r2 - mu) * (r2 - mu)
    }
    vols.push(Math.sqrt(v / count))
  }
  const sorted = [...vols].sort((x, y) => x - y)
  const p85 = sorted[Math.floor(0.85 * N)]
  const p35 = sorted[Math.floor(0.35 * N)]
  return vols.map((vol, i): ConditionDay => {
    const t60 = i >= 60 ? BENCH[i] / BENCH[i - 60] - 1 : 0
    if (vol >= p85) return 'highvol'
    if (t60 < -0.03) return 'falling'
    if (t60 > 0.04) return 'trend'
    if (vol <= p35) return 'calm'
    return 'choppy'
  })
})()

export const CONDITIONS: readonly (readonly [ConditionDay, string])[] = [
  ['calm', 'Calm'],
  ['trend', 'Trending up'],
  ['highvol', 'High volatility'],
  ['falling', 'Falling market'],
  ['choppy', 'Choppy'],
]

export const CONDITION_DAYS: Readonly<Record<ConditionDay, number>> = REG.reduce(
  (acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }),
  {} as Record<ConditionDay, number>
)
