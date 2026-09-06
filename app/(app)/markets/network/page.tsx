import type { Metadata } from 'next'
import { Suspense } from 'react'
import AtlasImmersiveMode from '@/components/AtlasImmersiveMode'
import MarketUniverse from '@/components/MarketUniverse'
import { SiteHeader } from '@/components/marketing/site-chrome'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import {
  deriveFallbackAtlas,
  getMarketNetwork,
  getRelationshipAtlas,
  type AtlasView,
} from '@/lib/network'

export const metadata: Metadata = {
  title: 'Market Universe - Longbrunch',
  description: 'Move through the market as a progressive universe of observed relationships.',
}

function singleSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}

function atlasView(value: string | null): AtlasView {
  return value === 'residual' || value === 'timing' || value === 'theme' ? value : 'market'
}

function evidenceWindow(value: string | null): 126 | 252 {
  return value === '126' ? 126 : 252
}

export default async function MarketNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string | string[]; view?: string | string[] }>
}) {
  const resolved = await searchParams
  const window = evidenceWindow(singleSearchParam(resolved.window))
  const view = atlasView(singleSearchParam(resolved.view))

  const materialized = await getRelationshipAtlas(window, view).catch(() => null)
  let atlas = materialized
  if (!atlas && view === 'market') {
    const legacy = await getMarketNetwork({ window: String(window), minAbsCorrelation: 0.28, topK: 8 }).catch(() => null)
    if (legacy) {
      const fallback = deriveFallbackAtlas(legacy, 'market')
      atlas = fallback.atlas
    }
  }

  if (!atlas) {
    return (
      <div className="container-lg py-16">
        <EmptyState
          title={`${view === 'market' ? 'The market universe' : 'This relationship view'} is temporarily unavailable`}
          description={view === 'market'
            ? 'The latest relationship snapshot could not be loaded.'
            : 'No materialized topology is available for this view and evidence window yet.'}
          action={<RetryButton>Retry</RetryButton>}
        />
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="min-h-[70svh]" aria-hidden="true" />}>
      <AtlasImmersiveMode />
      <SiteHeader activeHref="/" />
      <MarketUniverse initialAtlas={atlas} />
    </Suspense>
  )
}
