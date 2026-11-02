import Link from 'next/link'
import Problem from '@/components/model-lab/Problem'
import SelectCandidate from '@/components/model-lab/SelectCandidate'
import { CheckMark, PageTitle, Section, Tag, pct } from '@/components/model-lab/ui'
import Tabs, { type TabItem } from '@/components/ui/Tabs'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError, type Candidate } from '@/lib/model-lab/contract'

export const dynamic = 'force-dynamic'

type TabKey = 'shared' | 'candidates'

const REVIEW: Readonly<Record<Candidate['review'], string>> = { waiting: 'Waiting for approval', approved: 'Approved', declined: 'Declined' }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const query = await searchParams
  const { source, viewer } = await labContext()
  if (viewer.role !== 'admin') return <Problem error={new ModelLabError('forbidden')} back={{ href: '/models', label: 'Back to the Model Lab' }} />

  const tabs: (TabItem & { key: TabKey })[] = [
    { key: 'shared', label: 'Shared models', href: '/models/admin' },
    { key: 'candidates', label: 'Candidates', href: '/models/admin?tab=candidates' },
  ]
  const active: TabKey = tabs.some((t) => t.key === query.tab) ? (query.tab as TabKey) : 'shared'
  const candidates = await load(() => source.adminCandidates())
  let body: React.ReactNode

  if (active === 'shared') {
    const shared = await load(() => source.adminShared())
    const selected = new Set(candidates.ok ? candidates.data.map((c) => c.thesisId) : [])
    body = !shared.ok ? <Problem error={shared.error} /> : (
      <Section title="Shared by admins">
        {shared.data.length === 0 ? <p className="text-body-sm text-content-muted">Nothing shared yet. Share a thesis from its page.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">{shared.data.map((m) => (
            <li key={m.thesisId} className="flex flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="space-y-1">
                {m.mine ? <Link href={`/models/theses/${m.thesisId}`} className="text-card-title text-content-primary hover:underline">{m.statement}</Link> : <p className="text-card-title text-content-primary">{m.statement}</p>}
                <p className="text-caption text-content-muted">Shared by {m.sharedBy} · {day(m.sharedAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{m.checksHolding} of {m.checksTotal} checks hold</Tag>
                {m.returnAfterCosts !== null && m.benchmarkReturn !== null ? <span className="text-caption tabular-nums text-content-muted">{pct(m.returnAfterCosts)} vs {pct(m.benchmarkReturn)}</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2"><SelectCandidate thesisId={m.thesisId} selected={selected.has(m.thesisId)} /></div>
            </li>))}
          </ul>
        )}
      </Section>
    )
  } else {
    body = !candidates.ok ? <Problem error={candidates.error} /> : (
      <Section title="Candidates for production">
        <p className="mb-3 text-body-sm text-content-muted">Admins select candidates here. Approval, deployment and switching a model on or off happen in the backoffice.</p>
        {candidates.data.length === 0 ? <p className="text-body-sm text-content-muted">No candidates yet.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">{candidates.data.map((c) => (
            <li key={c.id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center gap-2"><p className="text-card-title text-content-primary">{c.name}</p><Tag>{REVIEW[c.review]}</Tag></div>
              <p className="text-caption text-content-muted">Selected by {c.selectedBy} · {day(c.selectedAt)}</p>
              <ul className="mt-2 space-y-1">{c.checks.map((k) => <li key={k.label} className="flex items-center gap-2 text-body-sm text-content-primary"><CheckMark state={k.state} />{k.label}</li>)}</ul>
            </li>))}
          </ul>
        )}
      </Section>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Admin">Models the admins shared with each other, and the candidates selected for production. Only visible to admins.</PageTitle>
      <Tabs items={tabs} activeKey={active} variant="underline" />
      {body}
    </div>
  )
}
