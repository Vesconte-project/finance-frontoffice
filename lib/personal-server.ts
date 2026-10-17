import 'server-only'
import { platformEnabled, platformSession } from './platform-server'
import { PlatformError } from './platform-client'

type PersonalOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown }

/** The active account is resolved by /me; owner is never sent to the API. */
export async function personalRequest(path: string, options: PersonalOptions = {}) {
  if (!platformEnabled()) throw new PlatformError(503)
  const { request, account } = await platformSession()
  const separator = path.includes('?') ? '&' : '?'
  return request(`${path}${separator}account_id=${encodeURIComponent(account.id)}`, options)
}

export function personalFailure(error: unknown) {
  const failure = error instanceof PlatformError ? error : new PlatformError(502)
  return Response.json({ error: failure.message }, { status: failure.status,
    headers: { 'Cache-Control': 'private, no-store',
      ...(failure.retryAfter !== null ? { 'Retry-After': String(failure.retryAfter) } : {}) } })
}
