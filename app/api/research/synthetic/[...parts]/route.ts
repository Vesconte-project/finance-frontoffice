import { getViewerUserId } from '@/lib/auth'
import { fetchBackendResponse } from '@/lib/backend'
import { syntheticResearchEnabled } from '@/lib/synthetic-research-access'
import { proxySynthetic } from '@/lib/synthetic-research-proxy'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ parts: string[] }> }
async function handle(request: Request, context: Context) {
  return proxySynthetic(request, (await context.params).parts, {
    viewer: getViewerUserId,
    enabled: syntheticResearchEnabled,
    secret: () => process.env.RESEARCH_BFF_SECRET || '',
    upstream: (path, init) => fetchBackendResponse(path, { context: 'research.synthetic', timeoutMs: 30000, init }),
  })
}
export const GET = handle
export const POST = handle
