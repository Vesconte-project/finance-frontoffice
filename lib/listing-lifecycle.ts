/** Public reason codes are translation keys; private approval/evidence never belong here. */
export type Lifecycle = {
  lifecycle_state: string
  suspension_reason: string | null
  suspended_at: string | null
  review_by: string | null
  lifecycle_revision: string
}
const REASONS: Record<string, string> = {
  provider_unavailable: 'O fornecedor deixou de disponibilizar dados válidos.',
  identity_migration_pending: 'A identificação desta cotação está a ser corrigida.',
  invalid_source_data: 'Foram detetadas inconsistências nos dados do fornecedor.',
}
const KNOWN = new Set(['active', 'suspended', 'pending_validation', 'rejected', 'removed', 'inactive', 'legacy_unregistered'])
export function lifecycleView(value: Partial<Lifecycle> | null | undefined) {
  if (!value || !value.lifecycle_state || !KNOWN.has(value.lifecycle_state)) return { state: 'unavailable' as const }
  if (value.lifecycle_state !== 'suspended') return { state: 'available' as const }
  const reason = value.suspension_reason && REASONS[value.suspension_reason]
  const date = value.suspended_at?.slice(0, 10)
  if (!reason || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(value.suspended_at ?? '')) || !value.lifecycle_revision) return { state: 'unavailable' as const }
  return { state: 'suspended' as const, reason, date, reviewBy: value.review_by?.slice(0, 10) ?? null }
}
/** Keep the source's dates; never extend a frozen history to today's date. */
export function historyThrough<T extends { date: string }>(rows: T[], suspendedAt: string): T[] {
  return rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date <= suspendedAt.slice(0, 10))
}
