import Link from 'next/link'
import EvidenceTab from '@/components/model-lab/thesis/EvidenceTab'
import LineageTab from '@/components/model-lab/thesis/LineageTab'
import NotesTab from '@/components/model-lab/thesis/NotesTab'
import SubmitCopy from '@/components/model-lab/thesis/SubmitCopy'
import TestsTab from '@/components/model-lab/thesis/TestsTab'
import WatchingTab from '@/components/model-lab/thesis/WatchingTab'
import Problem from '@/components/model-lab/Problem'
import { Tag } from '@/components/model-lab/ui'
import { buttonClass } from '@/components/ui/Button'
import Tabs, { type TabItem } from '@/components/ui/Tabs'
import { labContext, load } from '@/lib/model-lab/context'
import { currentTimeMs } from '@/lib/model-lab/time'
import { isUuid } from '@/lib/model-lab/validate'
import { ModelLabError } from '@/lib/model-lab/contract'

export const dynamic = 'force-dynamic'

type TabKey = 'evidence' | 'tests' | 'watching' | 'notes' | 'lineage'

export default async function ThesisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const { tab: requested } = await searchParams
  if (!isUuid(id)) return <Problem error={new ModelLabError('not-found')} back={{ href: '/models', label: 'All theses' }} />
  const { source, depth, viewer } = await labContext()
  const detail = await load(() => source.getThesis(id))
  if (!detail.ok) return <Problem error={detail.error} back={{ href: '/models', label: 'All theses' }} />

  const { summary, tests, notes, versions, lineage } = detail.data
  const tabs: (TabItem & { key: TabKey })[] = [
    { key: 'evidence', label: 'Evidence', href: `/models/theses/${id}` },
    ...(depth !== 'guided' ? [{ key: 'tests' as const, label: 'Tests', href: `/models/theses/${id}?tab=tests` }] : []),
    { key: 'watching', label: 'Watching', href: `/models/theses/${id}?tab=watching` },
    { key: 'notes', label: 'Notes and versions', href: `/models/theses/${id}?tab=notes` },
    ...(depth === 'lab' && lineage ? [{ key: 'lineage' as const, label: 'How it was calculated', href: `/models/theses/${id}?tab=lineage` }] : []),
  ]
  const active: TabKey = tabs.some((t) => t.key === requested) ? (requested as TabKey) : 'evidence'
  const lastSet = tests.find((t) => t.status === 'completed')

  let body: React.ReactNode
  if (active === 'evidence') {
    const evidence = await load(() => source.getEvidence(id))
    body = evidence.ok ? <EvidenceTab summary={summary} evidence={evidence.data} depth={depth} lastTestId={lastSet?.id ?? null} /> : <Problem error={evidence.error} />
  } else if (active === 'tests') {
    body = <TestsTab thesisId={id} tests={tests} unit={viewer.quota.unit} nowMs={currentTimeMs()} />
  } else if (active === 'watching') {
    const evidence = await load(() => source.getEvidence(id))
    body = evidence.ok ? <WatchingTab thesisId={id} history={evidence.data.history} initial={evidence.data.watch} /> : <Problem error={evidence.error} />
  } else if (active === 'notes') {
    body = <NotesTab thesisId={id} notes={notes} versions={versions} holding={summary.checksHolding} total={summary.checksTotal} nowMs={currentTimeMs()} />
  } else {
    body = lineage ? <LineageTab lineage={lineage} /> : <Problem error={new ModelLabError('forbidden')} />
  }

  return (
    <div className="space-y-6">
      <div><Link href="/models" className="text-label-sm text-content-secondary hover:text-content-primary">← All theses</Link></div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{summary.checksHolding} of {summary.checksTotal} checks hold</Tag>
            <Tag>{summary.status === 'watching' ? 'Watching' : summary.status === 'tested' ? 'Tested' : 'Draft'}</Tag>
          </div>
          <h1 className="text-page-title text-content-primary">{summary.statement}</h1>
          <ul className="flex flex-wrap gap-1.5" aria-label="Stocks">
            {summary.assets.map((a) => <li key={a} className="rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[11px] text-content-secondary">{a}</li>)}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:max-w-md md:justify-end">
          <SubmitCopy thesisId={id} submitted={summary.submittedAt !== null} />
          <Link href={`/models/new?thesis=${id}&edit=1`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Edit thesis</Link>
          <Link href={`/models/new?thesis=${id}`} className={buttonClass({ size: 'sm' })}>Test again</Link>
        </div>
      </div>
      <Tabs items={tabs} activeKey={active} variant="underline" />
      {body}
    </div>
  )
}
