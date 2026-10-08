import Link from 'next/link'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import EventCalendar from '@/components/calendar/EventCalendar'
import WeekBoard, { WeekSilhouette } from '@/components/calendar/WeekBoard'
import RankingsUniverse from '@/components/picks/RankingsUniverse'
import { buttonClass } from '@/components/ui/Button'
import { isViewerSignedIn } from '@/lib/auth'
import { getPublicCalendarRange, type CalendarResult } from '@/lib/calendar-events'
import { focusSymbols, resolveCalendarFocus } from '@/lib/calendar-focus'
import { getCalendarNames } from '@/lib/calendar-names'
import { CALENDAR_CATEGORIES, calendarFocus, calendarHref, focusParams as focusParamsFor, keepCompanies, humanWeek, resolveCalendarWindow, shiftDay, shiftMonth, type CalendarCategory, type CalendarView } from '@/lib/calendar-model'
import styles from './CalendarWeek.module.css'

export type CalendarQuery = { view?: string; week?: string; month?: string; day?: string; list?: string; around?: string }

const monthTitle = (month: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))

export default async function CalendarLanding({ category, query }: { category: CalendarCategory; query: CalendarQuery }) {
  const today = new Date().toISOString().slice(0, 10)
  const signedIn = await isViewerSignedIn()
  const shown = resolveCalendarWindow({ ...query, signedIn, today })
  // A locked window is never fetched: the page carries no events beyond what the viewer can read.
  const focusQuery = calendarFocus(query)
  const [fetched, focus] = await Promise.all([
    shown.locked ? Promise.resolve(null) : getPublicCalendarRange(shown, category),
    resolveCalendarFocus(focusQuery),
  ])
  // The narrowing happens here, on the server: a focused page carries only the companies it names.
  const kept = focusSymbols(focus)
  const result: CalendarResult | null = fetched ? { ...fetched, events: keepCompanies(fetched.events, kept) } : null
  const names = result ? await getCalendarNames([...result.events.flatMap((event) => event.symbol ? [event.symbol] : []), ...(focus.kind === 'around' ? [focus.center] : [])]) : {}
  const relations = focus.kind === 'around' ? focus.relations : {}
  const center = focus.kind === 'around' ? focus.center : null

  const href = (view: CalendarView, overrides: { week?: string; month?: string; day?: string } = {}, targetCategory = category, targetFocus = focusQuery) =>
    calendarHref({ category: targetCategory, view, week: overrides.week ?? shown.week, month: overrides.month ?? shown.month, day: overrides.day, focus: targetFocus })
  const isMonth = shown.view === 'month'
  const isThisWeek = !isMonth && shown.week === shown.thisWeek
  const thisMonth = shown.thisWeek.slice(0, 7)
  const step = isMonth
    ? { previous: href('month', { month: shiftMonth(shown.month, -1) }), current: href('month', { month: thisMonth }), next: href('month', { month: shiftMonth(shown.month, 1) }), unit: 'month', currentLabel: 'This month' }
    : { previous: href('week', { week: shiftDay(shown.week, -7) }), current: href('week', { week: shown.thisWeek }), next: href('week', { week: shiftDay(shown.week, 7) }), unit: 'week', currentLabel: 'This week' }
  const signUp = (view: CalendarView) => `/sign-up?redirect_url=${encodeURIComponent(href(view))}`

  return (
    <div className={styles.stage}>
      <RankingsUniverse seed={`calendar-${shown.view}-${isMonth ? shown.month : shown.week}`} />
      <div className={styles.page}>
        <header className={styles.head} data-rankings-band="">
          <nav className={styles.categories} aria-label="Event type">
            {CALENDAR_CATEGORIES.map((item) => (
              <Link key={item.key} href={href(shown.view, {}, item.key)} aria-current={item.key === category ? 'page' : undefined}>{item.label}</Link>
            ))}
          </nav>
          <div className={styles.controls}>
            <h1 className={styles.range}>
              {isThisWeek ? <span>This week · </span> : null}
              {isMonth ? monthTitle(shown.month) : humanWeek(shown.week)}
              {result ? <span> · {result.events.length} {result.events.length === 1 ? 'event' : 'events'}</span> : null}
            </h1>
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
        </header>

        <div className={styles.focusBar}>
          <span className={styles.focusLabel}>Companies</span>
          <div className={styles.viewSwitch} aria-label="Companies shown">
            <Link href={href(shown.view, {}, category, {})} aria-current={focus.kind === 'all' ? 'page' : undefined}>All</Link>
            <Link href={signedIn ? href(shown.view, {}, category, { list: 'watchlist' }) : signUp(shown.view)} aria-current={focus.kind === 'watchlist' ? 'page' : undefined} data-analytics-id="calendar_focus_watchlist">
              {signedIn ? null : <Lock size={13} strokeWidth={1.5} aria-label="Needs an account" />}My watchlist
            </Link>
          </div>
          <form className={styles.aroundForm} action={calendarHref({ category, view: shown.view, week: shown.week, month: shown.month })} method="get" role="search" aria-label="Companies around a ticker">
            {isMonth ? <><input type="hidden" name="view" value="month" /><input type="hidden" name="month" value={shown.month} /></> : <input type="hidden" name="week" value={shown.week} />}
            <label htmlFor="calendar-around">Around</label>
            <input id="calendar-around" name="around" defaultValue={center ?? ''} placeholder="Ticker, e.g. LLY" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={15} />
            <button type="submit" data-analytics-id="calendar_focus_around">Show</button>
          </form>
        </div>

        {focus.kind === 'around' ? (
          <p className={styles.focusNote}>
            {focus.status === 'ok'
              ? <><strong>{center}</strong>{center && names[center] ? ` ${names[center]}` : ''} and {Object.keys(relations).length} related {Object.keys(relations).length === 1 ? 'company' : 'companies'} from the atlas. </>
              : <>Companies around <strong>{center}</strong> did not load, so only its own dates are shown. </>}
            <Link href={href(shown.view, {}, category, {})}>Show all companies</Link>
          </p>
        ) : null}
        {focus.kind === 'watchlist' && focus.status !== 'ok' ? (
          <p className={styles.focusNote}>{focus.status === 'signed-out' ? 'Sign in to narrow the calendar to your watchlist.' : 'Your watchlist did not load. Nothing is wrong with your account.'} <Link href={href(shown.view, {}, category, {})}>Show all companies</Link></p>
        ) : null}
        {focus.kind === 'watchlist' && focus.status === 'ok' && focus.symbols.length === 0 ? (
          <p className={styles.focusNote}>Your watchlist is empty. Add companies with the star on their page. <Link href={href(shown.view, {}, category, {})}>Show all companies</Link></p>
        ) : null}

        <section className={styles.calendar} aria-label="Event calendar">
          {result && result.unavailableDomains.length > 0 && result.available ? (
            <p className={styles.coverage}>Partial coverage: some event sources are unavailable for this {step.unit}.</p>
          ) : null}
          {result?.truncated ? <p className={styles.coverage}>{kept ? 'This window has more than 500 events and only the first 500 were read, so some dates for these companies may be missing. Narrow the event type to see them.' : 'Showing the first 500 events. Narrow the event type to see more.'}</p> : null}

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
              extraParams={{ view: 'month', ...focusParamsFor(focusQuery) }}
              available={result.available}
              reason={result.reason}
              unavailableDomains={result.unavailableDomains}
              truncated={result.truncated}
            />
          ) : (
            <WeekBoard week={shown.week} today={today} events={result.events} names={names} relations={relations} center={center} category={category} available={result.available} reason={result.reason} />
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
