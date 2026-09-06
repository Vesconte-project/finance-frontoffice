import { exchangeDisplayName } from '@/lib/exchange-names'

export type AssetMetadataKind = 'ETF' | 'Equity'

export function assetMetadata(
  assetKind: AssetMetadataKind,
  exchangeCode: string | null,
  currencyCode: string
): string {
  const exchange = exchangeDisplayName(exchangeCode)
  const currency = currencyCode.trim().toUpperCase()

  return [assetKind === 'ETF' ? 'ETF' : 'Stock', exchange, currency]
    .filter((value): value is string => Boolean(value))
    .join(' · ')
}
