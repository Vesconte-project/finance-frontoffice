import { NextRequest, NextResponse } from 'next/server'
import { BackendDataError } from '@/lib/backend'
import { DISPLAY_CURRENCY_PARAM } from '@/lib/display-currency'
import { resolveDisplayCurrency } from '@/lib/display-currency-server'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getConvertedCloses, getHistoricalData } from '@/lib/finance'

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

  // `?currency=` adds, beside each reported close, the backend's conversion for
  // that day (`converted`, null without a rate) for the chart's "Show in" view;
  // a currency it does not list is refused rather than ignored.
  const requested = request.nextUrl.searchParams.get(DISPLAY_CURRENCY_PARAM)
  const currency = requested ? await resolveDisplayCurrency(requested) : null
  if (requested && !currency) {
    return NextResponse.json({ error: 'unsupported_currency' }, { status: 422 })
  }

  try {
    let points: unknown[]
    if (currency) {
      const converted = await getConvertedCloses(ticker, currency)
      if (converted.refused) return NextResponse.json({ error: 'unsupported_currency' }, { status: 422 })
      points = converted.points
    } else {
      points = await getHistoricalData(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX)
    }
    if (points.length === 0) {
      return NextResponse.json(
        { error: `Historical price data is unavailable for ${ticker}.` },
        { status: 404 },
      )
    }

    return NextResponse.json(points, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof BackendDataError && error.status === 409) {
      return NextResponse.json({ availability_status: 'unavailable', unavailable_reason: 'adjusted_price_input_invalid', price_basis: 'adjusted' },
        { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return NextResponse.json(
      { error: 'Historical price data is temporarily unavailable.' },
      { status: 502 },
    )
  }
}
