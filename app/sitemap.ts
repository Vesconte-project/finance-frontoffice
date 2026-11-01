import type { MetadataRoute } from 'next'
import { fetchBackendJson } from '@/lib/backend'
import { siteBaseUrl } from '@/lib/site-url'
import { publicSitemap } from '@/lib/crawl-policy'

export const revalidate = 3600

async function readTickers(): Promise<string[]> {
  try {
    const payload = await fetchBackendJson<{ items?: unknown[] }>('/v1/tickers/index', {
      context: 'backend.sitemap.ticker_index', timeoutMs: 4000,
    })
    return (payload.items ?? []).flatMap(row => {
      if (!row || typeof row !== 'object') return []
      const item = row as Record<string, unknown>
      const ticker = [item.ticker, item.symbol, item.asset_ticker].find(
        value => typeof value === 'string' && value.trim().length > 0,
      )
      return typeof ticker === 'string' ? [ticker] : []
    })
  } catch { return [] }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return publicSitemap(siteBaseUrl(), await readTickers())
}
