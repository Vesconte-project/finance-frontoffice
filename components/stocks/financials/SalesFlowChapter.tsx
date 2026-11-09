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
  flowFraction,
  flowScale,
  isReportedNode,
  narrowGroupOf,
  nodeValue,
  wideFlow,
  type FlowNodeId,
  type FlowValues,
  type WideNode,
} from '@/lib/sales-flow'
import { formatFraction, largestAnnualChanges, shortYear, valueInPeriod, valueInYear, type IncomeSeries, type MeasureKey } from '@/lib/statement-reading'
import { STATEMENT_DETAILS, statementDetailLines, type StatementDetailId } from '@/lib/financial-statement-details'
import styles from './Financials.module.css'

const SERIES_OF: Partial<Record<FlowNodeId, MeasureKey>> = {
  sales: 'revenue',
  grossProfit: 'grossProfit',
  operatingIncome: 'operatingIncome',
  netIncome: 'netIncome',
  costOfSales: 'costOfSales',
  operatingCosts: 'operatingCosts',
  taxes: 'incomeTax',
}

const REPORTED_SENTENCE: Partial<Record<FlowNodeId, string>> = {
  sales: 'What customers paid for the company’s products and services in the year.',
  grossProfit: 'What was left of sales after the direct cost of what was sold.',
  operatingIncome: 'What the business earned from its operations, after running costs.',
  netIncome: 'What was left after every cost, interest and tax.',
  costOfSales: 'The reported direct cost of the goods and services sold.',
  operatingCosts: 'The total operating expenses reported for the year.',
  taxes: 'The income tax expense reported for the year.',
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

/** Colour describes the measure; availability and selection remain separate. */
function flowRole(id: FlowNodeId): 'sales' | 'cost' | 'profit' | 'pending' {
  if (id === 'sales') return 'sales'
  if (id === 'costOfSales' || id === 'operatingCosts' || id === 'taxes') return 'cost'
  if (id === 'grossProfit' || id === 'operatingIncome' || id === 'netIncome') return 'profit'
  return 'pending'
}

function NodeText({
  id,
  value,
  unit,
  currency,
  chevron = false,
  detailAvailable = false,
}: {
  id: FlowNodeId
  value: number | null
  unit: Unit
  currency: string
  chevron?: boolean
  detailAvailable?: boolean
}) {
  const reported = isReportedNode(id)
  return (
    <>
      <span className={styles.nodeName}>
        {NODE_LABEL[id]}
        {chevron ? <span aria-hidden="true" className={styles.chevron}>›</span> : null}
      </span>
      {detailAvailable ? <span className={styles.detailHint}>View reported items</span> : reported && value !== null ? (
        <span className={styles.nodeValue} data-tone={value < 0 ? 'down' : undefined}>
          {unit === SHARE ? formatFraction(value) : formatChartMoney(value, currency)}
        </span>
      ) : <BeingBuiltBadge />}

    </>
  )
}

function accessibleName(id: FlowNodeId, value: number | null, unit: Unit, currency: string, detailAvailable = false): string {
  if (detailAvailable) return `${NODE_LABEL[id]}, view reported items`
  if (!isReportedNode(id)) return `${NODE_LABEL[id]}, being built`
  if (value === null) return `${NODE_LABEL[id]}, being built`
  return `${NODE_LABEL[id]}, ${unit === SHARE ? formatFraction(value) : formatCompactMoney(value, currency)}`
}

function WideFlow({
  values,
  unit,
  currency,
  selected,
  detailAvailable,
  onSelect,
}: {
  values: FlowValues
  unit: Unit
  currency: string
  selected: FlowNodeId
  detailAvailable: Partial<Record<FlowNodeId, boolean>>
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
          <path key={`${link.from}-${link.to}`} className={styles.link} data-flow-link={`${link.from}-${link.to}`} data-flow-role={flowRole(link.to)} data-pending={link.pending ? 'true' : undefined} data-negative={(nodeValue(link.to, values) ?? 0) < 0 ? 'true' : undefined} d={link.d} />
        ))}
        {flow.nodes.map((node) => (
          <rect
            key={node.id}
            className={styles.node}
            data-pending={node.pending ? 'true' : undefined}
            data-selected={node.id === selected ? 'true' : undefined}
            data-negative={(nodeValue(node.id, values) ?? 0) < 0 ? 'true' : undefined}
            data-flow-shape={node.id}
            data-flow-role={flowRole(node.id)}
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
              aria-label={accessibleName(node.id, value, unit, currency, detailAvailable[node.id])}
              style={position}
              onClick={() => onSelect(node.id)}
            >
              <NodeText id={node.id} value={value} unit={unit} currency={currency} detailAvailable={detailAvailable[node.id]} />
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
  detailAvailable,
  onSelect,
}: {
  values: FlowValues
  unit: Unit
  currency: string
  selected: FlowNodeId
  detailAvailable: Partial<Record<FlowNodeId, boolean>>
  onSelect: (id: FlowNodeId) => void
}) {
  const openId = narrowGroupOf(selected) ?? 'netIncome'
  const openIndex = NARROW_GROUPS.findIndex((group) => group.id === openId)
  const children = NARROW_GROUPS[openIndex]?.children ?? []
  const sales = values.revenue
  const scale = flowScale(values)

  return (
    <div className={styles.narrow} data-flow-variant="narrow">
      {/* Sales is the bar the four parts leave from, named above it; its
          amount is written on the sales bar above the flow. */}
      <span className={styles.narrowBarLabel} aria-hidden="true">{NODE_LABEL.sales}</span>
      <button
        type="button"
        className={styles.narrowBar}
        data-pending={sales === null ? 'true' : undefined}
        data-negative={sales !== null && sales < 0 ? 'true' : undefined}
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
            data-flow-role={flowRole(group.id)}
            data-negative={(nodeValue(group.id, values) ?? 0) < 0 ? 'true' : undefined}
            data-pending={isReportedNode(group.id) && nodeValue(group.id, values) !== null ? undefined : 'true'}
            data-open={group.id === openId ? 'true' : undefined}
            d={connectorPath(0, 1, index, NARROW_GROUPS.length)}
          />
        ))}
      </svg>
      <div className={styles.narrowColumn} data-flow-column="groups">
        {NARROW_GROUPS.map((group) => {
          const value = nodeValue(group.id, values)
          const fraction = flowFraction(value, scale)
          return (
            <button
              key={group.id}
              type="button"
              className={styles.narrowNode}
              data-flow-node={group.id}
              data-flow-role={flowRole(group.id)}
              data-pending={isReportedNode(group.id) && nodeValue(group.id, values) !== null ? undefined : 'true'}
              data-open={group.id === openId ? 'true' : undefined}
              aria-pressed={selected === group.id}
              aria-expanded={group.id === openId}
              aria-label={accessibleName(group.id, value, unit, currency)}
              onClick={() => onSelect(group.id)}
            >
              <NodeText id={group.id} value={value} unit={unit} currency={currency} chevron />
              {fraction !== null ? (
                <span className={styles.amountTrack} aria-hidden="true">
                  <span
                    className={styles.amountBar}
                    data-flow-amount={group.id}
                    data-negative={value !== null && value < 0 ? 'true' : undefined}
                    style={{ width: `${fraction * 100}%` }}
                  />
                </span>
              ) : null}
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
            aria-label={accessibleName(child, null, unit, currency, detailAvailable[child])}
            onClick={() => onSelect(child)}
          >
            <NodeText id={child} value={null} unit={unit} currency={currency} detailAvailable={detailAvailable[child]} />
          </button>
        ))}
      </div>
    </div>
  )
}

