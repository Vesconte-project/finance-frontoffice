import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasCompare } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'
import { atlasSetKey } from '@/lib/atlas-pro-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pro: how two sets (a region, a group or a company) moved together over the last year. */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const a = atlasSetKey(search.get('a'))
  const b = atlasSetKey(search.get('b'))
  const raw = search.get('asOf')
  const asOf = raw === null ? null : atlasDate(raw)
  if (!a || !b || (raw !== null && !asOf)) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasCompare(a, b, asOf))
}
