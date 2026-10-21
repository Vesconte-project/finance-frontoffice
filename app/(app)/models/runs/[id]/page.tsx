import Problem from '@/components/model-lab/Problem'
import RunProgress from '@/components/model-lab/RunProgress'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError } from '@/lib/model-lab/contract'
import { isUuid } from '@/lib/model-lab/validate'

export const dynamic = 'force-dynamic'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const back = { href: '/models', label: 'All theses' }
  if (!isUuid(id)) return <Problem error={new ModelLabError('not-found')} back={back} />
  const { source } = await labContext()
  const run = await load(() => source.getRun(id))
  if (!run.ok) return <Problem error={run.error} back={back} />
  return <RunProgress initial={run.data} />
}
