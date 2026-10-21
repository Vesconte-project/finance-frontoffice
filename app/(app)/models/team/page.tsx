import Link from 'next/link'
import AccessRequestForm from '@/components/model-lab/AccessRequestForm'
import PipelineSteps from '@/components/model-lab/PipelineSteps'
import Problem from '@/components/model-lab/Problem'
import { CheckMark, PageTitle, Section, Tag } from '@/components/model-lab/ui'
import Tabs, { type TabItem } from '@/components/ui/Tabs'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError, type PipelineKind } from '@/lib/model-lab/contract'

export const dynamic = 'force-dynamic'

type TabKey = 'queue' | 'pipeline' | 'candidates' | 'access' | 'data'
const KINDS: readonly (readonly [PipelineKind, string])[] = [['thesis', 'A thesis'], ['reuse', 'New rules, same model'], ['panel', 'A panel']]

const th = 'py-2 pr-3 font-medium'

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string; kind?: string }> }) {
  const query = await searchParams
  const { source, viewer } = await labContext()
  if (viewer.role !== 'team') return <Problem error={new ModelLabError('forbidden')} back={{ href: '/models', label: 'Back to the Model Lab' }} />

  const tabs: (TabItem & { key: TabKey })[] = [
    { key: 'queue', label: 'Queue', href: '/models/team' },
    { key: 'pipeline', label: 'Pipeline', href: '/models/team?tab=pipeline' },
    { key: 'candidates', label: 'Candidates', href: '/models/team?tab=candidates' },
    { key: 'access', label: 'Access requests', href: '/models/team?tab=access' },
    { key: 'data', label: 'Data health', href: '/models/team?tab=data' },
  ]
  const active: TabKey = tabs.some((t) => t.key === query.tab) ? (query.tab as TabKey) : 'queue'
  let body: React.ReactNode

  if (active === 'queue') {
    const rows = await load(() => source.teamQueue())
    body = !rows.ok ? <Problem error={rows.error} /> : (
      <Section title="Runs in progress and recent">
        <div className="overflow-x-auto"><table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">Runs on the research workers</caption>
          <thead><tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted"><th scope="col" className={th}>Job</th><th scope="col" className={th}>Who</th><th scope="col" className={th}>Thesis</th><th scope="col" className={`${th} text-right`}>Variants</th><th scope="col" className={th}>Stage</th><th scope="col" className={th}>State</th><th scope="col" className={`${th} text-right`}>Minutes</th></tr></thead>
          <tbody>{rows.data.map((r) => (
            <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
              <th scope="row" className="py-2 pr-3 font-mono text-xs">{r.id}</th><td className="py-2 pr-3 text-body-sm">{r.who}</td><td className="py-2 pr-3 text-body-sm">{r.thesis}</td>
              <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{r.variants}</td><td className="py-2 pr-3 text-body-sm">{r.stage}</td><td className="py-2 pr-3 text-body-sm">{r.state}</td><td className="py-2 text-right text-body-sm tabular-nums">{r.minutes}</td>
            </tr>))}</tbody>
        </table></div>
      </Section>
    )
  } else if (active === 'pipeline') {
    const kind = KINDS.find(([k]) => k === query.kind)?.[0] ?? 'thesis'
    const view = await load(() => source.teamPipeline(kind))
    body = (
      <div className="space-y-4">
        <nav aria-label="What to follow through the pipeline" className="flex flex-wrap gap-2">
          {KINDS.map(([k, label]) => <Link key={k} href={`/models/team?tab=pipeline&kind=${k}`} aria-current={k === kind ? 'page' : undefined} className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm text-content-primary aria-[current=page]:border-[var(--accent)] aria-[current=page]:bg-[var(--surface-soft)]">{label}</Link>)}
        </nav>
        {view.ok ? <PipelineSteps view={view.data} /> : <Problem error={view.error} />}
      </div>
    )
  } else if (active === 'candidates') {
    const list = await load(() => source.teamCandidates())
    body = !list.ok ? <Problem error={list.error} /> : (
      <Section title="Candidates for the product">
        <ul className="grid gap-3 md:grid-cols-2">{list.data.map((c) => (
          <li key={c.id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center gap-2"><p className="text-card-title text-content-primary">{c.name}</p><Tag>{c.status === 'shadow' ? 'Shadow' : 'Candidate'}</Tag><Tag>{c.source === 'customer-copy' ? 'Submitted by a customer' : 'Internal'}</Tag></div>
            <p className="text-caption text-content-muted">From {c.from}</p>
            <ul className="mt-2 space-y-1">{c.checks.map((k) => <li key={k.label} className="flex items-center gap-2 text-body-sm text-content-primary"><CheckMark state={k.state} />{k.label}</li>)}</ul>
          </li>))}
        </ul>
      </Section>
    )
  } else if (active === 'access') {
    const requests = await load(() => source.teamAccessRequests())
    body = (
      <div className="space-y-6">
        <p className="text-body-sm text-content-muted">Customer experiments are private unless the customer submits a copy. Seeing one that was not submitted is an exception: it needs a reason, it expires, it is logged, and the owner is told.</p>
        <AccessRequestForm />
        {requests.ok ? (
          requests.data.length === 0 ? <p className="text-body-sm text-content-muted">No requests yet.</p> : (
            <Section title="Your requests"><ul className="divide-y divide-[var(--line)]">{requests.data.map((r) => <li key={r.id} className="py-3 text-body-sm"><span className="font-mono text-xs">{r.experimentId}</span> · {r.reason} · until {r.expires} · {r.status}</li>)}</ul></Section>
          )
        ) : <Problem error={requests.error} />}
      </div>
    )
  } else {
    const health = await load(() => source.teamDataHealth())
    body = !health.ok ? <Problem error={health.error} /> : (
      <Section title="Data health" aside={`Snapshot ${health.data.snapshot.id}`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[28rem] border-collapse text-left">
          <caption className="sr-only">Signal families, their coverage and freshness</caption>
          <thead><tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted"><th scope="col" className={th}>Family</th><th scope="col" className={`${th} text-right`}>Features</th><th scope="col" className={`${th} text-right`}>Coverage</th><th scope="col" className={th}>Latest</th><th scope="col" className={th}>State</th></tr></thead>
          <tbody>{health.data.families.map((f) => (
            <tr key={f.family} className="border-b border-[var(--line)] last:border-0"><th scope="row" className="py-2 pr-3 text-body-sm font-medium">{f.family}</th><td className="py-2 pr-3 text-right text-body-sm tabular-nums">{f.features}</td><td className="py-2 pr-3 text-right text-body-sm tabular-nums">{Math.round(f.coverage * 100)}%</td><td className="py-2 pr-3 text-body-sm">{f.latest}</td><td className="py-2 text-body-sm"><CheckMark state={f.state === 'ok' ? 'holds' : f.state === 'warn' ? 'partly' : 'fails'} /><span className="sr-only">{f.state}</span></td></tr>))}</tbody>
        </table></div>
        <p className="mt-2 break-all font-mono text-[11px] text-content-muted">{health.data.snapshot.hash}</p>
      </Section>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Team">Tools for the people who run the research. Only visible with the research permission.</PageTitle>
      <Tabs items={tabs} activeKey={active} variant="underline" />
      {body}
    </div>
  )
}
