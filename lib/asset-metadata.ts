import { exchangeDisplayName } from './exchange-names'

export type AssetMetadataKind = 'ETF' | 'Country fund' | 'Equity'

export type AssetMetadataParts = {
  kind: string
  exchange: string | null
  currency: string | null
}

/** The asset type, exchange and currency labels, for layouts that arrange them. */
export function assetMetadataParts(
  assetKind: AssetMetadataKind,
  exchangeCode: string | null,
  currencyCode: string
): AssetMetadataParts {
  return {
    kind: assetKind === 'Equity' ? 'Stock' : assetKind,
    exchange: exchangeDisplayName(exchangeCode),
    currency: currencyCode.trim().toUpperCase() || null,
  }
}

export function assetMetadata(
  assetKind: AssetMetadataKind,
  exchangeCode: string | null,
  currencyCode: string
): string {
  const { kind, exchange, currency } = assetMetadataParts(assetKind, exchangeCode, currencyCode)
  return [kind, exchange, currency]
    .filter((value): value is string => Boolean(value))
    .join(' · ')
}
