import type { Metadata } from 'next'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import FaqPage from '@/components/marketing/FaqPage'
import { faqPageJsonLd } from '@/lib/faq-content'

const TITLE = 'FAQ | Vesconte'
const DESCRIPTION = 'Clear answers about Vesconte signals, market data, features, accounts, and plans.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: {
    type: 'website',
    url: '/faq',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function Faq() {
  return (
    <>
      <TrackEventOnMount eventName="view_faq" />
      {/*
        Serialised from FAQ_GROUPS, the same constant the accordion renders, so the
        answers shown to a reader and the answers published to search engines cannot
        drift apart. Never author this twice.
      */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPageJsonLd() }} />
      <FaqPage />
    </>
  )
}
