/** Small formatting and link helpers shared by the atlas's client components. */

export const SIGN_UP_HREF = '/sign-up?redirect_url=/markets/network'
export const SIGN_IN_HREF = '/sign-in?redirect_url=/markets/network'
/** The plans page the rest of the site links to for paid features. */
export const PLANS_HREF = '/pricing'

export function formatCap(value: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return null
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** A plain-language strength for a tie, so the panel reads without a coefficient. */
export function strength(correlation: number): string {
  if (correlation >= 0.6) return 'Very strong'
  if (correlation >= 0.4) return 'Strong'
  if (correlation >= 0.25) return 'Clear'
  return 'Weak'
}
