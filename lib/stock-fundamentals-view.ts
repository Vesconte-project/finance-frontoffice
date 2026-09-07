import 'server-only'

import {
  type FinancialStatementLineItem,
  type FinancialStatementType,
  type FinancialStatementsPayload,
} from '@/lib/canonical-research'
import type { ResearchMetric, StockResearchData } from '@/lib/stock-research'

export type MeasureFormat = 'currency' | 'perShare' | 'shares' | 'number'

export type MeasurePoint = {
  periodEnd: string
  label: string
  value: number
}

export type MeasureChange = {
  periodEnd: string
  changePct: number
}

export type FundamentalMeasure = {
  key: string
  label: string
  format: MeasureFormat
  currency: string
  /** Oldest to newest, so the series reads left to right. */
  series: MeasurePoint[]
  latest: MeasurePoint
  /**
   * Period-over-period change. This is the page's whole reason to exist: the
   * levels behind it are already in Financials, period by period, and already
   * on Overview as latest values. What neither shows is the trajectory.
   */
  changes: MeasureChange[]
}

export type FundamentalChapter = {
  key: string
  label: string
  measures: FundamentalMeasure[]
  /** The union of the chapter's change periods, oldest first — its columns. */
  periods: MeasurePoint[]
  /**
   * Funds only. An ETF files no statements, so its fundamentals are the
   * attributes themselves; an equity's tail was a verbatim copy of the
   * Overview page's own fundamental groups, built from the same rows by the
   * same regexes, and is dropped rather than repeated.
   */
  tail: ResearchMetric[]
}

export type FundamentalsView = {
  chapters: FundamentalChapter[]
  hasStatements: boolean
}

export type StatementBundle = Partial<Record<FinancialStatementType, FinancialStatementsPayload | null>>

type MeasureSpec = {
  key: string
  label: string
  format: MeasureFormat
  statement: FinancialStatementType
  /**
   * Exact `lineItemId` spellings, tried first.
   *
   * The canonical vocabulary is undocumented (REQ-008), and anchoring on
   * guesses alone is how `Financial health` ended up leading with shares
   * outstanding: none of the balance-sheet spellings matched, so the chapter
   * fell through to its statement's row order.
   */
  prefer: RegExp
  /**
   * Tolerant fallback, matched against `lineItemId` *and* `displayLabel`
   * together. The human label is far more predictable than the key — "Total
   * Debt" survives whatever the id happens to be called.
   */
  accept?: RegExp
  reject?: RegExp
}

type ChapterSpec = {
  key: string
  label: string
  /** Feeds the fallback, and the tail is drawn from the themes named here. */
  statement: FinancialStatementType
  themeKeys: string[]
  measures: MeasureSpec[]
  /**
   * Guards the last-resort fallback. Without it the fallback takes whatever
   * the statement listed first, which is how a share count became the headline
   * answer for whether a company can carry itself.
   */
  fallbackHint?: RegExp
}

