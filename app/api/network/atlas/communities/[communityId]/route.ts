import { getViewerUserId } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  deriveFallbackAtlas,
  getMarketNetwork,
  getRelationshipAtlasCommunity,
  type AtlasView,
} from '@/lib/network'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIEWS = new Set<AtlasView>(['market', 'residual', 'timing', 'theme'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> },
) {
  if (!(await getViewerUserId())) return NextResponse.json({error:'Authentication required'},
    {status:401,headers:{'Cache-Control':'private, no-store'}})

  const { communityId: rawCommunityId } = await params
  const communityId = decodeURIComponent(rawCommunityId || '').trim()
  const requestedView = request.nextUrl.searchParams.get('view') as AtlasView | null
  const view = requestedView && VIEWS.has(requestedView) ? requestedView : 'market'
  const window = boundedInteger(request.nextUrl.searchParams.get('window'), 252, 2, 5000)
  const limit = boundedInteger(request.nextUrl.searchParams.get('limit'), 64, 4, 120)
  const requestedAsOf = request.nextUrl.searchParams.get('asOf')
  const asOf = requestedAsOf && isIsoDate(requestedAsOf) ? requestedAsOf : undefined
  if (!communityId || !/^[a-z0-9_-]{3,96}$/i.test(communityId)) {
    return NextResponse.json({ error: 'A valid community id is required.' }, { status: 400 })
  }
  if (requestedAsOf && !asOf) {
    return NextResponse.json({ error: 'asOf must be an ISO date.' }, { status: 400 })
  }
  try {
    const detail = await getRelationshipAtlasCommunity(communityId, { window, view, limit, asOf })
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    if (asOf) {
      return NextResponse.json({ error: 'This market snapshot is temporarily unavailable.' }, { status: 502 })
    }
    const legacy = await getMarketNetwork({ window: String(window), minAbsCorrelation: 0.28, topK: 8 }).catch(() => null)
    const detail = legacy ? deriveFallbackAtlas(legacy, view).details[communityId] : null
    if (!detail) return NextResponse.json({ error: 'This market community is temporarily unavailable.' }, { status: 502 })
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
