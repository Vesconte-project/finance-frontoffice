import Link from 'next/link'
import AlertsTab from '@/components/model-lab/panel/AlertsTab'
import EvidenceTab from '@/components/model-lab/panel/EvidenceTab'
import ModelsTab from '@/components/model-lab/panel/ModelsTab'
import TodayTab from '@/components/model-lab/panel/TodayTab'
import PipelineSteps from '@/components/model-lab/PipelineSteps'
import Problem from '@/components/model-lab/Problem'
import { Tag } from '@/components/model-lab/ui'
import Tabs, { type TabItem } from '@/components/ui/Tabs'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError } from '@/lib/model-lab/contract'
import { isUuid } from '@/lib/model-lab/validate'

export const dynamic = 'force-dynamic'

type TabKey = 'today' | 'models' | 'evidence' | 'alerts' | 'lineage'
const BACK = { href: '/models/panels', label: 'All panels' }

export default async function PanelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const { tab: requested } = await searchParams
  if (!isUuid(id)) return <Problem error={new ModelLabError('not-found')} back={BACK} />
  const { source, depth, viewer } = await labContext()
  const panel = await load(() => source.getPanel(id))
  if (!panel.ok) return <Problem error={panel.error} back={BACK} />

  const lineage = depth === 'lab' && viewer.role === 'team'
  const tabs: (TabItem & { key: TabKey })[] = [
    { key: 'today', label: 'Today', href: `/models/panels/${id}` },
    { key: 'models', label: 'Models and rule', href: `/models/panels/${id}?tab=models` },
    { key: 'evidence', label: 'Evidence', href: `/models/panels/${id}?tab=evidence` },
    { key: 'alerts', label: 'Alerts', href: `/models/panels/${id}?tab=alerts` },
    ...(lineage ? [{ key: 'lineage' as const, label: 'How it was calculated', href: `/models/panels/${id}?tab=lineage` }] : []),
  ]
  const active: TabKey = tabs.some((t) => t.key === requested) ? (requested as TabKey) : 'today'

  let body: React.ReactNode
  if (active === 'today') {
    const today = await load(() => source.panelToday(id))
    body = today.ok ? <TodayTab panel={panel.data} today={today.data} /> : <Problem error={today.error} />
  } else if (active === 'models') {
    body = <ModelsTab panel={panel.data} />
  } else if (active === 'evidence') {
    const evidence = await load(() => source.panelEvidence(id))
    body = evidence.ok ? <EvidenceTab evidence={evidence.data} /> : <Problem error={evidence.error} />
  } else if (active === 'alerts') {
    const alerts = await load(() => source.panelAlerts(id))
    body = alerts.ok ? <AlertsTab panel={panel.data} replays={alerts.data.replays} /> : <Problem error={alerts.error} />
  } else {
    const view = await load(() => source.teamPipeline('panel'))
    body = view.ok ? <PipelineSteps view={view.data} /> : <Problem error={view.error} />
  }

  return (
    <div className="space-y-6">
      <Link href="/models/panels" className="text-label-sm text-content-secondary hover:text-content-primary">← All panels</Link>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><Tag>{panel.data.members.length} models</Tag><Tag>{panel.data.status === 'watching' ? 'Watching' : 'Paused'}</Tag></div>
        <h1 className="text-page-title text-content-primary">{panel.data.name}</h1>
        <ul className="flex flex-wrap gap-1.5" aria-label="Stocks">
          {panel.data.assets.map((a) => <li key={a} className="rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[11px] text-content-secondary">{a}</li>)}
        </ul>
      </div>
      <Tabs items={tabs} activeKey={active} variant="underline" />
      {body}
    </div>
  )
}
