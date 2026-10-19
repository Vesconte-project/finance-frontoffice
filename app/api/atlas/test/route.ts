import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasTest } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'
import { atlasSetKey } from '@/lib/atlas-pro-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pro: the influence test on two sets the reader chose; `testsRun` raises the bar with every test of the session. */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const from = atlasSetKey(search.get('from'))
  const to = atlasSetKey(search.get('to'))
  const testsRun = Number(search.get('testsRun'))
  const raw = search.get('asOf')
  const asOf = raw === null ? null : atlasDate(raw)
  if (!from || !to || !Number.isInteger(testsRun) || testsRun < 1 || testsRun > 1000 || (raw !== null && !asOf))
    return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasTest({ from, to, testsRun, asOf }))
}
