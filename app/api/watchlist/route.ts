import { NextResponse } from 'next/server'
import { personalFailure } from '@/lib/personal-server'
import { getViewerUserId } from '@/lib/auth'
import { addTickerToWatchlist, removeTickerFromWatchlist } from '@/lib/watchlist'

function parseTickerFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  if (Object.keys(body).some(key => key !== 'ticker')) return null
  const ticker = (body as { ticker?: unknown }).ticker
  if (typeof ticker !== 'string') return null
  const normalized = ticker.trim().toUpperCase()
  return normalized || null
}

export async function POST(request: Request) {
  const userId = await getViewerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const ticker = parseTickerFromBody(payload)
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required.' }, { status: 400 })
  }

  let result
  try {
    result = await addTickerToWatchlist(ticker)
  } catch (error) {
    return personalFailure(error)
  }
  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to add ticker.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ticker }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(request: Request) {
  const userId = await getViewerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const ticker = parseTickerFromBody(payload)
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required.' }, { status: 400 })
  }

  let result
  try {
    result = await removeTickerFromWatchlist(ticker)
  } catch (error) {
    return personalFailure(error)
  }
  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to remove ticker.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ticker }, { headers: { 'Cache-Control': 'private, no-store' } })
}
