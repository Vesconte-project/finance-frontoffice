'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, RotateCcw, Star } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import Dialog from '@/components/ui/Dialog'
import PromptPanel from '@/components/ui/PromptPanel'

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
  const retryRef = useRef<HTMLButtonElement>(null)

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

  const retry = () => {
    setError(null)
    void onClick()
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

      {/* Pending and success outcomes reach assistive technology here; a failure
          opens a dialog that names and describes itself, so nothing is announced twice. */}
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
          <div id={recoveryId} data-watchlist-recovery="open">
            <PromptPanel
              ticker={ticker}
              status="invite"
              statusLabel="Free account"
              title={`Save ${ticker} to your watchlist`}
              titleId={titleId}
              description={`${SIGNED_OUT_EXPLANATION} A free account gives you:`}
              descriptionId={descriptionId}
              points={[
                <>A watchlist to keep {ticker} and the other tickers you follow</>,
                <>A dashboard with the latest changes on the tickers you saved</>,
              ]}
              note="No card, no trial."
              actions={(
                <>
                  <Link
                    ref={createAccountRef}
                    href="/sign-up"
                    className={buttonClass({ variant: 'primary', size: 'md' })}
                  >
                    {CREATE_ACCOUNT_LABEL}
                  </Link>
                  <Link href="/sign-in" className={buttonClass({ variant: 'ghost', size: 'md' })}>
                    {SIGN_IN_LABEL}
                  </Link>
                </>
              )}
            />
          </div>
        </Dialog>
      )}

      {signedIn && (
        <Dialog
          open={error !== null}
          onClose={() => setError(null)}
          labelledBy={`${recoveryId}-error-title`}
          describedBy={`${recoveryId}-error-description`}
          initialFocusRef={retryRef}
          returnFocusRef={starRef}
        >
          <div data-watchlist-error="">
            <PromptPanel
              ticker={ticker}
              status="error"
              statusLabel="Error · not saved"
              title={`${ticker} wasn’t ${inWatchlist ? 'removed' : 'saved'}`}
              titleId={`${recoveryId}-error-title`}
              description={`${MUTATION_ERROR} Nothing changed in your watchlist.`}
              descriptionId={`${recoveryId}-error-description`}
              actions={(
                <>
                  <button
                    ref={retryRef}
                    type="button"
                    onClick={retry}
                    className={cn(buttonClass({ variant: 'primary', size: 'md' }), 'gap-2')}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    Try again
                  </button>
                  <button type="button" onClick={() => setError(null)} className={buttonClass({ variant: 'ghost', size: 'md' })}>
                    Close
                  </button>
                </>
              )}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
