import assert from 'node:assert/strict'
import test from 'node:test'
import { projectAuditSummary } from '../lib/synthetic-audit'
const diagnostics = ['lead_lag_audit', 'feature_causality_audit'].map((diagnostic_type) => ({
  diagnostic_type,
  status: 'ok',
  fail_count: 0,
  unchecked_count: 0,
  findings: [],
}))
const passed = { status: 'ok', validated: true, diagnostics }
test('missing or historical audit evidence never validates', () => {
  for (const value of [
    undefined,
    null,
    'diagnostic stderr /srv/private',
    { status: 'not_available', validated: false, diagnostics: [] },
  ])
    assert.deepEqual(projectAuditSummary(value), {
      status: 'not_available',
      validated: false,
      diagnostics: [],
    })
})
test('technical pass requires both complete distinct audit records and strict boolean assertion', () => {
  assert.deepEqual(projectAuditSummary(passed), passed)
  for (const value of [
    { ...passed, validated: 'true' },
    { ...passed, diagnostics: [] },
    { ...passed, diagnostics: [diagnostics[0], diagnostics[0]] },
    { ...passed, diagnostics: [diagnostics[0]] },
    { ...passed, status: 'new_status' },
  ])
    assert.equal(projectAuditSummary(value).validated, false)
})
test('failed evidence overrides an inconsistent upstream ok, independently of execution state', () => {
  for (const diagnostic of [
    { ...diagnostics[0], fail_count: 1 },
    { ...diagnostics[0], status: 'fail' },
    { ...diagnostics[0], status: 'error' },
    { ...diagnostics[0], findings: [{ feature: 'ret_5d', severity: 'fail' }] },
  ]) {
    const result = projectAuditSummary({ ...passed, diagnostics: [diagnostic, diagnostics[1]] })
    assert.equal(result.status, 'failed')
    assert.equal(result.validated, false)
  }
  assert.equal(
    projectAuditSummary({ status: 'failed', validated: true, diagnostics: [] }).status,
    'failed',
  )
})
test('incomplete, unchecked, warning, skipped and malformed evidence stays inconclusive', () => {
  for (const patch of [
    { unchecked_count: 1 },
    { status: 'warning' },
    { status: 'skipped' },
    { status: 'not_available' },
    { fail_count: -1 },
    { fail_count: true },
    { unchecked_count: 1.5 },
    { unchecked_count: Number.MAX_SAFE_INTEGER + 1 },
    { findings: {} },
  ]) {
    const result = projectAuditSummary({
      ...passed,
      diagnostics: [{ ...diagnostics[0], ...patch }, diagnostics[1]],
    })
    assert.equal(result.status, 'inconclusive')
    assert.equal(result.validated, false)
  }
  assert.equal(projectAuditSummary({ ...passed, status: 'inconclusive' }).status, 'inconclusive')
})
test('closed projection bounds arrays and removes raw diagnostics, paths, commands and malformed identifiers', () => {
  const result = projectAuditSummary({
    ...passed,
    stderr: 'private',
    diagnostics: [
      {
        ...diagnostics[0],
        command: 'private',
        paths: ['/srv/private'],
        payload_json: { env: 'private' },
        findings: [
          {
            feature: '../private',
            severity: 'warning',
            classification: 'inconclusive',
            audit_reason: 'python /srv/private',
            stderr: 'private',
          },
        ],
      },
      diagnostics[1],
    ],
  })
  assert.equal(result.status, 'inconclusive')
  assert.doesNotMatch(JSON.stringify(result), /private|stderr|command|paths|payload_json|\/srv\//)
  assert.deepEqual(result.diagnostics[0].findings, [
    { severity: 'warning', classification: 'inconclusive' },
  ])
  const many = projectAuditSummary({
    ...passed,
    diagnostics: [
      {
        ...diagnostics[0],
        findings: Array.from({ length: 101 }, () => ({ feature: 'ret_5d', severity: 'info' })),
      },
      diagnostics[1],
      diagnostics[0],
    ],
  })
  assert.equal(many.validated, false)
  assert.equal(many.diagnostics.length, 2)
  assert.equal(many.diagnostics[0].findings.length, 100)
})
