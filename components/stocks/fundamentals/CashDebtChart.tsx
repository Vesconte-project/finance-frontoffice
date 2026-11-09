import type { CSSProperties } from 'react'
import type { CashDebtPoint } from '@/lib/capital-statements'
import { formatChartMoney } from '@/lib/currency'
import styles from './CashDebtChart.module.css'

/**
 * Cash and debt, one row a year with the latest on top: debt grows to the left
 * of a shared centre line, cash to the right, both on one scale, with each
 * amount written at its bar's end and net cash in its own column. The column
 * heads name the marks, so there is no legend to decode, and it is a real
 * table for readers who cannot see the bars.
 */
export default function CashDebtChart({ points }: { points: CashDebtPoint[] }) {
  const largest = Math.max(1, ...points.flatMap((point) => [point.cash, point.debt]))
  const rows = [...points].reverse()
  const share = (amount: number) => ({ '--share': Math.max(0, amount) / largest } as CSSProperties)
  return (
    <figure className={styles.frame} aria-label="Annual cash, debt and net cash" data-chart-frame data-cash-debt="">
      <table className={styles.table}>
        <caption className="sr-only">Cash, debt and net cash at each fiscal year end, latest first</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.yearHead}><span className="sr-only">Fiscal year</span></th>
            <th scope="col" className={styles.debtHead}>Debt</th>
            <th scope="col" className={styles.cashHead}>Cash</th>
            <th scope="col" className={styles.netHead}>Net cash</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point, index) => (
            <tr key={point.periodEnd} data-latest={index === 0 ? 'true' : undefined}>
              <th scope="row" className={styles.year}>{point.year}</th>
              <td className={styles.debt}>
                <span className={styles.amount}>{formatChartMoney(point.debt, point.currency)}</span>
                <span className={styles.bar} style={share(point.debt)} aria-hidden="true" />
              </td>
              <td className={styles.cash}>
                <span className={styles.bar} style={share(point.cash)} aria-hidden="true" />
                <span className={styles.amount}>{formatChartMoney(point.cash, point.currency)}</span>
              </td>
              <td className={styles.net} data-tone={point.netCash < 0 ? 'down' : 'up'}>
                {point.netCash > 0 ? '+' : ''}{formatChartMoney(point.netCash, point.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
