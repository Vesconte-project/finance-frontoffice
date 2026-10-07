import type { Metadata } from 'next'
import PicksReadingPage from '@/components/picks/PicksReadingPage'
import { PICK_READING_CONTENT } from '@/lib/picks-content'

/**
 * Dynamic on purpose, and this must stay that way: how many rows render depends on
 * the viewer's session, so a cached page would serve a member's ranking to an
 * anonymous visitor. The cut itself is made in `lib/picks-access.ts`.
 */
export const dynamic = 'force-dynamic'

const CONTENT = PICK_READING_CONTENT.longTerm

export const metadata: Metadata = {
  title: `${CONTENT.label} ranking — ${CONTENT.headline}`,
  description: CONTENT.subtitle,
  alternates: { canonical: '/picks/long-term' },
}

export default function Page() {
  return <PicksReadingPage reading="longTerm" />
}
