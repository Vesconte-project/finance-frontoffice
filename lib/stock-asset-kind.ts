import type { LatestFundamentalsRow } from './ticker-data'

export type StockAssetKind = 'equity' | 'fund'

/** What the page calls the instrument. */
export type StockAssetBadge = 'ETF' | 'Country fund' | 'Equity'

export type ResolvedStockAsset = {
  kind: StockAssetKind
  badge: StockAssetBadge
  /** Whether the answer came from the registry or from the name-and-list guess below. */
  source: 'registry' | 'guess'
}

const REGISTRY_BADGES: Record<string, ResolvedStockAsset> = {
  etf: { kind: 'fund', badge: 'ETF', source: 'registry' },
  index_proxy: { kind: 'fund', badge: 'ETF', source: 'registry' },
  country_fund: { kind: 'fund', badge: 'Country fund', source: 'registry' },
  equity: { kind: 'equity', badge: 'Equity', source: 'registry' },
  adr: { kind: 'equity', badge: 'Equity', source: 'registry' },
}

/**
 * The registry's instrument type decides (Spec "Instrument type as the single source
 * V1", §4.4). `index_proxy` (SPY, QQQ, …) is a benchmark fund and badges as ETF. The
 * guess in `stockAssetKind` is used only when the registry says `unknown` or is absent.
 */
export function resolveStockAsset({
  assetType,
  ticker,
  name,
  latestFundamentals,
}: {
  assetType: string | null | undefined
  ticker: string
  name: string
  latestFundamentals: LatestFundamentalsRow[]
}): ResolvedStockAsset {
  const fromRegistry = REGISTRY_BADGES[(assetType ?? '').trim().toLowerCase()]
  if (fromRegistry) return fromRegistry
  const kind = stockAssetKind({ ticker, name, latestFundamentals })
  return { kind, badge: kind === 'fund' ? 'ETF' : 'Equity', source: 'guess' }
}

const FUND_TICKERS = new Set(['SPY', 'QQQ', 'DIA', 'IWM', 'VOO', 'IVV', 'VTI', 'XLK', 'XLF', 'XLE'])

export function stockAssetKind({
  ticker,
  name,
  latestFundamentals,
}: {
  ticker: string
  name: string
  latestFundamentals: LatestFundamentalsRow[]
}): StockAssetKind {
  if (FUND_TICKERS.has(ticker)) return 'fund'
  if (/\b(etf|trust|fund|portfolio|index|spdr|ishares|vanguard|invesco|proshares|direxion|ark)\b/i.test(name)) {
    return 'fund'
  }
  return latestFundamentals.some((row) =>
    /(expense ratio|number of holdings|top holdings|inception date|turnover rate|fund family|fund category|portfolio p\/?e)/i.test(
      `${row.metricLabel} ${row.metric}`,
    ),
  )
    ? 'fund'
    : 'equity'
}
