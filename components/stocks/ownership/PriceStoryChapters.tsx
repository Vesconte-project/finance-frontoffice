'use client'

import { useState, type KeyboardEvent } from 'react'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ChartFrame, { ChartLabel, ChartPlot } from '@/components/stocks/research/ChartFrame'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import SegmentedControl from '@/components/ui/SegmentedControl'
import type { PricePeriod } from '@/lib/capital-reading'
import type { PlotBox } from '@/lib/chart-labels'
import { formatCompactMoney, formatMoney, formatSignedMoney } from '@/lib/currency'
import { connectorPath } from '@/lib/sales-flow'
import styles from './Ownership.module.css'

type PaysNode = 'shares' | 'debt' | 'company' | 'business' | 'cash' | 'profits' | 'growth'

const PAYS_LABEL: Record<PaysNode, string> = {
  shares: 'Shares',
  debt: 'Debt',
  company: 'Whole company',
  business: 'The business',
  cash: 'Cash back',
  profits: 'Backed by profits',
  growth: 'Bet on growth',
}

const PAYS_SENTENCE: Record<PaysNode, string> = {
  shares: 'What the market pays for all the shares today.',
  debt: 'The company’s debt and how it changed are being added.',
  company: 'What the whole company costs, shares and debt together, is being added.',
  business: 'What the business itself is valued at, without its cash, is being added.',
  cash: 'The cash the company holds, and how it changed, is being added.',
  profits: 'How much of the value today’s profits support, per share and over five years, is being added.',
  growth: 'How much of the value is a bet on growth, per share and over five years, with the growth it needs against its record, is being added.',
}

/** The flow's columns, left to right: what is paid, the company, what it holds, what backs it. */
const PAYS_COLUMNS: readonly PaysNode[][] = [['shares', 'debt'], ['company'], ['business', 'cash'], ['profits', 'growth']]
/** Each column's links to the next: [from index, to index]. */
const PAYS_LINKS: ReadonlyArray<Array<[number, number]>> = [[[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [0, 1]]]

/**
 * What the price pays for (Spec PRD-78): a horizontal flow from the shares and
 * the debt to the whole company, the business and its cash, and what backs the
 * business — today's profits and a bet on growth. Only the market value of the
 * shares is reported today; the rest is being built (ENG-164, ENG-168).
 */
export function PricePaysForChapter({ marketCap, marketCapAsOf, currency }: { marketCap: number | null; marketCapAsOf: string | null; currency: string }) {
  const [selected, setSelected] = useState<PaysNode>('growth')
  const valueOf = (node: PaysNode) => (node === 'shares' ? marketCap : null)

  return (
    <ResearchChapter
      id="price-pays-for"
      label="What the price pays for"
      band
      aside={selected === 'shares' && marketCap !== null ? (
        <ChapterCard title={PAYS_LABEL.shares} meta={formatCompactMoney(marketCap, currency)}>
          <p className={styles.cardText} data-pays-card="shares">
            {PAYS_SENTENCE.shares}{marketCapAsOf ? ` As of ${formatDay(marketCapAsOf)}.` : ''}
          </p>
          <p className={styles.cardNote}><BeingBuiltBadge /> Its share of each share’s price, its change and five years of it are being added.</p>
        </ChapterCard>
      ) : (
        <BeingBuilt label={PAYS_LABEL[selected]}>{PAYS_SENTENCE[selected]}</BeingBuilt>
      )}
    >
      <div className={styles.paysFlow} data-pays-flow="" role="group" aria-label="What the price pays for, from the shares and the debt to what backs the business">
        {PAYS_COLUMNS.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.paysStep}>
            <div className={styles.paysColumn} data-pays-column={columnIndex}>
              {column.map((node) => {
                const value = valueOf(node)
                return (
                  <button
                    key={node}
                    type="button"
                    className={styles.paysNode}
                    data-pays-node={node}
                    data-pending={value === null ? 'true' : undefined}
                    aria-pressed={selected === node}
                    aria-label={value === null ? `${PAYS_LABEL[node]}, being built` : `${PAYS_LABEL[node]}, ${formatCompactMoney(value, currency)}`}
                    onClick={() => setSelected(node)}
                  >
                    <span className={styles.paysName}>{PAYS_LABEL[node]}</span>
                    {value !== null ? <span className={styles.paysValue}>{formatCompactMoney(value, currency)}</span> : <BeingBuiltBadge />}
                  </button>
                )
              })}
            </div>
            {columnIndex < PAYS_COLUMNS.length - 1 ? (
              <svg className={styles.paysGap} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                {PAYS_LINKS[columnIndex].map(([from, to]) => (
                  <path
                    key={`${from}-${to}`}
                    className={styles.paysLink}
                    data-pending={columnIndex === 0 && from === 0 && marketCap !== null ? undefined : 'true'}
                    d={connectorPath(from, column.length, to, PAYS_COLUMNS[columnIndex + 1].length)}
                  />
                ))}
              </svg>
            ) : null}
          </div>
        ))}
      </div>
      <p className={styles.chartNote}><BeingBuiltBadge /> Each part’s value and its change on the year before are being added.</p>
    </ResearchChapter>
  )
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? dayFormat.format(parsed) : value
}

