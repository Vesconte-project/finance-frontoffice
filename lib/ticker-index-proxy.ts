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
  const cacheControl = upstream.headers.get('cache-control')
  const contentType = upstream.headers.get('content-type')

  if (etag) headers.set('etag', etag)
  if (cacheControl) headers.set('cache-control', cacheControl)
  if (contentType) headers.set('content-type', contentType)

  return headers
}

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
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

export async function proxyTickerIndex(request: Request): Promise<Response> {
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
      timeoutMs: 10000,
      init: {
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
      return jsonResponse({ error: 'backend_unavailable', status: upstream.status }, 502)
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
        502
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
