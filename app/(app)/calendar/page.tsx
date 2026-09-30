import CalendarLanding from '@/components/calendar/CalendarLanding'

export const dynamic = 'force-dynamic'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const query = await searchParams
  return <CalendarLanding category="all" rawMonth={query.month} day={query.day} />
}
