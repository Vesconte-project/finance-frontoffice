/** Internal bounded traversal; no calendar cut, no partial result labelled complete. */
export async function collectHistoryPages<T extends { available: boolean; rows: unknown[]; count: number; truncated?: boolean }>(load: (page: number) => Promise<T>): Promise<T> {
  const deadline = Date.now() + 30_000
  let first: T | null = null
  const rows: unknown[] = []
  const seen = new Set<string>()
  const priorRows = new Set<string>()
  for (let page = 0; page < 100; page++) {
    if (Date.now() > deadline) throw new Error('history_time_budget_exceeded')
    const next = await load(page)
    if (!Array.isArray(next.rows)) throw new Error('history_page_invalid')
    if (!first) first = next
    if (!next.available) {
      if (page === 0) return next
      throw new Error('history_page_unavailable')
    }
    if (next.rows.length === 0) return { ...first, rows, count: rows.length, ...(first.truncated === undefined ? {} : {truncated:false}) } as T
    const signature = JSON.stringify(next.rows)
    if (seen.has(signature)) throw new Error('history_page_did_not_advance')
    seen.add(signature)
    const keys=next.rows.map(row=>JSON.stringify(row))
    if(keys.some(key=>priorRows.has(key))) throw new Error('history_pages_overlap')
    keys.forEach(key=>priorRows.add(key))
    rows.push(...next.rows)
    if (next.truncated === false) return { ...first, rows, count: rows.length, ...(first.truncated === undefined ? {} : {truncated:false}) } as T
  }
  throw new Error('history_request_budget_exceeded')
}

/** JSON values compare independently of object property order, including currency metadata. */
function samePriceValues(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && samePriceValues(a[key], b[key]))
}

/** One ordering/duplicate contract for reported and converted history and OHLC.
 * Backward pagination is transport order, never chart order. Compare before
 * normalization/rounding so contradictory values cannot silently overwrite a day.
 */
export function orderedPriceRows<T>(rows: readonly T[]): T[] {
  const byDate = new Map<string, T>()
  for (const row of rows) {
    const date = row && typeof row === 'object' && !Array.isArray(row)
      ? (row as { date?: unknown }).date : null
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('price_history_date_invalid')
    }
    if (byDate.has(date) && !samePriceValues(byDate.get(date), row)) {
      throw new Error('price_history_conflicting_date')
    }
    byDate.set(date, row)
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, row]) => row)
}

export async function collectPricePages(load: (endDate: string | null) => Promise<{ rows: unknown[]; nextEnd: string | null }>): Promise<unknown[]> {
  const deadline = Date.now() + 30_000
  let end: string | null = null
  const all: unknown[] = []
  for (let page = 0; page < 100; page++) {
    if (Date.now() > deadline) throw new Error('history_time_budget_exceeded')
    const next = await load(end)
    if (!Array.isArray(next.rows)) throw new Error('price_history_page_invalid')
    all.push(...next.rows)
    if (next.rows.length === 0 || next.nextEnd === null) return orderedPriceRows(all)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.nextEnd) || (end !== null && next.nextEnd >= end)) throw new Error('price_history_did_not_advance')
    end = next.nextEnd
  }
  throw new Error('history_request_budget_exceeded')
}
