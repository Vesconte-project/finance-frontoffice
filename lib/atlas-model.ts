/**
 * The weekly relationship atlas as the backend serves it (`/v1/atlas*`), read
 * defensively: a malformed entry is dropped, never invented, and a payload that
 * is not an atlas at all reads as `null`.
 *
 * What a reader receives depends on their tier (backend rule 7):
 * - signed out: zones in their true place with a circle, companies at levels 0–1
 *   placed schematically, and only tie counts between zones;
 * - free (signed in): the real map of the newest week;
 * - Pro: the same with history and movement (not registered yet: nobody is Pro).
 */

export type AtlasTier = 'signedOut' | 'free' | 'pro'
export type AtlasDenial = 'sign_in_required' | 'pro_required' | 'history_unavailable'

export type AtlasAccess = {
  tier: AtlasTier
  maxLevel: number
  historyWeeks: number
  lines: boolean
  bundleTies: boolean
  truePositions: boolean
  movement: boolean
}

export type AtlasPoint = [number, number]
export type AtlasContour =
  | { type: 'circle'; x: number; y: number; radius: number }
  | { type: 'rings'; coverage: number; rings: AtlasPoint[][] }

export type AtlasZone = {
  zoneId: string
  label: string
  memberCount: number
  /** Where the label sits: the given centre, or the middle of the largest ring. */
  x: number | null
  y: number | null
  contour: AtlasContour | null
  leaders: string[]
}

export type AtlasNode = {
  symbol: string
  name: string | null
  zoneId: string
  x: number
  y: number
  level: number
  /** 0 (largest) to 3, in four steps of market value. */
  size: number
  /** Ball radius in the prototype's map units (0.06–0.28): continuous in market value, else from the step. */
  bulk: number
  /** Signed in only: how many companies move with it beyond the market (the "Most connected" order). */
  reach: number | null
  /** Signed in only: its reach against the strongest company in its region, 0–1; it sinks the ground. */
  well: number | null
  /** Signed in only: no tie clearly above the market's average, so it moves on its own. */
  loner: boolean
  /** Signed in only: its regions by share of its strongest ties, largest first; the ring of a ball between regions. */
  memberships: AtlasShare[]
}

export type AtlasShare = { zoneId: string; share: number }

export type AtlasLine = { source: string; target: string; zoneId: string; correlation: number | null }
export type AtlasTie = { source: string; target: string; correlation: number | null }
export type AtlasBundle = { zoneA: string; zoneB: string; tieCount: number; structural: boolean; ties: AtlasTie[] }

export type AtlasComparison = 'higher' | 'lower' | 'usual'
/** Signed in only: the week's average correlation beyond the market, against the last year's weeks. */
export type AtlasMarketCorrelation = { value: number; comparedWithLastYear: AtlasComparison | null; weeksCompared: number }

export type AtlasOverview = {
  asOf: string
  companyCount: number
  zoneCount: number
  access: AtlasAccess
  level: number
  zones: AtlasZone[]
  nodes: AtlasNode[]
  lines: AtlasLine[]
  bundles: AtlasBundle[]
  marketCorrelation: AtlasMarketCorrelation | null
}

export type AtlasCompanyRef = { symbol: string; name: string | null }
export type AtlasNeighbour = AtlasCompanyRef & { zoneId: string | null; correlation: number }
export type AtlasMembership = { zoneId: string; label: string | null; share: number }

export type AtlasCompanyPanel = {
  asOf: string
  access: AtlasAccess
  symbol: string
  name: string | null
  sector: string | null
  industry: string | null
  country: string | null
  zoneId: string
  zoneLabel: string | null
  /** Signed out: the zone's fixed leaders. Signed in: empty, the neighbours say more. */
  zoneLeaders: AtlasCompanyRef[]
  memberships: AtlasMembership[]
  neighbours: AtlasNeighbour[]
  marketCap: number | null
}

export type AtlasZoneMember = AtlasCompanyRef & { share: number | null; marketCap: number | null }

export type AtlasZonePanel = {
  asOf: string
  access: AtlasAccess
  zoneId: string
  label: string
  memberCount: number
  leaders: AtlasCompanyRef[]
  /** Signed in only: the whole zone. */
  members: AtlasZoneMember[]
}

export const SIZE_STEPS = 4
export const ATLAS_MAX_LEVEL = 3
const TIERS: readonly AtlasTier[] = ['signedOut', 'free', 'pro']
const DENIALS: readonly AtlasDenial[] = ['sign_in_required', 'pro_required', 'history_unavailable']

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

