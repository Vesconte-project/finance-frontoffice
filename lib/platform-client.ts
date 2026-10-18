/** Native user API. Commercial decisions belong to FastAPI, never Clerk metadata. */
type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>
type Options = { baseUrl: string; getToken: GetToken; fetcher?: typeof fetch; originHeaders?: (url: URL, method: string) => Promise<Record<string, string>> }
type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; idempotencyKey?: string }

const messages: Record<number, string> = {
  401: 'Sign in again to continue.', 403: 'Your account does not have access to this operation.',
  404: 'The requested resource is unavailable.', 409: 'The operation conflicts with the current account state.',
  422: 'Check the submitted options.', 429: 'An account limit has been reached. Try again later.',
  503: 'This service is temporarily unavailable.',
}
export class PlatformError extends Error {
  constructor(readonly status: number, readonly retryAfter: number | null = null) {
    super(messages[status] || 'The service could not complete this request.')
  }
}

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const reads = new RegExp(`^/(?:me|accounts/${uuid}/access|research/jobs(?:/${uuid}(?:/(?:results|events|artifacts))?)?|artifacts/${uuid}/(?:download|content)|rankings|watchlist|ai-research/runs(?:/${uuid})?)$`)
const writes = new RegExp(`^/(?:billing/(?:checkout|portal)|research/jobs(?:/${uuid}/cancel)?|watchlist|ai-research/(?:runs|feedback)|analytics/events)$`)

export function createPlatformClient({ baseUrl, getToken, fetcher = fetch, originHeaders }: Options) {
  let base: string
  const prefix = baseUrl === 'same-origin' ? '/api/platform' : '/v1'
  try {
    if (baseUrl === 'same-origin') base = ''
    else {
    const url = new URL(baseUrl)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw Error()
    base = url.origin
    }
  } catch { throw new PlatformError(503) }

  return async (path: string, options: RequestOptions = {}): Promise<Response> => {
    const method = options.method || 'GET'
    const route = path.split('?')[0]
    if (path.includes('#') || route.includes('%') || !path.startsWith('/') ||
      !(method === 'GET' ? reads.test(route) : method === 'PATCH'
        ? new RegExp(`^/ai-research/runs/${uuid}$`).test(route) : method === 'DELETE'
        ? route === '/watchlist' : writes.test(route))) throw new PlatformError(404)
    if (method === 'GET' && options.body !== undefined) throw new PlatformError(422)
    const requiresKey = method === 'POST' && ['/billing/checkout', '/billing/portal', '/research/jobs'].includes(route)
    if ((requiresKey && !options.idempotencyKey) || (options.idempotencyKey &&
      !/^[A-Za-z0-9_.:-]{8,128}$/.test(options.idempotencyKey))) throw new PlatformError(422)

    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getToken(attempt ? { skipCache: true } : undefined)
      if (!token) throw new PlatformError(401)
      const headers: Record<string, string> = { ...(originHeaders ? await originHeaders(new URL(`${base}/v1${path}`), method) : {}), Authorization: `Bearer ${token}` }
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
      let response: Response
      try {
        response = await fetcher(`${base}${prefix}${path}`, {
          method, headers, credentials: 'omit', cache: 'no-store', redirect: 'error',
          signal: AbortSignal.timeout(35000),
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        })
      } catch { throw new PlatformError(502) }
      if (response.status === 401 && attempt === 0) continue
      if (!response.ok) {
        const raw = response.headers.get('Retry-After')
        const retryAfter = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null
        throw new PlatformError(response.status, retryAfter)
      }
      return response
    }
    throw new PlatformError(401)
  }
}
