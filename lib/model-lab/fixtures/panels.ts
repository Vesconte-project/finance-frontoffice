import type {
  AgreementBucket,
  AlertReplay,
  ConditionInfo,
  LibraryModel,
  PanelAlertKey,
  PanelAlerts,
  PanelEvidence,
  PanelMember,
  PanelSummary,
  PanelToday,
  TodayRow,
} from '../contract'
import { BENCH, BENCH_STATS, CONDITIONS, CONDITION_DAYS, DATES, N, REG, RET, stats } from './world'
import { fixtureId, hash, rng, round } from './random'

type Skill = Readonly<Record<string, number>>
const SKILL = (calm: number, trend: number, highvol: number, falling: number, choppy: number): Skill => ({ calm, trend, highvol, falling, choppy })

type LibraryEntry = Readonly<{ key: string; name: string; how: string; skill: Skill }>

const LIBRARY: readonly LibraryEntry[] = [
  { key: 'm1', name: 'Winners keep winning', how: 'Gradient boosting · 10 days', skill: SKILL(0.6, 0.63, 0.47, 0.44, 0.5) },
  { key: 'm2', name: 'Quiet stocks fall less', how: 'Logistic regression · 20 days', skill: SKILL(0.52, 0.48, 0.57, 0.64, 0.53) },
  { key: 'm3', name: 'Volatility regime', how: 'Random forest · 5 days', skill: SKILL(0.49, 0.5, 0.65, 0.56, 0.52) },
  { key: 'm4', name: 'Cheap after a pullback', how: 'Logistic regression · 5 days', skill: SKILL(0.57, 0.52, 0.5, 0.49, 0.6) },
  { key: 'm5', name: 'Earnings drift', how: 'Gradient boosting · 10 days', skill: SKILL(0.55, 0.58, 0.51, 0.48, 0.5) },
  { key: 'm6', name: 'Quality compounders', how: 'Ridge · 20 days', skill: SKILL(0.58, 0.6, 0.5, 0.5, 0.51) },
]

export function libraryModels(): LibraryModel[] {
  return LIBRARY.map((m) => ({ id: fixtureId(`model:${m.key}`), name: m.name, how: m.how, skill: m.skill, runId: fixtureId(`run:${m.key}`) }))
}

export function memberFor(key: string): PanelMember {
  const m = LIBRARY.find((x) => x.key === key) ?? LIBRARY[0]
  return { id: fixtureId(`model:${m.key}`), name: m.name, how: m.how, skill: m.skill, runId: fixtureId(`run:${m.key}`) }
}

export function memberKeyOfRun(runId: string): string | null {
  return LIBRARY.find((m) => fixtureId(`run:${m.key}`) === runId)?.key ?? null
}

export const TODAY_CONDITIONS: readonly string[] = ['highvol', 'falling']

export function initialPanels(): PanelSummary[] {
  return [
    {
      id: fixtureId('panel:core'),
      name: 'Core panel',
      members: ['m1', 'm2', 'm3', 'm4'].map(memberFor),
      rule: 'agree',
      agreementNeeded: 3,
      below: 'flat',
      holdDays: 2,
      quietDays: 3,
      weeklyCap: 3,
      alerts: { reached: true, flip: true, collapse: false, spec: false, blind: true },
      channels: ['email', 'app'],
      assets: ['AAPL', 'MSFT', 'NVDA', 'COST', 'V', 'LLY'],
      status: 'watching',
    },
  ]
}

/* ---------- simulation ---------- */

let SHARED: number[] | null = null
function sharedView(): number[] {
  if (!SHARED) {
    const r = rng(4242)
    let cur = 1
    SHARED = []
    for (let i = 0; i < N; i++) {
      if (i === 0 || r() < 0.2) {
        let sum = 0
        for (let j = i; j < Math.min(N, i + 5); j++) sum += RET[j]
        cur = (r() < 0.55 ? sum > 0 : sum <= 0) ? 1 : 0
      }
      SHARED.push(cur)
    }
  }
  return SHARED
}

const POS_CACHE = new Map<string, number[]>()
function positions(member: PanelMember): number[] {
  const cached = POS_CACHE.get(member.id)
  if (cached) return cached
  const r = rng((hash(member.id) % 100000) + 7)
  const shared = sharedView()
  const out: number[] = []
  let cur = 1
  for (let i = 0; i < N; i++) {
    if (i === 0 || r() < 0.2) {
      let sum = 0
      for (let j = i; j < Math.min(N, i + 5); j++) sum += RET[j]
      const up = sum > 0
      const own = (r() < (member.skill[REG[i]] ?? 0.5) ? up : !up) ? 1 : 0
      cur = r() < 0.3 ? shared[i] : own
    }
    out.push(cur)
  }
  POS_CACHE.set(member.id, out)
  return out
}

type Rule = Pick<PanelSummary, 'rule' | 'agreementNeeded' | 'below'>

