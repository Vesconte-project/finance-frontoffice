import { NextRequest } from 'next/server'
import { atlasRouteResponse, getAtlasTheme } from '@/lib/atlas'
import { atlasDate } from '@/lib/atlas-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const THEME_ID = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$/

function safeDecode(value: string | undefined): string {
  try {
    return decodeURIComponent(value ?? '')
  } catch {
    return ''
  }
}

/** Signed in: one theme with its members, as map companies, so the map can show them wherever they are. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
  const themeId = safeDecode((await params).themeId).trim()
  const raw = request.nextUrl.searchParams.get('asOf')
  const asOf = raw === null ? null : atlasDate(raw)
  if (!THEME_ID.test(themeId) || (raw !== null && !asOf))
    return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasTheme(themeId, asOf))
}
