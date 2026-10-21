import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasMovement } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pro: how companies moved between an earlier week (`from`) and a later one (`to`, default the newest). */
export async function GET(request: NextRequest) {
  const from = atlasDate(request.nextUrl.searchParams.get('from'))
  const rawTo = request.nextUrl.searchParams.get('to')
  const to = rawTo === null ? null : atlasDate(rawTo)
  if (!from || (rawTo !== null && !to)) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasMovement(from, to))
}
