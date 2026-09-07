import Link from 'next/link'
import ResearchViewShell, { ResearchAdPlacement } from '@/components/stocks/ResearchViewShell'
import StatementChart, { type StatementSeries } from '@/components/stocks/StatementChart'
import { formatCompactMoney } from '@/lib/currency'
import type { FinancialStatementLineItem, FinancialStatementsPayload } from '@/lib/canonical-research'
import type { StockResearchData } from '@/lib/stock-research'
import styles from './ResearchViews.module.css'

export type StatementKey = 'income' | 'balance-sheet' | 'cash-flow'
export type StatementPeriod = 'annual' | 'quarterly'

const STATEMENTS: Array<{ key: StatementKey; label: string; short: string }> = [
  { key: 'income', label: 'Income Statement', short: 'Income' },
  { key: 'balance-sheet', label: 'Balance Sheet', short: 'Balance Sheet' },
  { key: 'cash-flow', label: 'Cash Flow', short: 'Cash Flow' },
]

/**
 * Reading order for each statement.
 *
 * The rows arrived alphabetically, so an income statement opened EBITDA, EPS,
 * Gross Profit, Net Income, Operating Income, Revenue — the top line last and
 * a per-share figure in the middle of the money. A statement read out of order
 * is not a statement. Anything unmatched keeps the backend's own order behind
 * these, so a line item added later still appears.
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
 * The money lines each statement leads with.
 */
const CHART_SERIES: Record<StatementKey, RegExp[]> = {
  income: [/^(total_)?revenue/, /^operating_income/, /^net_income/],
  'balance-sheet': [/^total_assets/, /^total_liabilities/, /^(total_|stockholders_)?equity/],
  'cash-flow': [/^operating_cash_flow|operating_activities/, /^free_cash_flow/],
}

/**
 * Per-share figures, charted separately.
 *
 * Not laid over the money on a second y-axis, which is what a padlock-and-
 * overlay reference does and what the request asked for. Two scales in one
 * frame make the relationship between the lines an artifact of where each axis
 * was pinned — move one and the crossing moves with it — so EPS gets its own
 * frame under the same periods instead. Same x, honest y.
 */
const PER_SHARE_SERIES: Record<StatementKey, RegExp[]> = {
  income: [/^eps|per_share/],
  'balance-sheet': [/^shares_outstanding/],
  'cash-flow': [/per_share/],
}

function statementHref({
  ticker,
  statement,
  period,
}: {
  ticker: string
  statement: StatementKey
  period: StatementPeriod
}) {
  const params = new URLSearchParams({ statement, period })
  return `/stocks/${ticker}/financials?${params.toString()}`
}

function formatPeriod(row: FinancialStatementLineItem): string {
  if (row.periodType === 'quarterly' && row.fiscalQuarter) {
    return `${row.fiscalQuarter} ${row.fiscalYear ?? ''}`.trim()
  }
  return row.fiscalYear ? `FY${row.fiscalYear}` : row.periodEnd
}

