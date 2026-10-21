import type {
  CheckKey,
  CheckState,
  EvidenceCheck,
  ThesisEvidence,
  ThesisSummary,
  WatchSettings,
} from '../contract'
import { describeThesis, type ThesisSentence, type WhoKey } from '../thesis-sentence'
import { BENCH, BENCH_STATS, DATES, N, SNAPSHOT, daysAgoIso, downsample, shaped, stats } from './world'
import { fixtureId, gauss, hash, hex, rng, round } from './random'

export type ThesisSpec = Readonly<{
  key: string
  sentence: ThesisSentence
  statement: string
  assets: readonly string[]
  status: ThesisSummary['status']
  seed: number
  /** Points ahead of the benchmark over the year. */
  ex: number
  checks: readonly ['ok' | 'warn' | 'bad', 'ok' | 'warn' | 'bad', 'ok' | 'warn' | 'bad', 'ok' | 'warn' | 'bad', 'ok' | 'warn' | 'bad']
  robust: number
  turnover: number
  fading: boolean
  testedDaysAgo: number
}>

const STATE: Readonly<Record<'ok' | 'warn' | 'bad', CheckState>> = { ok: 'holds', warn: 'partly', bad: 'fails' }

const RULE: Readonly<Record<WhoKey, string>> = {
  momentum: 'buying the 20% of stocks with the strongest recent returns',
  lowvol: 'buying the 20% that swing the least',
  value: 'buying the 20% that are cheapest and profitable',
  quality: 'buying the 20% with the strongest balance sheets',
  growth: 'buying the 20% that are growing fastest',
  liquid: 'buying the 20% that trade the heaviest volume',
  earnings: 'buying right after every report',
}

