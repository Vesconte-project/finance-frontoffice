export type ScorecardAxisKey = 'value' | 'potential' | 'health' | 'income' | 'momentum'
export type ScorecardReadiness =
  | 'ready'
  | 'pending_build'
  | 'unavailable_missing_inputs'
  | 'not_tracked'
  | 'error'

export type ScorecardBuildReadiness = 'full' | 'partial' | 'unknown'

export type ScorecardOverall = {
  score: number | null
  grade: string
  label: string
}

export type ScorecardAxis = {
  key: ScorecardAxisKey
  label: string
  score: number | null
  available: boolean
  hint?: string | null
}

export type Scorecard = {
  asOf: string | null
  readiness: ScorecardReadiness
  buildStatus: string | null
  missingInputs: string[]
  materializationReadiness: string | null
  buildReadiness: ScorecardBuildReadiness
  buildMissingInputs: string[]
  coverageState: string | null
  hasPrices: boolean | null
  hasTechnicals: boolean | null
  hasScorecard: boolean | null
  registryStatus: string | null
  validationStatus: string | null
  promotionStatus: string | null
  overall: ScorecardOverall
  axes: ScorecardAxis[]
}

export const SCORECARD_AXIS_ORDER: ScorecardAxisKey[] = [
  'value',
  'potential',
  'health',
  'income',
  'momentum',
]

export const SCORECARD_AXIS_LABELS: Record<ScorecardAxisKey, string> = {
  value: 'Value',
  potential: 'Potential',
  health: 'Health',
  income: 'Income',
  momentum: 'Momentum',
}

function clampScore(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function scoreColor(score: number | null | undefined): string {
  const clamped = clampScore(score)
  if (clamped < 40) return 'var(--down)'
  if (clamped < 64) return 'var(--text-muted)'
  return 'var(--up)'
}

export function scoreGrade(score: number | null | undefined): string {
  const clamped = clampScore(score)
  if (clamped >= 85) return 'A'
  if (clamped >= 80) return 'A-'
  if (clamped >= 72) return 'B+'
  if (clamped >= 64) return 'B'
  if (clamped >= 56) return 'B-'
  if (clamped >= 48) return 'C+'
  if (clamped >= 40) return 'C'
  if (clamped >= 32) return 'C-'
  if (clamped >= 24) return 'D'
  return 'F'
}

export function scoreLabel(score: number | null | undefined): string {
  const clamped = clampScore(score)
  if (clamped >= 80) return 'Strong'
  if (clamped >= 64) return 'Solid'
  if (clamped >= 48) return 'Mixed'
  if (clamped >= 32) return 'Weak'
  return 'Fragile'
}

function normalizeReadiness(value: unknown): ScorecardReadiness {
  if (typeof value !== 'string') return 'ready'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'scorecard_ready' || normalized === 'ready') return 'ready'
  if (normalized === 'pending_build') return 'pending_build'
  if (normalized === 'unavailable_missing_inputs') return 'unavailable_missing_inputs'
  if (normalized === 'not_tracked') return 'not_tracked'
  if (normalized === 'error') return 'error'
  return 'ready'
}

function normalizeMissingInputs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 48))
}

function normalizeBuildReadiness(value: unknown): ScorecardBuildReadiness {
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase()
  return normalized === 'full' || normalized === 'partial' ? normalized : 'unknown'
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 80)
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return null
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true
      if (['false', '0', 'no', 'n'].includes(normalized)) return false
    }
  }
  return null
}

