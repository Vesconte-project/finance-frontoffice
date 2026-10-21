import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasThemes } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Signed in: the week's themes (what thematic funds hold together) and whether prices confirm each one. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('asOf')
  const asOf = raw === null ? null : atlasDate(raw)
  if (raw !== null && !asOf) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasThemes(asOf))
}
