import { projectResponse, type ComparisonRequest } from './synthetic-research'

export class ResearchReadError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>
type Options = { mode?: string; baseUrl?: string; getToken: GetToken; fetcher?: typeof fetch }
const messages: Record<number, string> = {
  401: 'Sign in again to continue.', 403: 'You do not have access to this research.',
  404: 'Run or artifact not found.', 409: 'Comparison cannot be submitted now.',
  422: 'The comparison was rejected. Check the permitted options.',
  429: 'Wait for your current comparison to finish.', 503: 'Synthetic research is unavailable.',
}
export function createResearchClient({ mode = 'bff', baseUrl = '', getToken, fetcher = fetch }: Options) {
  return async (path: string, body?: ComparisonRequest): Promise<Record<string, unknown>> => {
    if (!['bff', 'clerk_jwt'].includes(mode)) throw new ResearchReadError(messages[503], 503)
    // Only research routes; never let a path redirect a session token elsewhere.
    if (!/^(?:comparisons|experiments(?:\/[A-Za-z0-9_-]{1,128}(?:\/(?:events|artifacts)(?:\/[A-Za-z0-9_-]{1,128})?)?)?)(?:\?limit=(?:[1-9]|[1-4][0-9]|50))?$/.test(path))
      throw new ResearchReadError(messages[404], 404)
    let base = ''
    if (mode === 'clerk_jwt') {
      try {
        const url = new URL(baseUrl)
        if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
            !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw Error()
        base = url.origin
      } catch { throw new ResearchReadError(messages[503], 503) }
    }
    const url = mode === 'bff' ? `/api/research/synthetic/${path}` : `${base}/site/research/synthetic/${path}`
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (mode === 'clerk_jwt') {
        const token = await getToken(attempt ? { skipCache: true } : undefined)
        if (!token) throw new ResearchReadError(messages[401], 401)
        headers.Authorization = `Bearer ${token}`
      }
      let response: Response
      try {
        response = await fetcher(url, {
          method: body ? 'POST' : 'GET', headers, cache: 'no-store', redirect: 'error',
          credentials: mode === 'clerk_jwt' ? 'omit' : 'same-origin',
          signal: AbortSignal.timeout(35000), ...(body ? { body: JSON.stringify(body) } : {}),
        })
      } catch {
        throw new ResearchReadError(body ? 'Submission outcome is unknown. Refresh recent runs before submitting again.' : 'Research service could not be reached. Try refreshing.', 502)
      }
      if (response.status === 401 && mode === 'clerk_jwt' && attempt === 0) continue
      if (!response.ok) throw new ResearchReadError(messages[response.status] || 'Research service could not be reached.', response.status)
      try {
        if (response.status !== (body ? 202 : 200)) throw Error()
        return projectResponse(`/${path.split('?')[0]}`, await response.json()) as Record<string, unknown>
      } catch { throw new ResearchReadError(body ? 'Submission outcome is unknown. Refresh recent runs before submitting again.' : 'Unexpected research response. Try refreshing.', 502) }
    }
    throw new ResearchReadError(messages[401], 401)
  }
}
