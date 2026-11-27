import BeingBuilt from '@/components/stocks/research/BeingBuilt'
import ReportedBars from '@/components/stocks/research/ReportedBars'
import ResearchChapter, { ChapterCard, ChapterNote, LeadStat } from '@/components/stocks/research/ResearchChapter'
import ValueOrigin from '@/components/stocks/research/ValueOrigin'
import type { CashForOwners } from '@/lib/cash-for-owners'
import { formatChartMoney, formatCompactMoney } from '@/lib/currency'
import { lineName, shortYear, sourceName } from '@/lib/statement-reading'
import { FUNDAMENTALS_MEASURES } from './measures'
import styles from './Fundamentals.module.css'

/**
 * Free cash flow: how much cash is left for the owners after everything the
 * business had to reinvest (spec "Definições próprias das rubricas V1", 3.3).
 * Our filing definition is cash from operations minus the total reinvestment
 * (property and equipment, intangible assets and capitalised software, 3.2),
 * all from one filing. It is cash: pay in shares is named beside it and never
 * taken off. Every amount shown is published by the backend.
 */
export default function CashForOwnersChapter({ cash, band = false }: { cash: CashForOwners | null; band?: boolean }) {
  const points = cash?.points ?? []
  const latest = cash?.latest ?? null
  const provider = latest && !latest.ourDefinition ? sourceName(cash?.origin.latest?.source ?? null) : null
  return (
    <ResearchChapter
      id="free-cash-flow"
      label="Free cash flow"
      band={band}
      measure={FUNDAMENTALS_MEASURES.cash}
      lead={latest ? (
        <LeadStat
          label={latest.value < 0 ? 'Cash the business used' : 'Left for the owners'}
          value={formatCompactMoney(Math.abs(latest.value), latest.currency)}
          context={latest.ourDefinition
            ? `in fiscal ${latest.year}, after everything the business reinvested`
            : `in fiscal ${latest.year}, as ${provider ?? 'the provider'} publishes it`}
          tone={latest.value < 0 ? 'down' : undefined}
        />
      ) : (
        <BeingBuilt size="inline">The cash left for the owners after reinvestment is being added.</BeingBuilt>
      )}
      aside={(
        <>
          {latest?.ourDefinition ? (
            <ChapterCard title="How it is made" meta={`FY${latest.year}`}>
              <div data-cash-parts="">
                {latest.partsFromFiling ? (
                  <dl className={styles.factList}>
                    {latest.parts.map((part) => (
                      <div key={part.lineItemId} data-cash-part={part.lineItemId}>
                        <dt>{lineName(part.lineItemId)}</dt>
                        <dd>{formatChartMoney(part.value, latest.currency)}</dd>
                      </div>
                    ))}
                    {latest.reinvestment !== null ? (
                      <div data-cash-part="reinvestment_total">
                        <dt>Total reinvestment</dt>
                        <dd>{formatChartMoney(latest.reinvestment, latest.currency)}</dd>
                      </div>
                    ) : null}
                    <div data-cash-part="free_cash_flow">
                      <dt><strong>Free cash flow</strong></dt>
                      <dd><strong>{formatChartMoney(latest.value, latest.currency)}</strong></dd>
                    </div>
                  </dl>
                ) : (
                  <ul className={styles.cashPartNames}>
                    {latest.parts.map((part) => <li key={part.lineItemId}>{lineName(part.lineItemId)}</li>)}
                  </ul>
                )}
                <p className={styles.cardNote}>
                  Cash from operations, less each reinvestment line as the company reports it, all from one filing.
                </p>
              </div>
            </ChapterCard>
          ) : null}
          {latest && latest.shareBasedPay !== null ? (
            <ChapterCard title="Pay in shares" meta={`FY${latest.year}`}>
              <p className={styles.cardFigure} data-card-figure="" data-share-based-pay="">
                <strong>{formatCompactMoney(latest.shareBasedPay, latest.currency)}</strong>
                <span>paid to employees in shares that year. It is not cash, so it is not taken off free cash flow; owners bear it as new shares instead.</span>
              </p>
            </ChapterCard>
          ) : null}
          <BeingBuilt label="For each share">
            Free cash flow per share, on diluted shares, and pay in shares as a part of free cash flow are being added.
          </BeingBuilt>
        </>
      )}
    >
      {points.length > 0 ? (
        <div className={styles.chartPanel}>
          <ReportedBars
            slim
            ariaLabel={`Annual free cash flow, fiscal ${points[0].year} to ${points.at(-1)!.year}`}
            bars={points.map((point, index) => ({
              key: point.periodEnd,
              value: point.value,
              valueLabel: formatChartMoney(point.value, point.currency ?? latest?.currency ?? 'USD'),
              axisLabel: String(point.year),
              axisShort: shortYear(point.year),
              highlighted: index === points.length - 1,
            }))}
          />
        </div>
      ) : (
        <BeingBuilt size="chart">Free cash flow for each year is being added.</BeingBuilt>
      )}
      <ValueOrigin subject="free cash flow" origin={cash?.origin ?? null} />
      {points.length > 0 ? <ChapterNote>Bars show each fiscal year. Below zero, the business used more cash than it made.</ChapterNote> : null}
    </ResearchChapter>
  )
}
