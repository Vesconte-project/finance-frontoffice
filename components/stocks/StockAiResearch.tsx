import Link from 'next/link'
import ResearchViewShell from '@/components/stocks/ResearchViewShell'
import AskQuestion from '@/components/stocks/ai/AskQuestion'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import { getViewerAccess } from '@/lib/billing'
import type { StockResearchData } from '@/lib/stock-research'

/**
 * AI Research on the research chapters. The ticker brief and the answers are
 * being built (ENG-162); the question box is in place and says so when used.
 */
export default async function StockAiResearch({ data }: { data: StockResearchData }) {
  const access = await getViewerAccess()

  return (
    <ResearchViewShell data={data} title="AI Research" showHeader={false}>
      <div data-ai-research="">
        <ResearchChapter
          id="ask"
          label={`Ask about ${data.ticker}`}
          aside={(
            <>
              <BeingBuilt label="Sources">Each answer will cite the Vesconte data it uses, with its date; this is being added.</BeingBuilt>
              <ChapterCard title="Your plan" meta={access.isPro ? 'Pro' : 'Free'}>
                {access.isPro ? (
                  <p>AI research will be part of your plan when it opens.</p>
                ) : (
                  <p>AI research will be part of eligible plans. <Link href="/pricing">View plans →</Link></p>
                )}
              </ChapterCard>
            </>
          )}
        >
          <AskQuestion ticker={data.ticker} />
        </ResearchChapter>
        <ResearchChapter id="brief" label="Research brief" band>
          <BeingBuilt size="chart">
            A short brief on {data.name}, built from its signals, fundamentals and events, with a citation for each point, is being added.
          </BeingBuilt>
        </ResearchChapter>
      </div>
    </ResearchViewShell>
  )
}
