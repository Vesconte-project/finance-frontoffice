import { NextRequest, NextResponse } from 'next/server'
import { DISPLAY_CURRENCY_PARAM } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getHistoricalPrices } from '@/lib/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/

function normalizeTicker(value: string): string | null {
  const ticker = value.trim().toUpperCase()
  return TICKER_PATTERN.test(ticker) ? ticker : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params
  const ticker = normalizeTicker(rawTicker || '')
  if (!ticker) {
    return NextResponse.json({ error: 'A valid ticker is required.' }, { status: 400 })
  }

  // `?currency=` draws the closes in a display currency, as the backend converted
  // them; a currency it does not list is refused rather than ignored.
  const requested = request.nextUrl.searchParams.get(DISPLAY_CURRENCY_PARAM)
  const currency = requested ? await resolveDisplayCurrency(requested) : null
  if (requested && !currency) {
    return NextResponse.json({ error: 'unsupported_currency' }, { status: 422 })
  }

  try {
    const { points } = await getHistoricalPrices(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX, currency)
    if (points.length === 0) {
      return NextResponse.json(
        { error: `Historical price data is unavailable for ${ticker}.` },
        { status: 404 },
      )
    }

    return NextResponse.json(points, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=900',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Historical price data is temporarily unavailable.' },
      { status: 502 },
    )
  }
}
