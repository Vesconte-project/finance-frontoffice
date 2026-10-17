/** Anonymous telemetry stays in the frontend; only verified sessions may persist in /v1. */
import { NextResponse } from 'next/server'
import { personalRequest } from '@/lib/personal-server'
import { getViewerUserId } from '@/lib/auth'
import { readEvents, toInsertRow, type AnalyticsInsertRow } from '@/lib/analytics-ingest'
import { logServerEvent, logTelemetryEvent } from '@/lib/observability/vercel-log'

function errorMessage(error: unknown): string {
  void error
  return 'Authenticated analytics forwarding unavailable.'
}

async function forwardToBackend(rows: AnalyticsInsertRow[]): Promise<void> {
  for (const row of rows) {
    // Browser identifiers/user agent remain in frontend telemetry, never owners.
    const { event_name, payload, occurred_at, pathname, referrer } = row
    await personalRequest('/analytics/events', { method: 'POST',
      body: { event_name, payload, occurred_at, pathname, referrer } })
  }
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
  // Optional session. Anonymous events are logged locally and never forwarded.
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
    if (viewerId) await forwardToBackend(rows)
  } catch (error) {
    logServerEvent('analytics_forward_failed', { error: errorMessage(error) }, 'error')
  }

  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
}
