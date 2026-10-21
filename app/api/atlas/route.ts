import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasOverview } from '@/lib/atlas'
import { ATLAS_MAX_LEVEL, atlasDate } from '@/lib/atlas-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BBOX = /^-?\d{1,6}(\.\d{1,6})?(,-?\d{1,6}(\.\d{1,6})?){3}$/

/**
 * The atlas at one detail level, optionally for one area, an earlier week (`asOf`) or the
 * total lens (`lens=total`). The backend decides what this reader may see and refuses the rest.
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const level = Number.parseInt(search.get('level') ?? '0', 10)
  const bbox = search.get('bbox')
  const asOf = search.get('asOf')
  const lens = search.get('lens')
  if (
    !Number.isInteger(level) || level < 0 || level > ATLAS_MAX_LEVEL ||
    (bbox !== null && !BBOX.test(bbox)) ||
    (asOf !== null && !atlasDate(asOf)) ||
    (lens !== null && lens !== 'residual' && lens !== 'total')
  )
    return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasOverview(level, bbox, { asOf, lens: lens === 'total' ? 'total' : 'residual' }))
}
