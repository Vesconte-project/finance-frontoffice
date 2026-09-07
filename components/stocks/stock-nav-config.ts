export type StockTabKey = 'overview' | 'relationships' | 'research'
export type StockResearchNavKey =
  | 'overview'
  | 'fundamentals'
  | 'financials'
  | 'valuation'
  | 'signals'
  | 'events'
  | 'relationships'
  | 'profile'
  | 'ownership'
  | 'ai-research'
  | 'methodology'

export type StockResearchLink = {
  key: string
  label: string
  /**
   * Heading the loading skeleton shows for this view.
   *
   * An empty string means the view renders no page header, so its skeleton
   * must not render one either — otherwise a heading appears while loading and
   * vanishes when the content lands. Falls back to `label` when unset.
   */
  loadingTitle?: string
  slug: string
  query?: string
}

export const stockResearchPrimaryItems: readonly StockResearchLink[] = [
  { key: 'overview', label: 'Overview', loadingTitle: '', slug: '' },
  { key: 'fundamentals', label: 'Fundamentals', loadingTitle: '', slug: 'fundamentals' },
  { key: 'financials', label: 'Financials', loadingTitle: '', slug: 'financials' },
  { key: 'valuation', label: 'Valuation', loadingTitle: 'Valuation History', slug: 'valuation' },
  { key: 'signals', label: 'Signals', loadingTitle: 'Signals & Indicators', slug: 'signals' },
  { key: 'events', label: 'Events', slug: 'events' },
  { key: 'relationships', label: 'Relationships', slug: 'relationships' },
  { key: 'profile', label: 'Profile', slug: 'profile' },
  { key: 'ownership', label: 'Ownership & Capital', slug: 'ownership' },
  { key: 'ai-research', label: 'AI Research', slug: 'ai-research' },
  { key: 'methodology', label: 'Methodology', slug: 'methodology' },
] as const

export function stockResearchHref(
  ticker: string,
  item: Pick<StockResearchLink, 'slug' | 'query'>,
): string {
  const pathname = item.slug ? `/stocks/${ticker}/${item.slug}` : `/stocks/${ticker}`
  const params = new URLSearchParams(item.query)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function stockResearchKeyFromPath(pathname: string): StockResearchNavKey {
  const segment = pathname.split('/').filter(Boolean)[2]
  if (!segment) return 'overview'
  if (segment === 'relationships') return 'relationships'
  if (segment === 'fundamentals') return 'fundamentals'
  if (segment === 'financials') return 'financials'
  if (segment === 'valuation') return 'valuation'
  if (['signals', 'signal-history', 'indicators', 'performance'].includes(segment)) return 'signals'
  if (segment === 'events') return 'events'
  if (segment === 'profile') return 'profile'
  if (segment === 'ownership') return 'ownership'
  if (segment === 'ai-research') return 'ai-research'
  if (segment === 'methodology') return 'methodology'
  return 'overview'
}