const pct = (x: number, digits = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(digits)}%`

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Now']

export const THESIS_SPECS: readonly ThesisSpec[] = [
  {
    key: 'winners',
    sentence: { who: 'momentum', universe: 'picks', does: 'outperform', benchmark: 'market', condition: 'any', horizons: [10], gains: [5], losses: [3] },
    statement: 'Recent strong performers among my quality stocks keep outperforming over two weeks',
    assets: ['AAPL', 'MSFT', 'NVDA', 'COST', 'V', 'LLY'],
    status: 'watching',
    seed: 21,
    ex: 3.4,
    checks: ['ok', 'warn', 'warn', 'warn', 'warn'],
    robust: 13,
    turnover: 24,
    fading: false,
    testedDaysAgo: 2,
  },
  {
    key: 'quiet',
    sentence: { who: 'lowvol', universe: 'picks', does: 'fall-less', benchmark: 'market', condition: 'any', horizons: [20], gains: [5], losses: [3] },
    statement: 'Quiet, low-volatility stocks hold up better when the market falls, over a month',
    assets: ['KO', 'PG', 'JNJ', 'PEP'],
    status: 'watching',
    seed: 33,
    ex: 5.1,
    checks: ['ok', 'ok', 'ok', 'warn', 'ok'],
    robust: 17,
    turnover: 11,
    fading: true,
    testedDaysAgo: 1,
  },
  {
    key: 'cheap',
    sentence: { who: 'value', universe: 'picks', does: 'rise', benchmark: 'market', condition: 'pullback', horizons: [5], gains: [5], losses: [3] },
    statement: 'Cheap, profitable companies recover after a dip within a week',
    assets: ['INTC', 'PFE', 'VZ'],
    status: 'tested',
    seed: 58,
    ex: -2.3,
    checks: ['bad', 'bad', 'warn', 'warn', 'bad'],
    robust: 6,
    turnover: 38,
    fading: false,
    testedDaysAgo: 21,
  },
]

export function specId(key: string): string {
  return fixtureId(`thesis:${key}`)
}

export function testId(key: string): string {
  return fixtureId(`test:${key}`)
}

const isoDaysAgo = (days: number): string => daysAgoIso(days)

type Built = Readonly<{
  strategy: readonly number[]
  baseline: readonly number[]
  periods: readonly number[]
  holding: number
  history: readonly number[]
  baselineGap: number
}>

function build(spec: ThesisSpec): Built {
  const r = rng(spec.seed)
  const strategy = shaped(spec.seed, spec.ex, 1.6)
  const edge = spec.ex / 2
  const gap = { ok: 1.6, warn: 0.2, bad: -1.1 }[spec.checks[4]] + (rng(spec.seed + 3)() - 0.5) * 0.8
  const baselineGap = round(gap, 1)
  const baseline = shaped(spec.seed + 11, spec.ex - baselineGap, 1.4)
  const periods = Array.from({ length: 8 }, () => round(edge + gauss(r) * 2.2, 1))
  const holding = spec.checks.filter((c) => c === 'ok').length
  const history: number[] = []
  for (let j = 0; j < 6; j++) {
    const drift = j < 5 ? Math.round((r() - 0.5) * 2.2 + (spec.fading ? (5 - j) * 0.3 : 0)) : 0
    history.push(Math.max(0, Math.min(5, holding + drift)))
  }
  history[5] = holding
  return { strategy, baseline, periods, holding, history, baselineGap }
}

export function summaryOf(spec: ThesisSpec, submitted: boolean): ThesisSummary {
  const b = build(spec)
  const st = stats(b.strategy)
  return {
    id: specId(spec.key),
    statement: spec.statement,
    sentence: spec.sentence,
    assets: spec.assets,
    status: spec.status,
    checksHolding: b.holding,
    checksTotal: 5,
    testedAt: isoDaysAgo(spec.testedDaysAgo),
    returnAfterCosts: st.ret,
    benchmarkReturn: BENCH_STATS.ret,
    sparkline: { thesis: downsample(b.strategy), benchmark: downsample(BENCH) },
    submittedAt: submitted ? isoDaysAgo(0) : null,
  }
}

export const DEFAULT_WATCH: WatchSettings = { retest: 'monthly', alertOnWeaker: true, alertOnBetter: false, email: true, inApp: true }

export function evidenceOf(spec: ThesisSpec, team: boolean, watch: WatchSettings, stale: number | null, partial: boolean): ThesisEvidence {
  const b = build(spec)
  const st = stats(b.strategy)
  const who = spec.sentence.who
  const wins = b.periods.filter((p) => p > 0).length
  const lines = (key: CheckKey): { line: string; why: string } => {
    const s = spec.checks[['costs', 'periods', 'robust', 'recent', 'baseline'].indexOf(key)]
    switch (key) {
      case 'costs':
        return {
          line: s === 'ok' ? `After 5 bps of costs and 2 bps of slippage it returned ${pct(st.ret)}, against ${pct(BENCH_STATS.ret)} for the benchmark.` : s === 'warn' ? `After costs it returned ${pct(st.ret)}, roughly level with the benchmark at ${pct(BENCH_STATS.ret)}.` : `Costs take it behind the benchmark: ${pct(st.ret)} against ${pct(BENCH_STATS.ret)}.`,
          why: `Costs are charged on every position change. This idea trades about ${spec.turnover} times a year, so the cost drag is ${(spec.turnover * 0.07).toFixed(1)} points.`,
        }
      case 'periods':
        return { line: `Ahead of the benchmark in ${wins} of 8 separate test periods.`, why: 'Each period was tested only on data the model had not seen yet. Bars show how far ahead or behind it finished.' }
      case 'robust':
        return {
          line: s === 'ok' ? `Stayed ahead in ${spec.robust} of 20 slightly different setups.` : s === 'warn' ? `Stayed ahead in ${spec.robust} of 20 slightly different setups, so the result leans on the exact settings.` : `Only ${spec.robust} of 20 slightly different setups stayed ahead. The result looks fragile.`,
          why: 'We nudge thresholds, dates and the asset list and re-run. A real effect does not disappear when you breathe on it.',
        }
      case 'recent':
        return {
          line: s === 'ok' ? 'The last three months look like the rest of the year.' : s === 'warn' ? 'The last three months were weaker than the full period.' : 'The last three months were clearly worse than the rest of the year.',
          why: 'We compare the latest quarter with everything before it. A fading edge is the usual way a good idea stops working.',
        }
      default:
        return {
          line: s === 'ok' ? `It finished ${b.baselineGap} points ahead of simply ${RULE[who]}.` : s === 'warn' ? `About level with simply ${RULE[who]} (${b.baselineGap >= 0 ? '+' : ''}${b.baselineGap} points).` : `Simply ${RULE[who]} did better, by ${Math.abs(b.baselineGap)} points.`,
          why: 'A model has to earn its place. We also test the plain rule behind your idea, with no learning at all. If the plain rule does as well, you do not need the model.',
        }
    }
  }
  const TITLES: Readonly<Record<CheckKey, string>> = {
    costs: 'Still ahead after costs',
    periods: 'Works in different periods',
    robust: 'Survives small changes',
    recent: 'Still working recently',
    baseline: 'Better than the obvious rule',
  }
  const keys: readonly CheckKey[] = ['costs', 'periods', 'robust', 'recent', 'baseline']
  const checks: EvidenceCheck[] = keys.map((key, i) => ({
    key,
    title: TITLES[key],
    state: STATE[spec.checks[i]],
    ...lines(key),
    ...(key === 'periods' ? { periods: b.periods } : {}),
  }))

  const r = rng(spec.seed + 99)
  const rows = spec.assets.map((ticker) => ({ ticker, share: 0.3 + r(), hitRate: round(0.5 + (r() - 0.35) * 0.14, 3), signals: 20 + Math.floor(r() * 30) }))
  const total = rows.reduce((a, x) => a + x.share, 0)
  const contributions = rows.map((x) => ({ ...x, share: x.share / total })).sort((a, z) => z.share - a.share)

  const prev = b.history[4]
  const moved: CheckKey | null = b.holding === prev ? null : spec.fading ? 'recent' : keys[spec.checks.findIndex((c) => c !== 'ok')] ?? 'costs'

  const priceOnly = who === 'momentum' || who === 'lowvol'
  const left = partial ? spec.assets.slice(-2) : []
  const ic = round(0.004 + rng(spec.seed + 5)() * 0.05 + spec.ex / 800, 3)
  const sdIc = 0.11 + rng(spec.seed + 6)() * 0.05
  return {
    thesisId: specId(spec.key),
    asOf: isoDaysAgo(stale ?? 0),
    snapshot: SNAPSHOT,
    staleDays: stale,
    coverage: { used: spec.assets.length - left.length, total: spec.assets.length, left },
    checks,
    change: { previousHolding: prev, currentHolding: b.holding, movedCheck: moved, asOf: isoDaysAgo(0) },
    performance: {
      series: { dates: DATES, thesis: b.strategy, baseline: b.baseline, benchmark: BENCH },
      stats: { returnAfterCosts: st.ret, worstFall: st.dd, sharpe: st.sharpe, benchmarkReturn: BENCH_STATS.ret },
    },
    contributions,
    limits: [
      { key: 'period', state: 'known', title: 'Test period', text: `Prices from ${DATES[0]} to ${DATES[N - 1]}, data snapshot ${SNAPSHOT.id}.` },
      { key: 'coverage', state: left.length ? 'partly' : 'known', title: 'Coverage', text: left.length ? `${spec.assets.length - left.length} of ${spec.assets.length} stocks had prices for the whole period. ${left.join(' and ')} had gaps and were left out.` : `${spec.assets.length} of ${spec.assets.length} stocks had prices for the whole period.` },
      { key: 'pit', state: priceOnly ? 'known' : 'partly', title: 'Known on the day (point in time)', text: priceOnly ? 'This test uses prices only, which are dated to the day they traded.' : 'Prices are dated to the day they traded. For company figures, the date each one became public is not verified for every company, so some may have been used earlier than anyone could have known them.' },
      { key: 'survivors', state: 'unknown', title: 'Companies that disappeared', text: 'We cannot yet say whether companies that were delisted or acquired are in the universe. If they are missing, past results can look better than they were.' },
      { key: 'unseen', state: 'known', title: 'Tested on unseen data', text: '8 test periods. Each was tested only on data the model had not seen.' },
      { key: 'costs', state: 'known', title: 'Costs', text: '5 bps of costs and 2 bps of slippage on every position change, the same for every stock.' },
      { key: 'benchmark', state: 'partly', title: 'Benchmark', text: 'SPY, in US dollars. A stock listed in another currency is compared in its own returns.' },
    ],
    ordering: team
      ? {
          rankIc: ic,
          rankIcStability: round(ic / sdIc, 2),
          topMinusBottomBps: Math.round(spec.ex * 18 + rng(spec.seed + 7)() * 40),
          positivePeriods: Math.max(0, Math.min(8, Math.round(4 + spec.ex * 0.7 + (rng(spec.seed + 8)() - 0.5) * 3))),
          periods: 8,
          permutationP: round(Math.max(0.002, Math.min(0.9, Math.exp(-(ic / sdIc) * 3.2) * (0.6 + rng(spec.seed + 9)() * 0.8))), 3),
        }
      : null,
    history: b.history.map((holding, i) => ({ label: MONTHS[i], holding })),
    watch,
    fading: spec.fading,
  }
}

export function describeFixture(spec: ThesisSpec): string {
  return `${describeThesis(spec.sentence)}.`
}

export function configHash(spec: ThesisSpec): string {
  return hex(hash(spec.statement))
}
