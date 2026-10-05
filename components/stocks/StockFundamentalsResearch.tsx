import Link from 'next/link'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import RevenueChapter from '@/components/stocks/fundamentals/RevenueChapter'
import styles from '@/components/stocks/fundamentals/Fundamentals.module.css'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ReportedBars from '@/components/stocks/research/ReportedBars'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import { formatChartMoney, formatCompactMoney, formatMoney } from '@/lib/currency'
import {
  shortYear,
  summaryAmount,
  summaryDate,
  summaryPercent,
  type DividendHistory,
  type ReportedPoint,
} from '@/lib/statement-reading'
import type { StockResearchData } from '@/lib/stock-research'

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? dateFormat.format(parsed) : value
}

function OperatingMarginChapter({ data }: { data: StockResearchData }) {
  const rows = data.summary.latestFundamentals
  const operating = summaryPercent(rows, /operating\s+margin/i)
  const net = summaryPercent(rows, /net\s+(profit\s+)?margin/i)
  const operatingDate = summaryDate(rows, /operating\s+margin/i)
  const netDate = summaryDate(rows, /net\s+(profit\s+)?margin/i)
  const perUnit = formatChartMoney(1, data.currency)
  return (
    <ResearchChapter
      id="operating-margin"
      label="Operating margin"
      band
      lead={operating !== null ? (
        <LeadStat value={`${Math.round(operating)}¢`} context={`of operating profit for each ${perUnit} of sales${operatingDate ? ` · as of ${formatDay(operatingDate)}` : ''}`} tone={operating < 0 ? 'down' : undefined} />
      ) : (
        <BeingBuilt size="inline">Operating profit for each {perUnit} of sales is being added.</BeingBuilt>
      )}
      aside={(
        <>
          <BeingBuilt label="What moved the margin">What raised or lowered the margin, in percentage points, is being added.</BeingBuilt>
          {net !== null ? (
            <ChapterCard title="Net margin">
              <p className={styles.cardFigure} data-card-figure="">
                <strong>{`${Math.round(net)}¢`}</strong>
                <span>of net profit for each {perUnit} of sales{netDate ? ` · as of ${formatDay(netDate)}` : ''}</span>
              </p>
            </ChapterCard>
          ) : (
            <BeingBuilt label="Net margin" size="inline">Net profit for each {perUnit} of sales is being added.</BeingBuilt>
          )}
        </>
      )}
    >
      <BeingBuilt size="chart">
        The operating margin over ten years, against the median of its sector, with the gap written between them, is being added.
      </BeingBuilt>
    </ResearchChapter>
  )
}

function CashAndDebtChapter({ data }: { data: StockResearchData }) {
  const netCash = summaryAmount(data.summary.latestFundamentals, /^net\s+cash\b/i)
  const netCashDate = summaryDate(data.summary.latestFundamentals, /^net\s+cash\b/i)
  return (
    <ResearchChapter
      id="cash-and-debt"
      label="Cash and debt"
      lead={netCash !== null ? (
        <LeadStat value={formatCompactMoney(netCash, data.currency)} context={`net cash: cash minus debt${netCashDate ? ` · as of ${formatDay(netCashDate)}` : ''}`} tone={netCash < 0 ? 'down' : undefined} />
      ) : (
        <BeingBuilt size="inline">Net cash, the cash left after all debt, is being added.</BeingBuilt>
      )}
      aside={(
        <BeingBuilt label="If a bad year came">
          How many times profit covers interest, the next debt to fall due and the room left if sales fell 30% are being added.
        </BeingBuilt>
      )}
    >
      <BeingBuilt size="chart">Cash above and debt below the zero line over ten years, with the net cash line, is being added.</BeingBuilt>
    </ResearchChapter>
  )
}

function DividendsChapter({
  ticker,
  dividends,
  currency,
}: {
  ticker: string
  dividends: DividendHistory | null
  currency: string
}) {
  const payments = dividends?.payments ?? []
  const latest = payments.at(-1) ?? null
  const firstOfYear = new Set<number>()
  const seenYears = new Set<string>()
  payments.forEach((payment, index) => {
    const year = payment.exDate.slice(0, 4)
    if (!seenYears.has(year)) {
      seenYears.add(year)
      firstOfYear.add(index)
    }
  })

  return (
    <ResearchChapter
      id="dividends"
      label="Dividends"
      band
      lead={latest ? (
        <>
          <LeadStat
            value={formatMoney(latest.amount, latest.currency ?? currency)}
            context={`per share, latest dividend · ex-dividend ${formatDay(latest.exDate)}`}
          />
          <p className={styles.leadNote}><BeingBuiltBadge /> How many years in a row it has risen is being added.</p>
        </>
      ) : null}
      aside={(
        <>
          <BeingBuilt label="Each $100 of profit">How each $100 of profit went to buybacks, dividends and what the company kept is being added.</BeingBuilt>
          <Link className={styles.chapterLink} href={`/stocks/${ticker}/ownership`}>Buybacks and ownership →</Link>
        </>
      )}
    >
      {latest ? (
        <ReportedBars
          ariaLabel={`Dividends per share${dividends?.adjusted ? ', adjusted for splits' : ''}, by ex-dividend date, ${formatDay(payments[0].exDate)} to ${formatDay(latest.exDate)}`}
          values={{ wide: 'ends', compact: 'ends' }}
          maxAxis={{ wide: 10, compact: 5 }}
          bars={payments.map((payment, index) => {
            const year = Number(payment.exDate.slice(0, 4))
            return {
              key: payment.exDate,
              value: payment.amount,
              valueLabel: formatMoney(payment.amount, payment.currency ?? currency),
              axisLabel: firstOfYear.has(index) ? String(year) : null,
              axisShort: firstOfYear.has(index) ? shortYear(year) : null,
            }
          })}
        />
      ) : (
        <BeingBuilt size="chart">Ten years of dividends per share is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}

function FundChapters({ data }: { data: StockResearchData }) {
  const chapters = [
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'exposure', label: 'Exposure' },
    { key: 'distributions', label: 'Distributions' },
    { key: 'risk', label: 'Risk' },
  ]
  const themes = new Map(data.themes.map((theme) => [theme.key, theme]))
  return (
    <>
      {chapters.map((chapter, index) => {
        const metrics = themes.get(chapter.key)?.metrics ?? []
        return (
          <ResearchChapter key={chapter.key} id={chapter.key} label={chapter.label} band={index % 2 === 1}>
            {metrics.length > 0 ? (
              <dl className={styles.factList}>
                {metrics.map((metric) => (
                  <div key={metric.key}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <BeingBuilt>The fund’s {chapter.label.toLowerCase()} figures are being added.</BeingBuilt>
            )}
          </ResearchChapter>
        )
      })}
    </>
  )
}

export default function StockFundamentalsResearch({
  data,
  revenue,
  dividends,
}: {
  data: StockResearchData
  /** Reported annual revenue, oldest first. */
  revenue: ReportedPoint[]
  /** Reported dividends; null when they could not be read. */
  dividends: DividendHistory | null
}) {
  return (
    // No page header: the chrome above already carries the company, the price
    // and the active tab.
    <ResearchViewShell data={data} title="Fundamentals" showHeader={false}>
      <div className={styles.chapters} data-fundamentals="">
        {data.kind === 'fund' ? (
          <FundChapters data={data} />
        ) : (
          <>
            <RevenueChapter points={revenue} currency={data.currency} />
            <OperatingMarginChapter data={data} />
            <CashAndDebtChapter data={data} />
            <DividendsChapter ticker={data.ticker} dividends={dividends} currency={data.currency} />
          </>
        )}
      </div>
      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
