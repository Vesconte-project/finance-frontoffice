import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import PairedBars from '@/components/stocks/research/PairedBars'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import type { BuybackExecution, BuybackSummary } from '@/lib/capital-reading'
import { formatCompactMoney, formatMoney } from '@/lib/currency'
import {
  currentResearchSnapshot,
  formatResearchDate,
  formatResearchMoney,
  formatResearchShares,
} from '@/lib/research-evidence'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './StockOwnershipResearch.module.css'

/** A formatted figure, or a plain statement that it is missing — never a dash. */
function Figure({ value }: { value: string }) {
  return value === '—' || !value.trim() ? <span className={styles.missing}>Not available</span> : <>{value}</>
}

function CurrentSnapshot({ data }: { data: StockResearchData }) {
  const snapshot = currentResearchSnapshot(data)
  const fields = [
    { label: 'Market cap', value: formatResearchMoney(snapshot.marketCap, snapshot.currency) },
    { label: 'Shares outstanding', value: formatResearchShares(snapshot.sharesOutstanding) },
    { label: 'Currency', value: snapshot.currency },
    { label: 'Reporting period', value: formatResearchDate(snapshot.reportingPeriod) },
  ]

  return (
    <section className={styles.snapshotStrip} aria-label="Current capital snapshot">
      {fields.map((field) => (
        <div className={styles.snapshotItem} key={field.label}>
          <span>{field.label}</span>
          <strong><Figure value={field.value} /></strong>
        </div>
      ))}
    </section>
  )
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  return dayFormat.format(Date.parse(`${value}T00:00:00Z`))
}

const shareCount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

/**
 * Buybacks since 2016: what was spent each year against what those shares are
 * worth at today's price, from the reported executions (sums and one
 * multiplication, Spec decision 4), and each execution as reported. The share
 * count then and now is being built (ENG-167).
 */
function BuybacksChapter({
  buybacks,
  summary,
  currency,
}: {
  buybacks: BuybackExecution[]
  summary: BuybackSummary | null
  currency: string
}) {
  const newestFirst = [...buybacks].reverse()
  const recentFrom = summary && summary.recentShare !== null ? summary.years.findIndex((year) => year.year === summary.recentYears[0]) : -1
  return (
    <ResearchChapter
      id="buybacks"
      label="Buybacks since 2016"
      lead={summary ? (
        <div className={styles.buybackLead} data-buyback-lead="">
          <LeadStat
            value={formatCompactMoney(summary.spent, currency)}
            context={(
              <>
                <span className={styles.legendSpent}>spent on buybacks since {summary.years[0].year}</span>
                {summary.worthToday !== null ? (
                  <span className={styles.legendWorth}><strong>{formatCompactMoney(summary.worthToday, currency)}</strong> worth now</span>
                ) : (
                  <span className={styles.legendNote}><BeingBuiltBadge /> What those shares are worth now needs every share count.</span>
                )}
              </>
            )}
          />
        </div>
      ) : (
        <BeingBuilt size="inline">What the company has spent on buybacks since 2016, and what those shares are worth today, is being added.</BeingBuilt>
      )}
      aside={(
        <>
          <BeingBuilt label="Shares then and now">How many shares were bought back, issued to staff and left today, and how much more of the company each share owns, is being added.</BeingBuilt>
          {buybacks.length > 0 ? (
            <ChapterCard title="Each buyback" meta={`${buybacks.length} reported`}>
              <ol className={styles.executions} data-buyback-list="">
                {newestFirst.slice(0, 8).map((execution) => (
                  <li key={execution.id}>
                    <span className={styles.executionDate}>
                      {execution.periodStart ? `${formatDay(execution.periodStart)} – ` : ''}{formatDay(execution.date)}
                    </span>
                    <dl>
                      {execution.amount !== null ? <div><dt>Spent</dt><dd>{formatCompactMoney(execution.amount, execution.currency ?? currency)}</dd></div> : null}
                      {execution.shares !== null ? <div><dt>Shares</dt><dd>{shareCount.format(execution.shares)}</dd></div> : null}
                      {execution.averagePrice !== null ? <div><dt>Average price</dt><dd>{formatMoney(execution.averagePrice, execution.currency ?? currency)}</dd></div> : null}
                    </dl>
                  </li>
                ))}
              </ol>
            </ChapterCard>
          ) : null}
        </>
      )}
    >
      {summary ? (
        <>
          <PairedBars
            ariaLabel={`Spent on buybacks each year from ${summary.years[0].year} to ${summary.years.at(-1)!.year}, beside what those shares are worth at today’s price`}
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
          <p className={styles.chartNote} data-buyback-legend="">
            <span className={styles.legendSpent}>spent</span>
            <span className={styles.legendWorth}>worth now</span>
            <span>× = what $1 spent that year is worth now</span>
          </p>
        </>
      ) : (
        <BeingBuilt size="chart">What the company spent on buybacks each year, and what those shares are worth now, is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}

function EquityOwnership({ data, buybacks, buybackYears }: { data: StockResearchData; buybacks: BuybackExecution[]; buybackYears: BuybackSummary | null }) {
  const snapshot = currentResearchSnapshot(data)
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

      <BuybacksChapter buybacks={buybacks} summary={buybackYears} currency={snapshot.currency || data.currency} />

      <ResearchChapter
        id="price-pays-for"
        label="What the price pays for"
        band
        aside={<BeingBuilt label="Backed by profits or a bet on growth">How much of the price today’s profits support, and how much depends on growth, is being added.</BeingBuilt>}
      >
        <div className={styles.bridgeFormula} aria-label="From market value to enterprise value">
          <div className={styles.bridgeTerm} data-known="true"><small>Market cap</small><strong><Figure value={formatResearchMoney(snapshot.marketCap, snapshot.currency)} /></strong></div>
          <div className={styles.bridgeStep}>
            <span className={styles.bridgeOperator} aria-hidden="true">+</span>
            <div className={styles.bridgeTerm}><small>Debt</small><BeingBuiltBadge /></div>
          </div>
          <div className={styles.bridgeStep}>
            <span className={styles.bridgeOperator} aria-hidden="true">−</span>
            <div className={styles.bridgeTerm}><small>Cash</small><BeingBuiltBadge /></div>
          </div>
          <div className={styles.bridgeStep}>
            <span className={styles.bridgeOperator} aria-hidden="true">=</span>
            <div className={styles.bridgeTerm}><small>Enterprise value</small><BeingBuiltBadge /></div>
          </div>
        </div>
        <BeingBuilt label="How the price got here" size="chart">
          The share price split, year by year, into what profits support and what is a bet on growth, with what changed each period, is being added.
        </BeingBuilt>
      </ResearchChapter>
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
        <BeingBuilt size="chart">Today’s units are in the snapshot above; how they changed through creations and redemptions is being added.</BeingBuilt>
      </ResearchChapter>
    </>
  )
}

export default function StockOwnershipResearch({
  data,
  buybacks,
  buybackYears,
}: {
  data: StockResearchData
  buybacks: BuybackExecution[]
  buybackYears: BuybackSummary | null
}) {
  const isFund = data.kind === 'fund'

  return (
    <ResearchViewShell data={data} title={isFund ? 'Fund Structure' : 'Ownership & Capital'} showHeader={false}>
      <div className={styles.page}>
        <CurrentSnapshot data={data} />
        {isFund ? <FundStructure /> : <EquityOwnership data={data} buybacks={buybacks} buybackYears={buybackYears} />}
        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
