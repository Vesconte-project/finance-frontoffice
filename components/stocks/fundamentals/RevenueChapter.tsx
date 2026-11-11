'use client'

import { useState } from 'react'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ReportedBars from '@/components/stocks/research/ReportedBars'
import ResearchChapter, { LeadStat } from '@/components/stocks/research/ResearchChapter'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { formatChartMoney, formatCompactMoney } from '@/lib/currency'
import { formatFraction, type ReportedPoint } from '@/lib/statement-reading'
import { FUNDAMENTALS_MEASURES } from './measures'
import styles from './Fundamentals.module.css'

/** "$B", "€B", "B kr": the unit the bars are written in, for the toggle. */
function billionsUnit(currency: string): string {
  return formatChartMoney(1e9, currency).replace('1', '')
}

/** "this year", "last year", or "in fiscal 2022" for an older latest year. */
function relativeYear(fiscalYear: number): string {
  const current = new Date().getUTCFullYear()
  if (fiscalYear >= current) return 'this year'
  if (fiscalYear === current - 1) return 'last year'
  return `in fiscal ${fiscalYear}`
}

/**
 * Revenue: the reported annual revenue as bars, with the total written on each
 * year. Growth (the five-year rate and the "% growth" view) and the split by
 * business come from the backend and are being built (ENG-170, ENG-160).
 */
export default function RevenueChapter({
  points,
  currency,
  growth = [],
}: {
  /** Reported annual revenue, oldest first. */
  points: ReportedPoint[]
  growth?: ReportedPoint[]
  currency: string
}) {
  const amount = billionsUnit(points.at(-1)?.currency ?? currency)
  const options = [amount, '% growth'] as const
  const [view, setView] = useState<string>(amount)
  const latest = points.at(-1) ?? null
  const shown = points

  return (
    <ResearchChapter
      id="revenue"
      label="Revenue"
      measure={FUNDAMENTALS_MEASURES.revenue}
      lead={latest ? (
        <LeadStat
          value={formatCompactMoney(latest.value, latest.currency ?? currency)}
          context={`in sales ${relativeYear(latest.year)}`}
        />
      ) : null}
      actions={shown.length > 0 ? (
        <SegmentedControl options={options} value={view} onChange={setView} ariaLabel="Revenue in" analyticsId="ticker_revenue_unit" />
      ) : null}
      aside={(
        <BeingBuilt label="By business">
          Each business’s sales, how they changed on the year before and how the mix moved are being added.
        </BeingBuilt>
      )}
    >
      {shown.length === 0 ? (
        <BeingBuilt size="chart">Ten years of revenue, split by business, is being added.</BeingBuilt>
      ) : view === amount ? (
        <div className={styles.chartPanel}>
          <ReportedBars
            slim
            ariaLabel={`Reported revenue by fiscal year, ${shown[0].year} to ${shown.at(-1)!.year}`}
            bars={shown.map((point, index) => ({
              key: point.periodEnd,
              value: point.value,
              valueLabel: formatChartMoney(point.value, point.currency ?? currency),
              axisLabel: String(point.year),
              axisShort: `'${String(point.year).slice(-2)}`,
              highlighted: index === shown.length - 1,
            }))}
          />
          <p className={styles.chartNote}>
            <BeingBuiltBadge />{' '}
            {shown.length < 10 ? 'Growth, earlier years and the split by business are being added.' : 'Growth and the split by business are being added.'}
          </p>
        </div>
      ) : (
        growth.length > 0 ? <div className={styles.chartPanel}><ReportedBars
          slim
          ariaLabel="Annual revenue growth against the year before"
          bars={growth.map((point) => ({ key: point.periodEnd, value: point.value,
            valueLabel: formatFraction(point.value), axisLabel: String(point.year), axisShort: `'${String(point.year).slice(-2)}` }))}
        /></div> : <BeingBuilt size="chart">Each year’s revenue growth against the year before is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}