const EQUITY_CHAPTERS: ChapterSpec[] = [
  {
    key: 'growth',
    label: 'Growth',
    statement: 'income_statement',
    themeKeys: ['growth'],
    fallbackHint: /revenue|sales|income|earnings|cash flow/i,
    measures: [
      {
        key: 'revenue',
        label: 'Revenue',
        format: 'currency',
        statement: 'income_statement',
        prefer: /^(total_revenue|revenue|revenues|net_sales|total_net_sales|net_revenue|operating_revenue)$/,
        accept: /revenue|net sales/i,
        reject: /cost|expense|growth|per share|segment|deferred/i,
      },
      {
        key: 'net-income',
        label: 'Net income',
        format: 'currency',
        statement: 'income_statement',
        prefer: /^(net_income|net_income_common_stockholders|net_income_continuous_operations|profit_loss)$/,
        accept: /net income/i,
        reject: /per share|margin|discontinued|minority|noncontrolling|extraordinary/i,
      },
      {
        key: 'diluted-eps',
        label: 'Diluted EPS',
        format: 'perShare',
        statement: 'income_statement',
        prefer: /^(diluted_eps|eps_diluted|diluted_earnings_per_share|earnings_per_share_diluted)$/,
        accept: /diluted.*(eps|per share)|(eps|per share).*diluted/i,
        reject: /estimate|surprise|shares|average/i,
      },
      {
        key: 'free-cash-flow',
        label: 'Free cash flow',
        format: 'currency',
        statement: 'cash_flow',
        prefer: /^(free_cash_flow)$/,
        accept: /free cash flow|free_cash_flow/i,
        reject: /per share|yield|margin/i,
      },
    ],
  },
  {
    key: 'profitability',
    label: 'Profitability',
    statement: 'income_statement',
    themeKeys: ['profitability'],
    fallbackHint: /profit|income|ebitda|ebit|margin/i,
    measures: [
      {
        key: 'gross-profit',
        label: 'Gross profit',
        format: 'currency',
        statement: 'income_statement',
        prefer: /^(gross_profit|gross_income)$/,
        accept: /gross (profit|income)/i,
        reject: /margin|per share/i,
      },
      {
        key: 'operating-income',
        label: 'Operating income',
        format: 'currency',
        statement: 'income_statement',
        prefer: /^(operating_income|operating_income_loss|total_operating_income_as_reported)$/,
        accept: /operating (income|profit)/i,
        reject: /margin|per share|non.?operating/i,
      },
      {
        key: 'ebitda',
        label: 'EBITDA',
        format: 'currency',
        statement: 'income_statement',
        prefer: /^(ebitda|normalized_ebitda)$/,
        accept: /ebitda/i,
        reject: /margin|per share|multiple|enterprise/i,
      },
    ],
  },
  {
    key: 'financial-health',
    label: 'Financial health',
    statement: 'balance_sheet',
    themeKeys: ['financial-health'],
    // Deliberately narrow: a share count, a per-share figure or an issuance
    // line is not an answer to whether the balance sheet carries the company.
    fallbackHint: /cash|debt|equity|asset|liabilit|capital/i,
    measures: [
      {
        key: 'cash',
        label: 'Cash and equivalents',
        format: 'currency',
        statement: 'balance_sheet',
        prefer: /^(cash_and_cash_equivalents|cash_cash_equivalents_and_short_term_investments|cash_and_equivalents)$/,
        accept: /cash/i,
        reject: /flow|paid|dividend|financing|investing|operating|issuance|repurchase|change|per share/i,
      },
      {
        key: 'total-debt',
        label: 'Total debt',
        format: 'currency',
        statement: 'balance_sheet',
        prefer: /^(total_debt|total_debt_and_capital_lease_obligation)$/,
        accept: /debt/i,
        reject: /^net_debt$|issuance|repayment|net debt|per share/i,
      },
      {
        key: 'equity',
        label: 'Shareholder equity',
        format: 'currency',
        statement: 'balance_sheet',
        prefer: /^(stockholders_equity|total_stockholders_equity|common_stock_equity|total_equity_gross_minority_interest)$/,
        accept: /(stockholder|shareholder|common stock).*equity|total equity/i,
        reject: /method|investment|per share|minority/i,
      },
      {
        key: 'operating-cash-flow',
        label: 'Operating cash flow',
        format: 'currency',
        statement: 'cash_flow',
        prefer: /^(operating_cash_flow|cash_flow_from_continuing_operating_activities|total_cash_from_operating_activities)$/,
        accept: /operating (activities|cash flow)|cash from operations/i,
        reject: /investing|financing|per share|free/i,
      },
    ],
  },
  {
    key: 'shareholder-return',
    label: 'Shareholder return',
    statement: 'cash_flow',
    themeKeys: ['shareholder-return'],
    fallbackHint: /dividend|repurchase|buyback|stock/i,
    measures: [
      {
        key: 'dividends-paid',
        label: 'Dividends paid',
        format: 'currency',
        statement: 'cash_flow',
        prefer: /^(cash_dividends_paid|common_stock_dividend_paid|dividends_paid)$/,
        accept: /dividend.*paid|paid.*dividend/i,
        reject: /preferred|per share|received/i,
      },
      {
        key: 'buybacks',
        label: 'Share repurchases',
        format: 'currency',
        statement: 'cash_flow',
        prefer: /^(repurchase_of_capital_stock|common_stock_payments|repurchase_of_common_stock)$/,
        accept: /repurchase|buyback/i,
        reject: /preferred|per share|issuance/i,
      },
    ],
  },
]

// A fund files no statements, so its chapters are the themes it already has,
// carried into the same layout without series.
const FUND_CHAPTERS: ChapterSpec[] = [
  { key: 'portfolio', label: 'Portfolio', statement: 'income_statement', themeKeys: ['portfolio'], measures: [] },
  { key: 'exposure', label: 'Exposure', statement: 'income_statement', themeKeys: ['exposure'], measures: [] },
  { key: 'distributions', label: 'Distributions', statement: 'income_statement', themeKeys: ['distributions'], measures: [] },
  { key: 'risk', label: 'Risk', statement: 'income_statement', themeKeys: ['risk'], measures: [] },
]

function periodLabel(row: FinancialStatementLineItem): string {
  if (row.periodType === 'quarterly' && row.fiscalQuarter) {
    return `${row.fiscalQuarter} ${row.fiscalYear ?? ''}`.trim()
  }
  return row.fiscalYear ? `FY${row.fiscalYear}` : row.periodEnd
}

function seriesFor(rows: FinancialStatementLineItem[]): MeasurePoint[] {
  const byPeriod = new Map<string, MeasurePoint>()
  for (const row of rows) {
    if (row.value === null || !Number.isFinite(row.value)) continue
    // The read model can carry more than one revision of a period; the first
    // is the one the backend ordered first, so keep it rather than overwrite.
    if (byPeriod.has(row.periodEnd)) continue
    byPeriod.set(row.periodEnd, { periodEnd: row.periodEnd, label: periodLabel(row), value: row.value })
  }
  return [...byPeriod.values()].sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
}

