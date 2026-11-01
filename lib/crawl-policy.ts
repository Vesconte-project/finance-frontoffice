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

// Phase 2 proposal; edge admission is a separate Vercel-owner decision.
export const AI_SEARCH_ROBOTS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'] as const
export const AI_SEARCH_INSTITUTIONAL_PATHS = ['/', '/product', '/pricing', '/faq', '/about'] as const

// Product tokens, not authenticated identities or a Firewall ruleset.
// Includes on-demand agents and unapproved search, not only training.
// Google-Extended and Applebot-Extended are usage-control tokens.
// Sources and unconfirmed legacy tokens: docs/eng196-crawlers.md.
export const BLOCKED_AI_ROBOTS = [
  'meta-externalagent', 'meta-externalfetcher', 'meta-webindexer', 'meta-externalads',
  'GPTBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User',
  'anthropic-ai', // Legacy, unconfirmed current token; does not count as protection.
  'CCBot', 'Bytespider', 'Perplexity-User',
  'Amazonbot', 'Amzn-SearchBot', 'Amzn-User',
  'Applebot-Extended', 'Google-Extended', 'Google-Agent', 'Google-GeminiNotebook',
  'cohere-ai', // Legacy, unconfirmed current token; does not count as protection.
  'Diffbot', 'Diffbot-User',
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
    {
      userAgent: [...AI_SEARCH_ROBOTS],
      // Specific groups replace *, so repeat all relevant exclusions here.
      allow: [
        ...AI_SEARCH_INSTITUTIONAL_PATHS.map(path => `${path}$`),
        '/stocks/', '/_next/', '/marketing/', '/favicon.ico$',
        '/robots.txt$', '/sitemap.xml$', '/.well-known/security.txt$',
      ],
      disallow: ['/', '/stocks/*/', '/stocks/*?'],
    },
    { userAgent: [...BLOCKED_AI_ROBOTS], disallow: '/' },
  ]
}

export function publicSitemap(baseUrl: string, tickers: string[]): MetadataRoute.Sitemap {
  const symbols = [...new Set(tickers.map(ticker => ticker.trim().toUpperCase()))]
    .filter(ticker => /^(?=.*[A-Z0-9])[A-Z0-9.^=-]{1,32}$/.test(ticker))
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
