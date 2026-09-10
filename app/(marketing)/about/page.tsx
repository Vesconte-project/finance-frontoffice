import type { Metadata } from 'next'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import AboutPage from '@/components/marketing/AboutPage'

export const metadata: Metadata = {
  title: 'About | Vesconte',
  description: 'Learn about Vesconte and the product principles behind the weekly signal.',
}

export default function About() {
  return (
    <>
      <TrackEventOnMount eventName="view_about" />
      <AboutPage />
    </>
  )
}
