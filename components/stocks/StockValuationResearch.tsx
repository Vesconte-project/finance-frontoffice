import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import MultiplesChapter from '@/components/stocks/valuation/MultiplesChapter'
import PriceAssumesChapter from '@/components/stocks/valuation/PriceAssumesChapter'
import AnalystsChapter from '@/components/stocks/valuation/AnalystsChapter'
import styles from '@/components/stocks/valuation/Valuation.module.css'
import type { StockResearchData } from '@/lib/stock-research'
import type { MultipleKey, MultiplePoint } from '@/lib/valuation-reading'

/**
 * Valuation, in the Spec's order: multiples, peers, what the price assumes and
 * what analysts expect. Only reported multiples are drawn; peers, sector,
 * the valuation model remain placeholders; explicit current analyst consensus
 * uses the existing summary contract (ENG-89, ENG-91,
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
            <PriceAssumesChapter ticker={data.ticker} inputs={data.summary.asset?.assetType === 'equity' ? data.summary.earningsModelInputs : null} />
            <AnalystsChapter data={data} />
          </>
        )}
      </div>
      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
