import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasZone } from '@/lib/atlas'
import { atlasZoneId } from '@/lib/atlas-model'

function safeDecode(value: string | undefined): string {
  try {
    return decodeURIComponent(value ?? '')
  } catch {
    return ''
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A zone's panel: signed out, its name and leaders; signed in, every member (`lens=total`: Pro). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) {
  const zoneId = atlasZoneId(safeDecode((await params).zoneId))
  const lens = request.nextUrl.searchParams.get('lens')
  if (!zoneId || (lens !== null && lens !== 'residual' && lens !== 'total')) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasZone(zoneId, lens === 'total' ? 'total' : 'residual'))
}
