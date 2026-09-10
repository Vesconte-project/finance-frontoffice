'use client'

import {
  isAnalyticsEventName,
  normalizePayload,
  truncate,
  type AnalyticsEventName,
  type AnalyticsPayload,
} from '@/lib/analytics-events'

export type { AnalyticsEventName, AnalyticsPayload }

const INGEST_PATH = '/api/analytics/event'

type AnalyticsEnvelope = {
  event_name: AnalyticsEventName
  payload: AnalyticsPayload
  occurred_at: string
  timestamp: string
  pathname: string
  referrer: string | null
  session_id: string
  anonymous_id: string
}

declare global {
  interface Window {
    __vesconteAnalyticsQueue?: AnalyticsEnvelope[]
    __vesconteTelemetryInstalled?: boolean
  }
}

const ANON_KEY = 'vesconte_analytics_anon_v1'
const SESSION_KEY = 'vesconte_analytics_session_v1'
const SESSION_TOUCH_KEY = 'vesconte_analytics_session_touched_v1'
const DEBUG_KEY = 'vesconte_analytics_debug'

/** A session ends after this much inactivity, matching common analytics convention. */
const SESSION_IDLE_MS = 30 * 60 * 1000

/** Batching keeps one Vercel function invocation from being spent per click. */
const BATCH_MAX_EVENTS = 20
const BATCH_FLUSH_DELAY_MS = 1500

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private browsing and blocked storage both land here. Ids stay in-memory.
  }
}

const memoryIds: Record<string, string> = {}

function getOrCreateStorageId(key: string, prefix: string): string {
  const existing = readStorage(key)
  if (existing && existing.length > 0) return existing
  if (memoryIds[key]) return memoryIds[key]

  const created = makeId(prefix)
  memoryIds[key] = created
  writeStorage(key, created)
  return created
}

/** Refresh the activity stamp at most this often, not on every single event. */
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000

let lastTouchWrite = 0

function getSessionId(): string {
  const now = Date.now()
  const touchedRaw = readStorage(SESSION_TOUCH_KEY)
  const touched = touchedRaw ? Number.parseInt(touchedRaw, 10) : Number.NaN
  const expired = !Number.isFinite(touched) || now - touched > SESSION_IDLE_MS

  if (expired) {
    const fresh = makeId('sess')
    memoryIds[SESSION_KEY] = fresh
    writeStorage(SESSION_KEY, fresh)
    writeStorage(SESSION_TOUCH_KEY, String(now))
    lastTouchWrite = now
    return fresh
  }

  if (now - lastTouchWrite > SESSION_TOUCH_INTERVAL_MS) {
    writeStorage(SESSION_TOUCH_KEY, String(now))
    lastTouchWrite = now
  }

  return getOrCreateStorageId(SESSION_KEY, 'sess')
}

function buildEnvelope(eventName: AnalyticsEventName, payload: AnalyticsPayload): AnalyticsEnvelope {
  const timestamp = new Date().toISOString()
  return {
    event_name: eventName,
    payload: normalizePayload(payload),
    occurred_at: timestamp,
    timestamp,
    pathname: window.location.pathname,
    referrer: document.referrer || null,
    session_id: getSessionId(),
    anonymous_id: getOrCreateStorageId(ANON_KEY, 'anon'),
  }
}

function analyticsDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const debugParam = new URL(window.location.href).searchParams.get('analytics_debug')
    if (debugParam === '1') {
      writeStorage(DEBUG_KEY, '1')
      return true
    }
    if (debugParam === '0') {
      try {
        window.localStorage.removeItem(DEBUG_KEY)
      } catch {
        // Ignore storage failures.
      }
    }
  } catch {
    // Ignore URL parsing failures.
  }

  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === '1') return true

  const stored = readStorage(DEBUG_KEY)
  return stored === '1' || stored === 'true'
}

let pending: AnalyticsEnvelope[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function post(body: string, preferBeacon: boolean): void {
  if (preferBeacon) {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        if (navigator.sendBeacon(INGEST_PATH, blob)) return
      }
    } catch {
      // Fall through to fetch keepalive.
    }
  }

  void fetch(INGEST_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics failures never surface in product flows.
  })
}

/** Sends everything queued so far. Called on a timer, on batch fill, and on page hide. */
export function flushAnalytics(preferBeacon = true): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (pending.length === 0) return

  const batch = pending
  pending = []
  post(JSON.stringify({ events: batch }), preferBeacon)
}

