const SUFFIX_CURRENCY: Array<[string, string]> = [
  ['.DE', 'EUR'],
  ['.AS', 'EUR'],
  ['.PA', 'EUR'],
  ['.LS', 'EUR'],
  ['.L', 'GBp'],
  ['.CO', 'DKK'],
  ['.AX', 'AUD'],
  ['.HK', 'HKD'],
  ['.SS', 'CNY'],
  ['.SZ', 'CNY'],
  ['.NS', 'INR'],
  ['.BO', 'INR'],
  ['.T', 'JPY'],
]

const PREFIX_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  HKD: 'HK$',
  CNY: 'CN¥',
  INR: '₹',
  JPY: '¥',
}

const KR_SUFFIX_CURRENCIES = new Set(['DKK', 'SEK', 'NOK'])

/** Moeda a partir do sufixo do ticker; sem sufixo = USD. */
export function currencyForTicker(ticker: string | null | undefined): string {
  const t = String(ticker ?? '').trim().toUpperCase()
  for (const [suffix, currency] of SUFFIX_CURRENCY) {
    if (t.endsWith(suffix)) return currency
  }
  return 'USD'
}

function normalizeMoneyValue(
  value: number,
  currency: string | null | undefined
): { value: number; currency: string } {
  const rawCurrency = String(currency ?? 'USD').trim()
  if (rawCurrency === 'GBp' || rawCurrency.toUpperCase() === 'GBX') {
    return { value: value / 100, currency: 'GBP' }
  }
  return { value, currency: rawCurrency.toUpperCase() || 'USD' }
}

/** Formata um valor monetário na moeda dada (trata GBp->£ ÷100). */
export function formatMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'

  const normalized = normalizeMoneyValue(value, currency)
  const code = normalized.currency

  if (KR_SUFFIX_CURRENCIES.has(code)) return `${normalized.value.toFixed(2)} kr`
  if (code === 'JPY') return `¥${Math.round(normalized.value).toLocaleString('en-US')}`

  const symbol = PREFIX_SYMBOL[code]
  return symbol ? `${symbol}${normalized.value.toFixed(2)}` : `${normalized.value.toFixed(2)} ${code}`
}

/** Variação assinada na moeda dada (ex. "+€1.20" / "-£0.40"). */
export function formatSignedMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatMoney(Math.abs(value), currency)}`
}

export function formatCompactMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'

  const normalized = normalizeMoneyValue(value, currency)
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(normalized.value)

  if (KR_SUFFIX_CURRENCIES.has(normalized.currency)) return `${formatted} kr`

  const symbol = PREFIX_SYMBOL[normalized.currency]
  return symbol ? `${symbol}${formatted}` : `${formatted} ${normalized.currency}`
}

/**
 * A short amount for writing on a chart: three significant figures, compact,
 * with the minus sign ahead of the currency (−$3.2B, $394B, $0.24).
 */
export function formatChartMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const normalized = normalizeMoneyValue(Math.abs(value), currency)
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumSignificantDigits: 3,
  }).format(normalized.value)
  const sign = value < 0 ? '−' : ''
  if (KR_SUFFIX_CURRENCIES.has(normalized.currency)) return `${sign}${formatted} kr`
  const symbol = PREFIX_SYMBOL[normalized.currency]
  return symbol ? `${sign}${symbol}${formatted}` : `${sign}${formatted} ${normalized.currency}`
}
