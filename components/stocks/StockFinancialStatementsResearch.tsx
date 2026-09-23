import Link from 'next/link'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import { type StatementSeries } from '@/components/stocks/StatementChart'
import StatementHistoryWindow from '@/components/stocks/StatementHistoryWindow'
import { formatCompactMoney } from '@/lib/currency'
import { tickerIdentityColor } from '@/lib/ticker-identity-color'
import type { FinancialStatementLineItem, FinancialStatementsPayload } from '@/lib/canonical-research'
import { lockedHistoryCopy, type HistoryTier, type LockedHistoryCopy } from '@/lib/statement-history'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'

export type StatementKey = 'income' | 'balance-sheet' | 'cash-flow'
export type StatementPeriod = 'annual' | 'quarterly'

export type StatementBundle = Record<StatementKey, FinancialStatementsPayload | null>

const STATEMENTS: Array<{ key: StatementKey; label: string }> = [
  { key: 'income', label: 'Income' },
  { key: 'balance-sheet', label: 'Balance sheet' },
  { key: 'cash-flow', label: 'Cash flow' },
]

/**
 * Reading order for each statement.
 *
 * The rows arrived alphabetically, so an income statement opened EBITDA, EPS,
 * Gross Profit, Net Income, Operating Income, Revenue — the top line last and
 * a per-share figure in the middle of the money. Anything unmatched keeps the
 * backend's own order behind these, so a line item added later still appears.
 */
const STATEMENT_ORDER: Record<StatementKey, RegExp[]> = {
  income: [
    /^(total_)?revenue/, /^cost_of/, /^gross_profit/, /^(total_)?operating_expense/,
    /^operating_income/, /^ebitda/, /^ebit$/, /^interest/, /^pretax/, /^tax/,
    /^net_income/, /^eps|per_share/,
  ],
  'balance-sheet': [
    /^cash/, /^(short|long)_term_investments/, /^total_current_assets/, /^total_assets/,
    /^total_current_liabilities/, /^(total_)?debt/, /^total_liabilities/,
    /^(total_|stockholders_|common_stock_)?equity/, /^shares_outstanding/,
  ],
  'cash-flow': [
    /^operating_cash_flow|operating_activities/, /^capital_expenditure|capex/, /^free_cash_flow/,
    /^investing/, /^financing/, /^dividend/, /^repurchase|buyback/,
  ],
}

/**
 * The nesting each statement is charted as, outermost first.
 *
 * Income narrows from what was sold to what was kept. The balance sheet is
 * assets with the claim on them inside — the headroom left above the inner bar
 * is the equity, shown without stating a figure nobody sent us. EBITDA is
 * absent on purpose: it is an adjusted measure, not a step of the funnel, and
 * it stays in the table where it cannot imply it belongs in the sequence.
 */
const CHART_NESTING: Record<StatementKey, RegExp[]> = {
  income: [/^(total_)?revenue/, /^gross_profit/, /^operating_income/, /^net_income/],
  'balance-sheet': [/^total_assets/, /^total_liabilities/],
  'cash-flow': [/^operating_cash_flow|operating_activities/, /^free_cash_flow/],
}

function periodHref(ticker: string, period: StatementPeriod) {
  return `/stocks/${ticker}/financials?period=${period}`
}

function formatPeriod(row: FinancialStatementLineItem): string {
  if (row.periodType === 'quarterly' && row.fiscalQuarter) {
    return `${row.fiscalQuarter} ${row.fiscalYear ?? ''}`.trim()
  }
  return row.fiscalYear ? `FY${row.fiscalYear}` : row.periodEnd
}

function formatStatementValue(row: FinancialStatementLineItem | undefined, fallbackCurrency: string): string {
  if (!row || row.value === null || !Number.isFinite(row.value)) return ''
  const id = row.lineItemId.toLowerCase()
  if (id.includes('per_share') || id.includes('eps')) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(row.value)
  }
  if (id.includes('shares')) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(row.value)
  }
  return formatCompactMoney(row.value, row.currency || fallbackCurrency)
}

function rank(patterns: RegExp[], lineItemId: string): number {
  const index = patterns.findIndex((pattern) => pattern.test(lineItemId.toLowerCase()))
  return index < 0 ? patterns.length : index
}