const WIDE: PlotBox = { width: 640, height: 260 }
/** Left and right margin of the price plot, as a share of its width. */
const PLOT_SIDE = 0.016
const COMPACT: PlotBox = { width: 320, height: 240 }

function PricePlot({
  periods,
  selected,
  box,
  variant,
  currency,
}: {
  periods: readonly PricePeriod[]
  selected: number
  box: PlotBox
  variant: 'wide' | 'compact'
  currency: string
}) {
  const top = 28
  const bottom = 34
  // The same share of the width at both sizes, so the period picker lines up over either drawing.
  const side = box.width * PLOT_SIDE
  const closes = [periods[0].startClose, ...periods.map((period) => period.endClose)]
  const high = Math.max(...closes)
  const plotHeight = box.height - top - bottom
  const zeroY = box.height - bottom
  // Scaled from zero, as the price layers will be when they arrive.
  const y = (value: number) => zeroY - (value / (high || 1)) * plotHeight
  const step = (box.width - side * 2) / periods.length
  // Point i is the close at the end of period i - 1 (point 0: where the first period started).
  const x = (point: number) => side + step * point
  const path = closes.map((close, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(close).toFixed(1)}`).join(' ')
  const last = closes.length - 1
  const axisEvery = variant === 'compact' ? Math.ceil(periods.length / 5) : Math.ceil(periods.length / 10)

  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={(
        <>
          <ChartLabel box={box} x={x(last)} y={y(closes[last]) - 6} anchor="end" baseline="end" strong>
            {formatMoney(closes[last], currency)}
          </ChartLabel>
          {periods.map((period, index) => ((periods.length - 1 - index) % axisEvery === 0 ? (
            <ChartLabel key={period.key} box={box} x={side + step * (index + 0.5)} y={box.height - 14} tone={index === selected ? undefined : 'muted'} strong={index === selected}>
              {variant === 'wide' ? period.label : period.short}
            </ChartLabel>
          ) : null))}
        </>
      )}
    >
      <rect className={styles.periodBand} x={side + step * selected} y={top - 8} width={step} height={plotHeight + 8} />
      <line className={styles.zero} x1={0} x2={box.width} y1={zeroY} y2={zeroY} />
      <path className={styles.priceLine} d={path} />
      {closes.map((close, index) => (
        // A zero-length round-capped line stays a dot however the plot stretches.
        <line key={index} className={styles.pricePoint} data-last={index === last ? 'true' : undefined} x1={x(index)} x2={x(index)} y1={y(close)} y2={y(close)} />
      ))}
    </ChartPlot>
  )
}

const PERIOD_OPTIONS = ['Years', 'Quarters'] as const
type PeriodOption = (typeof PERIOD_OPTIONS)[number]

/**
 * How the price got here (Spec PRD-78): the share price by year or by quarter,
 * each period selectable, with the period's start, end and difference in the
 * card. The split of the price into profits and a bet on growth, the events on
 * the line and what changed in each period come from the backend (ENG-164) and
 * are being built. There is no automatic playback (founder decision 2026-10-05).
 */
export function PriceHistoryChapter({
  byYear,
  byQuarter,
  currency,
}: {
  byYear: PricePeriod[]
  byQuarter: PricePeriod[]
  currency: string
}) {
  const [option, setOption] = useState<PeriodOption>('Years')
  const periods = option === 'Years' ? byYear : byQuarter
  const [picked, setPicked] = useState<{ option: PeriodOption; index: number } | null>(null)
  const selected = picked && picked.option === option && picked.index < periods.length ? picked.index : periods.length - 1
  const period = periods[selected] ?? null
  const unit = option === 'Years' ? 'year' : 'quarter'

  const choose = (index: number) => setPicked({ option, index: Math.max(0, Math.min(periods.length - 1, index)) })
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: periods.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    choose(moves[event.key])
    const group = event.currentTarget.parentElement
    window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus())
  }

  return (
    <ResearchChapter
      id="price-got-here"
      label="How the price got here"
      actions={periods.length > 0 ? (
        <SegmentedControl options={PERIOD_OPTIONS} value={option} onChange={setOption} ariaLabel="Price by" analyticsId="ticker_price_history_period" />
      ) : null}
      lead={<BeingBuilt size="inline">How much of the price’s change came from profits and how much from a bigger or smaller bet on growth is being added.</BeingBuilt>}
      aside={period ? (
        <ChapterCard title={period.label} meta={formatSignedMoney(period.endClose - period.startClose, currency)}>
          <p className={styles.periodRange} data-period-card={period.key}>
            <span>{formatMoney(period.startClose, currency)}</span>
            <span aria-hidden="true">→</span>
            <span className="sr-only">to</span>
            <strong>{formatMoney(period.endClose, currency)}</strong>
          </p>
          <BeingBuilt label="What changed" size="inline">
            What happened in the {unit}, and how profits, interest rates, the bet on growth and cash each moved the price, is being added.
          </BeingBuilt>
        </ChapterCard>
      ) : (
        <BeingBuilt label="Each period">Where the price started and ended, and what moved it, is being added.</BeingBuilt>
      )}
    >
      {periods.length > 0 ? (
        <>
          <div className={styles.priceStage}>
          <ChartFrame
            ariaLabel={`Share price by ${unit}, from ${periods[0].label} to ${periods.at(-1)!.label}, ${periods.at(-1)!.label} ending at ${formatMoney(periods.at(-1)!.endClose, currency)}`}
            className={styles.priceFrame}
          >
            <PricePlot periods={periods} selected={selected} box={WIDE} variant="wide" currency={currency} />
            <PricePlot periods={periods} selected={selected} box={COMPACT} variant="compact" currency={currency} />
          </ChartFrame>
          {/* Each period is a column of the chart the reader can pick (arrow keys move between them). */}
          <div
            className={styles.periodPicker}
            role="group"
            aria-label={`Choose a ${unit}`}
            data-period-picker=""
            style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`, paddingInline: `${PLOT_SIDE * 100}%` }}
          >
            {periods.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={styles.periodButton}
                aria-pressed={index === selected}
                aria-label={item.label}
                tabIndex={index === selected ? 0 : -1}
                onClick={() => choose(index)}
                onKeyDown={onKey}
              />
            ))}
          </div>
          </div>
          <p className={styles.chartNote}><BeingBuiltBadge /> The price split into what profits back and what is a bet on growth, and the events along the way, are being added.</p>
        </>
      ) : (
        <BeingBuilt size="chart">The share price by year and by quarter, split into what profits back and what is a bet on growth, is being added.</BeingBuilt>
      )}
    </ResearchChapter>
  )
}
