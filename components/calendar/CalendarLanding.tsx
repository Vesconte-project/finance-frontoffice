import Link from 'next/link'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import EventCalendar from '@/components/calendar/EventCalendar'
import WeekBoard, { WeekSilhouette } from '@/components/calendar/WeekBoard'
import { buttonClass } from '@/components/ui/Button'
import { isViewerSignedIn } from '@/lib/auth'
import { getPublicCalendarRange, type CalendarResult } from '@/lib/calendar-events'
import { getCalendarNames } from '@/lib/calendar-names'
import { CALENDAR_CATEGORIES, calendarHref, humanWeek, resolveCalendarWindow, shiftDay, type CalendarCategory, type CalendarView } from '@/lib/calendar-model'
import styles from './CalendarWeek.module.css'

const copy: Record<CalendarCategory, { title: string; description: string }> = {
  all: { title: 'Events calendar', description: 'Earnings, dividends, company dates and scheduled economic releases, day by day.' },
  earnings: { title: 'Earnings calendar', description: 'Reported and scheduled company results and earnings calls where the event source identifies them.' },
  dividends: { title: 'Dividend calendar', description: 'Ex-dates and fund distributions from the event sources currently connected.' },
  company: { title: 'Company events', description: 'Investor events, corporate actions and fund rebalances beyond earnings and distributions.' },
  macro: { title: 'Economic releases', description: 'Scheduled macro data releases. Dates and times reflect the source schedule, not confirmation that a release occurred.' },
  holidays: { title: 'Country holidays', description: 'A place for verified country holiday schedules. These are distinct from exchange trading closures.' },
}

export type CalendarQuery = { view?: string; week?: string; month?: string; day?: string }

export default async function CalendarLanding({ category, query }: { category: CalendarCategory; query: CalendarQuery }) {
  const today = new Date().toISOString().slice(0, 10)
  const signedIn = await isViewerSignedIn()
  const shown = resolveCalendarWindow({ ...query, signedIn, today })
  // A locked window is never fetched: the page carries no events beyond what the viewer can read.
  const result: CalendarResult | null = shown.locked ? null : await getPublicCalendarRange(shown, category)
  const names = result ? await getCalendarNames(result.events.flatMap((event) => event.symbol ? [event.symbol] : [])) : {}

  const href = (view: CalendarView, overrides: { week?: string; month?: string; day?: string } = {}, targetCategory = category) =>
    calendarHref({ category: targetCategory, view, week: overrides.week ?? shown.week, month: overrides.month ?? shown.month, day: overrides.day })
  const viewSwitch = (
    <div className={styles.viewSwitch} aria-label="Calendar view">
      <Link href={href('week', { week: shown.view === 'month' ? (shown.month === shown.thisWeek.slice(0, 7) ? shown.thisWeek : `${shown.month}-01`) : shown.week })} aria-current={shown.view === 'week' ? 'page' : undefined}>Week</Link>
      <Link href={href('month', { month: shown.view === 'week' ? shown.week.slice(0, 7) : shown.month })} aria-current={shown.view === 'month' ? 'page' : undefined}>
        {signedIn ? null : <Lock size={13} strokeWidth={1.5} aria-hidden="true" />}Month
      </Link>
    </div>
  )

  const offer = (
    <div className={styles.offer}>
      <span className={styles.offerIcon} aria-hidden="true"><Lock size={16} strokeWidth={1.5} /></span>
      <h2 className={styles.offerTitle}>Every week, every month</h2>
      <p className={styles.offerText}>This week is open to everyone. A free account opens the weeks ahead, past weeks and the month view.</p>
      <div className={styles.offerActions}>
        <Link href={`/sign-up?redirect_url=${encodeURIComponent(href(shown.view))}`} className={buttonClass({ variant: 'primary' })} data-analytics-id="calendar_locked_sign_up" data-analytics-event="auth_start" data-analytics-intent="sign_up">Create free account</Link>
        <Link href={href('week', { week: shown.thisWeek })} className={buttonClass({ variant: 'secondary' })} data-analytics-id="calendar_locked_this_week">Back to this week</Link>
      </div>
      <p className={styles.offerSignIn}>Already a member? <Link href={`/sign-in?redirect_url=${encodeURIComponent(href(shown.view))}`} data-analytics-id="calendar_locked_sign_in" data-analytics-event="auth_start" data-analytics-intent="sign_in">Sign in</Link></p>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1560px] px-5 py-8 md:px-10 md:py-12">
      <header className="mb-10 max-w-[68ch]">
        <h1 className="text-4xl font-medium leading-tight text-[var(--text)] md:text-5xl">{copy[category].title}</h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--text-body)]">{copy[category].description}</p>
      </header>

      {shown.view === 'month' && result ? (
        <EventCalendar
          month={shown.month}
          selectedDay={query.day}
          category={category}
          events={result.events}
          names={names}
          scope="global"
          basePath="/calendar"
          extraParams={{ view: 'month' }}
          toolbarExtra={viewSwitch}
          available={result.available}
          reason={result.reason}
          unavailableDomains={result.unavailableDomains}
          truncated={result.truncated}
        />
      ) : (
        <section className={styles.calendar} aria-label="Event calendar">
          <div className={styles.toolbar}>
            <div>
              <h2>{shown.view === 'month' ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${shown.month}-01T12:00:00Z`)) : humanWeek(shown.week)}</h2>
              <p>
                {shown.week === shown.thisWeek && shown.view === 'week' ? 'This week' : null}
                {result ? `${shown.week === shown.thisWeek ? ' · ' : ''}${result.events.length} ${result.events.length === 1 ? 'event' : 'events'}` : null}
                {!result ? 'Available with a free account' : null}
              </p>
            </div>
            <div className={styles.controls}>
              {viewSwitch}
              <div className={styles.stepper} aria-label="Change week">
                <Link href={href('week', { week: shiftDay(shown.week, -7) })} aria-label="Previous week"><ArrowLeft size={17} strokeWidth={1.5} /></Link>
                <Link href={href('week', { week: shown.thisWeek })}>This week</Link>
                <Link href={href('week', { week: shiftDay(shown.week, 7) })} aria-label="Next week"><ArrowRight size={17} strokeWidth={1.5} /></Link>
              </div>
            </div>
          </div>

          <nav className={styles.categories} aria-label="Event type">
            {CALENDAR_CATEGORIES.map((item) => (
              <Link key={item.key} href={href(shown.view, {}, item.key)} aria-current={item.key === category ? 'page' : undefined}>{item.label}</Link>
            ))}
          </nav>

          {result && result.unavailableDomains.length > 0 && result.available ? (
            <p className={styles.coverage}>Partial coverage: some event sources are unavailable for this week.</p>
          ) : null}
          {result?.truncated ? <p className={styles.coverage}>Showing the first 500 events. Narrow the event type to see more.</p> : null}

          {result ? (
            <WeekBoard week={shown.week} today={today} events={result.events} names={names} category={category} available={result.available} reason={result.reason} />
          ) : (
            <WeekSilhouette>{offer}</WeekSilhouette>
          )}

          {result && !signedIn ? (
            <p className={styles.openNote}>
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Other weeks and the month view open with a free account.</span>
              <Link href={`/sign-up?redirect_url=${encodeURIComponent(href('week'))}`} data-analytics-id="calendar_week_sign_up" data-analytics-event="auth_start" data-analytics-intent="sign_up">Create free account</Link>
            </p>
          ) : null}
        </section>
      )}
    </div>
  )
}
