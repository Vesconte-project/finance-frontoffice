'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import RetryButton from '@/components/ui/RetryButton'
import { buttonClass } from '@/components/ui/Button'
import { trackState } from '@/lib/analytics'

type RouteErrorFallbackProps = {
  error: Error & { digest?: string }
  unstable_retry: () => void
  title?: string
  description?: string
  homeHref?: string
  homeLabel?: string
}

export default function RouteErrorFallback({
  error,
  unstable_retry,
  title = 'This page hit an unexpected error',
  description = 'The app could not finish loading this view. Retry will re-fetch and render this segment again.',
  homeHref = '/',
  homeLabel = 'Return Home',
}: RouteErrorFallbackProps) {
  useEffect(() => {
    console.error(error)
    trackState('error_shown', {
      surface: 'route_error',
      message: error.message,
      digest: error.digest ?? null,
    })
  }, [error])

  return (
    <div className="container-sm flex min-h-[50vh] items-center justify-center py-10">
      <Card className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-section-title text-content-primary">{title}</h2>
          <p className="text-body mt-2 max-w-[60ch]">{description}</p>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
            <RetryButton
              analyticsId="route_error_retry"
              onRetry={unstable_retry}
              retryKey={`error:${error.digest ?? error.message}`}
              pendingMessage="Retrying this section and requesting fresh server data..."
              settledMessage="That retry did not recover the page yet. You can try again."
            >
              Try Again
            </RetryButton>
            <Link
              href={homeHref}
              data-analytics-id="route_error_home"
              className={buttonClass({ variant: 'ghost' })}
            >
              {homeLabel}
            </Link>
          </div>
          {error.digest ? (
            <p className="text-caption mt-2 text-content-muted">Reference: {error.digest}</p>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
