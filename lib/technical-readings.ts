/** How far the last close sits from an average, as a percentage of the average. */
export function distanceFromAverage(close: number | null, average: number | null): number | null {
  if (close === null || average === null || !Number.isFinite(close) || !Number.isFinite(average) || average === 0) return null
  return ((close - average) / average) * 100
}
