/**
 * The same company in several currencies, compared from one day: each line is
 * the change since that day, in percent. Every value is a close as reported or
 * the backend's conversion of it; the only arithmetic is the change from the
 * common first day. Lines compare the same days: a day missing from any series
 * (no rate that day) is left out of all of them.
 */
export type CompareSeries = { code: string; points: ReadonlyArray<{ date: string; value: number }> }
export type CompareLine = { code: string; changes: number[]; last: number }
export type CompareResult = { dates: string[]; lines: CompareLine[]; leftOut: number }

export function compareFrom(series: readonly CompareSeries[], start: string): CompareResult {
  if (!series.length) return { dates: [], lines: [], leftOut: 0 }
  const maps = series.map((item) => new Map(item.points.filter((point) => point.date >= start && point.value > 0).map((point) => [point.date, point.value])))
  const candidates = [...new Set(maps.flatMap((map) => [...map.keys()]))].sort()
  const dates = candidates.filter((date) => maps.every((map) => map.has(date)))
  if (dates.length < 2) return { dates: [], lines: [], leftOut: candidates.length - dates.length }
  const lines = series.map((item, index) => {
    const map = maps[index]
    const base = map.get(dates[0]) as number
    const changes = dates.map((date) => (map.get(date) as number) / base - 1)
    return { code: item.code, changes, last: changes[changes.length - 1] }
  })
  return { dates, lines, leftOut: candidates.length - dates.length }
}

/** Gridline steps for a percent axis: about four lines, on round values. */
export function percentTicks(low: number, high: number): number[] {
  const span = Math.max(high - low, 0.0001)
  const raw = span / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((multiple) => multiple * power).find((value) => value >= raw) ?? raw
  const ticks: number[] = []
  for (let value = Math.ceil(low / step) * step; value <= high + 1e-12; value += step) ticks.push(Number(value.toFixed(10)))
  return ticks
}
