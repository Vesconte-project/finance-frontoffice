import { getViewerUserId } from '@/lib/auth'
import { BackendDataError, fetchBackendResponse } from '@/lib/backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ parts: string[] }> }
const segment = /^[A-Za-z0-9_-]{1,128}$/

function allowedPath(method: 'GET' | 'POST', parts: string[]): string | null {
  if (method === 'POST' && parts.length === 1 && parts[0] === 'comparisons') return '/comparisons'
  if (method !== 'GET' || parts[0] !== 'experiments') return null
  if (parts.length === 1) return '/experiments'
  if (!parts[1] || !segment.test(parts[1])) return null
  if (parts.length === 2) return `/experiments/${parts[1]}`
  if (parts.length === 3 && (parts[2] === 'events' || parts[2] === 'artifacts')) {
    return `/experiments/${parts[1]}/${parts[2]}`
  }
  if (parts.length === 4 && parts[2] === 'artifacts' && segment.test(parts[3])) {
    return `/experiments/${parts[1]}/artifacts/${parts[3]}`
  }
  return null
}

async function proxy(request: Request, context: Context, method: 'GET' | 'POST'): Promise<Response> {
  const userId = await getViewerUserId()
  if (!userId) return Response.json({ error: 'Authentication required.' }, { status: 401 })

  const parts = (await context.params).parts
  const path = allowedPath(method, parts)
  if (!path) return Response.json({ error: 'Unknown research operation.' }, { status: 404 })

  const secret = (process.env.RESEARCH_BFF_SECRET || '').trim()
  if (!secret) return Response.json({ error: 'Research proof is unavailable.' }, { status: 503 })

  let body: string | undefined
  if (method === 'POST') {
    try {
      const raw = await request.text()
      if (raw.length > 4096) return Response.json({ error: 'Request too large.' }, { status: 413 })
      body = JSON.stringify(JSON.parse(raw))
    } catch {
      return Response.json({ error: 'Invalid JSON.' }, { status: 400 })
    }
  }

  const requestedLimit = new URL(request.url).searchParams.get('limit')
  const limit = requestedLimit && /^([1-9]|[1-4][0-9]|50)$/.test(requestedLimit) ? `?limit=${requestedLimit}` : ''
  try {
    const upstream = await fetchBackendResponse(`/site/research/synthetic${path}${method === 'GET' && path === '/experiments' ? limit : ''}`, {
      context: 'research.synthetic',
      timeoutMs: 30000,
      init: {
        method,
        body,
        headers: {
          'x-research-bff-secret': secret,
          'x-research-viewer-id': userId,
        },
      },
    })
    const payload = await upstream.text()
    const parsed = JSON.parse(payload) as unknown
    return Response.json(parsed, { status: upstream.status, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const status = error instanceof BackendDataError && error.status === 503 ? 503 : 502
    return Response.json({ error: status === 503 ? 'Research proof is unavailable.' : 'Research service failed.' }, {
      status,
      headers: { 'cache-control': 'no-store' },
    })
  }
}

export async function GET(request: Request, context: Context) {
  return proxy(request, context, 'GET')
}

export async function POST(request: Request, context: Context) {
  return proxy(request, context, 'POST')
}