function decide(panel: Rule, members: readonly PanelMember[], votes: readonly number[], active: readonly string[]) {
  const n = members.length
  const k = Math.min(panel.agreementNeeded, n)
  const total = votes.reduce((a, b) => a + b, 0)
  const fit = members.map((m) => active.some((r) => (m.skill[r] ?? 0) >= 0.55))
  let e: number
  if (panel.rule === 'agree') e = total >= k ? 1 : panel.below === 'half' && total >= Math.ceil(k / 2) ? 0.5 : 0
  else if (panel.rule === 'spec') {
    const fc = fit.filter(Boolean).length
    const fv = votes.filter((_, j) => fit[j]).reduce((a, b) => a + b, 0)
    e = fc ? (fv / fc >= 0.5 ? 1 : 0) : total >= Math.ceil(n / 2) ? 1 : 0
  } else {
    let w = 0
    let sv = 0
    members.forEach((m, j) => {
      const wi = Math.max(0.01, Math.max(...active.map((r) => m.skill[r] ?? 0)) - 0.45)
      w += wi
      sv += wi * votes[j]
    })
    e = sv / w
  }
  return { e, votes: total, fit }
}

function curve(expo: readonly number[]): number[] {
  const eq = [1]
  for (let i = 0; i < N - 1; i++) eq.push(eq[i] * (1 + expo[i] * RET[i] - Math.abs(expo[i] - (i ? expo[i - 1] : 0)) * 0.0007))
  return eq
}

export function panelToday(panel: PanelSummary): PanelToday {
  const score = (ticker: string, m: PanelMember, tag: string) => {
    const r = rng(hash(ticker + m.id + tag))
    r()
    return r()
  }
  const rows: TodayRow[] = panel.assets
    .map((ticker): TodayRow => {
      const scores = panel.members.map((m) => score(ticker, m, 'now'))
      const flagged = scores.map((s) => s >= 0.55)
      const previous = panel.members.map((m) => (score(ticker, m, 'prev') >= 0.55 ? 1 : 0))
      const now = decide(panel, panel.members, flagged.map(Number), TODAY_CONDITIONS)
      const before = decide(panel, panel.members, previous, TODAY_CONDITIONS)
      return {
        ticker,
        flagged,
        scores: scores.map((s) => round(s, 3)),
        fits: now.fit,
        votes: now.votes,
        previousVotes: before.votes,
        exposure: now.e,
        changed: now.votes !== before.votes || now.e > 0 !== before.e > 0,
      }
    })
    .sort((a, b) => Number(b.changed) - Number(a.changed) || b.votes - a.votes)
  return {
    panelId: panel.id,
    asOf: DATES[N - 1],
    conditions: [
      { label: 'Volatility', value: 'High', detail: 'Flag on for 6 days' },
      { label: 'Market trend', value: 'Falling', detail: 'Below its 200-day average' },
      { label: 'Credit stress', value: 'Low', detail: 'Spreads normal' },
    ],
    activeConditions: TODAY_CONDITIONS,
    rows,
  }
}

function simulate(panel: PanelSummary) {
  const members = panel.members
  const pos = members.map(positions)
  const expo: number[] = []
  const votes: number[] = []
  const fits: number[] = []
  for (let i = 0; i < N; i++) {
    const d = decide(panel, members, pos.map((q) => q[i]), [REG[i]])
    expo.push(d.e)
    votes.push(d.votes)
    fits.push(d.fit.filter(Boolean).length)
  }
  return { members, pos, expo, votes, fits, eq: curve(expo) }
}

function corr(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((x, y) => x + y, 0) / N
  const mb = b.reduce((x, y) => x + y, 0) / N
  let sab = 0
  let sa = 0
  let sb = 0
  for (let t = 0; t < N; t++) {
    sab += (a[t] - ma) * (b[t] - mb)
    sa += (a[t] - ma) ** 2
    sb += (b[t] - mb) ** 2
  }
  return sa && sb ? sab / Math.sqrt(sa * sb) : 0
}

function fitRow(expo: readonly number[]): number[] {
  return CONDITIONS.map(([key]) => {
    let days = 0
    let sum = 0
    for (let t = 0; t < N; t++) {
      if (REG[t] === key) {
        days++
        sum += (expo[t] - 1) * RET[t]
      }
    }
    return days ? round((sum / days) * 21 * 100, 2) : 0
  })
}

