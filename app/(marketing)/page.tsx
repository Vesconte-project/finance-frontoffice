import type { Metadata } from 'next'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import MarketingHomePage from '@/components/marketing/HomePage'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
}

// The cut is per request, against the live session, and is never cached. A cached
// page would hand one viewer's HTML to the next.
export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <>
      <TrackEventOnMount eventName="view_homepage" />
      <MarketingHomePage />
    </>
  )
}
