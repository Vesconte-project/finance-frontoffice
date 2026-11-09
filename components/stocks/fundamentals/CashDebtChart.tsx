import ChartFrame, { ChartPlot, ChartLabel } from '@/components/stocks/research/ChartFrame'
import { MetaChip } from '@/components/stocks/research/ResearchChapter'
import type { CashDebtPoint } from '@/lib/capital-statements'
import { formatChartMoney } from '@/lib/currency'
import type { PlotBox } from '@/lib/chart-labels'
import styles from './CashDebtChart.module.css'

function Plot({ points, box, variant }: { points: CashDebtPoint[]; box: PlotBox; variant: 'wide' | 'compact' }) {
  const high = Math.max(1, ...points.flatMap((point) => [point.cash, point.netCash]))
  const low = Math.min(-1, ...points.flatMap((point) => [-point.debt, point.netCash]))
  const y = (amount: number) => 24 + ((high - amount) / (high - low)) * (box.height - 56)
  const step = box.width / Math.max(1, points.length)
  const x = (index: number) => step * (index + 0.5)
  const width = Math.min(variant === 'wide' ? 28 : 18, step * 0.26)
  const last = points.length - 1
  return (
    <ChartPlot
      box={box}
      variant={variant}
      labels={points.map((point, index) => (
        <ChartLabel key={point.periodEnd} box={box} x={x(index)} y={box.height - 12} tone={index === last ? undefined : 'muted'} strong={index === last}>
          {variant === 'compact' ? `'${String(point.year).slice(-2)}` : point.year}
        </ChartLabel>
      ))}
    >
      <line className={styles.zero} x1={0} x2={box.width} y1={y(0)} y2={y(0)} />
      {points.map((point, index) => (
        <g key={point.periodEnd} data-latest={index === last ? 'true' : undefined} className={styles.year}>
          <rect className={styles.cash} x={x(index) - width - 1} y={y(point.cash)} width={width} height={Math.max(0, y(0) - y(point.cash))} />
          <rect className={styles.debt} x={x(index) + 1} y={y(0)} width={width} height={Math.max(0, y(-point.debt) - y(0))} />
        </g>
      ))}
      {points.map((point, index) =>
        index > 0 && Date.parse(point.periodEnd) - Date.parse(points[index - 1].periodEnd) <= 380 * 86400000 ? (
          <line key={`net-${point.periodEnd}`} className={styles.net} x1={x(index - 1)} y1={y(points[index - 1].netCash)} x2={x(index)} y2={y(point.netCash)} />
        ) : null,
      )}
      {points.map((point, index) => (
        <circle key={`dot-${point.periodEnd}`} className={styles.dot} cx={x(index)} cy={y(point.netCash)} r={index === last ? 4.5 : 3.5} />
      ))}
    </ChartPlot>
  )
}

/**
 * Cash above the zero line, debt below it, and net cash (cash minus debt) as a
 * line through the years. The key names each mark and gives the latest year's
 * three amounts, so no number has to be read off the drawing.
 */
export default function CashDebtChart({ points }: { points: CashDebtPoint[] }) {
  const latest = points.at(-1)!
  const money = (value: number) => formatChartMoney(value, latest.currency)
  return (
    <ChartFrame ariaLabel="Annual cash, debt and net cash" className={styles.frame}>
      <figcaption className="sr-only">
        {points.map((point) => `${point.year}: cash ${formatChartMoney(point.cash, point.currency)}, debt ${formatChartMoney(point.debt, point.currency)}, net cash ${formatChartMoney(point.netCash, point.currency)}`).join('; ')}
      </figcaption>
      <div className={styles.key} aria-hidden="true" data-cash-debt-key="">
        <MetaChip>{`FY${latest.year}`}</MetaChip>
        <dl className={styles.keyList}>
          <div data-key="cash">
            <dt><span className={styles.swatch} data-mark="cash" />Cash</dt>
            <dd>{money(latest.cash)}</dd>
          </div>
          <div data-key="debt">
            <dt><span className={styles.swatch} data-mark="debt" />Debt</dt>
            <dd>{money(latest.debt)}</dd>
          </div>
          <div data-key="net">
            <dt><span className={styles.swatch} data-mark="net" />Net cash</dt>
            <dd data-tone={latest.netCash < 0 ? 'down' : undefined}>{money(latest.netCash)}</dd>
          </div>
        </dl>
      </div>
      <Plot points={points} box={{ width: 600, height: 260 }} variant="wide" />
      <Plot points={points} box={{ width: 320, height: 230 }} variant="compact" />
    </ChartFrame>
  )
}
