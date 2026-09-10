'use client'

import type { ComponentProps } from 'react'
import { trackEvent } from '@/lib/analytics'
import type { AnalyticsEventName, AnalyticsPayload } from '@/lib/analytics-events'

type TrackedButtonProps = ComponentProps<'button'> & {
  eventName?: AnalyticsEventName
  eventPayload?: AnalyticsPayload
  /** Stable identifier for this control, independent of its visible label. */
  analyticsId: string
}

/**
 * A button that names itself in telemetry.
 *
 * The delegated capture in `installGlobalTelemetry` already records every
 * click, so this is only needed where a control deserves a stable id that
 * survives copy changes, or extra payload the DOM does not carry.
 */
export default function TrackedButton({
  eventName = 'button_click',
  eventPayload,
  analyticsId,
  onClick,
  children,
  ...props
}: TrackedButtonProps) {
  return (
    <button
      {...props}
      data-analytics-id={analyticsId}
      data-analytics-ignore=""
      onClick={(event) => {
        trackEvent(eventName, { control: analyticsId, ...(eventPayload ?? {}) })
        onClick?.(event)
      }}
    >
      {children}
    </button>
  )
}
