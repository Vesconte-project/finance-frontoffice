import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasInfluence } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pro: the influence arrows that pass the test this week, or why the test could not run. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('asOf')
  const asOf = raw === null ? null : atlasDate(raw)
  if (raw !== null && !asOf) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasInfluence(asOf))
}
