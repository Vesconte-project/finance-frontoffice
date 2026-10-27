import 'server-only'
import { backendOriginHeaders } from './backend-origin'
import { auth } from '@clerk/nextjs/server'
import { backendErrorDetails, logBackendRequestEvent } from './backend-request-log'

export class BackendDataError extends Error {
  readonly context: string
  readonly status: number | null
  readonly retryAfter: string | null

  constructor(context: string, message: string, status: number | null = null, retryAfter: string | null = null) {
    super(message)
    this.name = 'BackendDataError'
    this.context = context
    this.status = status
    this.retryAfter = retryAfter
  }
}

export function backendBaseUrl(): string {
  const raw = process.env.BACKEND_BASE_URL || ''
  return raw.trim().replace(/\/+$/, '')
}

function backendCfAccessConfig(): {
  clientId: string
  clientSecret: string
} | null {
  const clientId = (process.env.CF_ACCESS_CLIENT_ID || '').trim()
  const clientSecret = (process.env.CF_ACCESS_CLIENT_SECRET || '').trim()

  if (!clientId && !clientSecret) return null
  if (!clientId || !clientSecret) {
    throw new BackendDataError(
      'backend.config.cloudflare_access',
      'CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must both be set or both be unset'
    )
  }

  return { clientId, clientSecret }
}

export function backendConfigSnapshot(): {
  hasBackendBaseUrl: boolean
  hasCfAccessClientId: boolean
  hasCfAccessClientSecret: boolean
} {
  const cfAccess = backendCfAccessConfig()
  return {
    hasBackendBaseUrl: (process.env.BACKEND_BASE_URL || '').trim().length > 0,
    hasCfAccessClientId: Boolean(cfAccess?.clientId),
    hasCfAccessClientSecret: Boolean(cfAccess?.clientSecret),
  }
}

export function backendHeaders(
  options: {
    includeContentType?: boolean
    headers?: HeadersInit
  } = {}
): HeadersInit {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  if (options.includeContentType) {
    headers['content-type'] = 'application/json'
  }

  const cfAccess = backendCfAccessConfig()
  if (cfAccess) {
    headers['CF-Access-Client-Id'] = cfAccess.clientId
    headers['CF-Access-Client-Secret'] = cfAccess.clientSecret
  }

  return {
    ...headers,
    ...(options.headers ?? {}),
  }
}

export async function fetchBackendJson<T>(
  path: string,
  {
    context,
    timeoutMs = 9000,
    init,
    allowEmptyBody = false,
  }: {
    context: string
    timeoutMs?: number
    init?: RequestInit & {
      next?: {
        revalidate?: number | false
        tags?: string[]
      }
    }
    allowEmptyBody?: boolean
  }
): Promise<T> {
  const response = await fetchBackendResponse(path, { context, timeoutMs, init })

  if (!response.ok) {
    throw new BackendDataError(context, `${context} failed with status ${response.status}`, response.status, response.headers.get('retry-after'))
  }

  try {
    const text = await response.text()
    if (!text.trim()) {
      if (allowEmptyBody) return null as T
      throw new Error('Empty backend response body')
    }
    return JSON.parse(text) as T
  } catch (error) {
    throw new BackendDataError(
      context,
      error instanceof Error ? error.message : 'Invalid backend JSON response',
      error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 503 : response.status
    )
  }
}

export async function fetchBackendResponse(
  path: string,
  {
    context,
    timeoutMs = 9000,
    init,
  }: {
    context: string
    timeoutMs?: number
    init?: RequestInit & {
      next?: {
        revalidate?: number | false
        tags?: string[]
      }
    }
  }
): Promise<Response> {
  const base = backendBaseUrl()
  if (!base) {
    throw new BackendDataError(context, 'BACKEND_BASE_URL is not configured')
  }

  const url = new URL(`${base}${path}`)
  const outgoing = new Headers(backendHeaders({ includeContentType: init?.body !== undefined }))
  const supplied = new Headers(init?.headers)
  // Caller input cannot select identity, Access credentials or an IP proof.
  for (const name of ['if-none-match', 'if-modified-since'])
    if (supplied.has(name)) outgoing.set(name, supplied.get(name)!)
  for (const [name,value] of Object.entries(await backendOriginHeaders(url, init?.method || 'GET')))
    outgoing.set(name,value)
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const session = await auth()
      if (session.userId) {
        const token = await session.getToken()
        if (!token) throw new BackendDataError(context, 'Backend session is unavailable', 401)
        outgoing.set('Authorization', `Bearer ${token}`)
      }
    } catch (error) {
      if (error instanceof BackendDataError) throw error
      throw new BackendDataError(context, 'Backend session is unavailable', 503)
    }
  }
  // Native fetch cancellation also covers a response body that stalls after headers.
  const deadline = AbortSignal.timeout(timeoutMs)
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline
  const startedAt = Date.now()
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      cache: 'no-store',
      next: undefined,
      headers: outgoing,
      redirect: 'error',
      signal,
    })
  } catch (error) {
    const details = backendErrorDetails(error)
    logBackendRequestEvent({
      context,
      endpoint: path,
      durationMs: Date.now() - startedAt,
      error: `${details.aborted ? 'abort: ' : ''}${details.message}`,
      status: null,
      timeout: details.timeout,
    })
    if (deadline.aborted) throw new BackendDataError(context, `${context} timed out after ${timeoutMs}ms`, 503)
    if (init?.signal?.aborted) throw init.signal.reason
    if (error instanceof BackendDataError) throw error
    throw new BackendDataError(
      context,
      error instanceof Error ? error.message : 'Unknown backend fetch failure'
    )
  }

  logBackendRequestEvent({
    context,
    endpoint: path,
    durationMs: Date.now() - startedAt,
    status: response.status,
  })

  return response
}
