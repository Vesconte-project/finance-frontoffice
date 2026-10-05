import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { PriceHistoryChapter, PricePaysForChapter } from '@/components/stocks/ownership/PriceStoryChapters'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import PairedBars from '@/components/stocks/research/PairedBars'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import type { BuybackSummary, PricePeriod } from '@/lib/capital-reading'
import { formatCompactMoney } from '@/lib/currency'
import { currentResearchSnapshot } from '@/lib/research-evidence'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './StockOwnershipResearch.module.css'

const SINCE_YEAR = 2016

const shareCount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? dayFormat.format(parsed) : value
}

/**
 * Shares in 2016 → bought back → issued to staff → shares today (Spec PRD-78).
 * What is reported shows: the shares bought back (a sum of reported counts)
 * and today's count. The 2016 count, the shares issued to staff and the rings
 * with each share's larger stake come from the backend (ENG-167).
 */
function ShareBalanceCard({ bought, today, todayAsOf }: { bought: number | null; today: number | null; todayAsOf: string | null }) {
  const rows = [
    { key: 'start', label: `Shares in ${SINCE_YEAR}`, value: null as string | null },
    { key: 'bought', label: 'Bought back', value: bought === null ? null : `−${shareCount.format(bought)}` },
    { key: 'issued', label: 'Issued to staff', value: null },
    { key: 'today', label: 'Shares today', value: today === null ? null : shareCount.format(today) },
  ]
  return (
    <ChapterCard title={`Shares, ${SINCE_YEAR} → today`} meta={todayAsOf && today !== null ? `as of ${formatDay(todayAsOf)}` : undefined}>
      <dl className={styles.shareBalance} data-share-balance="">
        {rows.map((row) => (
          <div key={row.key} data-share-row={row.key}>
            <dt><span className={styles.shareSwatch} data-row={row.key} aria-hidden="true" />{row.label}</dt>
            <dd data-tone={row.key === 'bought' && row.value ? 'up' : undefined}>{row.value ?? <BeingBuiltBadge />}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.cardNote}><BeingBuiltBadge /> The rings, and how much more of the company each share owns, are being added.</p>
    </ChapterCard>
  )
}

/**
 * Buybacks since 2016: what was spent each year against what those shares are
 * worth at today's price, from the reported executions (sums and one
 * multiplication, Spec decision 4). Every year since 2016 keeps its place; a
 * year with nothing reported stays empty.
 */
function BuybacksChapter({
  summary,
  mixedCurrencies,
  currency,
  sharesBought,
  sharesToday,
  sharesTodayAsOf,
}: {
  summary: BuybackSummary | null
  mixedCurrencies: boolean
  currency: string
  sharesBought: number | null
  sharesToday: number | null
  sharesTodayAsOf: string | null
}) {
  const recentFrom = summary && summary.recentShare !== null ? summary.years.findIndex((year) => year.year === summary.recentYears[0]) : -1
  return (
    <ResearchChapter
      id="buybacks"
      label={`Buybacks since ${SINCE_YEAR}`}
      lead={summary ? (
        <LeadStat
          value={formatCompactMoney(summary.spent, currency)}
          context={(
            <span className={styles.buybackLegend} data-buyback-lead="">
              <span className={styles.legendSpent}>spent on buybacks</span>
              {summary.worthToday !== null ? (
                <span className={styles.legendWorth}><strong>{formatCompactMoney(summary.worthToday, currency)}</strong> worth now</span>
              ) : (
                <span className={styles.legendNote}><BeingBuiltBadge /> What those shares are worth now needs every share count.</span>
              )}
            </span>
          )}
        />
      ) : (
        <BeingBuilt size="inline">
          {mixedCurrencies
            ? 'Buybacks reported in more than one currency are being added together.'
            : `What the company has spent on buybacks since ${SINCE_YEAR}, and what those shares are worth today, is being added.`}
        </BeingBuilt>
      )}
      aside={<ShareBalanceCard bought={sharesBought} today={sharesToday} todayAsOf={sharesTodayAsOf} />}
    >
      {summary ? (
        <>
          <PairedBars
            ariaLabel={`Spent on buybacks each year from ${summary.years[0].year} to ${summary.years.at(-1)!.year}, beside what those shares are worth at today’s price; years with no buyback reported are empty`}
            bracket={recentFrom >= 0 ? { from: recentFrom, label: `${Math.round((summary.recentShare as number) * 100)}% of spend` } : null}
            pairs={summary.years.map((year) => ({
              key: String(year.year),
              first: year.spent,
              second: year.worthToday,
              label: year.multiple === null ? null : `×${year.multiple.toFixed(1)}`,
              axisLabel: String(year.year),
              axisShort: `'${String(year.year).slice(-2)}`,
            }))}
          />
          <p className={styles.chartNote} data-buyback-legend="">× = what $1 spent that year is worth now</p>
        </>
      ) : (
        <BeingBuilt size="chart">What the company spent on buybacks each year, and what those shares are worth now, is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}

type OwnershipProps = {
  data: StockResearchData
  buybackYears: BuybackSummary | null
  mixedCurrencies: boolean
  sharesBought: number | null
  sharesToday: number | null
  sharesTodayAsOf: string | null
  priceByYear: PricePeriod[]
  priceByQuarter: PricePeriod[]
}

function EquityOwnership({ data, buybackYears, mixedCurrencies, sharesBought, sharesToday, sharesTodayAsOf, priceByYear, priceByQuarter }: OwnershipProps) {
  const snapshot = currentResearchSnapshot(data)
  const currency = snapshot.currency || data.currency
  return (
    <>
      <ResearchChapter
        id="who-owns"
        label="Who owns the shares"
        aside={<BeingBuilt label="Largest holders">The largest holders in each group, their stakes and how they changed in a year are being added.</BeingBuilt>}
      >
        <BeingBuilt size="chart">How the shares split between funds, pensions, insiders and individual investors is being added.</BeingBuilt>
      </ResearchChapter>

      <ResearchChapter
        id="insiders"
        label="Insiders, last 90 days"
        band
        aside={<BeingBuilt label="Each trade">Who traded, how much, and whether the sale was planned are being added.</BeingBuilt>}
      >
        <BeingBuilt size="chart">What insiders sold and bought, marked on the share price, is being added.</BeingBuilt>
      </ResearchChapter>

      <BuybacksChapter
        summary={buybackYears}
        mixedCurrencies={mixedCurrencies}
        currency={currency}
        sharesBought={sharesBought}
        sharesToday={sharesToday}
        sharesTodayAsOf={sharesTodayAsOf}
      />

      <PricePaysForChapter marketCap={snapshot.marketCap} marketCapAsOf={snapshot.reportingPeriod} currency={currency} />

      <PriceHistoryChapter byYear={priceByYear} byQuarter={priceByQuarter} currency={currency} />
    </>
  )
}

function FundStructure() {
  return (
    <>
      <ResearchChapter
        id="fund-structure"
        label="Fund structure"
        aside={<BeingBuilt label="Fund context">Issuer, assets under management and holder concentration are being added.</BeingBuilt>}
      >
        <BeingBuilt size="chart">The issuer, the assets the fund holds and how its units are created and redeemed are being added.</BeingBuilt>
        <p className={styles.note}>Funds are read with fund figures; company measures such as insider ownership, corporate debt and dilution are not applied to them.</p>
      </ResearchChapter>

      <ResearchChapter id="fund-units" label="Units over time" band>
        <BeingBuilt size="chart">How the fund’s units changed through creations and redemptions is being added.</BeingBuilt>
      </ResearchChapter>
    </>
  )
}

export default function StockOwnershipResearch(props: OwnershipProps) {
  const isFund = props.data.kind === 'fund'

  return (
    <ResearchViewShell data={props.data} title={isFund ? 'Fund Structure' : 'Ownership & Capital'} showHeader={false}>
      <div className={styles.page}>
        {isFund ? <FundStructure /> : <EquityOwnership {...props} />}
        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