function buildMeasure(
  key: string,
  label: string,
  format: MeasureFormat,
  rows: FinancialStatementLineItem[],
  fallbackCurrency: string,
): FundamentalMeasure | null {
  const series = seriesFor(rows)
  if (series.length === 0) return null
  const changes: MeasureChange[] = []
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1]
    const current = series[index]
    // A sign flip has no meaningful percentage — a swing from a loss to a
    // profit is not "up 340%" — so it is left out rather than made up.
    if (previous.value === 0 || Math.sign(previous.value) !== Math.sign(current.value)) continue
    changes.push({
      periodEnd: current.periodEnd,
      changePct: ((current.value - previous.value) / Math.abs(previous.value)) * 100,
    })
  }
  return {
    key,
    label,
    format,
    currency: rows.find((row) => row.currency)?.currency ?? fallbackCurrency,
    series,
    latest: series[series.length - 1],
    changes,
  }
}

function rowsById(payload: FinancialStatementsPayload | null | undefined): Map<string, FinancialStatementLineItem[]> {
  const grouped = new Map<string, FinancialStatementLineItem[]>()
  if (!payload?.available) return grouped
  for (const row of payload.rows) {
    const existing = grouped.get(row.lineItemId)
    if (existing) existing.push(row)
    else grouped.set(row.lineItemId, [row])
  }
  return grouped
}

function dedupeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * The chapter's columns: every period any of its measures reports a change
 * for. Measures can cover different periods — the cash-flow statement need not
 * run as far back as the income statement — so a shared column set shows that
 * difference as a gap rather than silently aligning unlike years.
 */
function chapterPeriods(measures: FundamentalMeasure[]): MeasurePoint[] {
  const periods = new Map<string, MeasurePoint>()
  for (const measure of measures) {
    for (const change of measure.changes) {
      const point = measure.series.find((entry) => entry.periodEnd === change.periodEnd)
      if (point && !periods.has(point.periodEnd)) periods.set(point.periodEnd, point)
    }
  }
  return [...periods.values()].sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
}

export function buildFundamentalsView(
  data: StockResearchData,
  statements: StatementBundle,
): FundamentalsView {
  const specs = data.kind === 'fund' ? FUND_CHAPTERS : EQUITY_CHAPTERS
  const grouped: Partial<Record<FinancialStatementType, Map<string, FinancialStatementLineItem[]>>> = {
    income_statement: rowsById(statements.income_statement),
    balance_sheet: rowsById(statements.balance_sheet),
    cash_flow: rowsById(statements.cash_flow),
  }
  const hasStatements = Object.values(grouped).some((group) => (group?.size ?? 0) > 0)
  const claimedIds = new Set<string>()
  const themesByKey = new Map(data.themes.map((theme) => [theme.key, theme]))

  const chapters = specs.map((spec) => {
    const measures: FundamentalMeasure[] = []
    for (const measureSpec of spec.measures) {
      const group = grouped[measureSpec.statement]
      if (!group) continue
      const entries = [...group.entries()]
      const exact = entries.filter(([id]) => measureSpec.prefer.test(id.toLowerCase()))
      const candidates = exact.length > 0 ? exact : entries.filter(([id, rows]) => {
        if (!measureSpec.accept) return false
        const subject = `${id} ${rows[0].displayLabel ?? ''}`
        return measureSpec.accept.test(subject) && !(measureSpec.reject?.test(subject) ?? false)
      })
      if (candidates.length === 0) continue
      // Several spellings can match; the most complete series is the one worth
      // charting, and the shortest id breaks a tie towards the headline item
      // rather than one of its qualified variants.
      const [id, rows] = candidates.sort(
        (left, right) => right[1].length - left[1].length || left[0].length - right[0].length,
      )[0]
      const measure = buildMeasure(measureSpec.key, measureSpec.label, measureSpec.format, rows, data.currency)
      if (!measure) continue
      claimedIds.add(id)
      measures.push(measure)
    }

    // No spec matched, but the statement did arrive: the vocabulary is not what
    // this build expected. Lead with the statement's own order — a statement is
    // published top-line first — rather than showing the chapter as empty.
    if (measures.length === 0 && spec.measures.length > 0) {
      const group = grouped[spec.statement]
      for (const [id, rows] of group ?? []) {
        if (claimedIds.has(id) || measures.length >= 3) continue
        if (spec.fallbackHint && !spec.fallbackHint.test(`${id} ${rows[0].displayLabel ?? ''}`)) continue
        const measure = buildMeasure(id, rows[0].displayLabel || id, 'currency', rows, data.currency)
        if (!measure || measure.series.length < 3) continue
        claimedIds.add(id)
        measures.push(measure)
      }
    }

    const charted = new Set(measures.map((measure) => dedupeKey(measure.label)))
    const tail = data.kind === 'fund'
      ? spec.themeKeys
        .flatMap((themeKey) => themesByKey.get(themeKey)?.metrics ?? [])
        .filter((metric) => !charted.has(dedupeKey(metric.label)))
      : []

    return { key: spec.key, label: spec.label, measures, periods: chapterPeriods(measures), tail }
  })

  return {
    chapters: chapters.filter((chapter) => chapter.measures.length > 0 || chapter.tail.length > 0),
    hasStatements,
  }
}