function StatementDetailCard({ id, year, series, unit }: {
  id: StatementDetailId
  year: number
  series: IncomeSeries
  unit: Unit
}) {
  const anchor = valueInYear(series.revenue, year)
  const rows = statementDetailLines(series, id, anchor)
  const available = rows.some(row => unit === AMOUNT ? row.amount : row.sharePoint)
  const title = STATEMENT_DETAILS[id].title
  if (!available) {
    return <BeingBuilt label={title}>{title} for FY{year} {unit === SHARE ? 'as a share of sales ' : ''}is being added.</BeingBuilt>
  }
  return <ChapterCard title={title} meta={anchor ? `Year ended ${anchor.periodEnd}` : `FY${year}`}>
    <div data-statement-detail={id}>
      <p className={styles.cardNote}>Reported separately. These lines can overlap.</p>
      <dl className={styles.detailList}>
        {rows.map(row => {
          const point = unit === SHARE ? row.sharePoint : row.amount
          return <div key={row.key} data-detail-line={row.key}>
            <dt>{row.label}</dt>
            <dd>
              {point ? <strong data-detail-value="" data-tone={point.value < 0 ? 'down' : undefined}>{unit === SHARE ? formatFraction(point.value) : formatCompactMoney(point.value, row.amount!.currency!)}</strong> : <BeingBuiltBadge />}
              {row.amount && (row.growthPoint || (unit === AMOUNT && row.sharePoint)) ? <span className={styles.detailNote}>
                {unit === AMOUNT && row.sharePoint ? <span>{formatFraction(row.sharePoint.value)} of sales</span> : null}
                {row.growthPoint ? <span>{formatFraction(row.growthPoint.value)} against the year before</span> : null}
              </span> : null}
            </dd>
          </div>
        })}
      </dl>
    </div>
  </ChapterCard>
}

