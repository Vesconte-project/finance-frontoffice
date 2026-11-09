/**
 * Each chapter's measure keeps one colour across the page and the Financials
 * flow: sales in the theme accent, profit and cash in the up role, debt in the
 * soft terracotta the flow uses for costs, dividends between the two.
 */
export const FUNDAMENTALS_MEASURES = {
  revenue: 'var(--accent)',
  margin: 'var(--up)',
  cash: 'var(--up)',
  dividends: 'color-mix(in oklch, var(--accent) 55%, var(--up))',
} as const
