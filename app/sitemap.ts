import type { MetadataRoute } from 'next'
import { fetchBackendJson } from '@/lib/backend'
import { siteBaseUrl } from '@/lib/site-url'

export const revalidate = 3600

type TickerSignal = {
  ticker: string
  signalDate: string | null
}

const SITEMAP_SOURCE_TIMEOUT_MS = 4000

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readTicker(row: Record<string, unknown>): string | null {
  const candidate =
    readString(row.ticker)?.toUpperCase() ??
    readString(row.symbol)?.toUpperCase() ??
    readString(row.asset_ticker)?.toUpperCase()
  return candidate ?? null
}

async function readTickerSignalsFromBackend(): Promise<TickerSignal[]> {
  try {
    const data = await fetchBackendJson<unknown>('/screener/signals?limit=500', {
      context: 'backend.sitemap.screener_signals',
      timeoutMs: SITEMAP_SOURCE_TIMEOUT_MS,
    })
    if (!Array.isArray(data) || data.length === 0) return []

    return data
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const typedRow = row as Record<string, unknown>
        const ticker = readTicker(typedRow)
        if (!ticker) return null
        return {
          ticker,
          signalDate:
            readString(typedRow.signalDate) ??
            readString(typedRow.signal_date) ??
            readString(typedRow.as_of_date),
        }
      })
      .filter((row): row is TickerSignal => row !== null)
  } catch {
    return []
  }
}

async function readTickerSignals(): Promise<TickerSignal[]> {
  return readTickerSignalsFromBackend()
}

function toDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return undefined
  return new Date(parsed)
}

function tickerEntries(baseUrl: string, row: TickerSignal): MetadataRoute.Sitemap {
  const ticker = encodeURIComponent(row.ticker)
  const lastModified = toDate(row.signalDate) ?? new Date()

  return [
    {
      url: `${baseUrl}/stocks/${ticker}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl()
  const now = new Date()
  const rows = await readTickerSignals()

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    // /screener is deliberately absent: Signals is locked while it is rebuilt, and
    // its page is noindex. It returns here when there is something to read.
    ...(['long-term', 'income', 'short-term'] as const).map((slug) => ({
      url: `${baseUrl}/picks/${slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    {
      url: `${baseUrl}/markets`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/community`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/product`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  const uniqueTickers = new Map<string, TickerSignal>()
  for (const row of rows) {
    uniqueTickers.set(row.ticker, row)
  }

  for (const row of uniqueTickers.values()) {
    entries.push(...tickerEntries(baseUrl, row))
  }

  return entries
}
