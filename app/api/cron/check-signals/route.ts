import { NextRequest, NextResponse } from 'next/server'
import { confirmAlertDelivery, getAlertWork, getPendingAlertWork, reserveAlertWork } from '@/lib/alert-service'
import type { AlertReservation } from '@/lib/alert-service'
import { getAlertRecipients, sendSignalFlipAlertEmail } from '@/lib/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(request: NextRequest) {
  const token = process.env.SIGNAL_ALERT_CRON_TOKEN
  if (!token?.trim() || request.headers.get('authorization') !== `Bearer ${token}`)
    return reply({ ok: false, error: 'Unauthorized' }, 401)
  const targetDate = request.nextUrl.searchParams.get('date') ?? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const day = Date.parse(targetDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !Number.isFinite(day)
    || new Date(day).toISOString().slice(0, 10) !== targetDate)
    return reply({ ok: false, error: 'Invalid date' }, 400)
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  let cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  let sent = 0
  let failed = 0
  let candidates = 0
  const seen = new Set<string>()
  const deliver = async (reservations: AlertReservation[]) => {
    for (const reservation of reservations) {
      if (Date.parse(reservation.expires_at) <= Date.now()) { failed++; continue }
      const [recipient] = await getAlertRecipients([reservation.recipient_subject])
      if (!recipient || Date.parse(reservation.expires_at) <= Date.now()) { failed++; continue }
      const result = await sendSignalFlipAlertEmail({ deliveryId: reservation.id, to: recipient.email,
        firstName: recipient.firstName, events: reservation.events })
      if (!result.ok) { failed++; continue }
      sent++
      await confirmAlertDelivery(reservation.id)
    }
  }
  try {
    if (!dryRun) {
      let pendingCursor: string | undefined
      for (let page=0; page<100; page++) {
        const pending = await getPendingAlertWork(pendingCursor)
        await deliver(pending.reservations)
        if (!pending.next_cursor) break
        if (pending.next_cursor === pendingCursor || seen.has(pending.next_cursor)) throw new Error('Invalid pagination')
        seen.add(pending.next_cursor)
        pendingCursor = pending.next_cursor
        if (page===99) throw new Error('Pending batch limit exceeded')
      }
      seen.clear()
    }
    for (let page = 0; page < 100; page++) {
      const work = await getAlertWork(targetDate, cursor)
      candidates += work.items.length
      if (!dryRun && work.items.length) {
        const reservations = await reserveAlertWork(targetDate, work.items.map(item => item.subscription_id))
        // No provider user lookup, recipient address or email before reservation.
        await deliver(reservations)
      }
      if (!work.next_cursor) return reply({ ok: failed === 0, dryRun, targetDate, candidates, sent, failed })
      if (seen.has(work.next_cursor) || work.next_cursor === cursor) throw new Error('Invalid pagination')
      seen.add(work.next_cursor)
      cursor = work.next_cursor
    }
    return reply({ ok: false, dryRun, targetDate, candidates, sent, failed, nextCursor: cursor }, 503)
  } catch {
    // Counts only: recipient IDs, email addresses, events and provider errors are private.
    return reply({ ok: false, dryRun, targetDate, sent, failed, error: 'Alert service unavailable' }, 503)
  }
}
