import type { MetadataRoute } from 'next'

/** Public, canonical pages with useful anonymous content. Redirects are excluded. */
export const INDEXABLE_PAGES = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/markets', changeFrequency: 'daily', priority: 0.8 },
  { path: '/picks/weekly', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/picks/long-term', changeFrequency: 'daily', priority: 0.7 },
  { path: '/picks/income', changeFrequency: 'daily', priority: 0.7 },
  { path: '/picks/short-term', changeFrequency: 'daily', priority: 0.7 },
  { path: '/product', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
] as const

// These are robots product tokens, not a manually maintained Firewall ruleset.
// In particular Google-Extended has no separate HTTP User-Agent.
export const AI_ROBOTS = [
  'meta-externalagent', 'meta-externalfetcher', 'meta-webindexer',
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'CCBot', 'Bytespider', 'PerplexityBot', 'Perplexity-User',
  'Amazonbot', 'Applebot-Extended', 'Google-Extended', 'cohere-ai', 'Diffbot',
] as const

export function crawlRules(): MetadataRoute.Robots['rules'] {
  return [
    {
      userAgent: '*',
      // An allowlist keeps APIs, account pages and future research routes closed.
      allow: [
        ...INDEXABLE_PAGES.map(({ path }) => `${path}$`),
        '/stocks/', '/_next/', '/marketing/', '/favicon.ico$',
        '/robots.txt$', '/sitemap.xml$', '/.well-known/security.txt$',
      ],
      // Only the ticker overview; no subpages, filters or dated URL spaces.
      disallow: ['/', '/stocks/*/', '/stocks/*?'],
    },
    { userAgent: [...AI_ROBOTS], disallow: '/' },
  ]
}

export function publicSitemap(baseUrl: string, tickers: string[]): MetadataRoute.Sitemap {
  const symbols = [...new Set(tickers.map(ticker => ticker.trim().toUpperCase()))]
    .filter(ticker => /^[A-Z0-9][A-Z0-9.^=-]{0,31}$/.test(ticker))
    .sort()
  return [
    ...INDEXABLE_PAGES.map(({ path, ...metadata }) => ({ url: `${baseUrl}${path === '/' ? '/' : path}`, ...metadata })),
    ...symbols.map(ticker => ({
      url: `${baseUrl}/stocks/${encodeURIComponent(ticker)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