function isMoney(lineItemId: string): boolean {
  const id = lineItemId.toLowerCase()
  return !id.includes('per_share') && !id.includes('eps') && !id.includes('shares') && !id.includes('ratio')
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

export default function StockFinancialStatementsResearch({
  data,
  statement,
  period,
  statements,
}: {
  data: StockResearchData
  statement: StatementKey
  period: StatementPeriod
  statements: FinancialStatementsPayload | null
}) {
  const activeStatement = STATEMENTS.find((item) => item.key === statement) ?? STATEMENTS[0]
  const canonicalRows = statements?.available ? statements.rows : []
  const cells = new Map<string, FinancialStatementLineItem>()
  for (const row of canonicalRows) {
    const key = `${row.lineItemId}:${row.periodEnd}`
    if (!cells.has(key)) cells.set(key, row)
  }

  // Oldest to newest, the way a statement is published and the way the chart
  // above reads. Every reported period, with no cap — the previous five was
  // a slice applied here after asking the backend for five hundred.
  const periods = [...new Map(canonicalRows.map((row) => [row.periodEnd, row])).values()]
    .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))

  const lineItems = [...new Map(canonicalRows.map((row) => [row.lineItemId, row])).values()]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const order = rank(STATEMENT_ORDER[statement], left.row.lineItemId) - rank(STATEMENT_ORDER[statement], right.row.lineItemId)
      return order !== 0 ? order : left.index - right.index
    })
    .map((entry) => entry.row)

  const seriesFrom = (patterns: RegExp[], money: boolean): StatementSeries[] => patterns.flatMap((pattern) => {
    const match = lineItems.find(
      (item) => pattern.test(item.lineItemId.toLowerCase()) && isMoney(item.lineItemId) === money,
    )
    if (!match) return []
    return [{
      key: match.lineItemId,
      label: match.displayLabel || match.lineItemId,
      values: periods.map((periodRow) => cells.get(`${match.lineItemId}:${periodRow.periodEnd}`)?.value ?? null),
    }]
  })
  const chartSeries = seriesFrom(CHART_SERIES[statement], true)
  const perShareSeries = seriesFrom(PER_SHARE_SERIES[statement], false)
  const periodLabels = periods.map(formatPeriod)

  // TODO(REQ-011, backend): mark periods the response is withholding once the
  // contract can say so. Earlier history is intended to become a paid tier, but
  // a padlock drawn over periods the backend simply does not hold would invent
  // a paywall over missing data and claim coverage we do not have.
  // `CanonicalAvailability.count` is not that signal — it reports 500 for a
  // symbol whose rows number in the tens, which is the limit this page sends.
  const currency = [...new Set(canonicalRows.map((row) => row.currency).filter(Boolean))].join(', ') || data.currency
  const latestKnownAt = canonicalRows.reduce<string | null>(
    (latest, row) => !latest || row.knownAt > latest ? row.knownAt : latest,
    null,
  )

  return (
    // No page header: the tab above already says Financials, and the coverage
    // badge beside it said nothing a reader could act on.
    <ResearchViewShell data={data} title="Financial Statements" showHeader={false}>
      <div className={styles.statementToolbar}>
        <nav className={styles.statementTabs} aria-label="Financial statement">
          {STATEMENTS.map((item) => (
            <Link
              key={item.key}
              href={statementHref({ ticker: data.ticker, statement: item.key, period })}
              aria-current={item.key === statement ? 'page' : undefined}
              scroll={false}
            >
              {item.short}
            </Link>
          ))}
        </nav>
        <nav className={styles.periodTabs} aria-label="Reporting frequency">
          {(['annual', 'quarterly'] as const).map((item) => (
            <Link
              key={item}
              href={statementHref({ ticker: data.ticker, statement, period: item })}
              aria-current={item === period ? 'page' : undefined}
              scroll={false}
            >
              {item === 'annual' ? 'Annual' : 'Quarterly'}
            </Link>
          ))}
        </nav>
      </div>

      <StatementChart
        periods={periodLabels}
        series={chartSeries}
        currency={data.currency}
        caption={`${activeStatement.label} · ${period === 'annual' ? 'annual' : 'quarterly'} periods`}
      />

      {perShareSeries.length > 0 ? (
        <StatementChart
          periods={periodLabels}
          series={perShareSeries}
          currency={data.currency}
          format="plain"
          height={150}
          caption={`${perShareSeries[0].label} · ${period === 'annual' ? 'annual' : 'quarterly'} periods`}
        />
      ) : null}

      {lineItems.length > 0 ? (
        <section aria-labelledby="statement-detail">
          <div className={styles.statementTableWrap}>
            <table className={styles.statementTable}>
              <caption id="statement-detail">{activeStatement.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Line item</th>
                  {periods.map((row) => <th scope="col" key={row.periodEnd}>{formatPeriod(row)}<small>{row.periodEnd}</small></th>)}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((lineItem) => (
                  <tr key={lineItem.lineItemId}>
                    {/* The canonical key used to print under every label. It is
                        a join key for this codebase, not something a reader
                        came here to read. */}
                    <th scope="row">{lineItem.displayLabel || lineItem.lineItemId}</th>
                    {periods.map((periodRow) => (
                      <td key={periodRow.periodEnd}>{formatStatementValue(cells.get(`${lineItem.lineItemId}:${periodRow.periodEnd}`), data.currency)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.statementProvenance}>
            {currency} · as reported{latestKnownAt ? ` · known at ${latestKnownAt}` : ''}
          </p>
        </section>
      ) : (
        <p className={styles.statementProvenance}>{statements?.reason ?? 'Canonical statement data is unavailable for this symbol.'}</p>
      )}

      <ResearchAdPlacement />
    </ResearchViewShell>
  )
}
