import { NextRequest } from 'next/server'
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

/** A company's panel: signed out, its zone and leaders; signed in, its memberships and strongest ties (`lens=total`: Pro). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const symbol = atlasSymbol(safeDecode((await params).ticker))
  const lens = request.nextUrl.searchParams.get('lens')
  if (!symbol || (lens !== null && lens !== 'residual' && lens !== 'total'))
    return Response.json({ detail: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return atlasRouteResponse(await getAtlasCompany(symbol, lens === 'total' ? 'total' : 'residual'))
}
