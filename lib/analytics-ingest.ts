/**
 * Request-shape handling for the telemetry ingress.
 *
 * Kept apart from the route handler so it stays pure and unit-testable: no
 * `next/server`, no backend client, no auth.
 */

export type AnalyticsEventBody = {
  event_name?: string
  category?: string
  payload?: Record<string, unknown>
  occurred_at?: string
  timestamp?: string
  pathname?: string
  referrer?: string | null
  session_id?: string
  anonymous_id?: string
}

export type AnalyticsInsertRow = {
  event_name: string
  payload: Record<string, unknown>
  occurred_at: string
  pathname: string
  referrer: string | null
  session_id: string
  anonymous_id: string
  user_agent: string | null
}

/** Guards against a runaway client. Anything beyond this is dropped, not rejected. */
export const MAX_EVENTS_PER_REQUEST = 50

function sanitizeString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function safeIsoTimestamp(value: unknown): string {
  if (typeof value !== 'string') return new Date().toISOString()
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

/**
 * Normalizes either accepted request shape into a list of events: a single
 * envelope (the legacy shape, still sent by anything that has not reloaded) or
 * `{ events: [...] }` from the batching browser tracker.
 */
export function readEvents(body: unknown): AnalyticsEventBody[] {
  if (!body || typeof body !== 'object') return []

  const batch = (body as { events?: unknown }).events
  if (Array.isArray(batch)) {
    return batch
      .filter((entry): entry is AnalyticsEventBody => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
      .slice(0, MAX_EVENTS_PER_REQUEST)
  }

  if (typeof (body as AnalyticsEventBody).event_name === 'string') {
    return [body as AnalyticsEventBody]
  }

  return []
}

export function toInsertRow(event: AnalyticsEventBody, userAgent: string | null): AnalyticsInsertRow {
  const payload = event.payload
  return {
    event_name: sanitizeString(event.event_name, 'unknown_event'),
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    occurred_at: safeIsoTimestamp(event.occurred_at ?? event.timestamp),
    pathname: sanitizeString(event.pathname, '/'),
    referrer: typeof event.referrer === 'string' ? event.referrer : null,
    session_id: sanitizeString(event.session_id, 'unknown_session'),
    anonymous_id: sanitizeString(event.anonymous_id, 'unknown_anon'),
    user_agent: userAgent,
  }
}
