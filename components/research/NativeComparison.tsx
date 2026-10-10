'use client'
import { useAuth, OrganizationSwitcher } from '@clerk/nextjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import RunAuditEvidence from './RunAuditEvidence'
import { projectAuditSummary } from '@/lib/synthetic-audit'
import { createPlatformClient, PlatformError } from '@/lib/platform-client'
import type { PlatformAccess, PlatformAccount } from '@/lib/platform-server'

type Job = { id: string; name: string; status: string; created_at: string; finished_at: string | null }
type Evidence = { variants: { variant: string; metrics: Record<string, number>; definition_hash: string; config_hash: string; audit_summary: unknown }[];
  events: { event_type: string; created_at: string }[];
  artifacts: { id: string; kind: string; sha256: string; size_bytes: number; requires_revalidation: boolean }[] }
type State = { identity: string; account: PlatformAccount; access: PlatformAccess; jobs: Job[] }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const statuses = ['queued', 'running', 'completed', 'failed', 'canceled']
const describe = (error: unknown) => error instanceof PlatformError ? error.message : 'The response could not be read. Refresh to try again.'

function jobs(value: unknown): Job[] {
  if (!Array.isArray(value) || value.some(row => !row || !uuid.test(row.id) || !statuses.includes(row.status) ||
    typeof row.name !== 'string' || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))))
    throw new PlatformError(502)
  return value
}

