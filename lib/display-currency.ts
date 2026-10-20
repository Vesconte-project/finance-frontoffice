/**
 * Display currency for the ticker pages: the reader can see every amount in
 * another currency, converted by the backend (`?currency=XXX` on the ticker
 * reads). Nothing here converts: the browser and this site never apply a rate.
 * The backend adds a `money` block next to each amount it can annotate:
 *
 *   {"close": 75000, "money": {"close": {"value": 75000, "currency": "KRW",
 *     "sourceCurrency": "KRW", "date": "2026-10-13",
 *     "converted": {"value": 54.12, "currency": "USD", "rate": 0.0007216, "rateDate": "2026-10-12"},
 *     "unconvertedReason": null}}}
 *
 * This module parses those blocks defensively, puts the converted value in the
 * field's place for the page to draw (or null when there is none, so a chart
 * never mixes currencies), and keeps the original beside it.
 *
 * The preference lives in the URL (`?currency=`) and in the browser
 * (localStorage) for now; it moves to the account once the platform migration
 * is approved.
 */

export const DISPLAY_CURRENCY_PARAM = 'currency'
export const DISPLAY_CURRENCY_STORAGE_KEY = 'vesconte:display-currency'

/** Reasons the backend gives for an amount it could not convert. */
export const BACKEND_UNCONVERTED_REASONS = ['currency_unknown', 'value_date_unknown', 'no_rate', 'fx_rates_unavailable'] as const
export type BackendUnconvertedReason = (typeof BACKEND_UNCONVERTED_REASONS)[number]
/**
 * `not_offered`: the page shows an amount the backend does not annotate (for
 * example net cash), so it stays in its own currency.
 */
export type UnconvertedReason = BackendUnconvertedReason | 'not_offered'

export type MoneyConversion = {
  value: number
  currency: string
  rate: number | null
  rateDate: string | null
}

export type MoneyEntry = {
  /** The original amount in its ISO currency (a provider minor unit is already scaled into its parent). */
  value: number | null
  currency: string | null
  /** The stored label, case preserved (GBp). */
  sourceCurrency: string | null
  date: string | null
  converted: MoneyConversion | null
  unconvertedReason: BackendUnconvertedReason | null
}

export type MoneyBlock = Record<string, MoneyEntry>

export type MoneyOriginal = {
  value: number
  currency: string
  /** The label the amount was stored with (GBp for pence), for the reader. */
  label: string
}

export type DisplayCurrencyReport = {
  target: string
  converted: number
  unconverted: Partial<Record<BackendUnconvertedReason, number>>
  /** The backend refused the currency; the page fell back to original amounts. */
  unsupported: boolean
}

export type CurrencyOption = {
  code: string
  latestRateDate: string | null
  status: string | null
}

export type CurrenciesPayload = {
  available: boolean
  reason: string | null
  pivot: string
  maxStalenessBusinessDays: number | null
  currencies: CurrencyOption[]
}

const CODE = /^[A-Z]{3}$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** A three-letter upper-case ISO code, or null. Lower case is not accepted: the backend matches exactly. */
export function displayCurrencyCode(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && CODE.test(candidate.trim()) ? candidate.trim() : null
}

/** The ISO parent of a listing label, for comparing with a display currency (GBp → GBP). */
export function isoCurrency(label: string | null | undefined): string | null {
  const raw = text(label)
  if (!raw) return null
  if (raw === 'GBp' || raw.toUpperCase() === 'GBX') return 'GBP'
  if (raw === 'ZAc' || raw.toUpperCase() === 'ZAC') return 'ZAR'
  if (raw.toUpperCase() === 'ILA') return 'ILS'
  const upper = raw.toUpperCase()
  return CODE.test(upper) ? upper : null
}

function parseReason(value: unknown): BackendUnconvertedReason | null {
  return (BACKEND_UNCONVERTED_REASONS as readonly string[]).includes(value as string) ? value as BackendUnconvertedReason : null
}