function scheduleFlush(): void {
  if (pending.length >= BATCH_MAX_EVENTS) {
    flushAnalytics(false)
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(() => flushAnalytics(false), BATCH_FLUSH_DELAY_MS)
}

export function trackEvent(eventName: AnalyticsEventName, payload: AnalyticsPayload = {}): void {
  if (typeof window === 'undefined') return

  let envelope: AnalyticsEnvelope
  try {
    envelope = buildEnvelope(eventName, payload)
  } catch {
    return
  }

  if (analyticsDebugEnabled()) {
    console.info('[analytics:event]', envelope)
  }

  window.__vesconteAnalyticsQueue = window.__vesconteAnalyticsQueue ?? []
  window.__vesconteAnalyticsQueue.push(envelope)
  // Keep the debug mirror bounded so a long session cannot grow without limit.
  if (window.__vesconteAnalyticsQueue.length > 200) {
    window.__vesconteAnalyticsQueue.splice(0, window.__vesconteAnalyticsQueue.length - 200)
  }

  pending.push(envelope)
  scheduleFlush()
}

// ---------------------------------------------------------------------------
// Named helpers. Call sites read better than a bare trackEvent everywhere.
// ---------------------------------------------------------------------------

export function trackPageView(payload: AnalyticsPayload = {}): void {
  trackEvent('page_view', payload)
}

/**
 * How the current navigation started.
 *
 * `instrumentation-client.ts` records it as the router transition begins;
 * `AnalyticsProvider` consumes it when the route commits, so one navigation
 * yields exactly one `page_view` that knows whether it came from a link, a
 * replace, or the back button. Recording it as its own event instead would
 * double-count every link click the delegated capture already sees.
 */
type NavigationType = 'push' | 'replace' | 'traverse' | 'initial'

let pendingNavigationType: NavigationType | null = null

export function recordNavigationType(type: NavigationType): void {
  pendingNavigationType = type
}

export function consumeNavigationType(): NavigationType {
  const type = pendingNavigationType ?? 'initial'
  pendingNavigationType = null
  return type
}

/** A discrete product capability being used, as opposed to a raw DOM click. */
export function trackFeature(feature: string, payload: AnalyticsPayload = {}): void {
  trackEvent('feature_use', { feature, ...payload })
}

export function trackClick(
  control: string,
  payload: AnalyticsPayload = {},
  eventName: AnalyticsEventName = 'button_click'
): void {
  trackEvent(eventName, { control, ...payload })
}

/** A wall the user hit: an error, an empty result, a gated or unavailable surface. */
export function trackState(
  eventName: Extract<
    AnalyticsEventName,
    'error_shown' | 'empty_state_shown' | 'unavailable_shown' | 'upgrade_prompt_shown'
  >,
  payload: AnalyticsPayload = {}
): void {
  trackEvent(eventName, payload)
}

// ---------------------------------------------------------------------------
// Site-wide automatic capture.
// ---------------------------------------------------------------------------

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], summary, input[type="submit"], input[type="button"]'

function elementLabel(element: Element): string {
  const explicit = element.getAttribute('data-analytics-id')
  if (explicit) return truncate(explicit, 80)

  const aria = element.getAttribute('aria-label')
  if (aria) return truncate(aria.trim(), 80)

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const target = document.getElementById(labelledBy.split(/\s+/)[0])
    const text = target?.textContent?.trim()
    if (text) return truncate(text, 80)
  }

  const text = (element as HTMLElement).innerText?.trim() || element.textContent?.trim()
  if (text) return truncate(text.replace(/\s+/g, ' '), 80)

  const title = element.getAttribute('title')
  if (title) return truncate(title.trim(), 80)

  const name = element.getAttribute('name') || element.getAttribute('id')
  if (name) return truncate(name, 80)

  return `${element.tagName.toLowerCase()}:unlabelled`
}

/**
 * The nearest declared region, so a click can be attributed to the part of the
 * page it came from without every control naming its own context.
 */
function elementSurface(element: Element): string | undefined {
  const surface = element.closest('[data-analytics-surface]')
  const declared = surface?.getAttribute('data-analytics-surface')
  if (declared) return truncate(declared, 64)

  const section = element.closest('section[id], [data-section], nav, header, footer, dialog')
  if (!section) return undefined
  const id = section.getAttribute('data-section') || section.getAttribute('id')
  if (id) return truncate(id, 64)
  return section.tagName.toLowerCase()
}

