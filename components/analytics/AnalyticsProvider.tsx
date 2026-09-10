'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { consumeNavigationType, trackEvent } from '@/lib/analytics'

/**
 * Records a committed page view on first paint and on every client navigation,
 * plus one web-vitals event per metric.
 *
 * Deliberately reads the query string from `window.location` instead of
 * `useSearchParams`, because that hook opts the whole tree below it out of
 * static rendering. Mounted in the root layout, that cost would land on every
 * page in the site.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname()
  const lastReported = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const search = window.location.search
    const key = `${pathname}${search}`
    // React 18 double-invokes effects in development; the guard keeps one
    // navigation to one page view either way.
    if (lastReported.current === key) return
    lastReported.current = key

    const params = new URLSearchParams(search)
    trackEvent('page_view', {
      path: pathname,
      // 'initial' on first load, otherwise how the router transition started:
      // a link or router.push, a replace, or the back/forward button.
      navigation_type: consumeNavigationType(),
      query: search ? search.slice(0, 200) : null,
      title: document.title || null,
      referrer: document.referrer || null,
      // Attribution parameters, when a campaign sent the visitor here.
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    })
  }, [pathname])

  useReportWebVitals((metric) => {
    // CLS is unitless; every other metric is milliseconds. Rounding keeps the
    // log line small without losing anything actionable.
    const value = metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value)
    trackEvent('web_vitals', {
      metric: metric.name,
      value,
      rating: 'rating' in metric ? String(metric.rating) : null,
      path: pathname,
    })
  })

  return null
}
