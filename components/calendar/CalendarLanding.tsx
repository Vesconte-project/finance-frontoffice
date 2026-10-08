import Link from 'next/link'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import EventCalendar from '@/components/calendar/EventCalendar'
import WeekBoard, { WeekSilhouette } from '@/components/calendar/WeekBoard'
import RankingsUniverse from '@/components/picks/RankingsUniverse'
import { buttonClass } from '@/components/ui/Button'
import { isViewerSignedIn } from '@/lib/auth'
import { getPublicCalendarRange, type CalendarResult } from '@/lib/calendar-events'
import { getCalendarNames } from '@/lib/calendar-names'
import { CALENDAR_CATEGORIES, calendarHref, humanWeek, resolveCalendarWindow, shiftDay, shiftMonth, type CalendarCategory, type CalendarView } from '@/lib/calendar-model'
import styles from './CalendarWeek.module.css'

export type CalendarQuery = { view?: string; week?: string; month?: string; day?: string }

const monthTitle = (month: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))

export default async function CalendarLanding({ category, query }: { category: CalendarCategory; query: CalendarQuery }) {
  const today = new Date().toISOString().slice(0, 10)
  const signedIn = await isViewerSignedIn()
  const shown = resolveCalendarWindow({ ...query, signedIn, today })
  // A locked window is never fetched: the page carries no events beyond what the viewer can read.
  const result: CalendarResult | null = shown.locked ? null : await getPublicCalendarRange(shown, category)
  const names = result ? await getCalendarNames(result.events.flatMap((event) => event.symbol ? [event.symbol] : [])) : {}

  const href = (view: CalendarView, overrides: { week?: string; month?: string; day?: string } = {}, targetCategory = category) =>
    calendarHref({ category: targetCategory, view, week: overrides.week ?? shown.week, month: overrides.month ?? shown.month, day: overrides.day })
  const isMonth = shown.view === 'month'
  const isThisWeek = !isMonth && shown.week === shown.thisWeek
  const thisMonth = shown.thisWeek.slice(0, 7)
  const step = isMonth
    ? { previous: href('month', { month: shiftMonth(shown.month, -1) }), current: href('month', { month: thisMonth }), next: href('month', { month: shiftMonth(shown.month, 1) }), unit: 'month', currentLabel: 'This month' }
    : { previous: href('week', { week: shiftDay(shown.week, -7) }), current: href('week', { week: shown.thisWeek }), next: href('week', { week: shiftDay(shown.week, 7) }), unit: 'week', currentLabel: 'This week' }
  const categoryLabel = CALENDAR_CATEGORIES.find((item) => item.key === category)?.label ?? 'All events'
  const eyebrow = [category === 'all' ? 'Calendar' : categoryLabel, isThisWeek ? 'This week' : isMonth ? 'Month' : 'Week'].join(' · ')
  const signUp = (view: CalendarView) => `/sign-up?redirect_url=${encodeURIComponent(href(view))}`

  return (
    <div className={styles.stage}>
      <RankingsUniverse seed={`calendar-${shown.view}-${isMonth ? shown.month : shown.week}`} />
      <div className={styles.page}>
        <header className={styles.head} data-rankings-band="">
          <div className={styles.titleRow}>
            <div>
              <div className={styles.eyebrowRow}>
                <span className={styles.node} data-rankings-anchor="" aria-hidden="true" />
                <p className={styles.eyebrow}>{eyebrow}</p>
              </div>
              <h1 className={styles.title}>{isMonth ? monthTitle(shown.month) : humanWeek(shown.week)}</h1>
              {result ? <p className={styles.stamp}><span className={styles.stampDot} aria-hidden="true" />{result.events.length} {result.events.length === 1 ? 'event' : 'events'}</p> : null}
            </div>
            <div className={styles.controls}>
              <div className={styles.viewSwitch} aria-label="Calendar view">
                <Link href={href('week', { week: isMonth ? (shown.month === thisMonth ? shown.thisWeek : `${shown.month}-01`) : shown.week })} aria-current={!isMonth ? 'page' : undefined}>Week</Link>
                <Link href={href('month', { month: isMonth ? shown.month : shown.week.slice(0, 7) })} aria-current={isMonth ? 'page' : undefined}>
                  {signedIn ? null : <Lock size={13} strokeWidth={1.5} aria-label="Needs an account" />}Month
                </Link>
              </div>
              <div className={styles.stepper} aria-label={`Change ${step.unit}`}>
                <Link href={step.previous} aria-label={`Previous ${step.unit}`}><ArrowLeft size={17} strokeWidth={1.5} /></Link>
                <Link href={step.current}>{step.currentLabel}</Link>
                <Link href={step.next} aria-label={`Next ${step.unit}`}><ArrowRight size={17} strokeWidth={1.5} /></Link>
              </div>
            </div>
          </div>
          <nav className={styles.categories} aria-label="Event type">
            {CALENDAR_CATEGORIES.map((item) => (
              <Link key={item.key} href={href(shown.view, {}, item.key)} aria-current={item.key === category ? 'page' : undefined}>{item.label}</Link>
            ))}
          </nav>
        </header>

        <section className={styles.calendar} aria-label="Event calendar">
          {result && result.unavailableDomains.length > 0 && result.available ? (
            <p className={styles.coverage}>Partial coverage: some event sources are unavailable for this {step.unit}.</p>
          ) : null}
          {result?.truncated ? <p className={styles.coverage}>Showing the first 500 events. Narrow the event type to see more.</p> : null}

          {!result ? (
            <WeekSilhouette>
              <div className={styles.offer}>
                <span className={styles.offerIcon} aria-hidden="true"><Lock size={16} strokeWidth={1.5} /></span>
                <h2 className={styles.offerTitle}>Every week, every month</h2>
                <p className={styles.offerText}>This week is open to everyone. A free account opens the weeks ahead, past weeks and the month view.</p>
                <div className={styles.offerActions}>
                  <Link href={signUp(shown.view)} className={buttonClass({ variant: 'primary' })} data-analytics-id="calendar_locked_sign_up" data-analytics-event="auth_start" data-analytics-intent="sign_up">Create free account</Link>
                  <Link href={href('week', { week: shown.thisWeek })} className={buttonClass({ variant: 'secondary' })} data-analytics-id="calendar_locked_this_week">Back to this week</Link>
                </div>
                <p className={styles.offerSignIn}>Already a member? <Link href={`/sign-in?redirect_url=${encodeURIComponent(href(shown.view))}`} data-analytics-id="calendar_locked_sign_in" data-analytics-event="auth_start" data-analytics-intent="sign_in">Sign in</Link></p>
              </div>
            </WeekSilhouette>
          ) : isMonth ? (
            <EventCalendar
              bare
              month={shown.month}
              selectedDay={query.day}
              category={category}
              events={result.events}
              names={names}
              scope="global"
              basePath="/calendar"
              extraParams={{ view: 'month' }}
              available={result.available}
              reason={result.reason}
              unavailableDomains={result.unavailableDomains}
              truncated={result.truncated}
            />
          ) : (
            <WeekBoard week={shown.week} today={today} events={result.events} names={names} category={category} available={result.available} reason={result.reason} />
          )}

          {result && !signedIn ? (
            <p className={styles.openNote}>
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Other weeks and the month view open with a free account.</span>
              <Link href={signUp('week')} data-analytics-id="calendar_week_sign_up" data-analytics-event="auth_start" data-analytics-intent="sign_up">Create free account</Link>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