/** Extra `data-analytics-*` attributes on the control become payload fields. */
function datasetPayload(element: Element): AnalyticsPayload {
  const out: AnalyticsPayload = {}
  for (const attr of Array.from(element.attributes)) {
    if (!attr.name.startsWith('data-analytics-')) continue
    const key = attr.name.slice('data-analytics-'.length)
    if (key === 'id' || key === 'event' || key === 'surface' || key === '') continue
    out[key.replace(/-/g, '_')] = truncate(attr.value, 120)
  }
  return out
}

function isExternalHref(href: string): boolean {
  if (/^(mailto:|tel:)/i.test(href)) return true
  try {
    return new URL(href, window.location.href).origin !== window.location.origin
  } catch {
    return false
  }
}

function resolveEventName(element: Element, isLink: boolean, href: string | null): AnalyticsEventName {
  // A declared name is honoured only if it is part of the shared vocabulary,
  // so a stray attribute cannot invent an event series.
  const declared = element.getAttribute('data-analytics-event')
  if (isAnalyticsEventName(declared)) return declared
  if (element.getAttribute('role') === 'tab') return 'tab_change'
  if (element.getAttribute('role') === 'switch') return 'toggle_change'
  if (isLink && href && isExternalHref(href)) return 'outbound_click'
  if (isLink && element.closest('nav, header, footer')) return 'nav_click'
  if (isLink) return 'link_click'
  return 'button_click'
}

function handleDelegatedClick(event: MouseEvent): void {
  try {
    const target = event.target
    if (!(target instanceof Element)) return

    const control = target.closest(INTERACTIVE_SELECTOR)
    if (!control) return
    if (control.getAttribute('data-analytics-ignore') !== null) return
    if (control.closest('[data-analytics-ignore]')) return

    const href = control.getAttribute('href')
    const isLink = control.tagName === 'A' && Boolean(href)
    const eventName = resolveEventName(control, isLink, href)

    const payload: AnalyticsPayload = {
      control: elementLabel(control),
      surface: elementSurface(control),
      element: control.tagName.toLowerCase(),
      ...datasetPayload(control),
    }

    if (isLink && href) {
      payload.href = truncate(href, 256)
      payload.external = isExternalHref(href)
    }

    const pressed = control.getAttribute('aria-pressed') ?? control.getAttribute('aria-checked')
    if (pressed !== null) payload.pressed = pressed === 'true'

    const expanded = control.getAttribute('aria-expanded')
    if (expanded !== null) payload.expanded = expanded === 'true'

    trackEvent(eventName, payload)
  } catch {
    // A capture failure must never break the click it was observing.
  }
}

function handleSubmit(event: Event): void {
  try {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    if (form.closest('[data-analytics-ignore]')) return

    trackEvent('form_submit', {
      control: form.getAttribute('data-analytics-id') || form.getAttribute('name') || form.id || 'form',
      surface: elementSurface(form),
      method: form.method || 'get',
    })
  } catch {
    // Ignore.
  }
}

function handleClientError(event: ErrorEvent): void {
  trackEvent('client_error', {
    message: truncate(event.message || 'unknown_error', 240),
    source: truncate(event.filename || '', 200),
    line: Number.isFinite(event.lineno) ? event.lineno : null,
  })
}

function handleRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason
  const message =
    reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'unhandled_rejection'
  trackEvent('client_error', { message: truncate(message, 240), kind: 'unhandled_rejection' })
}

/**
 * Installs the delegated capture once per document. Runs from
 * `instrumentation-client.ts`, which executes before hydration, so clicks are
 * observed even on routes that render no client component of their own.
 */
export function installGlobalTelemetry(): void {
  if (typeof window === 'undefined') return
  if (window.__vesconteTelemetryInstalled) return
  window.__vesconteTelemetryInstalled = true

  // Capture phase, so a handler that stops propagation cannot hide the click.
  document.addEventListener('click', handleDelegatedClick, { capture: true, passive: true })
  document.addEventListener('submit', handleSubmit, { capture: true, passive: true })
  window.addEventListener('error', handleClientError)
  window.addEventListener('unhandledrejection', handleRejection)

  // pagehide is the reliable end-of-page signal on mobile Safari; visibilitychange
  // covers tab switches, where the page may never fire pagehide at all.
  window.addEventListener('pagehide', () => flushAnalytics(true))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAnalytics(true)
  })
}
