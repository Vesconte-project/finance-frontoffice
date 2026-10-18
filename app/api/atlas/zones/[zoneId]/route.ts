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

/** A zone's panel: signed out, its name and leaders; signed in, every member. */
export async function GET(_request: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const zoneId = atlasZoneId(safeDecode((await params).zoneId))
  if (!zoneId) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasZone(zoneId))
}
