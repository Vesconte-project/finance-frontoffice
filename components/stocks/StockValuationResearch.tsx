import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import MultiplesChapter from '@/components/stocks/valuation/MultiplesChapter'
import PriceAssumesChapter from '@/components/stocks/valuation/PriceAssumesChapter'
import styles from '@/components/stocks/valuation/Valuation.module.css'
import type { StockResearchData } from '@/lib/stock-research'
import type { MultipleKey, MultiplePoint } from '@/lib/valuation-reading'

/**
 * Valuation, in the Spec's order: multiples, peers, what the price assumes and
 * what analysts expect. Only reported multiples are drawn; peers, sector,
 * the valuation model and analyst consensus are being built (ENG-89, ENG-91,
 * ENG-165, ENG-166).
 */
export default function StockValuationResearch({
  data,
  series,
}: {
  data: StockResearchData
  series: Record<MultipleKey, MultiplePoint[]>
}) {
  const isFund = data.kind === 'fund'
  return (
    <ResearchViewShell data={data} title="Valuation" showHeader={false}>
      <div className={styles.chapters} data-valuation="">
        <MultiplesChapter series={series} ticker={data.ticker} />
        {isFund ? null : (
          <>
            <ResearchChapter
              id="peers"
              label="Against its peers"
              band
              aside={<BeingBuilt label="The chosen peer">A peer’s P/E, its expected growth and how it sits against the trend are being added.</BeingBuilt>}
            >
              <BeingBuilt size="chart">
                {data.ticker}’s P/E against expected growth over three years, beside its peers and their trend, is being added.
              </BeingBuilt>
            </ResearchChapter>
            <PriceAssumesChapter ticker={data.ticker} />
            <ResearchChapter
              id="analysts"
              label="What analysts expect"
              band
              lead={<BeingBuilt size="inline">The median price target, and how far it is from the price, is being added.</BeingBuilt>}
              aside={<BeingBuilt label="Recommendations">How many analysts say buy, hold or sell, and how the median target moved in 90 days, are being added.</BeingBuilt>}
            >
              <BeingBuilt size="chart">The range of price targets, from the lowest to the highest, with the price and the median, is being added.</BeingBuilt>
            </ResearchChapter>
          </>
        )}
      </div>
      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
