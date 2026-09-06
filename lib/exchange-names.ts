/**
 * Display names for exchange codes. Presentation labelling only — this is not a
 * source of data semantics, and an unknown code is never guessed at.
 */
const EXCHANGE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  NASDAQ: 'Nasdaq',
  NMS: 'Nasdaq',
  NYQ: 'New York Stock Exchange',
  NYSEARCA: 'NYSE Arca',
}

export function exchangeDisplayName(code: string | null): string | null {
  if (code === null) return null
  return EXCHANGE_DISPLAY_NAMES[code.trim().toUpperCase()] ?? null
}
