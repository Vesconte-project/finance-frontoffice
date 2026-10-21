import Link from 'next/link'
import DepthSwitch from '@/components/model-lab/DepthSwitch'
import LabNav from '@/components/model-lab/LabNav'
import PreviewStates from '@/components/model-lab/PreviewStates'
import Problem from '@/components/model-lab/Problem'
import { Tag } from '@/components/model-lab/ui'
import { labContext } from '@/lib/model-lab/context'
import { ModelLabError } from '@/lib/model-lab/contract'
import { toModelLabError } from '@/lib/model-lab/backend-source'

export const dynamic = 'force-dynamic'

function quotaText(remaining: number, limit: number, unit: { one: string; many: string }, kind: 'credits' | 'budget'): string {
  const r = Math.round(remaining * 10) / 10
  return `${r} of ${limit} ${r === 1 ? unit.one : unit.many} left${kind === 'budget' ? ' (internal budget)' : ''}`
}

export default async function ModelsLayout({ children }: { children: React.ReactNode }) {
  let context
  try {
    context = await labContext()
  } catch (error) {
    const failure = error instanceof ModelLabError ? error : toModelLabError(error)
    return (
      <div className="container-md section-gap">
        <Problem error={failure} />
      </div>
    )
  }
  const { viewer, depth, fixtureState } = context
  const quota = viewer.quota
  const share = quota.limit > 0 ? Math.max(0, Math.min(100, (quota.remaining / quota.limit) * 100)) : 0
  return (
    <div className="container-md section-gap">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[var(--line)]">
        <LabNav unread={viewer.unreadAlerts} team={viewer.role === 'team'} />
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <DepthSwitch depth={depth} lab={viewer.role === 'team'} />
          {viewer.plan === 'free' ? (
            <>
              <Tag>Free plan</Tag>
              <Link href="/pricing" className="text-label-sm text-[var(--color-accent)] underline underline-offset-2">Upgrade</Link>
            </>
          ) : (
            <div className="flex items-center gap-2 text-label-sm text-content-secondary" aria-label="Your allowance">
              <span className="tabular-nums">{quotaText(quota.remaining, quota.limit, quota.unit, quota.kind)}</span>
              <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-sm bg-[var(--line)]">
                <i className="block h-full bg-[var(--accent)]" style={{ width: `${share}%` }} />
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 space-y-6">{children}</div>
      {fixtureState ? <PreviewStates state={fixtureState} /> : null}
    </div>
  )
}