export default function NativeComparison() {
  const { getToken, userId, orgId, isLoaded } = useAuth()
  const identity = `${userId || ''}:${orgId || ''}`
  const request = useMemo(() => createPlatformClient({ baseUrl: process.env.NEXT_PUBLIC_PLATFORM_API_BASE_URL || '', getToken }), [getToken])
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [name, setName] = useState('synthetic_comparison')
  const [models, setModels] = useState(['logistic_regression', 'random_forest_classifier'])
  const [thresholds, setThresholds] = useState([0.5, 0.6])
  const [evidence, setEvidence] = useState<{ identity: string; jobId: string; value: Evidence } | null>(null)
  const submission = useRef<{ body: string; key: string } | null>(null)
  const epoch = useRef(0)
  const current = state?.identity === identity ? state : null

  useEffect(() => {
    const lifecycle = epoch
    const generation = ++epoch.current
    setError(''); setEvidence(null); submission.current = null
    if (!isLoaded || !userId) { setState(null); return }
    async function load() {
      try {
        const me = await (await request('/me')).json()
        if (!Array.isArray(me.accounts)) throw new PlatformError(502)
        const account = me.accounts.find((row: PlatformAccount) => orgId
          ? row.type === 'organization' && row.clerk_organization_id === orgId : row.type === 'personal')
        if (!account || !uuid.test(account.id)) throw new PlatformError(404)
        const access = await (await request(`/accounts/${account.id}/access`)).json()
        if (access.account_id !== account.id || typeof access.features?.['research.ai']?.allowed !== 'boolean') throw new PlatformError(502)
        const history = jobs(await (await request(`/research/jobs?account_id=${account.id}`)).json())
        if (epoch.current === generation) setState({ identity, account, access, jobs: history })
      } catch (problem) { if (epoch.current === generation) { setState(null); setError(describe(problem)) } }
    }
    void load()
    return () => { lifecycle.current++ }
  }, [identity, isLoaded, orgId, request, userId, reload])

  async function refresh() {
    if (!current) { setReload(value => value + 1); return }
    // A pending initial read must not overwrite a newer manual refresh.
    const generation = ++epoch.current
    const [access, history] = await Promise.all([
      request(`/accounts/${current.account.id}/access`).then(r => r.json()),
      request(`/research/jobs?account_id=${current.account.id}`).then(r => r.json()).then(jobs),
    ])
    if (access.account_id !== current.account.id || typeof access.features?.['research.ai']?.allowed !== 'boolean') throw new PlatformError(502)
    if (epoch.current === generation) setState({ ...current, access, jobs: history })
  }

  async function action(operation: () => Promise<void>) {
    setError(''); setBusy(true)
    try { await operation() } catch (problem) { setError(describe(problem)) }
    finally { setBusy(false) }
  }

  async function submit() {
    if (!current) return
    const body = { account_id: current.account.id, comparison: { experiment_name: name, fixture: 'synthetic-market-v1',
      variants: ['baseline', 'forest'].map((variant, i) => ({ name: variant, model: models[i], probability_threshold: thresholds[i] })) } }
    const serialized = JSON.stringify(body)
    if (submission.current?.body !== serialized) submission.current = { body: serialized, key: crypto.randomUUID() }
    // Preserve the key after an ambiguous network failure; a retry cannot charge twice.
    await request('/research/jobs', { method: 'POST', body, idempotencyKey: submission.current.key })
    submission.current = null
    await refresh()
  }

  async function billing(kind: 'checkout' | 'portal') {
    if (!current) return
    const body = { account_id: current.account.id, ...(kind === 'checkout' ? { offer_key: 'pro' } : {}) }
    const response = await (await request(`/billing/${kind}`, { method: 'POST', body, idempotencyKey: crypto.randomUUID() })).json()
    const target = new URL(response.url)
    if (target.protocol !== 'https:' || target.username || target.password ||
      !['checkout.stripe.com', 'billing.stripe.com'].includes(target.hostname)) throw new PlatformError(502)
    window.location.assign(target.toString())
  }

  async function inspect(jobId: string) {
    if (!current) return
    const generation = epoch.current
    const suffix = `?account_id=${current.account.id}`
    const [result, events, artifacts] = await Promise.all(['results', 'events', 'artifacts'].map(part =>
      request(`/research/jobs/${jobId}/${part}${suffix}`).then(r => r.json())))
    if (!Array.isArray(result.variants) || result.variants.length !== 2 || !Array.isArray(events.events) || !Array.isArray(artifacts.artifacts))
      throw new PlatformError(502)
    for (const variant of result.variants) if (typeof variant.variant !== 'string' || !variant.metrics ||
      Object.values(variant.metrics).some(value => typeof value !== 'number' || !Number.isFinite(value))) throw new PlatformError(502)
    for (const artifact of artifacts.artifacts) if (!uuid.test(artifact.id) || typeof artifact.kind !== 'string' ||
      typeof artifact.size_bytes !== 'number' || typeof artifact.sha256 !== 'string') throw new PlatformError(502)
    if (epoch.current === generation) setEvidence({ identity, jobId, value: { variants: result.variants, events: events.events, artifacts: artifacts.artifacts } })
  }

  async function download(artifactId: string, revalidate: boolean) {
    if (!current) return
    const path = `/artifacts/${artifactId}/${revalidate ? 'content' : 'download'}?account_id=${current.account.id}`
    const response = await request(path)
    let blob: Blob
    if (revalidate) blob = await response.blob()
    else {
      const link = await response.json()
      const url = new URL(link.url)
      if (!(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password)
        throw new PlatformError(502)
      // A normal download needs no storage CORS policy and sends no API JWT.
      // The signed response has an attachment disposition and private cache policy.
      const anchor = document.createElement('a')
      anchor.href = url.toString(); anchor.rel = 'noreferrer noopener'; anchor.target = '_blank'; anchor.click()
      return
    }
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = href; anchor.download = `${artifactId}.json`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  return <section className="space-y-8 py-8">
    <div className="space-y-3"><h1 className="text-page-title">Compare synthetic variants</h1>
      <p className="max-w-prose text-content-secondary">Use ACME/GLOB synthetic data to compare two models. Technical checks do not establish financial validity.</p>
      <OrganizationSwitcher afterSelectOrganizationUrl="/dashboard/research/synthetic" afterSelectPersonalUrl="/dashboard/research/synthetic" />
    </div>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="secondary" disabled={busy} onClick={() => void action(refresh)}>Refresh account and history</Button></div>}
    {!current ? <p role="status">{error ? 'Account data is unavailable.' : 'Loading account and history…'}</p> : <>
      <section className="space-y-3" aria-label="Account access"><h2 className="text-lg font-semibold">{current.account.type === 'personal' ? 'Personal account' : 'Organization account'}</h2>
        <p>{current.access.features['research.ai'].allowed ? 'Research access is active.' : 'Research requires Pro access.'}</p>
        {current.access.research_actions && typeof current.access.research_actions.remaining_units === 'number' &&
          <p>{current.access.research_actions.remaining_units} comparisons available in this billing period.</p>}
        {current.access.can_manage_billing && <div className="flex flex-wrap gap-3">
          {!current.access.features['research.ai'].allowed && <Button disabled={busy} onClick={() => void action(() => billing('checkout'))}>Subscribe to Pro</Button>}
          <Button variant="secondary" disabled={busy} onClick={() => void action(() => billing('portal'))}>Manage subscription</Button>
        </div>}
      </section>
      <form className="max-w-2xl space-y-5" onSubmit={event => { event.preventDefault(); void action(submit) }}>
        <div><label htmlFor="native-comparison-name" className="mb-2 block">Comparison name</label>
          <Input id="native-comparison-name" value={name} maxLength={60} pattern="[a-z][a-z0-9_]{0,59}" required onChange={event => setName(event.target.value)} /></div>
        {['Baseline', 'Forest'].map((label, i) => <fieldset className="space-y-3" key={label}><legend className="font-medium">{label} variant</legend>
          <label className="block">Model<select className="mt-2 block w-full rounded-md border border-current p-3" value={models[i]} onChange={event => setModels(values => values.map((value, j) => j === i ? event.target.value : value))}>
            <option value="logistic_regression">Logistic regression</option><option value="random_forest_classifier">Random forest classifier</option></select></label>
          <label className="block">Probability threshold<select className="mt-2 block w-full rounded-md border border-current p-3" value={thresholds[i]} onChange={event => setThresholds(values => values.map((value, j) => j === i ? Number(event.target.value) : value))}>
            <option value={0.5}>0.5</option><option value={0.6}>0.6</option></select></label>
        </fieldset>)}
        <Button type="submit" disabled={busy || current.access.research_actions?.can_create !== true}>Submit synthetic comparison</Button>
        {current.access.features['research.ai'].allowed && current.access.research_actions?.can_create !== true && <p role="status">New comparisons are unavailable under the current account limits. Refresh for an updated balance.</p>}
      </form>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Comparison history</h2>
        <Button variant="secondary" disabled={busy} onClick={() => void action(refresh)}>Refresh history</Button></div>
        {!current.jobs.length ? <p>No comparisons have been submitted for this account.</p> : <ul className="divide-y divide-border">{current.jobs.map(job => <li key={job.id} className="space-y-2 py-4">
          <p>{job.name} · {job.status}</p><p className="break-all text-sm text-content-secondary">{new Date(job.created_at).toLocaleString()} · {job.id}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" disabled={busy || job.status !== 'completed' || !current.access.features['research.ai'].allowed} onClick={() => void action(() => inspect(job.id))}>Inspect comparison</Button>
            {['queued', 'running'].includes(job.status) && <Button variant="ghost" disabled={busy} onClick={() => void action(async () => {
              await request(`/research/jobs/${job.id}/cancel?account_id=${current.account.id}`, { method: 'POST' }); await refresh()
            })}>Cancel comparison</Button>}
          </div>
        </li>)}</ul>}
      </section>
      {evidence?.identity === identity && current.access.features['research.ai'].allowed && <section className="space-y-6" aria-label="Comparison evidence">
        <h2 className="text-lg font-semibold">Completed comparison</h2>
        {evidence.value.variants.map(variant => <div className="space-y-3" key={variant.variant}><h3 className="font-medium">{variant.variant}</h3>
          <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(variant.metrics).map(([metric, value]) => <div key={metric}><dt className="text-sm text-content-secondary">{metric.replaceAll('_', ' ')}</dt><dd>{value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</dd></div>)}</dl>
          <p className="break-all text-xs">Definition SHA-256: {variant.definition_hash}</p><p className="break-all text-xs">Configuration SHA-256: {variant.config_hash}</p>
          <RunAuditEvidence summary={projectAuditSummary(variant.audit_summary)} />
        </div>)}
        <div><h3 className="mb-3 font-medium">Execution events</h3><ol className="space-y-2">{evidence.value.events.map((event, i) => <li key={i}>{event.event_type.replaceAll('_', ' ')} · {new Date(event.created_at).toLocaleString()}</li>)}</ol></div>
        <div><h3 className="mb-3 font-medium">Artefacts</h3><ul className="space-y-4">{evidence.value.artifacts.map(artifact => <li key={artifact.id} className="space-y-2">
          <p>{artifact.kind.replaceAll('_', ' ')} · {artifact.size_bytes.toLocaleString()} bytes</p><p className="break-all text-xs">SHA-256: {artifact.sha256}</p>
          <Button variant="secondary" disabled={busy} onClick={() => void action(() => download(artifact.id, artifact.requires_revalidation))}>Download artefact</Button>
        </li>)}</ul></div>
      </section>}
    </>}
  </section>
}
