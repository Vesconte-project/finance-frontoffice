import { atlasRouteResponse, getAtlasCompany } from '@/lib/atlas'
import { atlasSymbol } from '@/lib/atlas-model'

function safeDecode(value: string | undefined): string {
  try {
    return decodeURIComponent(value ?? '')
  } catch {
    return ''
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A company's panel: signed out, its zone and leaders; signed in, its memberships and strongest ties. */
export async function GET(_request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const symbol = atlasSymbol(safeDecode((await params).ticker))
  if (!symbol) return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasCompany(symbol))
}
