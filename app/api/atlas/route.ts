import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasOverview } from '@/lib/atlas'
import { ATLAS_MAX_LEVEL } from '@/lib/atlas-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BBOX = /^-?\d{1,6}(\.\d{1,6})?(,-?\d{1,6}(\.\d{1,6})?){3}$/

/** The atlas at one detail level, optionally for one area. The backend decides what this reader may see. */
export async function GET(request: NextRequest) {
  const level = Number.parseInt(request.nextUrl.searchParams.get('level') ?? '0', 10)
  const bbox = request.nextUrl.searchParams.get('bbox')
  if (!Number.isInteger(level) || level < 0 || level > ATLAS_MAX_LEVEL || (bbox !== null && !BBOX.test(bbox)))
    return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasOverview(level, bbox))
}
