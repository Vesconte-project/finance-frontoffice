import type { Metadata } from 'next'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import RelationshipOrbit, { type RelationshipWindow, type ToggleLayer } from '@/components/RelationshipOrbit'
import { hasRelationshipExperience } from '@/lib/relationship-visibility'
import { getTickerRelationships, type TickerRelationships } from '@/lib/relationships'
import { getStockResearchData } from '@/lib/stock-research'

export const dynamic = 'force-dynamic'

type QueryValue = string | string[] | undefined

function singleParam(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseWindow(value: string | undefined): RelationshipWindow {
  return value === '126' ? 126 : 252
}

function parseLayer(value: string | undefined): ToggleLayer | undefined {
  if (value === 'residual' || value === 'theme' || value === 'leadLag' || value === 'market') return value
  return undefined
}

function emptyRelationships(ticker: string, window: RelationshipWindow): TickerRelationships {
  return {
    asOf: null,
    ticker,
    window,
    node: null,
    nodes: [],
    marketCoMovers: [],
    residualCoMovers: [],
    leadLag: { followers: [], leaders: [] },
    probableSpurious: [],
    themePeers: [],
  }
}

async function loadRelationships(ticker: string, window: RelationshipWindow) {
  try {
    return { data: await getTickerRelationships(ticker, { window, topK: 50 }), failed: false }
  } catch {
    return { data: emptyRelationships(ticker, window), failed: true }
  }
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params
  return {
    title: `${ticker.toUpperCase()} Relationships - Vesconte`,
    description: `Observed relationship evidence and co-movement context for ${ticker.toUpperCase()}.`,
  }
}

export default async function RelationshipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>
  searchParams: Promise<Record<string, QueryValue>>
}) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const query = await searchParams
  const initialWindow = parseWindow(singleParam(query.window))
  const initialLayer = parseLayer(singleParam(query.layer))
  const [researchResult, relationship126, relationship252] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    loadRelationships(ticker, 126),
    loadRelationships(ticker, 252),
  ])

  if (!researchResult) return <ResearchUnavailable ticker={ticker} />
  if (relationship126.failed && relationship252.failed) {
    return <EmptyState title="Relationships are temporarily unavailable" description="The relationship data could not be loaded right now." action={<RetryButton>Retry</RetryButton>} />
  }

  const relationshipsByWindow = { 126: relationship126.data, 252: relationship252.data } as Record<RelationshipWindow, TickerRelationships>
  const hasAnyExperience = hasRelationshipExperience(relationshipsByWindow[126]) || hasRelationshipExperience(relationshipsByWindow[252])
  return (
    <ResearchViewShell data={researchResult} title="Relationships" showHeader={false}>
      <div data-relationship-page="">
        {hasAnyExperience ? (
          <RelationshipOrbit
            relationshipsByWindow={relationshipsByWindow}
            centerTicker={ticker}
            centerName={researchResult.name}
            initialWindow={initialWindow}
            initialLayer={initialLayer}
          />
        ) : (
          <ResearchChapter id="related-companies" label="Related companies">
            <BeingBuilt size="chart">The companies whose prices move with {ticker}’s, and how closely, are being added.</BeingBuilt>
          </ResearchChapter>
        )}
      </div>
    </ResearchViewShell>
  )
}
