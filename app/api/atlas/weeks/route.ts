import { atlasRouteResponse, getAtlasWeeks } from '@/lib/atlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pro: the weeks this reader may open, newest first, with each week's market cohesion. */
export async function GET() {
  return atlasRouteResponse(await getAtlasWeeks())
}