export function normalizeScorecard(raw: unknown): Scorecard | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const buildMetadata =
    record.buildMetadata && typeof record.buildMetadata === 'object' && !Array.isArray(record.buildMetadata)
      ? (record.buildMetadata as Record<string, unknown>)
      : null
  const overallRecord =
    record.overall && typeof record.overall === 'object' && !Array.isArray(record.overall)
      ? (record.overall as Record<string, unknown>)
      : null
  if (!overallRecord) return null

  const rawScore = overallRecord.score
  const overallScore =
    typeof rawScore === 'number' && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(100, Math.round(rawScore)))
      : null
  const grade =
    typeof overallRecord.grade === 'string' && overallRecord.grade.trim()
      ? overallRecord.grade.trim().slice(0, 3)
      : scoreGrade(overallScore)
  const label =
    typeof overallRecord.label === 'string' && overallRecord.label.trim()
      ? overallRecord.label.trim().slice(0, 24)
      : scoreLabel(overallScore)

  const rawAxes = Array.isArray(record.axes) ? record.axes : []
  const axesByKey = new Map<ScorecardAxisKey, ScorecardAxis>()
  for (const item of rawAxes) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const axis = item as Record<string, unknown>
    const key = typeof axis.key === 'string' ? axis.key.trim().toLowerCase() : ''
    if (!SCORECARD_AXIS_ORDER.includes(key as ScorecardAxisKey)) continue
    const typedKey = key as ScorecardAxisKey
    const rawAxisScore = axis.score
    const axisScore =
      typeof rawAxisScore === 'number' && Number.isFinite(rawAxisScore)
        ? Math.max(0, Math.min(100, Math.round(rawAxisScore)))
        : null
    const available = axis.available === true && axisScore !== null
    axesByKey.set(typedKey, {
      key: typedKey,
      label:
        typeof axis.label === 'string' && axis.label.trim()
          ? axis.label.trim().slice(0, 28)
          : SCORECARD_AXIS_LABELS[typedKey],
      score: available ? axisScore : null,
      available,
      hint: typeof axis.hint === 'string' && axis.hint.trim() ? axis.hint.trim().slice(0, 160) : null,
    })
  }

  const axes = SCORECARD_AXIS_ORDER.map((key) => {
    const axis = axesByKey.get(key)
    if (axis) return axis
    return {
      key,
      label: SCORECARD_AXIS_LABELS[key],
      score: null,
      available: false,
      hint: 'No scorecard data available yet.',
    }
  })

  return {
    asOf: typeof record.asOf === 'string' && record.asOf.trim() ? record.asOf.trim() : null,
    readiness: normalizeReadiness(record.readiness ?? record.buildStatus),
    buildStatus: readString(record, ['buildStatus', 'build_status']),
    missingInputs: normalizeMissingInputs(record.missingInputs ?? record.missing_inputs),
    materializationReadiness: readString(record, ['materializationReadiness', 'materialization_readiness']),
    buildReadiness: normalizeBuildReadiness(record.buildReadiness ?? buildMetadata?.readiness),
    buildMissingInputs: normalizeMissingInputs(record.buildMissingInputs ?? record.build_missing_inputs),
    coverageState: readString(record, ['coverageState', 'coverage_state']),
    hasPrices: readBoolean(record, ['hasPrices', 'has_prices', 'pricesReady', 'prices_ready']),
    hasTechnicals: readBoolean(record, ['hasTechnicals', 'has_technicals', 'technicalsReady', 'technicals_ready']),
    hasScorecard: readBoolean(record, ['hasScorecard', 'has_scorecard', 'scorecardReady', 'scorecard_ready']),
    registryStatus: readString(record, ['registryStatus', 'registry_status']),
    validationStatus: readString(record, ['validationStatus', 'validation_status']),
    promotionStatus: readString(record, ['promotionStatus', 'promotion_status']),
    overall: {
      score: overallScore,
      grade,
      label,
    },
    axes,
  }
}

export function buildFixtureScorecard(ticker: string, seedScore = 62): Scorecard {
  const score = Math.max(0, Math.min(100, Math.round(seedScore)))
  return {
    asOf: null,
    readiness: 'ready',
    buildStatus: 'scorecard_ready',
    missingInputs: [],
    materializationReadiness: 'scorecard_ready',
    buildReadiness: 'full',
    buildMissingInputs: [],
    coverageState: 'ready',
    hasPrices: true,
    hasTechnicals: true,
    hasScorecard: true,
    registryStatus: 'ready',
    validationStatus: null,
    promotionStatus: null,
    overall: {
      score,
      grade: scoreGrade(score),
      label: scoreLabel(score),
    },
    axes: [
      { key: 'value', label: 'Value', score: Math.max(0, Math.min(100, score - 5)), available: true },
      { key: 'potential', label: 'Potential', score: Math.max(0, Math.min(100, score + 3)), available: true },
      { key: 'health', label: 'Health', score: Math.max(0, Math.min(100, score + 8)), available: true },
      {
        key: 'income',
        label: 'Income',
        score: null,
        available: false,
        hint: `${ticker.toUpperCase()} income needs dividend data.`,
      },
      { key: 'momentum', label: 'Momentum', score: Math.max(0, Math.min(100, score + 14)), available: true },
    ],
  }
}

export function buildUnavailableScorecard(label = 'No data'): Scorecard {
  return {
    asOf: null,
    readiness: 'error',
    buildStatus: 'error',
    missingInputs: [],
    materializationReadiness: null,
    buildReadiness: 'unknown',
    buildMissingInputs: [],
    coverageState: null,
    hasPrices: null,
    hasTechnicals: null,
    hasScorecard: false,
    registryStatus: null,
    validationStatus: null,
    promotionStatus: null,
    overall: {
      score: null,
      grade: '–',
      label,
    },
    axes: SCORECARD_AXIS_ORDER.map((key) => ({
      key,
      label: SCORECARD_AXIS_LABELS[key],
      score: null,
      available: false,
      hint: 'No scorecard data available yet.',
    })),
  }
}