export function parseMoneyEntry(raw: unknown): MoneyEntry | null {
  const record = asRecord(raw)
  if (!record) return null
  const convertedRecord = asRecord(record.converted)
  const convertedValue = finite(convertedRecord?.value)
  const convertedCurrency = displayCurrencyCode(convertedRecord?.currency)
  const converted = convertedRecord && convertedValue !== null && convertedCurrency
    ? {
        value: convertedValue,
        currency: convertedCurrency,
        rate: finite(convertedRecord.rate),
        rateDate: text(convertedRecord.rateDate),
      }
    : null
  return {
    value: finite(record.value),
    currency: text(record.currency),
    sourceCurrency: text(record.sourceCurrency),
    date: text(record.date),
    converted,
    // A malformed conversion is reported as having no rate, never shown as converted.
    unconvertedReason: converted ? null : parseReason(record.unconvertedReason) ?? 'no_rate',
  }
}

export function parseMoneyBlock(raw: unknown): MoneyBlock | null {
  const record = asRecord(raw)
  if (!record) return null
  const block: MoneyBlock = {}
  for (const [field, value] of Object.entries(record)) {
    const entry = parseMoneyEntry(value)
    if (entry) block[field] = entry
  }
  return Object.keys(block).length ? block : null
}

export function moneyEntryOf(holder: unknown, field: string): MoneyEntry | null {
  const block = parseMoneyBlock(asRecord(holder)?.money)
  return block?.[field] ?? null
}

export function emptyReport(target: string): DisplayCurrencyReport {
  return { target, converted: 0, unconverted: {}, unsupported: false }
}

export function mergeReports(target: string, reports: ReadonlyArray<DisplayCurrencyReport | null | undefined>): DisplayCurrencyReport {
  const merged = emptyReport(target)
  for (const report of reports) {
    if (!report || report.target !== target) continue
    merged.converted += report.converted
    merged.unsupported ||= report.unsupported
    for (const [reason, count] of Object.entries(report.unconverted) as Array<[BackendUnconvertedReason, number]>) {
      merged.unconverted[reason] = (merged.unconverted[reason] ?? 0) + count
    }
  }
  return merged
}

export function unconvertedCount(report: DisplayCurrencyReport | null | undefined): number {
  return report ? Object.values(report.unconverted).reduce((sum, count) => sum + (count ?? 0), 0) : 0
}

/**
 * The payload as the page draws it in `target`: every annotated amount is
 * replaced by its converted value, or by null when the backend could not
 * convert it, and the holder's `currency` reads `target`. The `money` blocks
 * stay, parsed, so the original can be shown beside the converted value. The
 * input is not changed.
 */
export function applyDisplayCurrency<T>(payload: T, target: string): { payload: T; report: DisplayCurrencyReport } {
  const report = emptyReport(target)
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    const record = asRecord(node)
    if (!record) return node
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(record)) out[key] = key === 'money' ? value : walk(value)
    const block = parseMoneyBlock(record.money)
    if (!block) return out
    out.money = block
    for (const [field, entry] of Object.entries(block)) {
      if (entry.converted && entry.converted.currency === target) {
        out[field] = entry.converted.value
        report.converted += 1
      } else {
        out[field] = null
        // A conversion into another currency than the one asked for is not used.
        if (!entry.unconvertedReason && entry.converted) entry.unconvertedReason = 'no_rate'
        if (entry.value !== null) {
          const reason = entry.unconvertedReason ?? 'no_rate'
          report.unconverted[reason] = (report.unconverted[reason] ?? 0) + 1
        }
      }
    }
    if ('currency' in out) out.currency = target
    return out
  }
  return { payload: walk(payload) as T, report }
}

