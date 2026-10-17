import { NextRequest, NextResponse } from 'next/server'
import { getSignalFlipsOnDate } from '@/lib/signals'
import { getAllWatchlistTickers, getWatchlistSubscriptionsForTickers } from '@/lib/watchlist'
import {
  getAlertRecipients,
  recordFlipEventsDispatchedForUser,
  reserveUnsentFlipEventsForUser,
  sendSignalFlipAlertEmail,
} from '@/lib/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.SIGNAL_ALERT_CRON_TOKEN
  if (!token?.trim()) return false

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${token}`
}

function easternDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function parseTargetDate(request: NextRequest): string {
  const dateParam = request.nextUrl.searchParams.get('date')
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam
  return easternDateString()
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const targetDate = parseTargetDate(request)
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'

  const watchedTickers = await getAllWatchlistTickers()
  if (watchedTickers.length === 0) {
    return NextResponse.json({
      ok: true,
      dryRun,
      targetDate,
      message: 'No watchlist tickers found.',
      sent: 0,
      failed: 0,
      flips: [],
    })
  }

  const flips = await getSignalFlipsOnDate({
    date: targetDate,
    tickers: watchedTickers,
  })

  if (flips.length === 0) {
    return NextResponse.json({
      ok: true,
      dryRun,
      targetDate,
      message: 'No signal flips found for target date.',
      sent: 0,
      failed: 0,
      flips: [],
    })
  }

  const flippedTickers = [...new Set(flips.map((flip) => flip.ticker))]
  const subscriptions = await getWatchlistSubscriptionsForTickers(flippedTickers)

  const eventsByUser = new Map<string, typeof flips>()
  for (const subscription of subscriptions) {
    const events = flips.filter((flip) => flip.ticker === subscription.ticker)
    if (events.length === 0) continue

    const current = eventsByUser.get(subscription.userId) ?? []
    current.push(...events)
    eventsByUser.set(subscription.userId, current)
  }

  const recipients = await getAlertRecipients([...eventsByUser.keys()])

  let sent = 0
  let failed = 0
  const failures: Array<{ userId: string; error: string }> = []

  for (const recipient of recipients) {
    const candidateEvents = eventsByUser.get(recipient.userId) ?? []
    const dedupedEvents = [...new Map(candidateEvents.map((event) => [`${event.ticker}:${event.signalDate}`, event])).values()]
    if (dedupedEvents.length === 0) continue

    if (dryRun) {
      sent += 1
      continue
    }

    const sendableEvents = await reserveUnsentFlipEventsForUser({
      userId: recipient.userId,
      events: dedupedEvents,
    })

    if (sendableEvents.length === 0) continue

    const result = await sendSignalFlipAlertEmail({
      to: recipient.email,
      firstName: recipient.firstName,
      events: sendableEvents,
    })

    if (result.ok) {
      sent += 1
      await recordFlipEventsDispatchedForUser({
        userId: recipient.userId,
        events: sendableEvents,
      })
    } else {
      failed += 1
      failures.push({ userId: recipient.userId, error: result.error || 'Failed to send email.' })
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    dryRun,
    targetDate,
    flips,
    totals: {
      watchedTickers: watchedTickers.length,
      flippedTickers: flippedTickers.length,
      recipients: recipients.length,
      sent,
      failed,
    },
    failures,
  })
}
