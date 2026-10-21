import Link from 'next/link'
import Problem from '@/components/model-lab/Problem'
import { PageTitle, Tag } from '@/components/model-lab/ui'
import { buttonClass } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { labContext, load } from '@/lib/model-lab/context'
import { RULE_TEXT } from '@/lib/model-lab/conditions'

export const dynamic = 'force-dynamic'

export default async function PanelsPage() {
  const { source } = await labContext()
  const panels = await load(() => source.listPanels())
  if (!panels.ok) return <Problem error={panels.error} />
  return (
    <div className="space-y-6">
      <PageTitle title="Panels" actions={<Link href="/models/panels/new" className={buttonClass()}>New panel</Link>}>
        A panel combines models you have already tested, so one stock can be looked at through several of them.
      </PageTitle>
      {panels.data.length === 0 ? (
        <EmptyState title="No panels yet" description="Test a few theses first, then combine the ones you want to follow together." action={<Link href="/models/panels/new" className={buttonClass()}>Build a panel</Link>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {panels.data.map((p) => (
            <li key={p.id}>
              <Link href={`/models/panels/${p.id}`} className="block focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                <Card padding="md" className="h-full hover:border-[var(--line-strong)]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-card-title text-content-primary">{p.name}</h2>
                    <Tag>{p.status === 'watching' ? 'Watching' : 'Paused'}</Tag>
                  </div>
                  <p className="text-body-sm mt-1 text-content-muted">
                    {p.members.length} models · {p.assets.length} stocks
                  </p>
                  <p className="text-body-sm mt-2 text-content-primary">
                    {p.rule === 'agree' ? RULE_TEXT.agree(p.agreementNeeded, p.members.length) : p.rule === 'spec' ? RULE_TEXT.spec() : RULE_TEXT.blend()}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
