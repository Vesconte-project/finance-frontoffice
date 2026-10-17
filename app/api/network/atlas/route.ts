import { getViewerUserId } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { deriveFallbackAtlas, getMarketNetwork, getRelationshipAtlas, type AtlasView } from '@/lib/network'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIEWS = new Set<AtlasView>(['market', 'residual', 'timing', 'theme'])

export async function GET(request: NextRequest) {
  if (!(await getViewerUserId())) return NextResponse.json({error:'Authentication required'},
    {status:401,headers:{'Cache-Control':'private, no-store'}})

  const requestedView = request.nextUrl.searchParams.get('view') as AtlasView | null
  const view = requestedView && VIEWS.has(requestedView) ? requestedView : 'market'
  const parsedWindow = Number.parseInt(request.nextUrl.searchParams.get('window') ?? '252', 10)
  const window = Number.isFinite(parsedWindow) ? Math.max(2, Math.min(5000, parsedWindow)) : 252
  try {
    const atlas = await getRelationshipAtlas(window, view)
    return NextResponse.json(atlas, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    if (view !== 'market') {
      return NextResponse.json(
        { error: 'This relationship view is not materialized for the requested window.' },
        { status: 503 },
      )
    }
    const legacy = await getMarketNetwork({ window: String(window), minAbsCorrelation: 0.28, topK: 8 }).catch(() => null)
    if (!legacy) return NextResponse.json({ error: 'The market atlas is temporarily unavailable.' }, { status: 502 })
    return NextResponse.json(deriveFallbackAtlas(legacy, 'market').atlas, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
