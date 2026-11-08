import { retryAfterMs } from './retry-policy'

/**
 * A 429 from the market budget is a limit the reader reached, not a fault (ENG-268).
 * Say so, say when it frees up, and offer the free account instead of a retry that
 * would only spend the wait.
 */
export type MarketLimitNotice = { minutes: number | null }

export function marketLimitNotice(error: unknown, now = Date.now()): MarketLimitNotice | null {
  if (!error || typeof error !== 'object' || (error as { status?: unknown }).status !== 429) return null
  const raw = (error as { retryAfter?: unknown }).retryAfter
  const delay = retryAfterMs(typeof raw === 'string' ? raw : null, now)
  return { minutes: delay === null ? null : Math.max(1, Math.ceil(delay / 60000)) }
}

export function marketLimitWait(notice: MarketLimitNotice): string {
  if (notice.minutes === null) return 'in a while'
  if (notice.minutes < 60) return `in about ${notice.minutes} minute${notice.minutes === 1 ? '' : 's'}`
  const hours = Math.round(notice.minutes / 60)
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`
}
