import { auditStatusLabel, type AuditSummary } from '@/lib/synthetic-audit'
import { statusLabel, type Run } from '@/lib/synthetic-research'

export function RunStateSummary({ run }: { run: Run }) {
  return (
    <dl className="mt-3 space-y-2 text-sm" aria-label="Run states">
      <div>
        <dt className="font-normal text-content-secondary">Execution state</dt>
        <dd className="font-medium">{statusLabel[run.status]}</dd>
      </div>
      <div>
        <dt className="font-normal text-content-secondary">Technical audit state</dt>
        <dd className="font-medium">{auditStatusLabel[run.audit_summary.status]}</dd>
      </div>
      <div>
        <dt className="font-normal text-content-secondary">Financial validity</dt>
        <dd className="font-medium">Not established</dd>
      </div>
    </dl>
  )
}

const diagnosticName = {
  lead_lag_audit: 'Lead/lag audit',
  feature_causality_audit: 'Feature causality audit',
}
const diagnosticStatus = {
  ok: 'Passed technical check',
  warning: 'Warning',
  fail: 'Failed',
  error: 'Audit error',
  not_available: 'No evidence',
  skipped: 'Skipped',
}

export default function RunAuditEvidence({ summary }: { summary: AuditSummary }) {
  return (
    <section aria-label="Technical audit evidence">
      <h3 className="text-lg font-semibold">Technical audit evidence</h3>
      <p className="mt-2 text-sm font-medium">{auditStatusLabel[summary.status]}</p>
      <p className="mt-2 text-sm text-content-secondary">
        These checks concern feature timing and availability. They do not establish financial
        validity or model performance.
      </p>
      {summary.status === 'not_available' ? (
        <p className="mt-3 text-sm">
          No public audit evidence is recorded. Historical runs may predate this contract; completed
          execution is not a substitute.
        </p>
      ) : null}
      {summary.status === 'inconclusive' ? (
        <p className="mt-3 text-sm">
          Technical validation was not established. Evidence may be missing, skipped, unchecked or
          incomplete.
        </p>
      ) : null}
      {summary.status === 'failed' ? (
        <p className="mt-3 text-sm">
          A technical check failed. Inspect the recorded findings; this alone does not prove
          temporal leakage or explain its cause.
        </p>
      ) : null}
      {summary.status === 'ok' ? (
        <p className="mt-3 text-sm">
          Both recorded technical checks passed. Financial validity remains not established.
        </p>
      ) : null}
      {summary.diagnostics.length ? (
        <ul className="mt-4 divide-y divide-border">
          {summary.diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.diagnostic_type}-${index}`} className="py-3">
              <h4 className="text-sm font-semibold">
                {diagnosticName[diagnostic.diagnostic_type]}
              </h4>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2">
                  <dt className="text-content-secondary">Check state</dt>
                  <dd>{diagnosticStatus[diagnostic.status]}</dd>
                </div>
                <div>
                  <dt className="text-content-secondary">Fail findings</dt>
                  <dd>{diagnostic.fail_count ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt className="text-content-secondary">Unchecked features</dt>
                  <dd>{diagnostic.unchecked_count ?? 'Not recorded'}</dd>
                </div>
              </dl>
              {diagnostic.findings.length ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer focus-visible:outline-2">
                    Recorded finding identifiers ({diagnostic.findings.length})
                  </summary>
                  <ul className="mt-2 space-y-3">
                    {diagnostic.findings.map((finding, findingIndex) => (
                      <li key={findingIndex} className="break-words">
                        <dl>
                          {(
                            [
                              ['Feature', finding.feature],
                              ['Severity', finding.severity],
                              ['Classification', finding.classification],
                              ['Audit reason', finding.audit_reason],
                            ] as const
                          ).map(([label, value]) => (
                            <div key={label}>
                              <dt className="inline text-content-secondary">{label}: </dt>
                              <dd className="inline font-mono text-xs">
                                {value ?? 'Not recorded'}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="mt-3 text-sm text-content-secondary">
                  No finding identifiers were recorded.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-sm text-content-secondary">
        Public summary only: up to two audit records and 100 finding identifiers per check. Counts
        may include findings beyond this list. Raw diagnostic reports are unavailable here.
      </p>
    </section>
  )
}
