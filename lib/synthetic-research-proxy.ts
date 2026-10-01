import 'server-only'
import { parseComparison, projectResponse } from './synthetic-research'

type Boundary = {
  viewer: () => Promise<string | null>
  enabled: () => boolean
  secret: () => string
  upstream: (path: string, init: RequestInit) => Promise<Response>
}
const segment = /^[A-Za-z0-9_-]{1,128}$/
export function allowedPath(method: string, parts: string[]): string | null {
  if (method === 'POST' && parts.length === 1 && parts[0] === 'comparisons') return '/comparisons'
  if (method !== 'GET' || parts[0] !== 'experiments') return null
  if (parts.length === 1) return '/experiments'
  if (!segment.test(parts[1])) return null
  if (parts.length === 2) return `/experiments/${parts[1]}`
  if (parts.length === 3 && ['events', 'artifacts'].includes(parts[2])) return `/experiments/${parts[1]}/${parts[2]}`
  if (parts.length === 4 && parts[2] === 'artifacts' && segment.test(parts[3])) return `/experiments/${parts[1]}/artifacts/${parts[3]}`
  return null
}
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store', vary: 'Cookie' } })
const error = (message: string, status: number) => reply({ error: message }, status)
async function boundedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > 4096) return null
  if (!request.body) return ''
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) { await reader.cancel(); return null }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength })
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
export async function proxySynthetic(request: Request, parts: string[], boundary: Boundary): Promise<Response> {
  if (!boundary.enabled()) return error('Synthetic research is unavailable.', 503)
  const viewer = await boundary.viewer()
  if (!viewer || !/^user_[A-Za-z0-9]{8,128}$/.test(viewer)) return error('Sign in to use synthetic research.', 401)
  const path = allowedPath(request.method, parts)
  if (!path) return error('Unknown research operation.', 404)
  const secret = boundary.secret().trim()
  if (!secret) return error('Synthetic research is unavailable.', 503)
  const url = new URL(request.url)
  for (const key of url.searchParams.keys()) if (key !== 'limit' || path !== '/experiments') return error('Unsupported query parameter.', 400)
  const limit = url.searchParams.get('limit')
  if (url.searchParams.getAll('limit').length > 1 || (limit !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit))) return error('Choose a limit between 1 and 50.', 400)
  let body: string | undefined
  if (request.method === 'POST') {
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return error('Cross-origin submission is forbidden.', 403)
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error('Send a JSON comparison.', 415)
    try {
      const raw = await boundedBody(request)
      if (raw === null) return error('Comparison exceeds the request limit.', 413)
      body = JSON.stringify(parseComparison(JSON.parse(raw)))
    } catch { return error('Choose two distinct variants with valid names and permitted parameters.', 422) }
  }
  try {
    const upstream = await boundary.upstream(`/site/research/synthetic${path}${limit ? `?limit=${limit}` : ''}`, { method: request.method, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'x-research-bff-secret': secret, 'x-research-viewer-id': viewer } })
    if (!upstream.ok) {
      const status = [401, 403, 404, 409, 422, 429, 503].includes(upstream.status) ? upstream.status : 502
      const messages: Record<number, string> = { 401: 'Sign in again to continue.', 403: 'Synthetic research is unavailable.', 404: 'Run not found.', 409: 'Comparison cannot be submitted now.', 422: 'The comparison was rejected. Check the permitted options.', 429: 'Wait for your current comparison to finish.', 503: 'Synthetic research is unavailable.', 502: 'Research service could not be reached.' }
      return error(messages[status], status)
    }
    if (upstream.status !== (request.method === 'POST' ? 202 : 200)) return error('Unexpected research response.', 502)
    return reply(projectResponse(path, await upstream.json()), upstream.status)
  } catch { return error(request.method === 'POST' ? 'Submission outcome is unknown. Refresh recent runs before submitting again.' : 'Research service could not be reached. Try refreshing.', 502) }
}
