'use client'

import { useState, type CSSProperties } from 'react'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ReportedBars from '@/components/stocks/research/ReportedBars'
import ResearchChapter, { ChapterCard } from '@/components/stocks/research/ResearchChapter'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { labelPosition, plotUnits, stackLabels } from '@/lib/chart-labels'
import { formatChartMoney, formatCompactMoney } from '@/lib/currency'
import {
  NARROW_GROUPS,
  NODE_LABEL,
  connectorPath,
  isReportedNode,
  narrowGroupOf,
  nodeValue,
  wideFlow,
  type FlowNodeId,
  type FlowValues,
  type WideNode,
} from '@/lib/sales-flow'
import { shortYear, valueInYear, type IncomeSeries, type MeasureKey } from '@/lib/statement-reading'
import styles from './Financials.module.css'

const SERIES_OF: Partial<Record<FlowNodeId, MeasureKey>> = {
  sales: 'revenue',
  grossProfit: 'grossProfit',
  operatingIncome: 'operatingIncome',
  netIncome: 'netIncome',
}

const REPORTED_SENTENCE: Partial<Record<FlowNodeId, string>> = {
  sales: 'What customers paid for the company’s products and services in the year.',
  grossProfit: 'What was left of sales after the direct cost of what was sold.',
  operatingIncome: 'What the business earned from its operations, after running costs.',
  netIncome: 'What was left after every cost, interest and tax.',
}

const PENDING_SENTENCE: Partial<Record<FlowNodeId, string>> = {
  business: 'Sales by business for the year, and how each changed, are being added.',
  costOfSales: 'The direct cost of what was sold, and what it is made of, is being added.',
  operatingCosts: 'Research, selling and running costs for the year are being added.',
  taxes: 'Interest, taxes and other items between operating income and net income are being added.',
  buybacks: 'What the company spent buying back its shares in the year is being added.',
  dividends: 'What the company paid in dividends in the year is being added.',
  retained: 'What the company kept after buybacks and dividends is being added.',
  costOfSalesParts: 'What the cost of sales is made of is being added.',
  operatingCostsParts: 'What the operating costs are made of is being added.',
  taxesParts: 'Each item between operating income and net income is being added.',
}

const AMOUNT = 'Amount'
const SHARE = '% of sales'
type Unit = typeof AMOUNT | typeof SHARE

/** Label size in CSS pixels, for keeping a column of labels apart. */
const LABEL_HEIGHT_PX = 40
const WIDE_MIN_PX = 900

function NodeText({
  id,
  value,
  unit,
  currency,
  chevron = false,
}: {
  id: FlowNodeId
  value: number | null
  unit: Unit
  currency: string
  chevron?: boolean
}) {
  const reported = isReportedNode(id)
  return (
    <>
      <span className={styles.nodeName}>
        {NODE_LABEL[id]}
        {chevron ? <span aria-hidden="true" className={styles.chevron}>›</span> : null}
      </span>
      {reported && unit === AMOUNT && value !== null ? (
        <span className={styles.nodeValue} data-tone={value < 0 ? 'down' : undefined}>{formatChartMoney(value, currency)}</span>
      ) : reported && unit === AMOUNT ? (
        <span className={styles.nodeMissing}>Not reported for this year</span>
      ) : (
        <BeingBuiltBadge />
      )}
    </>
  )
}

function accessibleName(id: FlowNodeId, value: number | null, unit: Unit, currency: string): string {
  if (!isReportedNode(id)) return `${NODE_LABEL[id]}, being built`
  if (unit === SHARE) return `${NODE_LABEL[id]}, share of sales being built`
  return value === null ? `${NODE_LABEL[id]}, not reported for this year` : `${NODE_LABEL[id]}, ${formatCompactMoney(value, currency)}`
}

