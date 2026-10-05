import Link from 'next/link'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ReportedBars from '@/components/stocks/research/ReportedBars'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import type { BuybackExecution } from '@/lib/capital-reading'
import { formatChartMoney, formatCompactMoney, formatMoney } from '@/lib/currency'
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
 * Buybacks since 2016: each execution the capital-events read model reports,
 * as it was reported. Totals per year, what the shares are worth today and the
 * share count then and now are being built (ENG-167); nothing is summed here.
 */
function BuybacksChapter({ buybacks, currency }: { buybacks: BuybackExecution[]; currency: string }) {
  const withAmount = buybacks.filter((execution) => execution.amount !== null)
  const seenYears = new Set<string>()
  const newestFirst = [...buybacks].reverse()
  return (
    <ResearchChapter
      id="buybacks"
      label="Buybacks since 2016"
      lead={<BeingBuilt size="inline">What the company has spent on buybacks since 2016, and what those shares are worth today, is being added.</BeingBuilt>}
      aside={(
        <>
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
          <BeingBuilt label="Shares then and now">How many shares were bought back, issued to staff and left today, and how much more of the company each share owns, is being added.</BeingBuilt>
        </>
      )}
    >
      {withAmount.length > 0 ? (
        <>
          <ReportedBars
            ariaLabel={`Amount spent on each reported buyback, ${formatDay(withAmount[0].date)} to ${formatDay(withAmount.at(-1)!.date)}`}
            values={{ wide: withAmount.length <= 12 ? 'all' : 'ends', compact: 'ends' }}
            bars={withAmount.map((execution) => {
              const year = execution.date.slice(0, 4)
              const firstOfYear = !seenYears.has(year)
              seenYears.add(year)
              return {
                key: execution.id,
                value: execution.amount as number,
                valueLabel: formatChartMoney(execution.amount, execution.currency ?? currency),
                axisLabel: firstOfYear ? year : null,
                axisShort: firstOfYear ? `'${year.slice(-2)}` : null,
              }
            })}
          />
          <p className={styles.chartNote}><BeingBuiltBadge /> Spending by year, and what those shares are worth at today’s price, is being added.</p>
        </>
      ) : (
        <BeingBuilt size="chart">What the company spent on buybacks each year, and what those shares are worth now, is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}

function EquityOwnership({ data, buybacks }: { data: StockResearchData; buybacks: BuybackExecution[] }) {
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

      <BuybacksChapter buybacks={buybacks} currency={snapshot.currency || data.currency} />

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

export default function StockOwnershipResearch({ data, buybacks }: { data: StockResearchData; buybacks: BuybackExecution[] }) {
  const isFund = data.kind === 'fund'

  return (
    <ResearchViewShell data={data} title={isFund ? 'Fund Structure' : 'Ownership & Capital'}>
      <div className={styles.page}>
        <CurrentSnapshot data={data} />
        {isFund ? <FundStructure /> : <EquityOwnership data={data} buybacks={buybacks} />}
        <section className={styles.methodology} aria-labelledby="ownership-methodology">
          <div>
            <h2 id="ownership-methodology">Methodology</h2>
            <p>Every figure here shows where it comes from and the date it refers to.</p>
          </div>
          <div>
            <p>Ownership percentages, holder rankings, debt, cash and capital changes appear only when they come from a dated source. Nothing is estimated in the meantime.</p>
            <Link href={`/stocks/${data.ticker}/methodology`}>Open methodology →</Link>
          </div>
        </section>
        <ResearchAdPlacement />
      </div>
    </ResearchViewShell>
  )
}
