import { NextResponse } from 'next/server'
import { getDisplayCurrencies } from '@/lib/display-currency-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The currencies a ticker page can be shown in, as `GET /v1/currencies` lists
 * them (USD first). The ticker page's currency selector offers these and no
 * others.
 */
export async function GET() {
  try {
    const payload = await getDisplayCurrencies()
    if (!payload) {
      return NextResponse.json({ error: 'The currency list is malformed.' }, { status: 502 })
    }
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'The currency list is temporarily unavailable.' }, { status: 502 })
  }
}
