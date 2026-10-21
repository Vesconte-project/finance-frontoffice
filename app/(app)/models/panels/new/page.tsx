import Link from 'next/link'
import PanelBuilder from '@/components/model-lab/PanelBuilder'
import Problem from '@/components/model-lab/Problem'
import { labContext, load } from '@/lib/model-lab/context'

export const dynamic = 'force-dynamic'

export default async function NewPanelPage({ searchParams }: { searchParams: Promise<{ models?: string }> }) {
  const { models } = await searchParams
  const { source } = await labContext()
  const library = await load(() => source.libraryModels())
  if (!library.ok) return <Problem error={library.error} back={{ href: '/models/panels', label: 'All panels' }} />
  const preselected = (models ?? '').split(',').filter(Boolean).slice(0, 6)
  return (
    <div className="space-y-6">
      <Link href="/models/panels" className="text-label-sm text-content-secondary hover:text-content-primary">← All panels</Link>
      <h1 className="text-page-title text-content-primary">New panel</h1>
      <PanelBuilder library={library.data} preselected={preselected} watchlist={[]} />
    </div>
  )
}
