/**
 * The state of a stock page's required summary, kept apart from rendering so the decision can be
 * exercised in tests (ENG-268). A 429 is a reached limit, not a fault: the page offers what helps
 * this viewer (an account to an anonymous reader, the plans to a signed-in one), never a retry.
 */
import { marketLimitNotice, type MarketLimitNotice } from './market-limit'

export type StockSummaryState<T> =
  | { status: 'ok'; summary: T }
  | { status: 'limit'; signedIn: boolean; notice: MarketLimitNotice }
  | { status: 'error'; error: unknown }

export async function loadStockSummaryState<T>(load: () => Promise<T>,
  isSignedIn: () => Promise<boolean>): Promise<StockSummaryState<T>> {
  try {
    return { status: 'ok', summary: await load() }
  } catch (error) {
    const notice = marketLimitNotice(error)
    if (!notice) return { status: 'error', error }
    let signedIn = false
    try { signedIn = await isSignedIn() } catch { signedIn = false }
    return { status: 'limit', signedIn, notice }
  }
}
