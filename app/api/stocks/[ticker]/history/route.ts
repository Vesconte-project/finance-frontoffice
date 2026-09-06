import { NextRequest, NextResponse } from 'next/server'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getHistoricalData } from '@/lib/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/

function normalizeTicker(value: string): string | null {
  const ticker = value.trim().toUpperCase()
  return TICKER_PATTERN.test(ticker) ? ticker : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params
  const ticker = normalizeTicker(rawTicker || '')
  if (!ticker) {
    return NextResponse.json({ error: 'A valid ticker is required.' }, { status: 400 })
  }

  try {
    const points = await getHistoricalData(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX)
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
