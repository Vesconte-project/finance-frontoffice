import EventCalendar from '@/components/calendar/EventCalendar'
import { getPublicCalendar } from '@/lib/calendar-events'
import { calendarMonth, type CalendarCategory } from '@/lib/calendar-model'

const copy: Record<CalendarCategory, { title: string; description: string }> = {
  all: { title: 'Events calendar', description: 'Company dates and scheduled economic releases in one place. Choose a day or narrow the event type.' },
  earnings: { title: 'Earnings calendar', description: 'Reported and scheduled company results and earnings calls where the event source identifies them.' },
  dividends: { title: 'Dividend calendar', description: 'Ex-dates and fund distributions from the event sources currently connected.' },
  company: { title: 'Company events', description: 'Investor events, corporate actions and fund rebalances beyond earnings and distributions.' },
  macro: { title: 'Economic releases', description: 'Scheduled macro data releases. Dates and times reflect the source schedule, not confirmation that a release occurred.' },
  holidays: { title: 'Country holidays', description: 'A place for verified country holiday schedules. These are distinct from exchange trading closures.' },
}

export default async function CalendarLanding({ category, rawMonth, day }: { category: CalendarCategory; rawMonth?: string; day?: string }) {
  const month = calendarMonth(rawMonth)
  const result = await getPublicCalendar(month, category)
  return (
    <div className="mx-auto w-full max-w-[1560px] px-5 py-8 md:px-10 md:py-12">
      <header className="mb-10 max-w-[68ch]">
        <h1 className="text-4xl font-medium leading-tight text-[var(--text)] md:text-5xl">{copy[category].title}</h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--text-body)]">{copy[category].description}</p>
      </header>
      <EventCalendar
        month={month}
        selectedDay={day}
        category={category}
        events={result.events}
        scope="global"
        basePath="/calendar"
        available={result.available}
        reason={result.reason}
        unavailableDomains={result.unavailableDomains}
        truncated={result.truncated}
      />
    </div>
  )
}
