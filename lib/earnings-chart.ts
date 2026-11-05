/**
 * Reported against estimate, per quarter, for one measure (EPS or revenue):
 * the estimate as a hollow mark, what was reported as a filled one, joined by a
 * line. Only reported values are placed; the difference is not computed here
 * (the backend sends the surprise when its source has it).
 */
export type EarningsObservation = {
  earningsDate: string
  fiscalPeriod: string | null
  epsActual: number | null
  epsEstimate: number | null
  epsSurprisePct: number | null
  revenueActual: number | null
  revenueEstimate: number | null
  revenueSurprisePct: number | null
}

export type EarningsMeasure = 'eps' | 'revenue'

export type EarningsQuarter = {
  key: string
  label: string
  date: string
  x: number
  actual: number | null
  estimate: number | null
  actualY: number | null
  estimateY: number | null
  /** Above or below the estimate, when both were reported; never a computed amount. */
  direction: 'above' | 'below' | 'level' | null
  surprisePct: number | null
}

export type EarningsChart = {
  width: number
  height: number
  quarters: EarningsQuarter[]
  low: number
  high: number
  /** Gridlines with the value each marks. */
  grid: Array<{ y: number; value: number }>
  /** y of zero when the range crosses it, for a baseline. */
  zeroY: number | null
}

const pick = (row: EarningsObservation, measure: EarningsMeasure) => measure === 'eps'
  ? { actual: row.epsActual, estimate: row.epsEstimate, surprise: row.epsSurprisePct }
  : { actual: row.revenueActual, estimate: row.revenueEstimate, surprise: row.revenueSurprisePct }

/** Whether any quarter reports this measure at all (actual or estimate). */
export function hasMeasure(rows: readonly EarningsObservation[], measure: EarningsMeasure): boolean {
  return rows.some((row) => {
    const { actual, estimate } = pick(row, measure)
    return actual !== null || estimate !== null
  })
}

/** Which table columns carry at least one reported value; empty columns are left out. */
export function reportedColumns(rows: readonly EarningsObservation[]) {
  const any = (read: (row: EarningsObservation) => number | null) => rows.some((row) => read(row) !== null)
  return {
    epsActual: any((row) => row.epsActual),
    epsEstimate: any((row) => row.epsEstimate),
    epsSurprise: any((row) => row.epsSurprisePct),
    revenueActual: any((row) => row.revenueActual),
    revenueEstimate: any((row) => row.revenueEstimate),
    revenueSurprise: any((row) => row.revenueSurprisePct),
  }
}

function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target)
  const power = 10 ** Math.floor(Math.log10(raw || 1))
  const scaled = raw / power
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10) * power
}

export function earningsChart(
  rows: readonly EarningsObservation[],
  measure: EarningsMeasure,
  box: { width: number; height: number },
  limit = 12,
): EarningsChart {
  const quarters = [...rows]
    .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate))
    .slice(-limit)
  const values = quarters.flatMap((row) => {
    const { actual, estimate } = pick(row, measure)
    return [actual, estimate].filter((value): value is number => value !== null)
  })
  const top = 26
  const bottom = box.height - 30
  const rawLow = values.length ? Math.min(...values) : 0
  const rawHigh = values.length ? Math.max(...values) : 1
  const step = niceStep(rawHigh - rawLow || Math.abs(rawHigh) || 1, 4)
  const low = Math.floor((rawLow - step * 0.25) / step) * step
  const high = Math.ceil((rawHigh + step * 0.25) / step) * step
  const yOf = (value: number) => bottom - ((value - low) / (high - low || 1)) * (bottom - top)
  const slot = box.width / Math.max(1, quarters.length)
  const round = (value: number) => Math.round(value * 10) / 10
  const grid: EarningsChart['grid'] = []
  for (let value = low; value <= high + step / 2; value += step) grid.push({ y: round(yOf(value)), value: Number(value.toFixed(6)) })
  return {
    width: box.width,
    height: box.height,
    low,
    high,
    grid,
    zeroY: low < 0 && high > 0 ? round(yOf(0)) : null,
    quarters: quarters.map((row, index) => {
      const { actual, estimate, surprise } = pick(row, measure)
      return {
        key: `${row.earningsDate}-${row.fiscalPeriod ?? ''}`,
        label: row.fiscalPeriod ?? row.earningsDate.slice(0, 7),
        date: row.earningsDate,
        x: round(slot * (index + 0.5)),
        actual,
        estimate,
        actualY: actual === null ? null : round(yOf(actual)),
        estimateY: estimate === null ? null : round(yOf(estimate)),
        direction: actual === null || estimate === null ? null : actual > estimate ? 'above' : actual < estimate ? 'below' : 'level',
        surprisePct: surprise,
      }
    }),
  }
}
