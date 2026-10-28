/** The chart contract is explicit: unknown/raw series never enter an adjusted chart. */
export const ADJUSTED_PRICE_LABEL = 'ajustado a splits e dividendos'
export const ADJUSTED_CHART_VERSION = 'adjusted-fx-v4'
export type AdjustedHistoryPoint = { date: string; close: number; price_basis: 'adjusted' }

export function normalizeAdjustedHistory(payload: unknown): AdjustedHistoryPoint[] {
  if (!Array.isArray(payload)) throw new Error('adjusted_history_unavailable')
  if (payload.some(row => !row || row.price_basis !== 'adjusted' || typeof row.date !== 'string'
    || typeof row.close !== 'number' || !Number.isFinite(row.close) || row.close <= 0)) {
    throw new Error('adjusted_price_input_invalid')
  }
  return payload.map(row => ({ date: row.date, close: row.close, price_basis: 'adjusted' }))
}

export type ChartOverlay = {
  key: string
  price_basis: 'adjusted'
  unit: 'price' | 'index_0_100'
  points: Array<{ price_basis: 'adjusted'; date: string; value: number | null; upper?: number | null; lower?: number | null }>
}
export type TechnicalChartPayload = {
  price_basis: 'adjusted'
  availability_status: 'ready' | 'stale'
  unavailable_reason: string | null
  series: ChartOverlay[]
}
export function readyAdjustedOverlays(payload: TechnicalChartPayload | null, bars: readonly { price_basis?: string }[]): ChartOverlay[] {
  if (!payload || payload.price_basis !== 'adjusted' || payload.availability_status !== 'ready'
    || payload.unavailable_reason || !bars.length || bars.some(bar => bar.price_basis !== 'adjusted')
    || !Array.isArray(payload.series) || payload.series.some(series => !series || series.price_basis !== 'adjusted'
      || typeof series.key !== 'string' || !['price', 'index_0_100'].includes(series.unit)
      || !Array.isArray(series.points) || series.points.some(point => !point || point.price_basis !== 'adjusted' || typeof point.date !== 'string'
        || [point.value, point.upper, point.lower].some(value => value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)))))) return []
  return payload.series
}
