import {
  BackendDataError,
  backendConfigSnapshot,
  fetchBackendResponse,
} from './backend'

const TICKER_INDEX_CONTEXT = 'backend.tickers.index'

type UpstreamFailureDetails = {
  cfAccessDomain: string | null
  cfMitigated: string | null
  contentType: string | null
  status: number
}

function passthroughHeaders(upstream: Response): Headers {
  const headers = new Headers()
  const etag = upstream.headers.get('etag')
  const contentType = upstream.headers.get('content-type')

  if (etag) headers.set('etag', etag)
  if (contentType) headers.set('content-type', contentType)
  // Admission and client budgets must run before every network read, including
  // revalidation. The browser still reuses its in-memory catalogue while typing.
  headers.set('cache-control', 'private, no-store')

  return headers
}

function jsonResponse(payload: unknown, status: number, retryAfter: string | null = null): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
      ...(retryAfter ? { 'retry-after': retryAfter } : {}),
    },
  })
}

function upstreamFailureDetails(upstream: Response): UpstreamFailureDetails {
  return {

    cfAccessDomain: upstream.headers.get('cf-access-domain'),
    cfMitigated: upstream.headers.get('cf-mitigated'),
    contentType: upstream.headers.get('content-type'),
    status: upstream.status,
  }
}

function logProxyFailure(message: string, details: Record<string, unknown>): void {
  console.error('[api/tickers/index] ' + message, details)
}

export async function proxyTickerIndex(request: Request, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Bound the entire operation, including Clerk preparation and body reading.
    // Aborting also prevents a delayed identity lookup from starting a fetch.
    return await Promise.race([
      proxyTickerIndexRequest(request, controller.signal, timeoutMs),
      new Promise<Response>((resolve) => {
        timer = setTimeout(() => {
          controller.abort()
          resolve(jsonResponse({ error: 'backend_timeout' }, 503, '30'))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function refusalStatus(status: number): number {
  return [401, 403, 429, 503].includes(status) ? status : 502
}

async function proxyTickerIndexRequest(request: Request, signal: AbortSignal, timeoutMs: number): Promise<Response> {
  let config = {
    hasBackendBaseUrl: false,
    hasCfAccessClientId: false,
    hasCfAccessClientSecret: false,
  }

  try {
    config = backendConfigSnapshot()

    if (!config.hasBackendBaseUrl) {
      return jsonResponse({ error: 'backend_unconfigured' }, 503)
    }

    const ifNoneMatch = request.headers.get('if-none-match')
    const upstream = await fetchBackendResponse('/v1/tickers/index', {
      context: TICKER_INDEX_CONTEXT,
      timeoutMs,
      init: {
        signal,
        headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : undefined,
      },
    }).catch((error) => {
      if (error instanceof BackendDataError && error.status !== null) return error
      throw error
    })

    if (upstream instanceof BackendDataError) {
      logProxyFailure('upstream rejected request', {
        hasBackendBaseUrl: config.hasBackendBaseUrl,
        hasCfAccessClientId: config.hasCfAccessClientId,
        hasCfAccessClientSecret: config.hasCfAccessClientSecret,
        status: upstream.status,
      })
      return jsonResponse({ error: 'backend_unavailable', status: upstream.status },
        refusalStatus(upstream.status!), upstream.retryAfter)
    }

    if (upstream.status === 304) {
      return new Response(null, {
        status: 304,
        headers: passthroughHeaders(upstream),
      })
    }

    const text = await upstream.text()
    if (!upstream.ok) {
      const details = upstreamFailureDetails(upstream)
      logProxyFailure('upstream unavailable', {
        hasBackendBaseUrl: config.hasBackendBaseUrl,
        hasCfAccessClientId: config.hasCfAccessClientId,
        hasCfAccessClientSecret: config.hasCfAccessClientSecret,
        ...details,
      })
      return jsonResponse(
        {
          error: details.cfAccessDomain || details.cfMitigated ? 'backend_access_denied' : 'backend_unavailable',
          status: upstream.status,
          upstreamContentType: details.contentType,
          cfAccessDomain: details.cfAccessDomain,
          cfMitigated: details.cfMitigated,
        },
        details.cfAccessDomain || details.cfMitigated ? 502 : refusalStatus(upstream.status),
        upstream.headers.get('retry-after')
      )
    }

    return new Response(text, {
      status: upstream.status,
      headers: passthroughHeaders(upstream),
    })
  } catch (error) {
    logProxyFailure('proxy failed', {
      hasBackendBaseUrl: config.hasBackendBaseUrl,
      hasCfAccessClientId: config.hasCfAccessClientId,
      hasCfAccessClientSecret: config.hasCfAccessClientSecret,
      message: error instanceof Error ? error.message : 'Unknown proxy error',
    })
    return jsonResponse({ error: 'backend_unreachable' }, 502)
  }
}