export function panelEvidence(panel: PanelSummary): PanelEvidence {
  const sim = simulate(panel)
  const n = sim.members.length
  const k = Math.min(panel.agreementNeeded, n)
  const singles = sim.members.map((m, j) => ({ m, eq: curve(sim.pos[j]), pos: sim.pos[j] }))
  const best = [...singles].sort((a, b) => stats(b.eq).ret - stats(a.eq).ret)[0]
  const exposure = (e: readonly number[]) => e.reduce((a, b) => a + b, 0) / N
  const changes = (e: readonly number[]) => e.slice(1).filter((v, i) => v !== e[i]).length

  const rows = [
    { name: 'Panel', eq: sim.eq, e: sim.expo },
    ...singles.map((s) => ({ name: s.m.name, eq: s.eq, e: s.pos })),
  ].map((r) => ({ name: r.name, returnAfterCosts: stats(r.eq).ret, worstFall: stats(r.eq).dd, invested: exposure(r.e), positionChanges: changes(r.e) }))

  const CUT = 168
  const seg = (eq: readonly number[], a: number, b: number) => stats(eq.slice(a, b).map((x) => x / eq[a]))
  const entries = [{ name: 'Panel', eq: sim.eq, isPanel: true }, ...singles.map((s) => ({ name: s.m.name, eq: s.eq, isPanel: false }))].map((e) => ({ ...e, a: seg(e.eq, 0, CUT), b: seg(e.eq, CUT, N) }))
  const place = (key: 'a' | 'b', e: (typeof entries)[number]) => [...entries].sort((x, y) => y[key].ret - x[key].ret).indexOf(e) + 1
  let up = 0
  let counted = 0
  for (let i = CUT; i < N - 5; i++) {
    if (sim.votes[i] >= k) {
      let f = 0
      for (let j = 1; j <= 5; j++) f += RET[i + j - 1]
      counted++
      if (f > 0) up++
    }
  }

  const agreement: AgreementBucket[] = []
  for (let v = 0; v <= n; v++) {
    let c = 0
    let upDays = 0
    let tot = 0
    for (let i = 0; i < N - 5; i++) {
      if (sim.votes[i] === v) {
        let f = 0
        for (let j = 1; j <= 5; j++) f += RET[i + j - 1]
        c++
        tot += f
        if (f > 0) upDays++
      }
    }
    agreement.push({ votes: v, days: c, averageMove: c ? tot / c : null, hitRate: c ? upDays / c : null })
  }

  const cm = sim.pos.map((a) => sim.pos.map((b) => round(corr(a, b), 3)))
  const off: number[] = []
  for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) off.push(cm[x][y])
  const rho = off.length ? off.reduce((a, b) => a + b, 0) / off.length : 0
  const conditions: ConditionInfo[] = CONDITIONS.map(([key, label]) => ({ key, label, days: CONDITION_DAYS[key] ?? 0 }))

  return {
    panelId: panel.id,
    series: { dates: DATES, panel: sim.eq, best: best.eq, benchmark: BENCH },
    rows,
    heldOut: {
      chosenOnFrom: DATES[0],
      chosenOnTo: DATES[CUT - 1],
      days: N - CUT,
      agreementHitRate: counted >= 8 ? up / counted : null,
      agreementDays: counted,
      rows: entries.map((e) => ({ name: e.name, chosenOnReturn: e.a.ret, chosenOnPlace: place('a', e), heldOutReturn: e.b.ret, heldOutPlace: place('b', e), heldOutWorstFall: e.b.dd, isPanel: e.isPanel })),
    },
    agreement,
    conditions,
    fit: { panel: fitRow(sim.expo), models: singles.map((s) => ({ name: s.m.name, pointsPerMonth: fitRow(s.pos) })) },
    independentOpinions: round(n / (1 + (n - 1) * Math.max(0, rho)), 1),
    correlations: cm,
  }
}

const ALERT_KEYS: readonly PanelAlertKey[] = ['reached', 'flip', 'collapse', 'spec', 'blind']

function replay(panel: PanelSummary, kind: PanelAlertKey): AlertReplay {
  const sim = simulate(panel)
  const n = sim.members.length
  const k = Math.min(panel.agreementNeeded, n)
  const hold = panel.holdDays
  const sig = (t: number) => sim.members.map((m) => ((m.skill[REG[t]] ?? 0) >= 0.55 ? 1 : 0)).join('')
  const cond = (t: number) => (kind === 'reached' ? sim.votes[t] >= k : kind === 'flip' ? sim.expo[t] > 0 : kind === 'collapse' ? sim.votes[t] <= Math.max(0, n - k) : kind === 'blind' ? sim.fits[t] === 0 : false)
  const events: { index: number; moveAfter: number }[] = []
  let last = -999
  for (let i = 0; i < N - 10; i++) {
    let fire = false
    if (kind === 'spec') {
      let held = true
      for (let j = 0; j < hold; j++) if (i - j < 0 || sig(i - j) !== sig(i)) held = false
      fire = held && i - hold >= 0 && sig(i - hold) !== sig(i)
    } else {
      let h = true
      for (let j = 0; j < hold; j++) if (i - j < 0 || !cond(i - j)) h = false
      fire = h && !(i - hold >= 0 && cond(i - hold))
    }
    if (fire && i - last >= panel.quietDays) {
      let f = 0
      for (let j = 1; j <= 10; j++) f += RET[i + j - 1]
      events.push({ index: i, moveAfter: f })
      last = i
    }
  }
  const weeks: Record<number, number> = {}
  const kept = events.filter((e) => {
    const w = Math.floor(e.index / 5)
    weeks[w] = (weeks[w] ?? 0) + 1
    return weeks[w] <= panel.weeklyCap
  })
  return { key: kind, dates: DATES, market: BENCH, events: kept, perMonth: kept.length / 12, droppedByCap: events.length - kept.length }
}

export function panelAlerts(panel: PanelSummary): PanelAlerts {
  return { panelId: panel.id, replays: ALERT_KEYS.map((key) => replay(panel, key)) }
}

export const BENCH_RETURN = BENCH_STATS.ret
