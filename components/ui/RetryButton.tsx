'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, RotateCw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

const RETRY_FEEDBACK_KEY = 'vesconte:retry-feedback'
const RETRY_FEEDBACK_WINDOW_MS = 15000

type ButtonProps = ComponentProps<typeof Button>

type RetryButtonProps = {
  onRetry?: () => void
  retryKey?: string
  pendingMessage?: string
  settledMessage?: string
  pendingLabel?: string
  children?: ReactNode
  /** Names the retry in telemetry, so repeat retries on one surface are countable. */
  analyticsId?: string
} & Omit<ButtonProps, 'children' | 'onClick'>

type StoredRetryFeedback = {
  key: string
  timestamp: number
}

function readStoredRetryFeedback(): StoredRetryFeedback | null {
  if (typeof window === 'undefined') return null

  const raw = window.sessionStorage.getItem(RETRY_FEEDBACK_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredRetryFeedback
    if (
      typeof parsed.key !== 'string' ||
      typeof parsed.timestamp !== 'number' ||
      !Number.isFinite(parsed.timestamp)
    ) {
      window.sessionStorage.removeItem(RETRY_FEEDBACK_KEY)
      return null
    }

    return parsed
  } catch {
    window.sessionStorage.removeItem(RETRY_FEEDBACK_KEY)
    return null
  }
}

function consumeStoredRetryFeedback(currentRetryKey: string): boolean {
  const stored = readStoredRetryFeedback()
  if (!stored) return false

  const isFresh = Date.now() - stored.timestamp <= RETRY_FEEDBACK_WINDOW_MS
  const shouldShow = stored.key === currentRetryKey && isFresh

  if (!isFresh || shouldShow) {
    window.sessionStorage.removeItem(RETRY_FEEDBACK_KEY)
  }

  return shouldShow
}

export default function RetryButton({
  onRetry,
  retryKey,
  pendingMessage = 'Refreshing this page and requesting the latest data...',
  settledMessage = 'Still unavailable after the last retry. You can try again in a moment.',
  pendingLabel = 'Retrying...',
  variant = 'secondary',
  size = 'md',
  className,
  children = 'Retry',
  analyticsId,
  ...props
}: RetryButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const currentRetryKey =
    retryKey ?? `${pathname}${queryString.length > 0 ? `?${queryString}` : ''}`
  const [isPending, startTransition] = useTransition()
  const [showSettledMessage, setShowSettledMessage] = useState(() => consumeStoredRetryFeedback(currentRetryKey))
  const settledTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (settledTimeoutRef.current !== null) {
        window.clearTimeout(settledTimeoutRef.current)
        settledTimeoutRef.current = null
      }
    }
  }, [])

  function handleClick() {
    const timestamp = Date.now()
    trackEvent('retry_click', {
      control: analyticsId ?? 'retry',
      path: pathname,
      retry_key: currentRetryKey,
    })
    setShowSettledMessage(false)
    window.sessionStorage.setItem(
      RETRY_FEEDBACK_KEY,
      JSON.stringify({ key: currentRetryKey, timestamp } satisfies StoredRetryFeedback)
    )

    if (settledTimeoutRef.current !== null) {
      window.clearTimeout(settledTimeoutRef.current)
    }
    settledTimeoutRef.current = window.setTimeout(() => {
      setShowSettledMessage(true)
      settledTimeoutRef.current = null
    }, 1600)

    startTransition(() => {
      if (onRetry) {
        onRetry()
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Button
        variant={variant}
        size={size}
        className={cn('min-w-[10.5rem] gap-2', className)}
        data-analytics-ignore=""
        aria-live="polite"
        aria-busy={isPending}
        disabled={isPending}
        onClick={handleClick}
        {...props}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        <span>{isPending ? pendingLabel : children}</span>
      </Button>
      <p
        className={cn(
          'min-h-[1.25rem] max-w-[26rem] text-caption transition-opacity duration-[var(--motion-normal)]',
          isPending || showSettledMessage ? 'opacity-100' : 'opacity-0',
          isPending ? 'text-content-secondary' : 'text-content-muted'
        )}
        aria-live="polite"
      >
        {isPending ? pendingMessage : showSettledMessage ? settledMessage : ' '}
      </p>
    </div>
  )
}
