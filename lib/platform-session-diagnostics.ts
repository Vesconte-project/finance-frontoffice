import { PlatformError } from './platform-client'
import { logServerEvent } from './observability/vercel-log'

export type PlatformSessionPhase = 'identity' | 'client' | 'account_request' |
  'account_response' | 'account_validation' | 'account_selection'

/** Closed metadata only: never serialize the error, response, account or credentials. */
export function reportPlatformSessionFailure(phase: PlatformSessionPhase, error: unknown): void {
  const status = error instanceof PlatformError ? error.status : null
  // Expected authentication/access refusals are product states, not server faults.
  if (status !== null && status < 500) return
  const failure = error instanceof PlatformError ? 'platform_error'
    : error instanceof SyntaxError ? 'invalid_json' : 'unexpected_error'
  logServerEvent('platform_session_failed', { phase, status, failure }, 'error')
}
