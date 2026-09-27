import { exchangeDisplayName } from './exchange-names'

export type AssetMetadataKind = 'ETF' | 'Country fund' | 'Equity'

export function assetMetadata(
  assetKind: AssetMetadataKind,
  exchangeCode: string | null,
  currencyCode: string
): string {
  const exchange = exchangeDisplayName(exchangeCode)
  const currency = currencyCode.trim().toUpperCase()

  return [assetKind === 'Equity' ? 'Stock' : assetKind, exchange, currency]
    .filter((value): value is string => Boolean(value))
    .join(' · ')
}
