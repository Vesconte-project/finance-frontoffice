import Link from 'next/link'
import Problem from '@/components/model-lab/Problem'
import SetResults from '@/components/model-lab/SetResults'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError } from '@/lib/model-lab/contract'
import { isUuid } from '@/lib/model-lab/validate'

export const dynamic = 'force-dynamic'

export default async function TestResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const back = { href: '/models', label: 'All theses' }
  if (!isUuid(id)) return <Problem error={new ModelLabError('not-found')} back={back} />
  const { source } = await labContext()
  const results = await load(() => source.getTestResults(id))
  if (!results.ok) return <Problem error={results.error} back={back} />
  return (
    <div className="space-y-6">
      <Link href={`/models/theses/${results.data.thesisId}`} className="text-label-sm text-content-secondary hover:text-content-primary">← Thesis</Link>
      <div className="max-w-3xl space-y-2">
        <h1 className="text-page-title text-content-primary">Set of variants</h1>
        <p className="font-[var(--font-display)] text-lg text-content-primary">{results.data.statement}</p>
      </div>
      <SetResults results={results.data} />
    </div>
  )
}
