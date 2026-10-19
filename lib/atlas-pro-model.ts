/**
 * The atlas's Pro and history answers (`/v1/atlas/weeks`, `/movement`, `/themes`,
 * `/influence`, `/compare`, `/test`), read as defensively as the map itself: a
 * malformed entry is dropped, a missing number stays `null`, nothing is invented.
 * Themes are for every signed-in reader; the rest answers Pro readers only.
 */
import { parseAccess, parseNodes, type AtlasAccess, type AtlasNode, type AtlasPoint } from './atlas-model'

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function whole(value: unknown): number | null {
  const number = finite(value)
  return number === null ? null : Math.max(0, Math.round(number))
}

function correlation(value: unknown): number | null {
  const number = finite(value)
  return number !== null && number >= -1 && number <= 1 ? number : null
}

function symbols(value: unknown): string[] {
  return [...new Set(list(value).map(text).filter((symbol): symbol is string => symbol !== null))]
}

/** A point as the backend writes it (`{x, y}`) or as a local route passes it on (`[x, y]`). */
function point(value: unknown): AtlasPoint | null {
  if (Array.isArray(value)) {
    const [x, y] = value.map(finite)
    return value.length === 2 && x !== null && y !== null ? [x, y] : null
  }
  const raw = record(value)
  const x = finite(raw?.x)
  const y = finite(raw?.y)
  return x === null || y === null ? null : [x, y]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function date(value: unknown): string | null {
  const day = text(value)
  return day && DATE.test(day) ? day : null
}

// ------------------------------------------------------------------ weeks

export type AtlasCohesionPoint = { asOf: string; value: number | null }

export type AtlasWeeks = {
  access: AtlasAccess | null
  /** Newest first: `weeks[0]` is the map on screen, `weeks[k]` is k weeks earlier. */
  weeks: string[]
  /** The week's average total correlation, oldest first, one per week (null when not computed). */
  cohesion: AtlasCohesionPoint[]
}

export function parseWeeks(value: unknown): AtlasWeeks | null {
  const raw = record(value)
  if (!raw) return null
  const weeks = [...new Set(list(raw.weeks).map(date).filter((week): week is string => week !== null))].sort().reverse()
  if (!weeks.length) return null
  const byWeek = new Map<string, number | null>()
  for (const entry of list(raw.cohesion)) {
    const item = record(entry)
    const asOf = date(item?.asOf)
    if (asOf) byWeek.set(asOf, correlation(item?.value))
  }
  return {
    access: parseAccess(raw.access),
    weeks,
    cohesion: [...weeks].reverse().map((asOf) => ({ asOf, value: byWeek.get(asOf) ?? null })),
  }
}

// ------------------------------------------------------------------ movement

export type AtlasMove = {
  symbol: string
  fromZoneId: string
  toZoneId: string
  /** The past position, aligned to the newer week's map; null when the backend did not align it. */
  from: AtlasPoint | null
  /** Aligned distance against the median nearest-neighbour gap of the newer week. */
  move: number | null
  /** Weight in the new main region now, less then. */
  shareGain: number | null
  tiesIn: string[]
  tiesOut: string[]
  /** Changed main region, gained at least 35 points there and replaced at least 3 of its 5 strongest ties. */
  flow: boolean
}

export type AtlasFlow = { fromZoneId: string; toZoneId: string; symbols: string[]; from: AtlasPoint; to: AtlasPoint }

export type AtlasMovement = {
  from: string
  to: string
  comparedCount: number
  /** The median move: what every company drifts between two snapshots. */
  noise: number | null
  moves: AtlasMove[]
  /** Groups of at least two companies that moved between the same two regions, largest first. */
  flows: AtlasFlow[]
}

export function parseMovement(value: unknown): AtlasMovement | null {
  const raw = record(value)
  const from = date(raw?.from)
  const to = date(raw?.to)
  if (!raw || !from || !to) return null
  const moves: AtlasMove[] = []
  const seen = new Set<string>()
  for (const entry of list(raw.moves)) {
    const item = record(entry)
    const symbol = text(item?.symbol)
    const fromZoneId = text(item?.fromZoneId)
    const toZoneId = text(item?.toZoneId)
    if (!item || !symbol || !fromZoneId || !toZoneId || seen.has(symbol)) continue
    seen.add(symbol)
    const fx = finite(item.fromX)
    const fy = finite(item.fromY)
    const move = finite(item.move)
    moves.push({
      symbol,
      fromZoneId,
      toZoneId,
      from: fx === null || fy === null ? point(item.from) : [fx, fy],
      move: move === null || move < 0 ? null : move,
      shareGain: correlation(item.shareGain),
      tiesIn: symbols(item.tiesIn).slice(0, 5),
      tiesOut: symbols(item.tiesOut).slice(0, 5),
      flow: item.flow === true,
    })
  }
  const flows: AtlasFlow[] = []
  for (const entry of list(raw.flows)) {
    const item = record(entry)
    const fromZoneId = text(item?.fromZoneId)
    const toZoneId = text(item?.toZoneId)
    const start = point(item?.from)
    const end = point(item?.to)
    const members = symbols(item?.symbols)
    // a single company is not a movement of the market: it stays in its own panel
    if (!fromZoneId || !toZoneId || fromZoneId === toZoneId || !start || !end || members.length < 2) continue
    flows.push({ fromZoneId, toZoneId, symbols: members, from: start, to: end })
  }
  flows.sort((a, b) => b.symbols.length - a.symbols.length || (a.fromZoneId + a.toZoneId).localeCompare(b.fromZoneId + b.toZoneId))
  const noise = finite(raw.noise)
  return { from, to, comparedCount: whole(raw.comparedCount) ?? moves.length, noise: noise !== null && noise > 0 ? noise : null, moves, flows }
}

// ------------------------------------------------------------------ themes

export type AtlasThemeVerdict = 'together' | 'loose' | 'apart'
export type AtlasThemeRegion = { zoneId: string; label: string | null; share: number }

export type AtlasTheme = {
  themeId: string
  label: string
  memberCount: number
  cohesion: number | null
  typicalCohesion: number | null
  verdict: AtlasThemeVerdict | null
  regions: AtlasThemeRegion[]
}

export type AtlasThemeDetail = AtlasTheme & { members: AtlasNode[] }

const VERDICTS: readonly AtlasThemeVerdict[] = ['together', 'loose', 'apart']

function parseTheme(value: unknown): AtlasTheme | null {
  const raw = record(value)
  const themeId = text(raw?.themeId)
  if (!raw || !themeId) return null
  const regions: AtlasThemeRegion[] = []
  for (const entry of list(raw.regions)) {
    const item = record(entry)
    const zoneId = text(item?.zoneId)
    const share = finite(item?.share)
    if (!zoneId || share === null || share <= 0 || share > 1 || regions.some((region) => region.zoneId === zoneId)) continue
    regions.push({ zoneId, label: text(item?.label), share })
  }
  return {
    themeId,
    label: text(raw.label) ?? themeId,
    memberCount: whole(raw.memberCount) ?? 0,
    cohesion: correlation(raw.cohesion),
    typicalCohesion: correlation(raw.typicalCohesion),
    verdict: VERDICTS.includes(raw.verdict as AtlasThemeVerdict) ? (raw.verdict as AtlasThemeVerdict) : null,
    regions: regions.sort((a, b) => b.share - a.share).slice(0, 3),
  }
}

export function parseThemes(value: unknown): AtlasTheme[] | null {
  // the backend's `{ themes: [...] }`, or the list itself as a local route passes it on
  const entries = Array.isArray(value) ? value : record(value)?.themes
  if (!Array.isArray(entries)) return null
  const themes: AtlasTheme[] = []
  for (const theme of entries.map(parseTheme)) if (theme && !themes.some((other) => other.themeId === theme.themeId)) themes.push(theme)
  return themes
}

export function parseThemeDetail(value: unknown): AtlasThemeDetail | null {
  const raw = record(value)
  const theme = parseTheme(record(raw?.theme) ?? raw)
  if (!raw || !theme) return null
  return { ...theme, members: parseNodes(list(raw.members)) }
}

// ------------------------------------------------------------------ influence

export type AtlasBasket = { basket: string; label: string; zoneId: string | null; members: string[] }
export type AtlasInfluenceArrow = {
  from: AtlasBasket
  to: AtlasBasket
  sign: 1 | -1
  t: number
  reportDays: number
  h1: number | null
  h2: number | null
  isNew: boolean
}
export type AtlasInfluenceReason = 'needs_two_years' | 'no_report_dates'
export type AtlasInfluence = { asOf: string | null; tested: boolean; reason: AtlasInfluenceReason | null; arrows: AtlasInfluenceArrow[] }

function parseBasket(value: unknown): AtlasBasket | null {
  const raw = record(value)
  const basket = text(raw?.basket)
  if (!raw || !basket) return null
  return { basket, label: text(raw.label) ?? basket, zoneId: text(raw.zoneId), members: symbols(raw.members) }
}

export function parseInfluence(value: unknown): AtlasInfluence | null {
  const raw = record(value)
  if (!raw) return null
  const tested = raw.tested === true
  const reason = raw.reason === 'needs_two_years' || raw.reason === 'no_report_dates' ? raw.reason : null
  const arrows: AtlasInfluenceArrow[] = []
  if (tested) {
    for (const entry of list(raw.arrows)) {
      const item = record(entry)
      const from = parseBasket(item?.from)
      const to = parseBasket(item?.to)
      const t = finite(item?.t)
      const sign = finite(item?.sign)
      if (!item || !from || !to || t === null || sign === null || sign === 0 || from.basket === to.basket) continue
      arrows.push({ from, to, sign: sign < 0 ? -1 : 1, t, reportDays: whole(item.reportDays) ?? 0, h1: finite(item.h1), h2: finite(item.h2), isNew: item.isNew === true })
    }
  }
  return { asOf: date(raw.asOf), tested, reason: tested ? null : reason, arrows }
}

// ------------------------------------------------------------------ compare and test

export type AtlasSetSummary = { label: string; count: number }
export type AtlasCompare = {
  a: AtlasSetSummary
  b: AtlasSetSummary
  /** Correlation of the two sets' average daily move beyond the market, 63-session windows, oldest first. */
  series: Array<{ asOf: string | null; value: number }>
  year: number | null
  firstHalf: number | null
  secondHalf: number | null
  last3Months: number | null
}

function summary(value: unknown): AtlasSetSummary | null {
  const raw = record(value)
  const count = whole(raw?.count)
  return raw && count !== null ? { label: text(raw.label) ?? '', count } : null
}

export function parseCompare(value: unknown): AtlasCompare | null {
  const raw = record(value)
  const a = summary(raw?.a)
  const b = summary(raw?.b)
  if (!raw || !a || !b) return null
  const series = list(raw.series)
    .map((entry) => {
      const item = record(entry)
      const number = correlation(item?.value)
      return number === null ? null : { asOf: date(item?.asOf), value: number }
    })
    .filter((item): item is { asOf: string | null; value: number } => item !== null)
  return { a, b, series, year: correlation(raw.year), firstHalf: correlation(raw.firstHalf), secondHalf: correlation(raw.secondHalf), last3Months: correlation(raw.last3Months) }
}

export type AtlasTestValue = { value: number | null; pass: boolean | null }
export type AtlasTest =
  | { available: false; reason: string | null }
  | {
      available: true
      reportDays: AtlasTestValue
      sameDayT: AtlasTestValue
      direction: 'up' | 'down' | null
      permutationP: AtlasTestValue
      threshold: number | null
      reverseP: AtlasTestValue
      firstHalfT: AtlasTestValue
      secondHalfT: AtlasTestValue
      placeboT: AtlasTestValue
      fromCount: number | null
      toCount: number | null
    }

/** A row arrives as a number with a `<name>Pass` flag beside it, or as `{ value, pass }`. */
function testValue(raw: Raw, name: string): AtlasTestValue {
  const nested = record(raw[name])
  const value = nested ? finite(nested.value) : finite(raw[name])
  const pass = nested && typeof nested.pass === 'boolean' ? nested.pass : typeof raw[`${name}Pass`] === 'boolean' ? (raw[`${name}Pass`] as boolean) : null
  return { value, pass }
}

export function parseTest(value: unknown): AtlasTest | null {
  const raw = record(value)
  if (!raw) return null
  if (raw.available === false) return { available: false, reason: text(raw.reason) }
  const result = {
    available: true as const,
    reportDays: testValue(raw, 'reportDays'),
    sameDayT: testValue(raw, 'sameDayT'),
    direction: raw.direction === 'up' ? ('up' as const) : raw.direction === 'down' ? ('down' as const) : null,
    permutationP: testValue(raw, 'permutationP'),
    threshold: finite(raw.threshold),
    reverseP: testValue(raw, 'reverseP'),
    firstHalfT: testValue(raw, 'firstHalfT'),
    secondHalfT: testValue(raw, 'secondHalfT'),
    placeboT: testValue(raw, 'placeboT'),
    fromCount: whole(record(raw.from)?.count ?? raw.fromCount),
    toCount: whole(record(raw.to)?.count ?? raw.toCount),
  }
  return result.reportDays.value === null && result.sameDayT.value === null ? null : result
}

// ------------------------------------------------------------------ sets

/** The most companies one set may name, as the backend accepts. */
export const ATLAS_SET_LIMIT = 200
const SET_SYMBOL = /^[A-Z0-9][A-Z0-9.\-^=]{0,23}$/
const SET_ZONE = /^[A-Za-z0-9][A-Za-z0-9_.:\-]{0,79}$/

/** A set as the backend reads it: `zone:<id>`, `group:<SYM,SYM,…>` or a ticker; null when malformed. */
export function atlasSetKey(value: string | null | undefined): string | null {
  const key = (value ?? '').trim()
  if (key.startsWith('zone:')) return SET_ZONE.test(key.slice(5)) ? key : null
  if (key.startsWith('group:')) {
    const members = [...new Set(key.slice(6).split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))]
    return members.length && members.length <= ATLAS_SET_LIMIT && members.every((symbol) => SET_SYMBOL.test(symbol)) ? `group:${members.join(',')}` : null
  }
  const symbol = key.toUpperCase()
  return SET_SYMBOL.test(symbol) ? symbol : null
}
