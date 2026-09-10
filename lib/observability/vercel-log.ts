/**
 * Structured logging for Vercel Runtime Logs.
 *
 * Vercel captures `console.log`/`warn`/`error` from functions and parses any
 * line that is a single JSON object, promoting each top-level field into a
 * filterable column in the Runtime Logs view and in any configured Log Drain.
 * So the contract here is narrow and worth keeping:
 *
 *   1. One event is one line. Never pretty-print, never log an array.
 *   2. Top-level fields only, flat and stable, because nesting is what you end
 *      up unable to filter on later.
 *   3. Stay under the 4KB per-line budget or the line is truncated and stops
 *      parsing as JSON at all.
 *
 * Nothing here throws. Telemetry must never take down a product path.
 */

import {
  analyticsCategory,
  normalizePayload,
  truncate,
  type AnalyticsPayloadValue,
} from '../analytics-events'

/** Vercel truncates at 4KB. Leave headroom for the platform's own envelope. */
const MAX_LOG_LINE_BYTES = 3500

/** Prefix that makes every telemetry line greppable in the Vercel log search box. */
export const TELEMETRY_LOG_PREFIX = 'vesconte.telemetry'

export type TelemetryLevel = 'info' | 'warn' | 'error'

export type TelemetryEventInput = {
  eventName: string
  payload?: Record<string, unknown>
  occurredAt: string
  pathname: string
  referrer?: string | null
  sessionId: string
  anonymousId: string
  userAgent?: string | null
  viewerId?: string | null
  level?: TelemetryLevel
}

export type TelemetryLogLine = {
  msg: string
  logger: string
  level: TelemetryLevel
  event: string
  category: string
  path: string
  route?: string
  referrer?: string
  sessionId: string
  anonymousId: string
  viewerId?: string
  occurredAt: string
  loggedAt: string
  env: string
  deploymentId?: string
  region?: string
  commit?: string
  branch?: string
  ua?: string
} & Record<string, AnalyticsPayloadValue | undefined>

/**
 * Collapses `/stocks/AAPL/financials/income` to `/stocks/[ticker]/financials/[statement]`
 * so per-route usage aggregates instead of fanning out into one row per ticker.
 * The concrete path is still logged separately as `path`.
 */
export function routePattern(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return '/'

  const patterned = segments.map((segment, index) => {
    const previous = segments[index - 1]
    if (previous === 'stocks' && index === 1) return '[ticker]'
    if (previous === 'models' && /^[0-9a-f-]{6,}$/i.test(segment)) return '[id]'
    if (previous === 'research' || previous === 'ai-research') return '[id]'
    if (previous === 'financials' && index === segments.length - 1) return '[statement]'
    // Anything that is mostly digits, or a long opaque id, is a parameter.
    if (/^\d+$/.test(segment)) return '[id]'
    if (segment.length > 24 && !segment.includes('-')) return '[id]'
    return segment
  })

  return `/${patterned.join('/')}`
}

function deploymentContext() {
  return {
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || undefined,
    region: process.env.VERCEL_REGION || undefined,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || undefined,
    branch: process.env.VERCEL_GIT_COMMIT_REF || undefined,
  }
}

function dropUndefined<T extends Record<string, unknown>>(input: T): T {
  for (const key of Object.keys(input)) {
    if (input[key] === undefined) delete input[key]
  }
  return input
}

/**
 * Serializes a line, shedding payload fields from the end until it fits the
 * runtime-log budget. A truncated line stops being parseable JSON, so shedding
 * fields is strictly better than letting Vercel cut the string.
 */
export function serializeLogLine(line: TelemetryLogLine): string {
  let candidate = JSON.stringify(line)
  if (Buffer.byteLength(candidate, 'utf8') <= MAX_LOG_LINE_BYTES) return candidate

  const reserved = new Set([
    'msg',
    'logger',
    'level',
    'event',
    'category',
    'path',
    'route',
    'sessionId',
    'anonymousId',
    'occurredAt',
    'loggedAt',
    'env',
  ])
  const droppable = Object.keys(line).filter((key) => !reserved.has(key))

  const working: Record<string, unknown> = { ...line }
  while (droppable.length > 0 && Buffer.byteLength(candidate, 'utf8') > MAX_LOG_LINE_BYTES) {
    const key = droppable.pop() as string
    delete working[key]
    working.truncated = true
    candidate = JSON.stringify(working)
  }

  return candidate
}

export function buildTelemetryLogLine(input: TelemetryEventInput): TelemetryLogLine {
  const payload = normalizePayload(input.payload)
  const category = analyticsCategory(input.eventName)
  const path = truncate(input.pathname || '/', 512)

  const line: TelemetryLogLine = {
    // `msg` is what shows in the collapsed row in the Vercel log list.
    msg: `${TELEMETRY_LOG_PREFIX} ${input.eventName} ${routePattern(path)}`,
    logger: TELEMETRY_LOG_PREFIX,
    level: input.level ?? 'info',
    event: truncate(input.eventName, 64),
    category,
    path,
    route: routePattern(path),
    referrer: input.referrer ? truncate(input.referrer, 512) : undefined,
    sessionId: truncate(input.sessionId, 64),
    anonymousId: truncate(input.anonymousId, 64),
    viewerId: input.viewerId ? truncate(input.viewerId, 64) : undefined,
    occurredAt: input.occurredAt,
    loggedAt: new Date().toISOString(),
    ua: input.userAgent ? truncate(input.userAgent, 256) : undefined,
    ...deploymentContext(),
  }

  // Payload fields are promoted to the top level so each one is filterable.
  // The `p_` prefix is what keeps them from ever shadowing an envelope field,
  // so a payload key named `path` or `level` is kept rather than dropped.
  for (const [key, value] of Object.entries(payload)) {
    const field = `p_${key}`
    if (field in line) continue
    line[field] = value
  }

  return dropUndefined(line) as TelemetryLogLine
}

/**
 * Emits one parseable JSON line to stdout/stderr for Vercel Runtime Logs.
 * Safe to call from any server context; failures are swallowed.
 */
export function logTelemetryEvent(input: TelemetryEventInput): void {
  try {
    const line = buildTelemetryLogLine(input)
    const serialized = serializeLogLine(line)

    if (line.level === 'error') {
      console.error(serialized)
    } else if (line.level === 'warn') {
      console.warn(serialized)
    } else {
      console.log(serialized)
    }
  } catch {
    // Telemetry never interrupts a product path.
  }
}

/**
 * Structured server-side log for anything that is not a user-usage event:
 * upstream failures, request errors, cron outcomes.
 */
export function logServerEvent(
  event: string,
  fields: Record<string, unknown> = {},
  level: TelemetryLevel = 'info'
): void {
  try {
    const line = dropUndefined({
      msg: `vesconte.server ${event}`,
      logger: 'vesconte.server',
      level,
      event: truncate(event, 64),
      loggedAt: new Date().toISOString(),
      ...deploymentContext(),
      ...normalizePayload(fields),
    })

    const serialized = serializeLogLine(line as TelemetryLogLine)
    if (level === 'error') console.error(serialized)
    else if (level === 'warn') console.warn(serialized)
    else console.log(serialized)
  } catch {
    // Telemetry never interrupts a product path.
  }
}
