/** Selection only: independent reported lines, never a reconciled cost split. */
import { valueInPeriod, type IncomeSeries, type MeasureKey, type ReportedPoint } from './statement-reading'

export type StatementDetailId = 'operatingCostsParts' | 'taxesParts'
type Line = { key: MeasureKey; label: string; share?: MeasureKey; growth?: MeasureKey }

export const STATEMENT_DETAILS: Record<StatementDetailId, { title: string; lines: readonly Line[] }> = {
  operatingCostsParts: {
    title: 'Operating cost details',
    lines: [
      { key: 'researchAndDevelopment', label: 'Research and development', share: 'researchAndDevelopmentShare', growth: 'researchAndDevelopmentGrowth' },
      { key: 'sga', label: 'Selling, general and administrative', share: 'sgaShare', growth: 'sgaGrowth' },
      { key: 'generalAndAdministrative', label: 'General and administrative' },
      { key: 'sellingAndMarketing', label: 'Selling and marketing' },
    ],
  },
  taxesParts: {
    title: 'Interest and income tax',
    lines: [
      { key: 'incomeTax', label: 'Income tax expense', share: 'incomeTaxShare', growth: 'incomeTaxGrowth' },
      { key: 'interestExpense', label: 'Interest expense', share: 'interestExpenseShare', growth: 'interestExpenseGrowth' },
      { key: 'nonOperatingInterestExpense', label: 'Non-operating interest expense', share: 'nonOperatingInterestExpenseShare', growth: 'nonOperatingInterestExpenseGrowth' },
      { key: 'interestIncome', label: 'Interest income' },
      { key: 'netInterestIncome', label: 'Net interest income' },
    ],
  },
}

export type StatementDetailLine = Line & { amount: ReportedPoint | null; sharePoint: ReportedPoint | null; growthPoint: ReportedPoint | null }

export function statementDetailLines(series: IncomeSeries, id: StatementDetailId, anchor: ReportedPoint | null): StatementDetailLine[] {
  return STATEMENT_DETAILS[id].lines.map(line => {
    const candidate = anchor ? valueInPeriod(series[line.key], anchor.periodEnd) : null
    const unit = anchor?.currency
    const knownUnit = unit && /^[A-Z]{3}$/.test(unit) && !['XXX', 'GBX', 'ZAC', 'ILA'].includes(unit)
    const amount = candidate && knownUnit && candidate.currency === unit && Number.isFinite(candidate.value) ? candidate : null
    const fraction = (key?: MeasureKey) => {
      const point = key && amount ? valueInPeriod(series[key], amount.periodEnd) : null
      return point && point.currency === null && Number.isFinite(point.value) ? point : null
    }
    return { ...line, amount, sharePoint: fraction(line.share), growthPoint: fraction(line.growth) }
  })
}
