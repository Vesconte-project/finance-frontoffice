import CalendarLanding, { type CalendarQuery } from '@/components/calendar/CalendarLanding'

// Dynamic: what a viewer receives depends on their session (lib/calendar-model resolveCalendarWindow).
export const dynamic = 'force-dynamic'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<CalendarQuery> }) {
  return <CalendarLanding category="all" query={await searchParams} />
}
