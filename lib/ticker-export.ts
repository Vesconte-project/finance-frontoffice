/** Bounded packaging of canonical data. No financial calculations or provider calls. */
export const EXPORT_MAX_ROWS = 500
export const EXPORT_MAX_JSON_BYTES = 2 * 1024 * 1024
const EXPORT_MAX_CSV_BYTES = 4 * 1024 * 1024
const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
const statements = ['income_statement', 'balance_sheet', 'cash_flow'] as const
const periods = ['annual', 'quarterly'] as const
export type ExportOptions = { dataset: 'prices' } | {
  dataset: 'fundamentals'; statement: typeof statements[number]; period: typeof periods[number]
}
export class TickerExportError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
function invalid(): never { throw new TickerExportError(502, 'The data could not be verified. Try again later.') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim()) return invalid(); return value }
function number(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid()
  return value
}
function optionalText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return invalid()
  return value
}
function day(value: unknown): string {
  const s = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) return invalid()
  return s
}
export function parseExportOptions(params: URLSearchParams): ExportOptions {
  const allowed = new Set(['dataset', 'statement', 'period'])
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new TickerExportError(400, 'Choose a valid dataset and period.')
  }
  const dataset = params.get('dataset')
  if (dataset === 'prices' && !params.has('statement') && !params.has('period')) return { dataset }
  const statement = params.get('statement'), period = params.get('period')
  if (dataset === 'fundamentals' && statements.includes(statement as typeof statements[number]) && periods.includes(period as typeof periods[number]))
    return { dataset, statement: statement as typeof statements[number], period: period as typeof periods[number] }
  throw new TickerExportError(400, 'Choose a valid dataset and period.')
}
/** Quote every cell; neutralize spreadsheet formula text, not numeric negatives. */
export function csvCell(value: string | number | null): string {
  let s = value == null ? '' : String(value)
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/u.test(s)) s = `'${s}`
  return `"${s.replaceAll('"', '""')}"`
}
function csv(rows: (string | number | null)[][]): string {
  const body = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  if (new TextEncoder().encode(body).length > EXPORT_MAX_CSV_BYTES) throw new TickerExportError(422, 'This export is too large. No file was downloaded.')
  return body
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    await response.body?.cancel()
    return invalid()
  }
  if (Number(response.headers.get('content-length')) > EXPORT_MAX_JSON_BYTES) {
    await response.body?.cancel()
    throw new TickerExportError(422, 'This export is too large. No file was downloaded.')
  }
  const reader = response.body?.getReader()
  if (!reader) return invalid()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, body = ''
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > EXPORT_MAX_JSON_BYTES) throw new TickerExportError(422, 'This export is too large. No file was downloaded.')
      body += decoder.decode(part.value, { stream: true })
    }
    body += decoder.decode()
    return JSON.parse(body)
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
function prices(payload: unknown, ticker: string, start: string, end: string): (string | number | null)[][] {
  if (!Array.isArray(payload) || payload.length > EXPORT_MAX_ROWS) return invalid()
  const seen = new Set<string>()
  return [['symbol', 'date', 'open', 'high', 'low', 'close', 'volume', 'price_basis'], ...payload.map(value => {
    const r = record(value), date = day(r.date)
    if (r.price_basis !== 'adjusted' || date < start || date > end || seen.has(date) || number(r.close) === null) return invalid()
    seen.add(date)
    return [ticker, date, number(r.open), number(r.high), number(r.low), number(r.close), number(r.volume), 'adjusted']
  })]
}
function financials(payload: unknown, ticker: string, options: Extract<ExportOptions, { dataset: 'fundamentals' }>): (string | number | null)[][] {
  const p = record(payload)
  if (p.symbol !== ticker || typeof p.available !== 'boolean') return invalid()
  if (!p.available) throw new TickerExportError(503, 'Financial statements are temporarily unavailable. Try again later.')
  if (p.truncated === true) throw new TickerExportError(422, 'More than 500 rows are available. This export cannot include them all, so no file was downloaded.')
  if (p.truncated !== false || p.latestOnly !== true || !Array.isArray(p.rows) || p.count !== p.rows.length || p.rows.length > EXPORT_MAX_ROWS) return invalid()
  const seen = new Set<string>()
  return [[ 'symbol', 'statement_type', 'period_type', 'period_end', 'fiscal_year', 'fiscal_quarter', 'line_item_id', 'display_label', 'value', 'currency', 'known_at', 'source', 'source_updated_at', 'ingested_at', 'methodology_version', 'data_quality_flags' ], ...p.rows.map(value => {
    const r = record(value)
    if (r.symbol !== ticker || r.statementType !== options.statement || r.periodType !== options.period) return invalid()
    const date = day(r.periodEnd), id = text(r.lineItemId), key = `${date}:${id}`
    if (seen.has(key)) return invalid()
    seen.add(key)
    const fiscalYear = number(r.fiscalYear)
    if (fiscalYear !== null && !Number.isInteger(fiscalYear)) return invalid()
    return [ticker, options.statement, options.period, date, fiscalYear, optionalText(r.fiscalQuarter), id,
      text(r.displayLabel), number(r.value), optionalText(r.currency), text(r.knownAt), optionalText(r.source),
      optionalText(r.sourceUpdatedAt), optionalText(r.ingestedAt), text(r.methodologyVersion),
      r.dataQualityFlags == null ? null : JSON.stringify(r.dataQualityFlags)]
  })]
}
type Dependencies = {
  access: () => Promise<{ isSignedIn: boolean; isPro: boolean }>
  read: (path: string, signal: AbortSignal) => Promise<Response>
  now?: () => Date
}
export async function exportTicker(request: Request, rawTicker: string, deps: Dependencies): Promise<Response> {
  try {
    const ticker = rawTicker.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) throw new TickerExportError(400, 'A valid ticker is required.')
    const options = parseExportOptions(new URL(request.url).searchParams)
    const viewer = await deps.access()
    if (!viewer.isSignedIn) throw new TickerExportError(401, 'Sign in to export data.')
    if (!viewer.isPro) return Response.json({ error: 'CSV exports are available with Pro.', upgradeUrl: '/pricing' }, { status: 403, headers: PRIVATE })
    const now = deps.now?.() ?? new Date(), end = now.toISOString().slice(0, 10)
    const start = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10)
    const query = options.dataset === 'prices'
      ? new URLSearchParams({ period_days: '365', startDate: start, endDate: end })
      : new URLSearchParams({ statementType: options.statement, periodType: options.period, latestOnly: 'true', limit: String(EXPORT_MAX_ROWS), page: '0' })
    const path = `/v1/tickers/${encodeURIComponent(ticker)}/${options.dataset === 'prices' ? 'ohlc' : 'financial-statements'}?${query}`
    const upstream = await deps.read(path, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]))
    if (!upstream.ok) {
      await upstream.body?.cancel()
      const status = [401, 403, 404, 409, 422, 429, 503].includes(upstream.status) ? upstream.status : 502
      const messages: Record<number, string> = { 401: 'Sign in again to export data.', 403: 'Your account cannot export this data.', 404: 'No data is available for this export.', 409: 'Adjusted prices are unavailable for this export.', 422: 'The backend cannot provide this export.', 429: 'An account limit has been reached. Try again later.', 503: 'Data is temporarily unavailable. Try again later.' }
      const headers = new Headers(PRIVATE), retry = upstream.headers.get('retry-after')
      if (retry && /^(\d{1,6}|[A-Za-z]{3}, .{20,30} GMT)$/.test(retry)) headers.set('Retry-After', retry)
      return Response.json({ error: messages[status] ?? 'The export is temporarily unavailable. Try again later.' }, { status, headers })
    }
    if (options.dataset === 'prices' && (upstream.headers.get('x-market-resolution') !== 'daily' || upstream.headers.has('link'))) {
      await upstream.body?.cancel()
      throw new TickerExportError(422, 'A complete daily price export is unavailable. No file was downloaded.')
    }
    const payload = await boundedJson(upstream)
    const rows = options.dataset === 'prices' ? prices(payload, ticker, start, end) : financials(payload, ticker, options)
    if (rows.length === 1) throw new TickerExportError(404, 'No data is available for this export.')
    const suffix = options.dataset === 'prices' ? `adjusted-prices-daily_${start}_${end}` : `${options.statement}_${options.period}_latest_${end}`
    return new Response(csv(rows), { headers: { ...PRIVATE, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${ticker}_${suffix}.csv"` } })
  } catch (error) {
    const status = error instanceof TickerExportError ? error.status : 502
    return Response.json({ error: error instanceof TickerExportError ? error.message : 'The export is temporarily unavailable. Try again later.' }, { status, headers: PRIVATE })
  }
}
