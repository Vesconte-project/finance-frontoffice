'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, CircleAlert, Loader2, Star } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import { PICK_VISIBLE_LIMITS } from '@/lib/picks-access-rules'

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
  const titleId = `${recoveryId}-title`
  const descriptionId = `${recoveryId}-description`
  const starRef = useRef<HTMLButtonElement>(null)
  const createAccountRef = useRef<HTMLAnchorElement>(null)

  // Closing returns focus to the star (handled by the dialog).
  const closeRecovery = () => setRecoveryOpen(false)

  const onClick = async () => {
    if (!signedIn) {
      // No mutation is attempted while signed out. The account prompt opens as
      // a modal dialog; a single boolean cannot stack, and while the dialog is
      // open the star is inert, so repeat activation cannot accumulate states.
      setRecoveryOpen(true)
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
        aria-haspopup={signedIn ? undefined : 'dialog'}
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

      {!signedIn && (
        <Dialog
          open={recoveryOpen}
          onClose={closeRecovery}
          labelledBy={titleId}
          describedBy={descriptionId}
          initialFocusRef={createAccountRef}
          returnFocusRef={starRef}
        >
          <div id={recoveryId} data-watchlist-recovery="open" className="flex flex-col gap-4 pr-8 text-left">
            <h2 id={titleId} className="text-xl font-medium text-[var(--text)]">
              Save {ticker} to your watchlist
            </h2>
            <p id={descriptionId} className="text-sm text-content-secondary">
              {SIGNED_OUT_EXPLANATION} A free account gives you:
            </p>
            <ul className="flex flex-col gap-2.5 text-sm text-[var(--text)]">
              {[
                `A watchlist to keep ${ticker} and the other tickers you follow`,
                `Where ${ticker} stands in each reading`,
                `The full Picks rankings — ${PICK_VISIBLE_LIMITS.free} companies per reading instead of ${PICK_VISIBLE_LIMITS.anonymous}`,
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <p className="text-caption text-content-muted">No card, no trial.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                ref={createAccountRef}
                href="/sign-up"
                className={buttonClass({ variant: 'primary', size: 'md' })}
              >
                {CREATE_ACCOUNT_LABEL}
              </Link>
              <Link
                href="/sign-in"
                className={buttonClass({ variant: 'ghost', size: 'md' })}
              >
                {SIGN_IN_LABEL}
              </Link>
            </div>
          </div>
        </Dialog>
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