/** One amount as the page shows it. */
export type Amount = {
  /** The amount to show, in `currency`; null when there is none to show. */
  value: number | null
  currency: string
  /** The original, when it differs from what is shown (converted) or stands in for it (unconverted). */
  original: MoneyOriginal | null
  unconverted: UnconvertedReason | null
  rateDate: string | null
}

export type DisplayContext = {
  /** The display currency the reader chose; null shows amounts as reported. */
  display: string | null
  /** The currency the amounts are reported in, used when no `money` entry says otherwise. */
  original: string
}

/**
 * The amount at `holder[field]` after `applyDisplayCurrency`. Without a display
 * currency it is the reported value. With one, it is the backend's converted
 * value and the original; when there is no conversion, the original with the
 * reason. An amount the backend does not annotate stays in its own currency.
 */
export function amountOf(holder: unknown, field: string, context: DisplayContext): Amount {
  const record = asRecord(holder)
  const raw = finite(record?.[field])
  if (!context.display) return { value: raw, currency: context.original, original: null, unconverted: null, rateDate: null }
  const entry = moneyEntryOf(record, field)
  if (!entry) {
    return {
      value: null,
      currency: context.display,
      original: raw === null ? null : { value: raw, currency: context.original, label: context.original },
      unconverted: raw === null ? null : 'not_offered',
      rateDate: null,
    }
  }
  const original = entry.value === null
    ? null
    : {
        value: entry.value,
        currency: entry.currency ?? context.original,
        label: entry.sourceCurrency ?? entry.currency ?? context.original,
      }
  if (entry.converted && entry.converted.currency === context.display) {
    return { value: entry.converted.value, currency: context.display, original, unconverted: null, rateDate: entry.converted.rateDate }
  }
  return {
    value: null,
    currency: context.display,
    original,
    unconverted: original ? entry.unconvertedReason ?? 'no_rate' : null,
    rateDate: null,
  }
}

/** The original of an annotated amount, for derived points (a statement year, a dividend). */
export function originalOf(holder: unknown, field: string): MoneyOriginal | null {
  const entry = moneyEntryOf(holder, field)
  if (!entry || entry.value === null || !entry.currency) return null
  return { value: entry.value, currency: entry.currency, label: entry.sourceCurrency ?? entry.currency }
}

/** Why an amount is not shown in `target`, in the reader's words. */
export function unconvertedReasonText(reason: UnconvertedReason, target: string): string {
  switch (reason) {
    case 'currency_unknown':
      return `The currency of this amount is not recorded, so it cannot be shown in ${target}.`
    case 'value_date_unknown':
      return `The date of this amount is not recorded, so no ${target} rate can be chosen for it.`
    case 'no_rate':
      return `No ${target} exchange rate was published within 10 business days of this amount's date.`
    case 'fx_rates_unavailable':
      return `Exchange rates are unavailable right now, so this amount is shown as reported.`
    case 'not_offered':
      return `This figure is not offered in other currencies yet, so it is shown as reported.`
  }
}

