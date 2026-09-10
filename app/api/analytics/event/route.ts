/**
 * Telemetry ingress.
 *
 * Two jobs, in this order of importance:
 *   1. Emit one structured JSON line per event so page, feature, and button
 *      usage is queryable in Vercel Runtime Logs and in any Log Drain. This is
 *      the durable record and it runs first, so a backend outage never costs a
 *      usage log.
 *   2. Best-effort forward to `finance-backend` for product analytics, exactly
 *      as before. Failures are swallowed and reported as 204.
 *
 * Accepts a single envelope (legacy shape) or `{ events: [...] }` (batched by
 * the browser tracker). Both are answered the same way.
 */

import { NextResponse } from 'next/server'
import { backendBaseUrl, backendHeaders } from '@/lib/backend'
import { getViewerUserId } from '@/lib/auth'
import { readEvents, toInsertRow, type AnalyticsInsertRow } from '@/lib/analytics-ingest'
import { logServerEvent, logTelemetryEvent } from '@/lib/observability/vercel-log'

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function forwardToBackend(rows: AnalyticsInsertRow[]): Promise<void> {
  const base = backendBaseUrl()
  if (!base) return

  await Promise.all(
    rows.map(async (row) => {
      try {
        const upstream = await fetch(`${base}/site/analytics/events`, {
          method: 'POST',
          headers: backendHeaders({ includeContentType: true }),
          body: JSON.stringify(row),
          cache: 'no-store',
        })

        // 404/405 means the backend has not shipped the endpoint yet. That is a
        // documented fail-open state, not an error worth alerting on.
        if (upstream.ok || upstream.status === 404 || upstream.status === 405) return

        logServerEvent(
          'analytics_upstream_rejected',
          { event: row.event_name, path: row.pathname, status: upstream.status },
          'warn'
        )
      } catch (error) {
        logServerEvent(
          'analytics_upstream_failed',
          { event: row.event_name, path: row.pathname, error: errorMessage(error) },
          'error'
        )
      }
    })
  )
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const events = readEvents(body)
  if (events.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_events' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent')
  // Opportunistic: the telemetry route is not matched by Clerk middleware, so
  // this resolves to null today and starts attributing automatically if that
  // ever changes. It never throws.
  const viewerId = await getViewerUserId()
  const rows = events.map((event) => toInsertRow(event, userAgent))

  // The Vercel log is written first and unconditionally.
  for (const row of rows) {
    logTelemetryEvent({
      eventName: row.event_name,
      payload: row.payload,
      occurredAt: row.occurred_at,
      pathname: row.pathname,
      referrer: row.referrer,
      sessionId: row.session_id,
      anonymousId: row.anonymous_id,
      userAgent: row.user_agent,
      viewerId,
      level: row.event_name === 'client_error' ? 'warn' : 'info',
    })
  }

  try {
    await forwardToBackend(rows)
  } catch (error) {
    logServerEvent('analytics_forward_failed', { error: errorMessage(error) }, 'error')
  }

  return new NextResponse(null, { status: 204 })
}
