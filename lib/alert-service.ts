import 'server-only'
import { backendBaseUrl } from './backend'
import type { SignalFlipEvent } from './signals'

export type AlertWorkPage = {
  items: Array<{ subscription_id: string; event: SignalFlipEvent }>
  next_cursor: string | null
}
export type AlertReservation = {
  id: string
  recipient_subject: string
  expires_at: string
  events: SignalFlipEvent[]
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const date = /^\d{4}-\d{2}-\d{2}$/
const direction = new Set(['bullish', 'neutral', 'bearish'])

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid alert response')
  return value as Record<string, unknown>
}
function flip(value: unknown, targetDate: string): SignalFlipEvent {
  const row = record(value)
  if (typeof row.ticker !== 'string' || !/^[A-Z0-9.^=-]{1,32}$/.test(row.ticker)
    || typeof row.signalDate !== 'string' || !date.test(row.signalDate) || row.signalDate !== targetDate
    || !direction.has(String(row.fromDirection)) || !direction.has(String(row.toDirection))
    || row.fromDirection === row.toDirection
    || !(row.conviction === null || (typeof row.conviction === 'number'
      && Number.isFinite(row.conviction) && row.conviction >= 0 && row.conviction <= 1)))
    throw new Error('Invalid alert event')
  return row as SignalFlipEvent
}

async function serviceJson(path: string, body?: unknown): Promise<unknown> {
  const token = process.env.ALERT_SERVICE_TOKEN || ''
  const base = backendBaseUrl()
  if (!/^vsa_[A-Za-z0-9_-]{43,128}$/.test(token) || !base) throw new Error('Alert service unavailable')
  const url = new URL(base)
  if (url.username || url.password || url.search || url.hash
    || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production'
      && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))))
    throw new Error('Alert service unavailable')
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const clientId = process.env.CF_ACCESS_CLIENT_ID || ''
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET || ''
  if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error('Alert service unavailable')
  if (clientId && clientSecret) {
    headers['CF-Access-Client-Id'] = clientId
    headers['CF-Access-Client-Secret'] = clientSecret
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // A separate transport deliberately never attaches the site's shared secret.
  const response = await fetch(base+path, { method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
    redirect: 'error', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('Alert service request refused')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Invalid alert response')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) {
        await reader.cancel()
        throw new Error('Alert service response too large')
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(text) as unknown
}

export async function getAlertWork(targetDate: string, cursor?: string): Promise<AlertWorkPage> {
  if (!date.test(targetDate) || (cursor !== undefined && !uuid.test(cursor))) throw new Error('Invalid alert request')
  const params = new URLSearchParams({ date: targetDate })
  if (cursor) params.set('cursor', cursor)
  const payload = record(await serviceJson(`/internal/alerts/work?${params}`))
  if (!Array.isArray(payload.items) || payload.items.length > 100
    || !(payload.next_cursor === null || (typeof payload.next_cursor === 'string' && uuid.test(payload.next_cursor))))
    throw new Error('Invalid alert work response')
  const items = payload.items.map(item => {
    const row = record(item)
    if (typeof row.subscription_id !== 'string' || !uuid.test(row.subscription_id)) throw new Error('Invalid alert work item')
    return { subscription_id: row.subscription_id, event: flip(row.event, targetDate) }
  })
  return { items, next_cursor: payload.next_cursor as string | null }
}

export async function reserveAlertWork(targetDate: string, ids: string[]): Promise<AlertReservation[]> {
  if (!date.test(targetDate) || !ids.length || ids.length > 100 || !ids.every(id => uuid.test(id)))
    throw new Error('Invalid alert reservation request')
  const payload = record(await serviceJson('/internal/alerts/reserve', { date: targetDate, subscription_ids: ids }))
  if (!Array.isArray(payload.reservations) || payload.reservations.length > ids.length)
    throw new Error('Invalid alert reservations')
  return readReservations(payload.reservations, targetDate)
}

function readReservations(values: unknown[], targetDate?: string): AlertReservation[] {
  return values.map(value => {
    const row = record(value)
    if (typeof row.id !== 'string' || !uuid.test(row.id)
      || typeof row.recipient_subject !== 'string' || !/^user_[A-Za-z0-9]{8,128}$/.test(row.recipient_subject)
      || typeof row.expires_at !== 'string' || !Number.isFinite(Date.parse(row.expires_at))
      || !Array.isArray(row.events) || !row.events.length || row.events.length > 100)
      throw new Error('Invalid alert reservation')
    return { id: row.id, recipient_subject: row.recipient_subject, expires_at: row.expires_at,
      events: row.events.map(event => flip(event, targetDate ?? record(event).signalDate as string)) }
  })
}

export async function confirmAlertDelivery(id: string): Promise<void> {
  if (!uuid.test(id)) throw new Error('Invalid alert delivery')
  const payload = record(await serviceJson(`/internal/alerts/deliveries/${id}/confirm`, {}))
  if (payload.ok !== true) throw new Error('Alert confirmation refused')
}

export async function getPendingAlertWork(cursor?: string): Promise<{ reservations: AlertReservation[]; next_cursor: string | null }> {
  if (cursor !== undefined && !uuid.test(cursor)) throw new Error('Invalid alert cursor')
  const payload = record(await serviceJson('/internal/alerts/pending'+(cursor ? '?cursor='+encodeURIComponent(cursor) : '')))
  if (!Array.isArray(payload.reservations) || payload.reservations.length > 1
    || !(payload.next_cursor === null || (typeof payload.next_cursor === 'string' && uuid.test(payload.next_cursor))))
    throw new Error('Invalid pending alerts')
  return { reservations: readReservations(payload.reservations), next_cursor: payload.next_cursor as string | null }
}
