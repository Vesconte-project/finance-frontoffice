import { NextResponse } from 'next/server'
import { BackendDataError, fetchBackendJson } from '@/lib/backend'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const ticker = (await params).ticker.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  try {
    const payload = await fetchBackendJson<unknown>(`/v1/tickers/${encodeURIComponent(ticker)}/technical-series?indicators=sma_20,sma_50,sma_200,bb_20_2,rsi_14&period_days=0`, { context: 'backend.tickers.technical-series' })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const status = error instanceof BackendDataError && error.status === 409 ? 409 : 502
    return NextResponse.json({ availability_status: 'unavailable', unavailable_reason: status === 409 ? 'adjusted_price_input_invalid' : 'technical_series_unavailable' }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
