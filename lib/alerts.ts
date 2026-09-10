import { clerkClient } from '@clerk/nextjs/server'
import { fetchBackendJson } from '@/lib/backend'
import type { SignalFlipEvent } from '@/lib/signals'

type AlertRecipient = {
  userId: string
  email: string
  firstName: string | null
}

async function backendJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await fetchBackendJson<T>(path, {
      context: `backend.alerts${path}`,
      init,
      allowEmptyBody: true,
    })
  } catch {
    return null
  }
}

function directionLabel(direction: 'bullish' | 'neutral' | 'bearish'): string {
  if (direction === 'bullish') return 'BULLISH'
  if (direction === 'bearish') return 'BEARISH'
  return 'NEUTRAL'
}

function formatConviction(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(0)}%`
}

function resolvePrimaryEmail(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null
  const typed = user as {
    primaryEmailAddressId?: string | null
    emailAddresses?: Array<{ id?: string; emailAddress?: string }>
  }
  const addresses = Array.isArray(typed.emailAddresses) ? typed.emailAddresses : []
  const primaryId = typed.primaryEmailAddressId ?? null
  const primary = primaryId ? addresses.find((item) => item.id === primaryId)?.emailAddress : null
  if (primary && primary.trim()) return primary.trim()
  const fallback = addresses[0]?.emailAddress
  return fallback?.trim() || null
}

export async function getAlertRecipients(userIds: string[]): Promise<AlertRecipient[]> {
  const uniqueUserIds = [...new Set(userIds.map((userId) => userId.trim()).filter(Boolean))]
  if (uniqueUserIds.length === 0) return []
  const client = await clerkClient()
  const recipients: AlertRecipient[] = []
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const user = await client.users.getUser(userId)
        const email = resolvePrimaryEmail(user)
        if (!email) return
        recipients.push({
          userId,
          email,
          firstName: typeof user.firstName === 'string' ? user.firstName : null,
        })
      } catch {
        // Ignore users no longer in Clerk.
      }
    })
  )
  return recipients
}

export async function reserveUnsentFlipEventsForUser({
  userId,
  events,
}: {
  userId: string
  events: SignalFlipEvent[]
}): Promise<SignalFlipEvent[]> {
  if (events.length === 0) return []
  const payload = await backendJson<{ events?: SignalFlipEvent[] }>('/site/alerts/reserve', {
    method: 'POST',
    body: JSON.stringify({ userId, events }),
  })
  return Array.isArray(payload?.events) ? payload!.events : events
}

export async function recordFlipEventsDispatchedForUser({
  userId,
  events,
}: {
  userId: string
  events: SignalFlipEvent[]
}): Promise<void> {
  if (events.length === 0) return
  await backendJson('/site/alerts/record', {
    method: 'POST',
    body: JSON.stringify({ userId, events }),
  })
}

export async function sendSignalFlipAlertEmail({
  to,
  firstName,
  events,
}: {
  to: string
  firstName?: string | null
  events: SignalFlipEvent[]
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.SIGNAL_ALERT_FROM_EMAIL

  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is missing.' }
  if (!from) return { ok: false, error: 'SIGNAL_ALERT_FROM_EMAIL is missing.' }
  if (events.length === 0) return { ok: true }

  const headline =
    events.length === 1
      ? `${events[0]?.ticker ?? 'Signal'} flipped to ${directionLabel(events[0]?.toDirection ?? 'neutral')}`
      : `${events.length} tracked signals flipped today`

  const subject = `Signal Alert: ${headline}`

  const rowsHtml = events
    .map((event) => {
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${event.ticker}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${directionLabel(event.fromDirection)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${directionLabel(event.toDirection)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${formatConviction(event.conviction)}</td>
      </tr>`
    })
    .join('')

  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const html = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;">
      <p>${greeting}</p>
      <p>One or more of your watched assets had a model signal flip.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #d1d5db;">Ticker</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #d1d5db;">From</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #d1d5db;">To</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #d1d5db;">Conviction</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top:16px;">Review details in Today: <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard">Vesconte Today</a></p>
    </div>
  `

  const textRows = events
    .map((event) => `${event.ticker}: ${directionLabel(event.fromDirection)} -> ${directionLabel(event.toDirection)} (${formatConviction(event.conviction)})`)
    .join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text: `${headline}\n\n${textRows}`,
    }),
  })

  if (response.ok) return { ok: true }
  const detail = await response.text().catch(() => '')
  return { ok: false, error: detail || `Resend error ${response.status}` }
}