function NodeCard({
  id,
  year,
  years,
  series,
  currency,
  unit,
  onSelect,
}: {
  id: FlowNodeId
  year: number
  years: number[]
  series: IncomeSeries
  currency: string
  unit: Unit
  onSelect: (id: FlowNodeId) => void
}) {
  if (id === 'operatingCostsParts' || id === 'taxesParts') return <StatementDetailCard id={id} year={year} series={series} unit={unit} />
  const key = SERIES_OF[id]
  if (!key) {
    return <BeingBuilt label={NODE_LABEL[id]}>{PENDING_SENTENCE[id]}</BeingBuilt>
  }
  const points = series[key] ?? []
  const anchor = valueInYear(series.revenue, year)
  const candidate = anchor ? valueInPeriod(points, anchor.periodEnd) : valueInYear(points, year)
  const point = candidate && candidate.currency && (!anchor || candidate.currency === anchor.currency) ? candidate : null
  const share = point ? valueInPeriod(series[`${key}Share` as MeasureKey], point.periodEnd) : null
  const growth = point ? valueInPeriod(series[`${key}Growth` as MeasureKey], point.periodEnd) : null
  const history = [...years].sort((left, right) => left - right).flatMap((candidate) => {
    const found = valueInYear(points, candidate)
    return found ? [{ year: candidate, point: found }] : []
  })
  return (
    <div className={styles.detail} data-flow-role={flowRole(id)}>
      <ChapterCard title={NODE_LABEL[id]} meta={`FY${year}`}>
        <div data-flow-card={id}>
          {point ? (
            <p className={styles.cardFigure}>
              <strong data-tone={point.value < 0 ? 'down' : undefined}>{formatCompactMoney(point.value, point.currency ?? currency)}</strong>
              <span>{REPORTED_SENTENCE[id]}</span>
            </p>
          ) : (
            <BeingBuilt size="inline">{NODE_LABEL[id]} for FY{year} is being added.</BeingBuilt>
          )}
        </div>
        <p className={styles.cardNote}>
          {growth ? <span>{formatFraction(growth.value)} against the year before. </span> : <BeingBuiltBadge />}
          {share ? <span>{formatFraction(share.value)} of sales.</span> : <BeingBuiltBadge />}
        </p>
        {id === 'taxes' ? <button type="button" className={styles.detailButton} onClick={() => onSelect('taxesParts')}>View interest and income tax</button> : null}
        {history.length > 0 ? (
          <div className={styles.history} data-flow-history={id}>
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
          </div>
        ) : null}
      </ChapterCard>
    </div>
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
  /** Fiscal years with a reported result, newest first. */
  years: number[]
  series: IncomeSeries
  currency: string
}) {
  const [chosenYear, setYear] = useState<number>(years[0] ?? 0)
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

  const year = years.includes(chosenYear) ? chosenYear : years[0]
  const anchor = valueInYear(series.revenue, year)
  const flowCurrency = anchor?.currency ?? currency
  const selectedValue = (key: MeasureKey): number | null => {
    if (!anchor) return null
    const point = valueInPeriod(series[unit === SHARE ? `${key}Share` as MeasureKey : key], anchor.periodEnd)
    if (!point || (unit === AMOUNT && (!point.currency || point.currency !== anchor.currency))) return null
    return point.value
  }
  const values: FlowValues = {
    revenue: selectedValue('revenue'), grossProfit: selectedValue('grossProfit'),
    operatingIncome: selectedValue('operatingIncome'), netIncome: selectedValue('netIncome'),
    costOfSales: selectedValue('costOfSales'), operatingCosts: selectedValue('operatingCosts'), incomeTax: selectedValue('incomeTax'),
  }
  const changes = anchor ? largestAnnualChanges(series, anchor.periodEnd) : []
  const netMargin = anchor ? valueInPeriod(series.netIncomeShare, anchor.periodEnd) : null
  const yearOptions = [...years].sort((left, right) => left - right).map(String)
  const perUnit = formatChartMoney(1, flowCurrency)
  const detailAvailable = Object.fromEntries((['operatingCostsParts', 'taxesParts'] as const).map(id => [id,
    statementDetailLines(series, id, anchor).some(row => unit === AMOUNT ? row.amount : row.sharePoint),
  ]))

  return (
    <ResearchChapter
      id="sales-flow"
      label="Where each dollar of sales goes"
      actions={(
        <>
          {yearOptions.length > 5 ? (
            <label className={styles.yearChoice}>Fiscal year
              <select aria-label="Fiscal year" value={String(year)} onChange={event=>setYear(Number(event.target.value))}>
                {yearOptions.map(option=><option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ) : <SegmentedControl
            options={yearOptions}
            value={String(year)}
            onChange={(next) => setYear(Number(next))}
            ariaLabel="Fiscal year"
            analyticsId="ticker_financials_year"
          />}
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
        netMargin ? <p>{formatFraction(netMargin.value)} of sales kept as net profit in FY{year}.</p>
          : <BeingBuilt size="inline">Net profit for each {perUnit} of sales in FY{year} is being added.</BeingBuilt>
      )}
      aside={(
        <>
          <NodeCard id={selected} year={year} years={years} series={series} currency={flowCurrency} unit={unit} onSelect={setSelected} />
          {changes.length === 4 ? <ChapterCard title="Biggest changes" meta="Year-on-year">
            <dl className={styles.changesList}>
              {changes.map((change) => <div key={change.measure}>
                <dt>{change.label}</dt>
                <dd data-tone={change.value === 0 ? undefined : (change.cost ? change.value > 0 : change.value < 0) ? 'down' : 'up'}>{formatFraction(change.value)}</dd>
              </div>)}
            </dl>
          </ChapterCard> : <BeingBuilt label="Biggest changes">The four largest changes against the year before are being added.</BeingBuilt>}
        </>
      )}
    >
      <div className={styles.salesBar} data-sales-by-business="">
        <span className={styles.salesBarFill} aria-hidden="true" />
        <span className={styles.salesBarLabel}>
          <strong>Sales{values.revenue !== null && unit === AMOUNT ? ` ${formatChartMoney(values.revenue, flowCurrency)}` : ''}</strong>
          <span>by business</span>
          <BeingBuiltBadge />
        </span>
      </div>
      <div className={styles.flow} data-sales-flow="" role="group" aria-label={`Where each dollar of sales went in FY${year}`}>
        <WideFlow values={values} unit={unit} currency={flowCurrency} selected={selected} detailAvailable={detailAvailable} onSelect={setSelected} />
        <NarrowFlow values={values} unit={unit} currency={flowCurrency} selected={selected} detailAvailable={detailAvailable} onSelect={setSelected} />
      </div>
      {Object.values(values).some((value) => value !== null && value < 0) ? (
        <p className={styles.flowNote}>Sizes compare absolute amounts. Negative amounts are shown in red.</p>
      ) : null}
    </ResearchChapter>
  )
}
