/**
 * Shared telemetry vocabulary.
 *
 * This module is deliberately free of client or server directives so the
 * browser tracker, the ingest route, and the tests can all agree on one set of
 * names. Adding a name here is the only supported way to introduce an event.
 */

export const ANALYTICS_EVENT_NAMES = [
  // Navigation and page lifecycle.
  'page_view',
  'nav_click',
  'outbound_click',
  'web_vitals',

  // Generic interaction, emitted by the delegated click capture.
  'button_click',
  'link_click',
  'tab_change',
  'toggle_change',
  'form_submit',

  // Feature usage.
  'feature_use',
  'search_query',
  'search_result_select',
  'ticker_open',
  'watchlist_add',
  'watchlist_remove',
  'export_download',
  'filter_apply',
  'sort_change',
  'retry_click',
  'auth_start',

  // State surfaces worth counting because they mean the user hit a wall.
  'error_shown',
  'empty_state_shown',
  'unavailable_shown',
  'upgrade_prompt_shown',
  'client_error',

  // Pre-existing named events. Kept verbatim so historical series stay joinable.
  'view_homepage',
  'view_pricing',
  'view_about',
  'click_sample_model',
  'view_stock',
  'click_stock_from_screener',
  'view_model',
  'click_modify_model',
  'run_validation',
  'create_model',
  'apply_template',
  'click_compare',
  'complete_compare',
  'use_screener',
  'apply_bias_filter',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]

const EVENT_NAME_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENT_NAMES)

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && EVENT_NAME_SET.has(value)
}

/**
 * Every event carries a category so Vercel Runtime Logs can be filtered down to
 * one kind of usage without knowing the individual event names.
 */
export type AnalyticsCategory = 'page' | 'navigation' | 'interaction' | 'feature' | 'state' | 'performance'

const CATEGORY_BY_EVENT: Partial<Record<AnalyticsEventName, AnalyticsCategory>> = {
  page_view: 'page',
  view_homepage: 'page',
  view_pricing: 'page',
  view_about: 'page',
  view_stock: 'page',
  view_model: 'page',

  nav_click: 'navigation',
  outbound_click: 'navigation',
  link_click: 'navigation',
  click_stock_from_screener: 'navigation',
  ticker_open: 'navigation',
  search_result_select: 'navigation',

  web_vitals: 'performance',

  button_click: 'interaction',
  tab_change: 'interaction',
  toggle_change: 'interaction',
  form_submit: 'interaction',
  retry_click: 'interaction',
  click_sample_model: 'interaction',
  click_modify_model: 'interaction',
  click_compare: 'interaction',

  error_shown: 'state',
  empty_state_shown: 'state',
  unavailable_shown: 'state',
  upgrade_prompt_shown: 'state',
  client_error: 'state',
}

export function analyticsCategory(eventName: string): AnalyticsCategory {
  if (isAnalyticsEventName(eventName)) {
    return CATEGORY_BY_EVENT[eventName] ?? 'feature'
  }
  return 'feature'
}

export type AnalyticsPayloadValue = string | number | boolean | null | undefined
export type AnalyticsPayload = Record<string, AnalyticsPayloadValue>

/** Vercel truncates a runtime log line at 4KB, so payloads are capped well below that. */
export const ANALYTICS_MAX_PAYLOAD_KEYS = 24
export const ANALYTICS_MAX_STRING_LENGTH = 256

export function truncate(value: string, max: number = ANALYTICS_MAX_STRING_LENGTH): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

/**
 * Drops undefined values, clamps strings, and caps key count so a single event
 * can never blow the runtime-log line budget.
 */
export function normalizePayload(payload: unknown): Record<string, AnalyticsPayloadValue> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}

  const out: Record<string, AnalyticsPayloadValue> = {}
  let keys = 0

  for (const [key, raw] of Object.entries(payload as Record<string, unknown>)) {
    if (keys >= ANALYTICS_MAX_PAYLOAD_KEYS) break
    if (raw === undefined) continue

    if (raw === null) {
      out[key] = null
    } else if (typeof raw === 'string') {
      out[key] = truncate(raw)
    } else if (typeof raw === 'number') {
      out[key] = Number.isFinite(raw) ? raw : null
    } else if (typeof raw === 'boolean') {
      out[key] = raw
    } else {
      continue
    }
    keys += 1
  }

  return out
}