function positive(value: unknown): number | null {
  const number = finite(value)
  return number !== null && number > 0 ? number : null
}

function correlation(value: unknown): number | null {
  const number = finite(value)
  return number !== null && number >= -1 && number <= 1 ? number : null
}

function whole(value: unknown, fallback = 0): number {
  const number = finite(value)
  return number === null ? fallback : Math.max(0, Math.round(number))
}

export function atlasDenial(value: unknown): AtlasDenial | null {
  const detail = record(value)?.detail
  return DENIALS.includes(detail as AtlasDenial) ? (detail as AtlasDenial) : null
}

export function parseAccess(value: unknown): AtlasAccess | null {
  const raw = record(value)
  if (!raw || !TIERS.includes(raw.tier as AtlasTier)) return null
  return {
    tier: raw.tier as AtlasTier,
    maxLevel: Math.min(ATLAS_MAX_LEVEL, whole(raw.maxLevel, 1)),
    historyWeeks: whole(raw.historyWeeks),
    lines: raw.lines === true,
    bundleTies: raw.bundleTies === true,
    truePositions: raw.truePositions === true,
    movement: raw.movement === true,
  }
}

function parsePoint(value: unknown): AtlasPoint | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [x, y] = value.map(finite)
  return x === null || y === null ? null : [x, y]
}

export function parseContour(value: unknown): AtlasContour | null {
  const raw = record(value)
  if (!raw) return null
  if (raw.type === 'circle') {
    const x = finite(raw.x)
    const y = finite(raw.y)
    const radius = finite(raw.radius)
    return x === null || y === null || radius === null || radius <= 0 ? null : { type: 'circle', x, y, radius }
  }
  if (raw.type === 'rings') {
    const rings = list(raw.rings)
      .map((ring) => list(ring).map(parsePoint).filter((point): point is AtlasPoint => point !== null))
      .filter((ring) => ring.length >= 3)
    return rings.length ? { type: 'rings', coverage: finite(raw.coverage) ?? 0.8, rings } : null
  }
  return null
}

/** Signed area of a ring (shoelace); its absolute value ranks rings by size. */
export function ringArea(ring: AtlasPoint[]): number {
  let area = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [ax, ay] = ring[i]
    const [bx, by] = ring[(i + 1) % ring.length]
    area += ax * by - bx * ay
  }
  return area / 2
}

/** Where a zone's label goes: its given centre, or the centroid of its largest ring. */
export function contourAnchor(contour: AtlasContour | null): AtlasPoint | null {
  if (!contour) return null
  if (contour.type === 'circle') return [contour.x, contour.y]
  const ring = [...contour.rings].sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]
  const sum = ring.reduce<AtlasPoint>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [sum[0] / ring.length, sum[1] / ring.length]
}

function parseZone(value: unknown): AtlasZone | null {
  const raw = record(value)
  const zoneId = text(raw?.zoneId)
  if (!raw || !zoneId) return null
  const contour = parseContour(raw.contour)
  const x = finite(raw.x)
  const y = finite(raw.y)
  const anchor = x !== null && y !== null ? ([x, y] as AtlasPoint) : contourAnchor(contour)
  return {
    zoneId,
    label: text(raw.label) ?? 'Unlabelled',
    memberCount: whole(raw.memberCount),
    x: anchor ? anchor[0] : null,
    y: anchor ? anchor[1] : null,
    contour,
    leaders: list(raw.leaders).map(text).filter((symbol): symbol is string => symbol !== null),
  }
}

/** Market value at which a company moves up a size step, largest first. */
export const CAP_STEPS = [200e9, 50e9, 10e9] as const

/** A size step from a market value, so a company keeps its size whichever area it was loaded with. */
export function capStep(marketCap: number): number {
  const step = CAP_STEPS.findIndex((threshold) => marketCap >= threshold)
  return step === -1 ? SIZE_STEPS - 1 : step
}

/** Log market value at which a ball is largest; above it every ball is the same size. */
const CAP_TOP = Math.log1p(4e12 / 1e6)
/** Market value a size step stands for when only the step arrives (signed out, or no value). */
const STEP_CAPS = [...CAP_STEPS, 3e9]

/**
 * A ball's radius from its market value, as the approved prototype draws it: log value against the
 * largest, small companies all at the floor. A fixed top keeps a company's size whichever area loaded it.
 */
export function capBulk(marketCap: number): number {
  const norm = Math.min(1, Math.log1p(Math.max(0, marketCap) / 1e6) / CAP_TOP)
  return 0.06 + 0.22 * Math.pow(Math.max(0, Math.min(1, (norm - 0.35) / 0.65)), 1.4)
}

