import { notFound } from 'next/navigation'
import CalendarLanding, { type CalendarQuery } from '@/components/calendar/CalendarLanding'
import type { CalendarCategory } from '@/lib/calendar-model'

export const dynamic = 'force-dynamic'

const categories = new Set<CalendarCategory>(['earnings', 'dividends', 'company', 'macro', 'holidays'])

export default async function CalendarCategoryPage({ params, searchParams }: {
  params: Promise<{ category: string }>
  searchParams: Promise<CalendarQuery>
}) {
  const [{ category }, query] = await Promise.all([params, searchParams])
  if (!categories.has(category as CalendarCategory)) notFound()
  return <CalendarLanding category={category as CalendarCategory} query={query} />
}
