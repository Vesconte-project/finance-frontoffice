'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { createResearchClient, ResearchReadError as ReadError } from '@/lib/synthetic-research-client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import RunAuditEvidence, { RunStateSummary } from './RunAuditEvidence'
import { auditStatusLabel } from '@/lib/synthetic-audit'
import {
  parseComparison,
  projectRun,
  projectEvent,
  projectArtifact,
  projectSubmission,
  statusLabel,
  type Run,
  type RunEvent,
  type Artifact,
  type ComparisonRequest,
  type Model,
  type Variant,
  type Submission,
} from '@/lib/synthetic-research'

const defaultRequest: ComparisonRequest = {
  experiment_name: 'synthetic_comparison',
  fixture: 'synthetic-market-v1',
  variants: [
    { name: 'baseline', model: 'logistic_regression', probability_threshold: 0.5 },
    { name: 'forest', model: 'random_forest_classifier', probability_threshold: 0.6 },
  ],
}
const modelLabel = (model: Model | null) =>
  model === 'logistic_regression'
    ? 'Logistic regression'
    : model === 'random_forest_classifier'
      ? 'Random forest classifier'
      : 'Not recorded'
const active = (run: Run) => run.status === 'queued' || run.status === 'running'
function time(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded'
}
export function RunEvidence({
  run,
  events,
  artifacts,
}: {
  run: Run
  events: RunEvent[]
  artifacts: Artifact[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Public configuration</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-content-muted">Model</dt>
            <dd>{modelLabel(run.parameters.model)}</dd>
          </div>
          <div>
            <dt className="text-content-muted">Positive probability threshold</dt>
            <dd>{run.parameters.probability_threshold ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-content-muted">Created</dt>
            <dd>{time(run.created_at)}</dd>
          </div>
          <div>
            <dt className="text-content-muted">Finished</dt>
            <dd>{time(run.finished_at)}</dd>
          </div>
          {(
            [
              ['Run', run.experiment_id],
              ['Comparison', run.comparison_id],
              ['Definition version', run.experiment_version],
              ['Feature snapshot', run.feature_snapshot_id],
              ['Snapshot name', run.snapshot_name],
              ['Snapshot version', run.snapshot_version],
              ['ML run', run.ml_run_id],
              ['Strategy run', run.strategy_run_id],
              ['Backtest run', run.backtest_run_id],
              ['Definition SHA-256', run.definition_hash],
              ['Execution configuration SHA-256', run.orchestrator_config_hash],
              ['Synthetic fixture SHA-256', run.fixture_sha256],
            ] as const
          ).map(([label, value]) => (
            <div className="sm:col-span-2" key={label}>
              <dt className="text-content-muted">{label}</dt>
              <dd className="break-all font-mono text-xs">{value ?? 'Not recorded'}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-content-secondary">
          These hashes identify the recorded configuration and fixture. The public API does not
          currently provide the executed code revision. Technical audit evidence is shown separately
          below.
        </p>
        {run.public_request ? (
          <details className="mt-4">
            <summary className="cursor-pointer focus-visible:outline-2">
              Your declarative comparison request
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(run.public_request, null, 2)}
            </pre>
          </details>
        ) : (
          <p className="mt-4 text-sm">
            The original comparison request is unavailable for this older run. Its permitted
            parameters are shown above.
          </p>
        )}
      </div>
      <div>
        <RunAuditEvidence summary={run.audit_summary} />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Execution events</h3>
        {events.length ? (
          <ol className="mt-3 divide-y divide-border">
            {events.map((event) => (
              <li key={event.event_id} className="py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="break-all">{event.event_type.replaceAll('_', ' ')}</span>
                  <span>{event.status ?? 'Status not recorded'}</span>
                </div>
                <p className="text-content-secondary">
                  {event.step ?? 'Run'} · {time(event.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-content-secondary">
            No events recorded yet. Refresh while the run progresses.
          </p>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Artefact records</h3>
        <p className="mt-2 text-sm text-content-secondary">
          Metadata only. File contents and downloads are unavailable in this proof.
        </p>
        {artifacts.length ? (
          <ul className="mt-3 divide-y divide-border">
            {artifacts.map((artifact) => (
              <li className="py-3 text-sm" key={artifact.artifact_id}>
                <p className="break-all font-medium">
                  {artifact.artifact_type.replaceAll('_', ' ')}
                </p>
                <p className="break-all font-mono text-xs">{artifact.artifact_id}</p>
                <p className="mt-1 break-all font-mono text-xs">
                  SHA-256: {artifact.artifact_hash ?? 'Not recorded'}
                </p>
                <p className="text-content-secondary">{time(artifact.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-content-secondary">
            No artefacts recorded yet. Failed runs may have no artefacts.
          </p>
        )}
      </div>
    </div>
  )
}
export function MetricsComparison({ runs }: { runs: Run[] }) {
  const keys = Array.from(
    new Set(runs.flatMap((run) => Object.keys(run.result_json?.metrics_summary_json ?? {}))),
  )
  return (
    <section aria-labelledby="synthetic-metrics">
      <h2 id="synthetic-metrics" className="text-section-title">
        Synthetic metrics
      </h2>
      <p className="mt-2 text-sm text-content-secondary">
        Test data only. These values do not establish investment performance, causal validity or
        financial validation. Missing metrics are shown as unavailable.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Public metrics for the selected synthetic variants</caption>
          <thead>
            <tr>
              <th scope="col" className="py-3 pr-4">
                Metric
              </th>
              {runs.map((run) => (
                <th scope="col" className="py-3 px-3" key={run.experiment_id}>
                  {run.variant ?? run.experiment_name}
                  <RunStateSummary run={run} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(keys.length ? keys : ['No metrics recorded']).map((key) => (
              <tr className="border-t border-border" key={key}>
                <th scope="row" className="py-3 pr-4 font-normal">
                  {key.replaceAll('_', ' ')}
                </th>
                {runs.map((run) => (
                  <td className="px-3 py-3 tabular-nums" key={run.experiment_id}>
                    {run.result_json?.metrics_summary_json[key]?.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    }) ?? 'Unavailable'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
export default function SyntheticComparison() {
  const { getToken, isLoaded } = useAuth()
  const api = useCallback((path: string, body?: ComparisonRequest) => createResearchClient({
    mode: process.env.NEXT_PUBLIC_RESEARCH_AUTH_MODE || 'bff',
    baseUrl: process.env.NEXT_PUBLIC_RESEARCH_API_BASE_URL,
    getToken,
  })(path, body), [getToken])
  const [form, setForm] = useState<ComparisonRequest>(defaultRequest)
  const [runs, setRuns] = useState<Run[]>([]),
    [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true),
    [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [submission, setSubmission] = useState<Submission | null>(null)
  const [signedOut, setSignedOut] = useState(false),
    [unknown, setUnknown] = useState(false)
  const [evidence, setEvidence] = useState<
    Record<string, { events: RunEvent[]; artifacts: Artifact[] }>
  >({})
  const [detailError, setDetailError] = useState(''),
    [detailLoading, setDetailLoading] = useState(false)
  const [updated, setUpdated] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const busy = useRef(false),
    submitLock = useRef(false)
  const onReadError = useCallback((failure: unknown) => {
    if (failure instanceof ReadError && failure.status === 401) {
      setSignedOut(true)
      setRuns([])
      setSelected([])
      setEvidence({})
      setSubmission(null)
      setNotice('')
    }
    return failure instanceof Error ? failure.message : 'Research is unavailable. Try refreshing.'
  }, [])
  const refresh = useCallback(async () => {
    if (!isLoaded || busy.current) return
    busy.current = true
    try {
      const result = await api('experiments?limit=50')
      if (!Array.isArray(result.jobs)) throw Error('Unexpected run list. Try refreshing.')
      setRuns(result.jobs.map(projectRun))
      setError('')
      setUnknown(false)
      setUpdated(new Date().toLocaleTimeString())
      setRefreshVersion((version) => version + 1)
    } catch (failure) {
      setError(onReadError(failure))
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [api, isLoaded, onReadError])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const isActive = runs.some(active)
  useEffect(() => {
    if (!isActive || error || signedOut) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 5000)
    return () => clearInterval(timer)
  }, [isActive, refreshVersion, error, signedOut, refresh])
  const selectedKey = selected.join(',')
  useEffect(() => {
    if (!selectedKey || signedOut) return
    let cancelled = false
    setDetailLoading(true)
    Promise.all(
      selectedKey.split(',').map(async (id) => {
        const safe = encodeURIComponent(id)
        const [detail, events, artifacts] = await Promise.all([
          api(`experiments/${safe}`),
          api(`experiments/${safe}/events`),
          api(`experiments/${safe}/artifacts`),
        ])
        if (!Array.isArray(events.events) || !Array.isArray(artifacts.artifacts))
          throw Error('Unexpected run evidence. Try refreshing.')
        return {
          run: projectRun(detail),
          events: events.events.map(projectEvent),
          artifacts: artifacts.artifacts.map(projectArtifact),
        }
      }),
    )
      .then((results) => {
        if (cancelled) return
        setEvidence(
          Object.fromEntries(
            results.map((result) => [
              result.run.experiment_id,
              { events: result.events, artifacts: result.artifacts },
            ]),
          ),
        )
        setRuns((previous) => {
          const byId = new Map(previous.map((run) => [run.experiment_id, run]))
          results.forEach((result) => byId.set(result.run.experiment_id, result.run))
          return [...byId.values()]
        })
        setDetailError('')
      })
      .catch((failure) => {
        if (!cancelled) {
          setEvidence({})
          setDetailError(onReadError(failure))
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api, selectedKey, refreshVersion, signedOut, onReadError])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitLock.current || unknown || loading || isActive || signedOut) return
    let body: ComparisonRequest
    try {
      body = parseComparison(form)
    } catch {
      setFormError(
        'Use different variant names and parameters. Names must start with a lowercase letter and contain only lowercase letters, numbers and underscores.',
      )
      return
    }
    setFormError('')
    submitLock.current = true
    setSubmitting(true)
    setNotice('')
    setSubmission(null)
    setError('')
    try {
      const result = projectSubmission(await api('comparisons', body))
      setSubmission(result)
      setSelected(
        result.members.flatMap((member) => (member.experiment_id ? [member.experiment_id] : [])),
      )
      setNotice(
        result.status === 'partial_failure'
          ? 'Submission was partial. Inspect the recorded runs before trying again; a variant may still be executing.'
          : 'Two synthetic variants submitted. Follow their execution below.',
      )
      await refresh()
    } catch (failure) {
      setError(onReadError(failure))
      if (!(failure instanceof ReadError) || failure.status === 502) setUnknown(true)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }
  function variant(index: number, changes: Partial<Variant>) {
    setFormError('')
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.map((v, i) => (i === index ? { ...v, ...changes } : v)) as [
        Variant,
        Variant,
      ],
    }))
  }
  const selectedRuns = selected.flatMap((id) => {
    const run = runs.find((r) => r.experiment_id === id)
    return run ? [run] : []
  })
  const groups = new Map<string, Run[]>()
  runs.forEach((run) => {
    const key = run.comparison_id ?? run.experiment_id
    groups.set(key, [...(groups.get(key) ?? []), run])
  })
  const disabled = submitting || loading || isActive || unknown || signedOut || Boolean(error)
  return (
    <div className="min-w-0 w-full space-y-10 py-6 md:py-10">
      <header>
        <Link href="/dashboard/research" className="text-sm underline underline-offset-4">
          Back to Research
        </Link>
        <h1 className="text-page-title mt-4">Compare synthetic variants</h1>
        <p className="text-body mt-3 max-w-3xl">
          Choose two permitted model configurations, follow their execution and inspect the recorded
          results.
        </p>
        <p className="mt-4 max-w-3xl text-sm font-medium">
          Synthetic test data only. Execution completed does not mean financially validated. This
          proof provides no investment advice and does not change official models.
        </p>
      </header>
      {signedOut ? (
        <Card>
          <h2 className="text-section-title">Your session ended</h2>
          <p className="mt-2">Sign in again to retrieve your runs.</p>
          <Link
            href="/sign-in?redirect_url=%2Fdashboard%2Fresearch%2Fsynthetic"
            className="mt-3 inline-block underline"
          >
            Sign in
          </Link>
        </Card>
      ) : null}
      {error ? (
        <div role="alert" className="surface-secondary p-5">
          <p>{error}</p>
          {unknown ? (
            <p className="mt-2 text-sm">
              The submission outcome is unknown. Refresh recent runs before submitting again.
              Refreshing does not submit a new comparison.
            </p>
          ) : updated ? (
            <p className="mt-2 text-sm">
              Showing the last successful read. Execution states may be stale.
            </p>
          ) : null}
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => void refresh()}
            disabled={submitting || signedOut}
          >
            Refresh recent runs
          </Button>
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-5" aria-label="Synthetic comparison">
        <h2 className="text-section-title">Configure comparison</h2>
        {formError ? <p role="alert">{formError}</p> : null}
        <div className="max-w-xl">
          <label htmlFor="comparison-name" className="mb-2 block text-sm font-medium">
            Comparison name
          </label>
          <Input
            className="scroll-mt-48"
            id="comparison-name"
            value={form.experiment_name}
            onChange={(e) => {
              setFormError('')
              setForm({ ...form, experiment_name: e.target.value })
            }}
            required
            pattern="[a-z][a-z0-9_]{0,59}"
            maxLength={60}
            aria-describedby="name-help"
            disabled={submitting || signedOut}
          />
          <p id="name-help" className="mt-2 text-sm text-content-secondary">
            Start with a lowercase letter; use lowercase letters, numbers and underscores.
          </p>
        </div>
        <p className="text-sm text-content-secondary">
          Fixture: synthetic-market-v1. Target, features and horizon are fixed by the trusted test
          template. Only model and threshold can be changed.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {form.variants.map((v, index) => (
            <fieldset
              className="surface-secondary min-w-0 space-y-4 p-5"
              key={index}
              disabled={submitting || signedOut}
            >
              <legend className="px-2 font-semibold">Variant {index === 0 ? 'A' : 'B'}</legend>
              <div>
                <label className="mb-2 block text-sm" htmlFor={`variant-${index}`}>
                  Variant name
                </label>
                <Input
                  className="scroll-mt-48"
                  id={`variant-${index}`}
                  value={v.name}
                  onChange={(e) => variant(index, { name: e.target.value })}
                  required
                  pattern="[a-z][a-z0-9_]{0,39}"
                  maxLength={40}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm" htmlFor={`model-${index}`}>
                  Model
                </label>
                <select
                  className="scroll-mt-48 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  id={`model-${index}`}
                  value={v.model}
                  onChange={(e) => variant(index, { model: e.target.value as Model })}
                >
                  <option value="logistic_regression">Logistic regression</option>
                  <option value="random_forest_classifier">Random forest classifier</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm" htmlFor={`threshold-${index}`}>
                  Positive probability threshold
                </label>
                <select
                  className="scroll-mt-48 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  id={`threshold-${index}`}
                  value={v.probability_threshold}
                  onChange={(e) =>
                    variant(index, { probability_threshold: Number(e.target.value) as 0.5 | 0.6 })
                  }
                >
                  <option value={0.5}>0.50</option>
                  <option value={0.6}>0.60</option>
                </select>
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={disabled}>
            {submitting ? 'Submitting…' : 'Submit synthetic comparison'}
          </Button>
          <p className="text-sm text-content-secondary">
            {isActive
              ? 'Wait for your current comparison to finish.'
              : 'Two distinct configurations. One active comparison at a time.'}
          </p>
        </div>
      </form>
      <div role="status" aria-live="polite">
        {notice}
        {submission?.status === 'partial_failure' ? (
          <ul className="mt-3 space-y-1 text-sm">
            {submission.members.map((member) => (
              <li key={member.variant}>
                {member.variant}: {member.status}
                {member.experiment_id ? ` · ${member.experiment_id}` : ' · no run ID returned'}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <section aria-labelledby="recent-runs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-runs" className="text-section-title">
            Recent comparisons
          </h2>
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            disabled={submitting || signedOut}
          >
            Refresh
          </Button>
        </div>
        <p className="mt-2 text-sm text-content-secondary">
          Up to 50 recent runs. {updated ? `Last checked at ${updated}.` : ''}{' '}
          {isActive && !error ? 'Checks every five seconds while this page is visible.' : ''}
        </p>
        {loading ? (
          <p role="status" className="mt-5">
            Loading your runs…
          </p>
        ) : !runs.length && !error ? (
          <p className="mt-5">
            No synthetic comparisons yet. Configure two variants above to start.
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-border">
          {[...groups.entries()].map(([key, members]) => (
            <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={key}>
              <div className="min-w-0">
                <p className="break-all font-medium">
                  {members[0].public_request?.experiment_name ?? members[0].experiment_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.map((run) => (
                    <Badge key={run.experiment_id}>
                      {run.variant ?? 'Variant'} · Execution: {statusLabel[run.status]} · Audit:{' '}
                      {auditStatusLabel[run.audit_summary.status]}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-sm text-content-secondary">
                  {members.length === 1
                    ? 'One recorded run. The comparison may be partial or older than this public contract.'
                    : 'Two recorded variants.'}
                </p>
              </div>
              <Button
                variant="secondary"
                aria-pressed={selectedKey === members.map((m) => m.experiment_id).join(',')}
                onClick={() => {
                  const ids = members.map((m) => m.experiment_id)
                  if (ids.join(',') !== selectedKey) {
                    setSelected(ids)
                    setEvidence({})
                    setDetailError('')
                  }
                }}
              >
                Inspect{members.length === 1 ? ' run' : ' comparison'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      {selectedRuns.length ? (
        <div className="space-y-8">
          <MetricsComparison runs={selectedRuns} />
          {selectedRuns[0].public_request ? (
            <Button
              variant="secondary"
              disabled={submitting || signedOut}
              onClick={() => {
                setForm(selectedRuns[0].public_request!)
                setNotice(
                  'Recorded options loaded. Review the form and submit explicitly to create new runs.',
                )
                document.getElementById('comparison-name')?.focus()
              }}
            >
              Load these options to repeat
            </Button>
          ) : null}
          {detailError ? (
            <div role="alert">
              <p>{detailError}</p>
              <Button variant="secondary" className="mt-2" onClick={() => void refresh()}>
                Retry evidence
              </Button>
            </div>
          ) : null}
          {detailLoading ? <p role="status">Loading run evidence…</p> : null}
          <div className="grid items-start gap-8 lg:grid-cols-2">
            {selectedRuns.map((run) => (
              <article key={run.experiment_id} className="min-w-0">
                <h2 className="text-section-title break-all">
                  {run.variant ?? run.experiment_name}
                </h2>
                <div className="mb-5">
                  <RunStateSummary run={run} />
                </div>
                {run.status === 'failed' ? (
                  <p className="mb-5 text-sm">
                    No complete result. Inspect events; refresh to check the recorded state.
                  </p>
                ) : null}
                {evidence[run.experiment_id] ? (
                  <RunEvidence run={run} {...evidence[run.experiment_id]} />
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
