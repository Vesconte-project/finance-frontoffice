import { NextRequest, NextResponse } from 'next/server'
import { amountOf, DISPLAY_CURRENCY_PARAM, moneyEntryOf } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { getTickerPageSummary } from '@/lib/ticker-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/

/**
 * The ticker chrome's quote in a display currency: the price and the day's
 * change as the backend converted them, each with the reported amount. The
 * chrome sits in the layout, which does not see the page's `?currency=`, so it
 * asks here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params
  const ticker = (rawTicker || '').trim().toUpperCase()
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: 'A valid ticker is required.' }, { status: 400 })
  }
  const currency = await resolveDisplayCurrency(request.nextUrl.searchParams.get(DISPLAY_CURRENCY_PARAM))
  if (!currency) {
    return NextResponse.json({ error: 'unsupported_currency' }, { status: 422 })
  }

  try {
    const summary = await getTickerPageSummary(ticker, currency)
    if (summary.displayReport?.unsupported) {
      return NextResponse.json({ error: 'unsupported_currency' }, { status: 422 })
    }
    const quote = summary.quote
    const original = summary.asset?.currency ?? currency
    const context = { display: currency, original }
    // The chrome falls back to the last price when the quote has none.
    const priceHolder = quote && (quote.price !== null || moneyEntryOf(quote, 'price')) ? quote : summary.marketStats
    const priceField = priceHolder === quote ? 'price' : 'lastPrice'
    return NextResponse.json({
      ticker,
      currency,
      price: amountOf(priceHolder, priceField, context),
      change: amountOf(quote, 'change', context),
      changePercent: typeof quote?.changePercent === 'number' ? quote.changePercent : null,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json({ error: 'The quote is temporarily unavailable.' }, { status: 502 })
  }
}
