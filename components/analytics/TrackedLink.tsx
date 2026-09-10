'use client'

import Link, { type LinkProps } from 'next/link'
import type { AnchorHTMLAttributes } from 'react'
import { trackEvent, type AnalyticsEventName, type AnalyticsPayload } from '@/lib/analytics'

type TrackedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    eventName: AnalyticsEventName
    eventPayload?: AnalyticsPayload
  }

export default function TrackedLink({
  eventName,
  eventPayload,
  onClick,
  children,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      data-analytics-ignore=""
      onClick={(event) => {
        trackEvent(eventName, eventPayload ?? {})
        onClick?.(event)
      }}
    >
      {children}
    </Link>
  )
}