function WideFlow({
  values,
  unit,
  currency,
  selected,
  onSelect,
}: {
  values: FlowValues
  unit: Unit
  currency: string
  selected: FlowNodeId
  onSelect: (id: FlowNodeId) => void
}) {
  const flow = wideFlow(values)
  const box = flow.box
  const size = plotUnits(LABEL_HEIGHT_PX, box, WIDE_MIN_PX)
  const gap = plotUnits(4, box, WIDE_MIN_PX)

  // Labels sit beside their node; within a column they are kept apart.
  const wanted = flow.nodes.map((node) => ({
    node,
    at: node.id === 'business' ? node.y + size / 2 + 4 : node.y + node.height / 2,
  }))
  const placed = new Map<FlowNodeId, number>()
  const columns = new Map<number, typeof wanted>()
  for (const entry of wanted) {
    const column = columns.get(entry.node.x) ?? []
    column.push(entry)
    columns.set(entry.node.x, column)
  }
  for (const column of columns.values()) {
    const stacked = stackLabels(
      column.map((entry) => ({ key: entry.node.id, at: entry.at, size })),
      { min: 0, max: box.height, gap },
    )
    for (const item of stacked) placed.set(item.key as FlowNodeId, item.placed)
  }

  return (
    <div className={styles.wide} data-flow-variant="wide" style={{ aspectRatio: `${box.width} / ${box.height}` } as CSSProperties}>
      <svg className={styles.drawing} viewBox={`0 0 ${box.width} ${box.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {flow.links.map((link) => (
          <path key={`${link.from}-${link.to}`} className={styles.link} data-pending={link.pending ? 'true' : undefined} d={link.d} />
        ))}
        {flow.nodes.map((node) => (
          <rect
            key={node.id}
            className={styles.node}
            data-pending={node.pending ? 'true' : undefined}
            data-selected={node.id === selected ? 'true' : undefined}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
          />
        ))}
      </svg>
      <div className={styles.wideLabels}>
        {flow.nodes.map((node: WideNode) => {
          const value = nodeValue(node.id, values)
          const right = node.labelSide === 'right'
          const position = labelPosition(box, right ? node.x + node.width + 6 : node.x - 6, placed.get(node.id) ?? node.y, right ? 'start' : 'end', 'middle')
          return (
            <button
              key={node.id}
              type="button"
              className={styles.wideLabel}
              data-side={node.labelSide}
              data-flow-node={node.id}
              aria-pressed={selected === node.id}
              aria-label={accessibleName(node.id, value, unit, currency)}
              style={position}
              onClick={() => onSelect(node.id)}
            >
              <NodeText id={node.id} value={value} unit={unit} currency={currency} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NarrowFlow({
  values,
  unit,
  currency,
  selected,
  onSelect,
}: {
  values: FlowValues
  unit: Unit
  currency: string
  selected: FlowNodeId
  onSelect: (id: FlowNodeId) => void
}) {
  const openId = narrowGroupOf(selected) ?? 'netIncome'
  const openIndex = NARROW_GROUPS.findIndex((group) => group.id === openId)
  const children = NARROW_GROUPS[openIndex]?.children ?? []
  const sales = values.revenue

  return (
    <div className={styles.narrow} data-flow-variant="narrow">
      {/* Sales is the bar the four parts leave from, named above it; its
          amount is written on the sales bar above the flow. */}
      <span className={styles.narrowBarLabel} aria-hidden="true">{NODE_LABEL.sales}</span>
      <button
        type="button"
        className={styles.narrowBar}
        data-flow-node="sales"
        aria-pressed={selected === 'sales'}
        aria-label={accessibleName('sales', sales, unit, currency)}
        onClick={() => onSelect('sales')}
      />
      <svg className={styles.gap} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {NARROW_GROUPS.map((group, index) => (
          <path
            key={group.id}
            className={styles.connector}
            data-pending={isReportedNode(group.id) ? undefined : 'true'}
            data-open={group.id === openId ? 'true' : undefined}
            d={connectorPath(0, 1, index, NARROW_GROUPS.length)}
          />
        ))}
      </svg>
      <div className={styles.narrowColumn} data-flow-column="groups">
        {NARROW_GROUPS.map((group) => {
          const value = nodeValue(group.id, values)
          return (
            <button
              key={group.id}
              type="button"
              className={styles.narrowNode}
              data-flow-node={group.id}
              data-pending={isReportedNode(group.id) ? undefined : 'true'}
              data-open={group.id === openId ? 'true' : undefined}
              aria-pressed={selected === group.id}
              aria-expanded={group.id === openId}
              aria-label={accessibleName(group.id, value, unit, currency)}
              onClick={() => onSelect(group.id)}
            >
              <NodeText id={group.id} value={value} unit={unit} currency={currency} chevron />
            </button>
          )
        })}
      </div>
      <svg className={styles.gap} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {children.map((child, index) => (
          <path
            key={child}
            className={styles.connector}
            data-pending="true"
            d={connectorPath(openIndex, NARROW_GROUPS.length, index, children.length)}
          />
        ))}
      </svg>
      <div className={styles.narrowColumn} data-flow-column="children">
        {children.map((child) => (
          <button
            key={child}
            type="button"
            className={styles.narrowNode}
            data-flow-node={child}
            data-pending="true"
            aria-pressed={selected === child}
            aria-label={accessibleName(child, null, unit, currency)}
            onClick={() => onSelect(child)}
          >
            <NodeText id={child} value={null} unit={unit} currency={currency} />
          </button>
        ))}
      </div>
    </div>
  )
}

function NodeCard({
  id,
  year,
  years,
  series,
  currency,
}: {
  id: FlowNodeId
  year: number
  years: number[]
  series: IncomeSeries
  currency: string
}) {
  const key = SERIES_OF[id]
  if (!key) {
    return <BeingBuilt label={NODE_LABEL[id]}>{PENDING_SENTENCE[id]}</BeingBuilt>
  }
  const points = series[key]
  const point = valueInYear(points, year)
  const history = [...years].sort((left, right) => left - right).flatMap((candidate) => {
    const found = valueInYear(points, candidate)
    return found ? [{ year: candidate, point: found }] : []
  })
  return (
    <ChapterCard title={NODE_LABEL[id]} meta={`FY${year}`}>
      <div data-flow-card={id}>
        {point ? (
          <p className={styles.cardFigure}>
            <strong data-tone={point.value < 0 ? 'down' : undefined}>{formatCompactMoney(point.value, point.currency ?? currency)}</strong>
            <span>{REPORTED_SENTENCE[id]}</span>
          </p>
        ) : (
          <p className={styles.cardFigure}>
            <span>Not reported for FY{year}. {REPORTED_SENTENCE[id]}</span>
          </p>
        )}
      </div>
      <p className={styles.cardNote}><BeingBuiltBadge /> The change on the year before and the share of sales are being added.</p>
      {history.length > 0 ? (
        <ReportedBars
          ariaLabel={`${NODE_LABEL[id]} by fiscal year, FY${year} highlighted`}
          values={{ wide: 'all', compact: 'ends' }}
          bars={history.map(({ year: barYear, point: barPoint }) => ({
            key: String(barYear),
            value: barPoint.value,
            valueLabel: formatChartMoney(barPoint.value, barPoint.currency ?? currency),
            axisLabel: String(barYear),
            axisShort: shortYear(barYear),
            highlighted: barYear === year,
          }))}
        />
      ) : null}
    </ChapterCard>
  )
}

/**
 * Financials: where each dollar of sales went in a chosen year. The flow is
 * horizontal at every width; below 900px of chart space it becomes three
 * columns — sales, its four parts, and what the open part is made of.
 */
export default function SalesFlowChapter({
  years,
  series,
  currency,
}: {
  /** Fiscal years with a reported result, newest first (at most five). */
  years: number[]
  series: IncomeSeries
  currency: string
}) {
  const [year, setYear] = useState<number>(years[0] ?? 0)
  const [unit, setUnit] = useState<Unit>(AMOUNT)
  const [selected, setSelected] = useState<FlowNodeId>('netIncome')

  if (years.length === 0) {
    return (
      <ResearchChapter
        id="sales-flow"
        label="Where each dollar of sales goes"
        aside={<BeingBuilt label="Biggest changes">The four largest changes against the year before are being added.</BeingBuilt>}
      >
        <BeingBuilt size="chart">
          How each dollar of sales splits into costs, taxes, profit, buybacks and dividends, year by year, is being added.
        </BeingBuilt>
      </ResearchChapter>
    )
  }

  const values: FlowValues = {
    revenue: valueInYear(series.revenue, year)?.value ?? null,
    grossProfit: valueInYear(series.grossProfit, year)?.value ?? null,
    operatingIncome: valueInYear(series.operatingIncome, year)?.value ?? null,
    netIncome: valueInYear(series.netIncome, year)?.value ?? null,
  }
  const yearOptions = [...years].sort((left, right) => left - right).map(String)
  const perUnit = formatChartMoney(1, currency)

  return (
    <ResearchChapter
      id="sales-flow"
      label="Where each dollar of sales goes"
      actions={(
        <>
          <SegmentedControl
            options={yearOptions}
            value={String(year)}
            onChange={(next) => setYear(Number(next))}
            ariaLabel="Fiscal year"
            analyticsId="ticker_financials_year"
          />
          <SegmentedControl
            options={[AMOUNT, SHARE] as const}
            value={unit}
            onChange={setUnit}
            ariaLabel="Show amounts or share of sales"
            analyticsId="ticker_financials_unit"
          />
        </>
      )}
      lead={(
        <BeingBuilt size="inline">Net profit for each {perUnit} of sales in FY{year}, and its change on the year before, is being added.</BeingBuilt>
      )}
      aside={(
        <>
          <NodeCard id={selected} year={year} years={years} series={series} currency={currency} />
          <BeingBuilt label="Biggest changes">The four largest changes against the year before, with costs that rose shown in red, are being added.</BeingBuilt>
        </>
      )}
    >
      <div className={styles.salesBar} data-sales-by-business="">
        <span className={styles.salesBarFill} aria-hidden="true" />
        <span className={styles.salesBarLabel}>
          <strong>Sales{values.revenue !== null && unit === AMOUNT ? ` ${formatChartMoney(values.revenue, currency)}` : ''}</strong>
          <span>by business</span>
          <BeingBuiltBadge />
        </span>
      </div>
      {unit === SHARE ? (
        <p className={styles.flowNote}><BeingBuiltBadge /> Each part as a share of sales is being added.</p>
      ) : null}
      <div className={styles.flow} data-sales-flow="" role="group" aria-label={`Where each dollar of sales went in FY${year}`}>
        <WideFlow values={values} unit={unit} currency={currency} selected={selected} onSelect={setSelected} />
        <NarrowFlow values={values} unit={unit} currency={currency} selected={selected} onSelect={setSelected} />
      </div>
    </ResearchChapter>
  )
}
