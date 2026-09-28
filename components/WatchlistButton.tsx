'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { CircleAlert, Loader2, Star } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'

/**
 * Founder-approved copy. Preserve verbatim — these strings are product scope,
 * not implementation detail.
 */
const SIGNED_OUT_EXPLANATION = 'Sign in to save this ticker to your watchlist.'
const SIGN_IN_LABEL = 'Sign in'
const CREATE_ACCOUNT_LABEL = 'Create account'
const SAVING_ANNOUNCEMENT = 'Saving…'
const REMOVING_ANNOUNCEMENT = 'Removing…'
const SAVED_ANNOUNCEMENT = 'Saved to watchlist.'
const REMOVED_ANNOUNCEMENT = 'Removed from watchlist.'
const MUTATION_ERROR = 'Couldn’t update your watchlist. Try again.'

type WatchlistButtonProps = {
  ticker: string
  initialInWatchlist: boolean
  signedIn: boolean
}

async function callWatchlistApi(method: 'POST' | 'DELETE', ticker: string) {
  const response = await fetch('/api/watchlist', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(payload?.error || 'Watchlist request failed.')
  }
}

export default function WatchlistButton({
  ticker,
  initialInWatchlist,
  signedIn,
}: WatchlistButtonProps) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const recoveryId = useId()
  const starRef = useRef<HTMLButtonElement>(null)
  const signInRef = useRef<HTMLAnchorElement>(null)

  // Entering the recovery state offers focus to the primary action, so focus is
  // never left on a control whose purpose has just changed.
  useEffect(() => {
    if (recoveryOpen) signInRef.current?.focus()
  }, [recoveryOpen])

  const closeRecovery = () => {
    setRecoveryOpen(false)
    starRef.current?.focus()
  }

  const onClick = async () => {
    if (!signedIn) {
      // No mutation is attempted while signed out. A single boolean cannot
      // stack, so repeat activation toggles rather than accumulating states.
      setRecoveryOpen((open) => !open)
      return
    }

    setPending(true)
    setError(null)
    const nextState = !inWatchlist
    setAnnouncement(nextState ? SAVING_ANNOUNCEMENT : REMOVING_ANNOUNCEMENT)

    try {
      await callWatchlistApi(nextState ? 'POST' : 'DELETE', ticker)
      setInWatchlist(nextState)
      setAnnouncement(nextState ? SAVED_ANNOUNCEMENT : REMOVED_ANNOUNCEMENT)
    } catch {
      // A failed request leaves the control in its true prior state, and the
      // reader gets the human-readable message rather than the upstream one.
      setAnnouncement('')
      setError(MUTATION_ERROR)
    } finally {
      setPending(false)
    }
  }

  const label = inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'

  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      <button
        ref={starRef}
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={label}
        title={label}
        aria-pressed={inWatchlist}
        aria-busy={pending}
        aria-expanded={signedIn ? undefined : recoveryOpen}
        aria-controls={!signedIn && recoveryOpen ? recoveryId : undefined}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--color-text-secondary)] transition-[border-color,color,transform] duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] active:scale-90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Star
            size={16}
            aria-hidden="true"
            className={inWatchlist ? 'fill-[var(--text-muted)] text-[var(--text-muted)]' : undefined}
          />
        )}
      </button>

      {/* Pending and success outcomes reach assistive technology here; the error
          line below is its own polite region, so nothing is announced twice. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      {!signedIn && recoveryOpen && (
        <div
          id={recoveryId}
          data-watchlist-recovery="open"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              closeRecovery()
            }
          }}
          className="flex w-[min(16.5rem,100%)] flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-surface-elevated px-3 py-2.5 text-left"
        >
          <p className="text-caption text-content-secondary">{SIGNED_OUT_EXPLANATION}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              ref={signInRef}
              href="/sign-in"
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              {SIGN_IN_LABEL}
            </Link>
            <Link href="/sign-up" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
              {CREATE_ACCOUNT_LABEL}
            </Link>
          </div>
        </div>
      )}

      {error && (
        <span
          data-watchlist-error=""
          aria-live="polite"
          className="signal-bearish text-caption inline-flex items-center gap-1.5"
        >
          <CircleAlert size={13} aria-hidden="true" className="shrink-0" />
          {error}
        </span>
      )}
    </div>
  )
}
