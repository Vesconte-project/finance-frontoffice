import { loadRequired } from '../../../../lib/load'
export async function GET(request, { params }) {
  const result = await loadRequired((await params).status, request.headers)
  return Response.json(result.data, { status: result.status, headers: {
    'Cache-Control': 'private, no-store',
    ...([429, 503].includes(result.status) ? { 'Retry-After': result.retryAfter || '60' } : {}),
  } })
}
