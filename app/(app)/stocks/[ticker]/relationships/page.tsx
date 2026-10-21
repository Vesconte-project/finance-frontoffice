import Link from 'next/link'
import type { Metadata } from 'next'
import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import ResearchUnavailable from '@/components/stocks/ResearchUnavailable'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import CompanyAtlasPlace from '@/components/atlas/CompanyAtlasPlace'
import { getAtlasCompany } from '@/lib/atlas'
import { getStockResearchData } from '@/lib/stock-research'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params
  return {
    title: `${ticker.toUpperCase()} Relationships - Vesconte`,
    description: `Where ${ticker.toUpperCase()} sits on the weekly market atlas and the companies it moves with.`,
  }
}

export default async function RelationshipsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const [researchResult, atlas] = await Promise.all([
    getStockResearchData(ticker).catch(() => null),
    getAtlasCompany(ticker),
  ])

  if (!researchResult) return <ResearchUnavailable ticker={ticker} />
  if (atlas.status === 'unavailable') {
    return <EmptyState title="Relationships are temporarily unavailable" description="The weekly atlas could not be loaded right now." action={<RetryButton>Retry</RetryButton>} />
  }

  return (
    <ResearchViewShell data={researchResult} title="Relationships" showHeader={false}>
      <div data-relationship-page="">
        {atlas.status === 'ok' ? (
          <CompanyAtlasPlace panel={atlas.data} />
        ) : atlas.status === 'denied' && atlas.reason === 'sign_in_required' ? (
          <ResearchChapter id="related-companies" label="Related companies">
            <p>
              <Link href={`/sign-up?redirect_url=/stocks/${ticker}/relationships`}>Create a free account</Link> to see where {ticker} sits on the market atlas and the companies it moves with.
            </p>
            <p><Link href="/markets/network">Open the market atlas</Link></p>
          </ResearchChapter>
        ) : (
          <ResearchChapter id="related-companies" label="Related companies">
            <BeingBuilt size="chart">{ticker} is not on this week’s market atlas yet. It appears once it has a year of trading history.</BeingBuilt>
          </ResearchChapter>
        )}
      </div>
    </ResearchViewShell>
  )
}
