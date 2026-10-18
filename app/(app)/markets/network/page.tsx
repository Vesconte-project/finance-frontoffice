import type { Metadata } from 'next'
import AtlasExplorer from '@/components/atlas/AtlasExplorer'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import { getAtlasOverview } from '@/lib/atlas'

export const metadata: Metadata = {
  title: 'Market Atlas - Vesconte',
  description: 'A weekly map of which companies move together beyond the market.',
}

// Levels 0 and 1 make the whole-map view; deeper levels load by area as a signed-in reader zooms in.
const FIRST_LEVEL = 1

export default async function MarketAtlasPage() {
  const result = await getAtlasOverview(FIRST_LEVEL)

  if (result.status === 'ok') return <AtlasExplorer initial={result.data} />

  return (
    <div className="container-lg py-16">
      {result.status === 'not_found' ? (
        <EmptyState
          title="The first weekly atlas is being built"
          description="The map appears here once its first week has been computed."
        />
      ) : (
        <EmptyState
          title="The market atlas is temporarily unavailable"
          description="The latest weekly map could not be loaded."
          action={<RetryButton>Retry</RetryButton>}
        />
      )}
    </div>
  )
}