function parseShares(value: unknown): AtlasShare[] {
  const shares: AtlasShare[] = []
  for (const raw of list(value).map(record)) {
    const zoneId = text(raw?.zoneId)
    const share = finite(raw?.share)
    if (!zoneId || share === null || share <= 0 || share > 1 || shares.some((item) => item.zoneId === zoneId)) continue
    shares.push({ zoneId, share })
  }
  return shares.sort((a, b) => b.share - a.share)
}

/** Four size steps by rank, largest first: the same cut the backend uses signed out. */
export function sizeSteps(values: Map<string, number>): Map<string, number> {
  const ranked = [...values.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return new Map(ranked.map(([symbol], rank) => [symbol, Math.min(SIZE_STEPS - 1, Math.floor((rank * SIZE_STEPS) / Math.max(1, ranked.length)))]))
}

function parseNodes(values: unknown[]): AtlasNode[] {
  type Valid = { raw: Raw; symbol: string; zoneId: string; x: number; y: number }
  const valid: Valid[] = []
  const seen = new Set<string>()
  for (const raw of values.map(record)) {
    const symbol = text(raw?.symbol)
    const zoneId = text(raw?.zoneId)
    const x = finite(raw?.x)
    const y = finite(raw?.y)
    if (!raw || !symbol || !zoneId || x === null || y === null || seen.has(symbol)) continue
    seen.add(symbol)
    valid.push({ raw, symbol, zoneId, x, y })
  }
  // Size is market value: signed out the backend sends the step itself; signed in it comes from the value,
  // and a company without one is ranked by importance among the others without one.
  const importance = new Map<string, number>()
  for (const { raw, symbol } of valid) {
    const value = finite(raw.importance)
    if (value !== null && finite(raw.size) === null && !positive(raw.marketCap)) importance.set(symbol, value)
  }
  const steps = sizeSteps(importance)
  return valid.map(({ raw, symbol, zoneId, x, y }) => {
    const size = finite(raw.size)
    const cap = positive(raw.marketCap)
    const well = finite(raw.well)
    const step = Math.min(SIZE_STEPS - 1, size !== null ? whole(size) : cap !== null ? capStep(cap) : steps.get(symbol) ?? SIZE_STEPS - 1)
    return {
      symbol,
      name: text(raw.name),
      zoneId,
      x,
      y,
      level: Math.min(ATLAS_MAX_LEVEL, whole(raw.level)),
      size: step,
      bulk: capBulk(size === null && cap !== null ? cap : STEP_CAPS[step]),
      reach: finite(raw.reach),
      well: well === null ? null : Math.max(0, Math.min(1, well)),
      loner: raw.loner === true,
      memberships: parseShares(raw.memberships),
    }
  })
}

function parseTie(value: unknown): AtlasTie | null {
  const raw = record(value)
  const source = text(raw?.source)
  const target = text(raw?.target)
  return source && target ? { source, target, correlation: correlation(raw?.correlation) } : null
}

const COMPARISONS: readonly AtlasComparison[] = ['higher', 'lower', 'usual']

export function parseMarketCorrelation(value: unknown): AtlasMarketCorrelation | null {
  const raw = record(value)
  const number = correlation(raw?.value)
  if (!raw || number === null) return null
  const compared = COMPARISONS.includes(raw.comparedWithLastYear as AtlasComparison) ? (raw.comparedWithLastYear as AtlasComparison) : null
  return { value: number, comparedWithLastYear: compared, weeksCompared: whole(raw.weeksCompared) }
}

export function parseOverview(value: unknown): AtlasOverview | null {
  const raw = record(value)
  const access = parseAccess(raw?.access)
  const asOf = text(raw?.asOf)
  if (!raw || !access || !asOf) return null
  const zones = list(raw.zones).map(parseZone).filter((zone): zone is AtlasZone => zone !== null)
  const zoneIds = new Set(zones.map((zone) => zone.zoneId))
  const nodes = parseNodes(list(raw.nodes)).filter((node) => zoneIds.has(node.zoneId))
  const symbols = new Set(nodes.map((node) => node.symbol))
  return {
    asOf,
    companyCount: whole(raw.companyCount),
    zoneCount: whole(raw.zoneCount, zones.length),
    access,
    level: Math.min(ATLAS_MAX_LEVEL, whole(raw.level)),
    zones,
    nodes,
    lines: list(raw.skeleton)
      .map((entry) => {
        const tie = parseTie(entry)
        const zoneId = text(record(entry)?.zoneId)
        return tie && zoneId && symbols.has(tie.source) && symbols.has(tie.target) ? { ...tie, zoneId } : null
      })
      .filter((line): line is AtlasLine => line !== null),
    bundles: list(raw.bundles)
      .map((entry) => {
        const bundle = record(entry)
        const zoneA = text(bundle?.zoneA)
        const zoneB = text(bundle?.zoneB)
        if (!bundle || !zoneA || !zoneB || !zoneIds.has(zoneA) || !zoneIds.has(zoneB)) return null
        return {
          zoneA,
          zoneB,
          tieCount: whole(bundle.tieCount),
          structural: bundle.structural === true,
          ties: list(bundle.ties).map(parseTie).filter((tie): tie is AtlasTie => tie !== null),
        }
      })
      .filter((bundle): bundle is AtlasBundle => bundle !== null && bundle.tieCount > 0),
    marketCorrelation: parseMarketCorrelation(raw.marketCorrelation),
  }
}

function parseRef(value: unknown): AtlasCompanyRef | null {
  const raw = record(value)
  const symbol = text(raw?.symbol)
  return symbol ? { symbol, name: text(raw?.name) } : null
}

function refs(value: unknown): AtlasCompanyRef[] {
  return list(value).map(parseRef).filter((ref): ref is AtlasCompanyRef => ref !== null)
}

export function parseCompanyPanel(value: unknown): AtlasCompanyPanel | null {
  const raw = record(value)
  const access = parseAccess(raw?.access)
  const symbol = text(raw?.symbol)
  const zoneId = text(raw?.zoneId)
  const asOf = text(raw?.asOf)
  if (!raw || !access || !symbol || !zoneId || !asOf) return null
  return {
    asOf,
    access,
    symbol,
    name: text(raw.name),
    sector: text(raw.sector),
    industry: text(raw.industry),
    country: text(raw.country),
    zoneId,
    zoneLabel: text(raw.zoneLabel),
    zoneLeaders: refs(raw.zoneLeaders),
    memberships: list(raw.memberships)
      .map((entry) => {
        const item = record(entry)
        const id = text(item?.zoneId)
        const share = finite(item?.share)
        return id && share !== null ? { zoneId: id, label: text(item?.label), share } : null
      })
      .filter((item): item is AtlasMembership => item !== null),
    neighbours: list(raw.neighbours)
      .map((entry) => {
        const ref = parseRef(entry)
        const correlation = finite(record(entry)?.correlation)
        return ref && correlation !== null ? { ...ref, zoneId: text(record(entry)?.zoneId), correlation } : null
      })
      .filter((item): item is AtlasNeighbour => item !== null),
    marketCap: finite(raw.marketCap),
  }
}

export function parseZonePanel(value: unknown): AtlasZonePanel | null {
  const raw = record(value)
  const access = parseAccess(raw?.access)
  const zoneId = text(raw?.zoneId)
  const asOf = text(raw?.asOf)
  if (!raw || !access || !zoneId || !asOf) return null
  return {
    asOf,
    access,
    zoneId,
    label: text(raw.label) ?? 'Unlabelled',
    memberCount: whole(raw.memberCount),
    leaders: refs(raw.leaders),
    members: list(raw.members)
      .map((entry) => {
        const ref = parseRef(entry)
        const item = record(entry)
        return ref ? { ...ref, share: finite(item?.share), marketCap: finite(item?.marketCap) } : null
      })
      .filter((item): item is AtlasZoneMember => item !== null),
  }
}

/** The local route for an overview; signed-out readers never send a level above 1 or an area. */
export function atlasOverviewPath(level: number, bbox?: [number, number, number, number] | null): string {
  const params = new URLSearchParams({ level: String(Math.max(0, Math.min(ATLAS_MAX_LEVEL, Math.round(level)))) })
  if (bbox) params.set('bbox', bbox.map((value) => value.toFixed(3)).join(','))
  return `/api/atlas?${params.toString()}`
}

export const ATLAS_SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.\-^=]{0,23}$/

export function atlasSymbol(value: string | null | undefined): string | null {
  const symbol = (value ?? '').trim().toUpperCase()
  return ATLAS_SYMBOL_PATTERN.test(symbol) ? symbol : null
}

export const ATLAS_ZONE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:\-]{0,79}$/

export function atlasZoneId(value: string | null | undefined): string | null {
  const zone = (value ?? '').trim()
  return ATLAS_ZONE_PATTERN.test(zone) ? zone : null
}
