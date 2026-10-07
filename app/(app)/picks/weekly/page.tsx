import type { Metadata } from 'next'
import WeeklyCutPage from '@/components/picks/WeeklyCutPage'

/**
 * Dynamic so the week turns over on its own; the ranking read underneath is cached
 * for five minutes in `lib/picks.ts`. Nothing here depends on the viewer.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "This week's ranking",
  description: 'One sector, one reading, ten companies — open to everyone, and a different pair each week.',
  alternates: { canonical: '/picks/weekly' },
}

export default function Page() {
  return <WeeklyCutPage />
}
