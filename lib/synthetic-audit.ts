/** Bounded public audit contract proposed by finance-backend #19. */
export type AuditStatus = 'failed' | 'inconclusive' | 'ok' | 'not_available'
export type DiagnosticStatus = 'ok' | 'warning' | 'fail' | 'error' | 'not_available' | 'skipped'
export type AuditFinding = Partial<
  Record<'feature' | 'severity' | 'classification' | 'audit_reason', string>
>
export type AuditDiagnostic = {
  diagnostic_type: 'lead_lag_audit' | 'feature_causality_audit'
  status: DiagnosticStatus
  fail_count: number | null
  unchecked_count: number | null
  findings: AuditFinding[]
}
export type AuditSummary = {
  status: AuditStatus
  validated: boolean
  diagnostics: AuditDiagnostic[]
}
const unavailable = (): AuditSummary => ({
  status: 'not_available',
  validated: false,
  diagnostics: [],
})
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
const identifier = /^[A-Za-z0-9_.-]{1,160}$/
const states: DiagnosticStatus[] = ['ok', 'warning', 'fail', 'error', 'not_available', 'skipped']

export function projectAuditSummary(value: unknown): AuditSummary {
  const raw = object(value)
  if (!raw) return unavailable()
  const items = Array.isArray(raw.diagnostics) ? raw.diagnostics : []
  if (raw.status === 'not_available' && raw.validated === false && items.length === 0)
    return unavailable()
  let complete = Array.isArray(raw.diagnostics) && items.length <= 2
  const diagnostics: AuditDiagnostic[] = []
  for (const candidate of items.slice(0, 2)) {
    const item = object(candidate)
    if (
      !item ||
      (item.diagnostic_type !== 'lead_lag_audit' &&
        item.diagnostic_type !== 'feature_causality_audit')
    ) {
      complete = false
      continue
    }
    const validStatus = states.includes(item.status as DiagnosticStatus)
    const failCount = count(item.fail_count),
      uncheckedCount = count(item.unchecked_count)
    const findingItems = Array.isArray(item.findings) ? item.findings : []
    if (
      !validStatus ||
      failCount === null ||
      uncheckedCount === null ||
      !Array.isArray(item.findings) ||
      findingItems.length > 100
    )
      complete = false
    const findings: AuditFinding[] = []
    for (const candidateFinding of findingItems.slice(0, 100)) {
      const source = object(candidateFinding)
      if (!source) {
        complete = false
        continue
      }
      const finding: AuditFinding = {}
      for (const key of ['feature', 'severity', 'classification', 'audit_reason'] as const) {
        if (!(key in source)) continue
        const field = source[key]
        if (typeof field === 'string' && identifier.test(field)) finding[key] = field
        else complete = false
      }
      if (Object.keys(finding).length) findings.push(finding)
      else complete = false
    }
    diagnostics.push({
      diagnostic_type: item.diagnostic_type,
      status: validStatus ? (item.status as DiagnosticStatus) : 'not_available',
      fail_count: failCount,
      unchecked_count: uncheckedCount,
      findings,
    })
  }
  const failed =
    raw.status === 'failed' ||
    diagnostics.some(
      (item) =>
        (item.fail_count ?? 0) > 0 ||
        item.status === 'fail' ||
        item.status === 'error' ||
        item.findings.some((finding) => finding.severity === 'fail'),
    )
  const validated =
    !failed &&
    complete &&
    raw.status === 'ok' &&
    raw.validated === true &&
    diagnostics.length === 2 &&
    new Set(diagnostics.map((item) => item.diagnostic_type)).size === 2 &&
    diagnostics.every(
      (item) => item.status === 'ok' && item.fail_count === 0 && item.unchecked_count === 0,
    )
  return { status: failed ? 'failed' : validated ? 'ok' : 'inconclusive', validated, diagnostics }
}

export const auditStatusLabel: Record<AuditStatus, string> = {
  failed: 'Failed technical audit',
  inconclusive: 'Inconclusive technical audit',
  ok: 'Passed technical checks',
  not_available: 'No audit evidence',
}