export type AmountView = {
  /** The figure to show first. */
  text: string
  /** The original beside a converted figure. */
  original: string | null
  /** A short marker for an amount shown as reported because it could not be converted. */
  marker: string | null
  /** The longer explanation: the rate date, or why there is none. */
  detail: string | null
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function formatDay(value: string): string {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(parsed) ? dayFormat.format(parsed) : value
}

/** What to write for an amount, with `format` choosing the style (full, compact, signed). */
export function amountView(
  amount: Amount,
  format: (value: number, currency: string) => string,
): AmountView | null {
  if (amount.unconverted && amount.original) {
    return {
      text: format(amount.original.value, amount.original.currency),
      original: null,
      marker: `not in ${amount.currency}`,
      detail: unconvertedReasonText(amount.unconverted, amount.currency),
    }
  }
  if (amount.value === null) return null
  const text = format(amount.value, amount.currency)
  if (!amount.original || isoCurrency(amount.original.currency) === amount.currency) {
    return { text, original: null, marker: null, detail: null }
  }
  const original = format(amount.original.value, amount.original.currency)
  const label = amount.original.label !== amount.original.currency ? ` (quoted in ${amount.original.label})` : ''
  return {
    text,
    original,
    marker: null,
    detail: `${original}${label} converted to ${amount.currency}${amount.rateDate ? ` at the rate of ${formatDay(amount.rateDate)}` : ''}.`,
  }
}

/** The page-level sentence for a display currency, or null when amounts show as reported. */
export function displayCurrencySummary(report: DisplayCurrencyReport | null | undefined): { lead: string; gaps: string | null } | null {
  if (!report) return null
  if (report.unsupported) {
    return { lead: `Amounts are shown as reported: ${report.target} is not available for this page right now.`, gaps: null }
  }
  const lead = `Amounts in ${report.target}, each converted at the exchange rate of its own date. The reported amount is shown beside the main figures.`
  const missing = unconvertedCount(report)
  if (!missing) return { lead, gaps: null }
  const reasons = (Object.entries(report.unconverted) as Array<[BackendUnconvertedReason, number]>).filter(([, count]) => count > 0)
  const head = `${missing} ${missing === 1 ? 'amount has' : 'amounts have'} no ${report.target} value`
  const tail = `${missing === 1 ? 'is' : 'are'} left out of charts or marked “not in ${report.target}”`
  if (reasons.length === 1) return { lead, gaps: `${head} (${GAP_LABEL[reasons[0][0]]}) and ${tail}.` }
  return { lead, gaps: `${head} and ${tail}: ${reasons.map(([reason, count]) => `${count} ${GAP_LABEL[reason]}`).join(', ')}.` }
}

const GAP_LABEL: Record<BackendUnconvertedReason, string> = {
  currency_unknown: 'no recorded currency',
  value_date_unknown: 'no recorded date',
  no_rate: 'no exchange rate within 10 business days of their date',
  fx_rates_unavailable: 'exchange rates unavailable',
}

export function parseCurrenciesPayload(raw: unknown): CurrenciesPayload | null {
  const record = asRecord(raw)
  if (!record || !Array.isArray(record.currencies)) return null
  const seen = new Set<string>()
  const currencies: CurrencyOption[] = []
  for (const item of record.currencies) {
    const option = asRecord(item)
    const code = displayCurrencyCode(option?.code)
    if (!option || !code || seen.has(code)) continue
    seen.add(code)
    currencies.push({ code, latestRateDate: text(option.latestRateDate), status: text(option.status) })
  }
  return {
    available: record.available === true,
    reason: text(record.reason),
    pivot: displayCurrencyCode(record.pivot) ?? 'USD',
    maxStalenessBusinessDays: finite(record.maxStalenessBusinessDays),
    currencies,
  }
}

/** True when `code` is one the backend lists and conversion is available. */
export function isListedCurrency(payload: CurrenciesPayload | null, code: string | null): code is string {
  return Boolean(code && payload?.available && payload.currencies.some((option) => option.code === code))
}

/** `href` with the display currency carried over (or removed when null). */
export function withDisplayCurrency(href: string, currency: string | null): string {
  const [pathAndQuery, hash] = href.split('#', 2)
  const [path, query = ''] = pathAndQuery.split('?', 2)
  const params = new URLSearchParams(query)
  if (currency) params.set(DISPLAY_CURRENCY_PARAM, currency)
  else params.delete(DISPLAY_CURRENCY_PARAM)
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}

/** A path with `currency` added to its query, for a backend read. */
export function withCurrencyQuery(path: string, currency: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${DISPLAY_CURRENCY_PARAM}=${encodeURIComponent(currency)}`
}

/** An amount already chosen for display (a statement year, a dividend), with its reported original when converted. */
export function shownAmount(value: number | null, currency: string, original?: MoneyOriginal | null): Amount {
  return { value, currency, original: original ?? null, unconverted: null, rateDate: null }
}