function Statement({
  statement,
  label,
  payload,
  currency,
  period,
  accentColor,
  withheld,
  locked,
}: {
  statement: StatementKey
  label: string
  payload: FinancialStatementsPayload | null
  currency: string
  period: StatementPeriod
  accentColor: string
  withheld: number
  locked: LockedHistoryCopy | null
}) {
  const rows = payload?.available ? payload.rows : []
  if (rows.length === 0) return null

  const cells = new Map<string, FinancialStatementLineItem>()
  for (const row of rows) {
    const key = `${row.lineItemId}:${row.periodEnd}`
    if (!cells.has(key)) cells.set(key, row)
  }

  // Oldest to newest, the way a statement is published and the way the chart
  // beside it reads. Every period the reader's plan allows — the page cut the
  // rest before this was reached — shown a window at a time.
  const periods = [...new Map(rows.map((row) => [row.periodEnd, row])).values()]
    .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))

  const lineItems = [...new Map(rows.map((row) => [row.lineItemId, row])).values()]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const order = rank(STATEMENT_ORDER[statement], left.row.lineItemId) - rank(STATEMENT_ORDER[statement], right.row.lineItemId)
      return order !== 0 ? order : left.index - right.index
    })
    .map((entry) => entry.row)

  const nesting: StatementSeries[] = CHART_NESTING[statement].flatMap((pattern) => {
    const match = lineItems.find((item) => pattern.test(item.lineItemId.toLowerCase()))
    if (!match) return []
    return [{
      key: match.lineItemId,
      label: match.displayLabel || match.lineItemId,
      values: periods.map((row) => cells.get(`${match.lineItemId}:${row.periodEnd}`)?.value ?? null),
    }]
  })

  return (
    <section className={styles.statement} id={statement}>
      <h2 className={styles.statementHeading}>{label}</h2>
      <StatementHistoryWindow
        periodLabels={periods.map(formatPeriod)}
        series={nesting}
        rows={lineItems.map((lineItem) => ({
          key: lineItem.lineItemId,
          label: lineItem.displayLabel || lineItem.lineItemId,
          cells: periods.map((row) => formatStatementValue(cells.get(`${lineItem.lineItemId}:${row.periodEnd}`), currency)),
        }))}
        currency={currency}
        accentColor={accentColor}
        caption={`${label} · ${period === 'annual' ? 'annual' : 'quarterly'} periods`}
        period={period}
        withheld={withheld}
        locked={locked}
      />
    </section>
  )
}

export default function StockFinancialStatementsResearch({
  data,
  period,
  statements,
  tier,
  withheldBy,
}: {
  data: StockResearchData
  period: StatementPeriod
  /** Already cut to the reader's plan by the page. */
  statements: StatementBundle
  tier: HistoryTier
  /** How many earlier periods each statement's plan does not open — counts, nothing else. */
  withheldBy: Record<StatementKey, number>
}) {
  const available = STATEMENTS.filter((item) => statements[item.key]?.available)
  const knownAt = Object.values(statements)
    .flatMap((payload) => payload?.rows ?? [])
    .reduce<string | null>((latest, row) => !latest || row.knownAt > latest ? row.knownAt : latest, null)

  return (
    // No page header: the tab above already says Financials. The three
    // statements are on one page rather than behind three tabs of their own —
    // this contract returns six income line items, three balance-sheet items
    // and one cash-flow item, and splitting that across three tabs left each
    // one nearly empty while the reader clicked between them.
    <ResearchViewShell data={data} title="Financial Statements" showHeader={false}>
      <div className={styles.statementToolbar}>
        {/* The statement links are gone with the tabs they used to switch. All
            three are on this page, in order, and a jump list over three
            headings is furniture. */}
        <nav className={styles.periodTabs} aria-label="Reporting frequency">
          {(['annual', 'quarterly'] as const).map((item) => (
            <Link
              key={item}
              href={periodHref(data.ticker, item)}
              aria-current={item === period ? 'page' : undefined}
              scroll={false}
            >
              {item === 'annual' ? 'Annual' : 'Quarterly'}
            </Link>
          ))}
        </nav>
      </div>

      {available.length > 0 ? (
        available.map((item) => (
          <Statement
            // Keyed by period too, so switching Annual / Quarterly resets the
            // window to the most recent periods (§4.2).
            key={`${item.key}:${period}`}
            statement={item.key}
            label={item.label}
            payload={statements[item.key]}
            currency={data.currency}
            period={period}
            accentColor={tickerIdentityColor(data.ticker)}
            withheld={withheldBy[item.key]}
            locked={lockedHistoryCopy(tier, period, withheldBy[item.key])}
          />
        ))
      ) : (
        <p className={styles.statementProvenance}>
          {statements.income?.reason ?? 'Canonical statement data is unavailable for this symbol.'}
        </p>
      )}

      {/* Periods beyond the reader's plan are cut on the page and shown only
          as a count, in each statement's locked zone. A count is never drawn
          past what the backend actually returned, so a lock never sits over
          history we do not hold. */}
      {available.length > 0 ? (
        <p className={styles.statementProvenance}>
          {data.currency} · as reported{knownAt ? ` · known at ${knownAt}` : ''}
        </p>
      ) : null}

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
