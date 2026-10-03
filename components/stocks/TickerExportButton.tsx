'use client'

import { useId, useRef, useState, type RefObject } from 'react'
import { Download, Loader2, RotateCcw } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import PromptPanel from '@/components/ui/PromptPanel'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

const EXPORT_LABEL = 'Download signal history CSV'
const EXPORT_ERROR = 'Couldn’t export signal history. Try again.'

/** What the export dialog is showing: an access prompt or an outcome the reader must see. */
type PromptState =
  | { kind: 'sign-in' | 'upgrade'; upgradeUrl: string }
  | { kind: 'empty' }
  | { kind: 'failed' }

function downloadFilename(disposition: string | null, ticker: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i)
  const filename = match?.[1]?.trim()
  return filename && /^[a-z0-9._-]+$/i.test(filename)
    ? filename
    : `${ticker.toLowerCase()}-signals.csv`
}

function safeUpgradeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '/pricing'
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '/pricing'
  } catch {
    return '/pricing'
  }
}

export default function TickerExportButton({ ticker, signedIn }: { ticker: string; signedIn: boolean }) {
  const symbol = ticker.toUpperCase()
  const [pending, setPending] = useState(false)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const promptId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const primaryRef = useRef<HTMLElement>(null)

  // Closing returns focus to the export button (handled by the dialog).
  const closePrompt = () => setPrompt(null)

  const showAccessPrompt = (kind: 'sign-in' | 'upgrade', upgradeUrl: string) => {
    setAnnouncement(kind === 'sign-in'
      ? 'Sign in or choose Pro to export signal history.'
      : 'A Pro plan is required to export signal history.')
    setPrompt({ kind, upgradeUrl })
    trackEvent('upgrade_prompt_shown', {
      control: 'ticker_export',
      surface: 'ticker_chrome',
      reason: kind === 'sign-in' ? 'signed_out' : 'plan_required',
      ticker: symbol,
    })
  }

  const showFailure = (kind: 'empty' | 'failed') => {
    setAnnouncement(kind === 'empty' ? `No signal history for ${symbol} yet.` : EXPORT_ERROR)
    setPrompt({ kind })
    trackEvent('error_shown', {
      control: 'ticker_export',
      surface: 'ticker_chrome',
      reason: kind === 'empty' ? 'no_signal_history' : 'export_failed',
      ticker: symbol,
    })
  }

  const exportSignals = async () => {
    // Signed out: the prompt opens at once. The route sits behind auth
    // middleware, which answers a signed-out API request with a bare 404, so
    // asking it would only surface as a failure.
    if (!signedIn) {
      showAccessPrompt('sign-in', '/pricing')
      return
    }

    setPending(true)
    setPrompt(null)
    setAnnouncement('Preparing signal history CSV.')

    try {
      const response = await fetch(`/api/export-signals?ticker=${encodeURIComponent(ticker)}`)
      if (response.status === 401) {
        showAccessPrompt('sign-in', '/pricing')
        return
      }
      if (response.status === 403) {
        const payload: unknown = await response.json().catch(() => null)
        const upgradeUrl = payload && typeof payload === 'object'
          ? safeUpgradeUrl((payload as { upgradeUrl?: unknown }).upgradeUrl)
          : '/pricing'
        showAccessPrompt('upgrade', upgradeUrl)
        return
      }
      if (response.status === 404 && response.headers.get('content-type')?.includes('application/json')) {
        // The route's own answer when the ticker has no signal history.
        showFailure('empty')
        return
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
        throw new Error('Signal export request failed.')
      }

      const csv = await response.blob()
      if (csv.size === 0) throw new Error('Signal export was empty.')

      const objectUrl = URL.createObjectURL(csv)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = downloadFilename(response.headers.get('content-disposition'), ticker)
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      setAnnouncement('Signal history CSV downloaded.')
      trackEvent('export_download', {
        control: 'ticker_export',
        dataset: 'signal_history',
        format: 'csv',
        ticker: symbol,
        bytes: csv.size,
      })
    } catch {
      showFailure('failed')
    } finally {
      setPending(false)
    }
  }

  const retry = () => {
    setPrompt(null)
    void exportSignals()
  }

  return (
    <div className="relative flex flex-col items-start gap-1.5 md:items-end">
      <button
        ref={buttonRef}
        type="button"
        data-analytics-id="ticker_export"
        data-analytics-ticker={symbol}
        onClick={exportSignals}
        disabled={pending}
        aria-label={EXPORT_LABEL}
        title={EXPORT_LABEL}
        aria-busy={pending}
        aria-haspopup="dialog"
        aria-expanded={prompt ? true : undefined}
        aria-controls={prompt ? promptId : undefined}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--color-text-secondary)] transition-[border-color,color,transform] duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)] active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
      </button>

      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      <Dialog
        open={prompt !== null}
        onClose={closePrompt}
        labelledBy={`${promptId}-title`}
        describedBy={`${promptId}-description`}
        initialFocusRef={primaryRef}
        returnFocusRef={buttonRef}
      >
        {prompt?.kind === 'sign-in' || prompt?.kind === 'upgrade' ? (
          <div id={promptId} data-ticker-export-recovery="open">
            <PromptPanel
              ticker={symbol}
              status="locked"
              statusLabel="Pro feature"
              title="Signal export is a Pro feature"
              titleId={`${promptId}-title`}
              description={prompt.kind === 'sign-in'
                ? `Downloading ${symbol}’s signal history as a CSV is part of Pro. Sign in to check your access.`
                : `Downloading ${symbol}’s signal history as a CSV is part of Pro.`}
              descriptionId={`${promptId}-description`}
              actions={(
                <>
                  <a
                    ref={primaryRef as RefObject<HTMLAnchorElement>}
                    href={prompt.kind === 'sign-in' ? '/sign-in' : prompt.upgradeUrl}
                    className={buttonClass({ variant: 'primary', size: 'md' })}
                  >
                    {prompt.kind === 'sign-in' ? 'Sign in' : 'Upgrade to Pro'}
                  </a>
                  {prompt.kind === 'sign-in' ? (
                    <a href={prompt.upgradeUrl} className={buttonClass({ variant: 'ghost', size: 'md' })}>View Pro</a>
                  ) : null}
                </>
              )}
            />
          </div>
        ) : null}
        {prompt?.kind === 'empty' || prompt?.kind === 'failed' ? (
          <div id={promptId} data-ticker-export-problem={prompt.kind}>
            <PromptPanel
              ticker={symbol}
              status={prompt.kind === 'empty' ? 'empty' : 'error'}
              statusLabel={prompt.kind === 'empty' ? 'Nothing yet' : 'Error · download failed'}
              title={prompt.kind === 'empty'
                ? `No signal history for ${symbol} yet`
                : `${symbol}’s signal history didn’t download`}
              titleId={`${promptId}-title`}
              description={prompt.kind === 'empty'
                ? 'There is nothing to download for this ticker at the moment. It will be here once its signal history exists.'
                : 'We couldn’t prepare the file, so nothing was saved to your device. Try again in a moment.'}
              descriptionId={`${promptId}-description`}
              actions={prompt.kind === 'failed' ? (
                <>
                  <button
                    ref={primaryRef as RefObject<HTMLButtonElement>}
                    type="button"
                    onClick={retry}
                    className={cn(buttonClass({ variant: 'primary', size: 'md' }), 'gap-2')}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    Try again
                  </button>
                  <button type="button" onClick={closePrompt} className={buttonClass({ variant: 'ghost', size: 'md' })}>
                    Close
                  </button>
                </>
              ) : (
                <button
                  ref={primaryRef as RefObject<HTMLButtonElement>}
                  type="button"
                  onClick={closePrompt}
                  className={buttonClass({ variant: 'primary', size: 'md' })}
                >
                  Close
                </button>
              )}
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
