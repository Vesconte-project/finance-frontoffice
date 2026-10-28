import { NextRequest, NextResponse } from 'next/server'
import { convertedValueOf, DISPLAY_CURRENCY_PARAM, moneyEntryOf } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { getTickerPageSummary } from '@/lib/ticker-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/

/**
 * The header price in a display currency: the backend's conversion of the
 * latest price at its rate ("₩75,000 ≈ $54.11"). The page keeps the reported
 * price; this only adds the converted figure beside it. The chrome sits in the
 * layout, which does not see the page's `?currency=`, so it asks here.
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
    if (summary.displayCurrency?.refused) {
      return NextResponse.json({ error: 'unsupported_currency' }, { status: 422 })
    }
    const quote = summary.quote
    // The chrome falls back to the last price when the quote has none.
    const priceHolder = quote && typeof quote.price === 'number' ? quote : summary.marketStats
    const priceField = priceHolder === quote ? 'price' : 'lastPrice'
    const conversion = convertedValueOf(priceHolder, priceField, currency)
    const entry = moneyEntryOf(priceHolder, priceField)
    return NextResponse.json({
      ticker,
      currency,
      price_basis: 'raw',
      // The latest price as reported stays the page's price; this is the backend's conversion of it.
      converted: conversion ? { value: conversion.value, currency: conversion.currency, rateDate: conversion.rateDate } : null,
      unconvertedReason: conversion ? null : entry?.unconvertedReason ?? 'no_rate',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json({ error: 'The quote is temporarily unavailable.' }, { status: 502 })
  }
}
