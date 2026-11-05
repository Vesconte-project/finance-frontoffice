import { NextResponse } from 'next/server'
import { BackendDataError, fetchBackendJson } from '@/lib/backend'
import { convertedTechnicalSeries } from '@/lib/display-currency'
import { fetchInDisplayCurrency, resolveDisplayCurrency } from '@/lib/display-currency-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const ticker = (await params).ticker.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  // `?currency=`: the indicators in the display currency, for a chart drawn in it.
  const currency = await resolveDisplayCurrency(new URL(request.url).searchParams.get('currency')).catch(() => null)
  try {
    const path = `/v1/tickers/${encodeURIComponent(ticker)}/technical-series?indicators=sma_20,sma_50,sma_200,bb_20_2,rsi_14&period_days=0`
    const read = (url: string) => fetchBackendJson<unknown>(url, { context: 'backend.tickers.technical-series' })
    if (!currency) return NextResponse.json(await read(path), { headers: { 'Cache-Control': 'private, no-store' } })
    const { payload, refused } = await fetchInDisplayCurrency(path, currency, read)
    // Never indicators in one currency over prices in another.
    if (refused) {
      return NextResponse.json({ availability_status: 'unavailable', unavailable_reason: 'technical_series_unavailable' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return NextResponse.json(convertedTechnicalSeries(payload, currency), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const status = error instanceof BackendDataError && error.status === 409 ? 409 : 502
    return NextResponse.json({ availability_status: 'unavailable', unavailable_reason: status === 409 ? 'adjusted_price_input_invalid' : 'technical_series_unavailable' }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
