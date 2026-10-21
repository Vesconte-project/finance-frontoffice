import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasSet } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'
import { ATLAS_SET_LIMIT, atlasSetKey } from '@/lib/atlas-pro-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pro: how tightly a selection moves together (mean pairwise correlation); at most 200 companies. */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const key = atlasSetKey(`group:${search.get('members') ?? ''}`)
  const members = key ? key.slice(6).split(',') : []
  const raw = search.get('asOf')
  const asOf = raw === null ? null : atlasDate(raw)
  if (!members.length || members.length > ATLAS_SET_LIMIT || (raw !== null && !asOf))
    return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasSet(members, asOf))
}
