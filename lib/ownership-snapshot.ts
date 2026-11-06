/** Only eligibility/formatting here; no ownership or remainder calculation. */
export type OwnershipSnapshot = {
  observedAt: string
  institutionsFraction: number | null
  insidersFraction: number | null
}

const DAY_MS = 86_400_000
const fraction = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null

export function parseOwnershipSnapshot(value: unknown, ticker: string, now = Date.now()): OwnershipSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.symbol !== ticker || row.source !== 'yahoo_finance' || row.unit !== 'fraction' || row.providerAsOf != null) return null
  if (typeof row.observedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(row.observedAt)) return null
  const captured = Date.parse(row.observedAt)
  const ageDays = Math.floor(now / DAY_MS) - Math.floor(captured / DAY_MS)
  if (!Number.isFinite(captured) || captured > now || ageDays < 0 || ageDays > 14) return null
  return { observedAt: row.observedAt, institutionsFraction: fraction(row.institutionsFraction), insidersFraction: fraction(row.insidersFraction) }
}
