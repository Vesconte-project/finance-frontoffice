'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CircleAlert, Download, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { trackEvent } from '@/lib/analytics'

const EXPORT_LABEL = 'Download signal history CSV'
const EXPORT_ERROR = 'Couldn’t export signal history. Try again.'

type RecoveryState = {
  kind: 'sign-in' | 'upgrade'
  upgradeUrl: string
}

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

export default function TickerExportButton({ ticker }: { ticker: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<RecoveryState | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const recoveryId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const recoveryLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (recovery) recoveryLinkRef.current?.focus()
  }, [recovery])

  const closeRecovery = () => {
    setRecovery(null)
    buttonRef.current?.focus()
  }

  const exportSignals = async () => {
    setPending(true)
    setError(null)
    setRecovery(null)
    setAnnouncement('Preparing signal history CSV.')

    try {
      const response = await fetch(`/api/export-signals?ticker=${encodeURIComponent(ticker)}`)
      if (response.status === 401) {
        setAnnouncement('Sign in or choose Pro to export signal history.')
        setRecovery({ kind: 'sign-in', upgradeUrl: '/pricing' })
        trackEvent('upgrade_prompt_shown', {
          control: 'ticker_export',
          surface: 'ticker_chrome',
          reason: 'signed_out',
          ticker: ticker.toUpperCase(),
        })
        return
      }
      if (response.status === 403) {
        const payload: unknown = await response.json().catch(() => null)
        const upgradeUrl = payload && typeof payload === 'object'
          ? safeUpgradeUrl((payload as { upgradeUrl?: unknown }).upgradeUrl)
          : '/pricing'
        setAnnouncement('A Pro plan is required to export signal history.')
        setRecovery({ kind: 'upgrade', upgradeUrl })
        trackEvent('upgrade_prompt_shown', {
          control: 'ticker_export',
          surface: 'ticker_chrome',
          reason: 'plan_required',
          ticker: ticker.toUpperCase(),
        })
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
        ticker: ticker.toUpperCase(),
        bytes: csv.size,
      })
    } catch {
      setAnnouncement('')
      setError(EXPORT_ERROR)
      trackEvent('error_shown', {
        control: 'ticker_export',
        surface: 'ticker_chrome',
        ticker: ticker.toUpperCase(),
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="relative flex flex-col items-start gap-1.5 md:items-end"
      onKeyDown={(event) => {
        if (recovery && event.key === 'Escape') {
          event.stopPropagation()
          closeRecovery()
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        data-analytics-id="ticker_export"
        data-analytics-ticker={ticker.toUpperCase()}
        onClick={exportSignals}
        disabled={pending}
        aria-label={EXPORT_LABEL}
        title={EXPORT_LABEL}
        aria-busy={pending}
        aria-expanded={recovery ? true : undefined}
        aria-controls={recovery ? recoveryId : undefined}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--color-text-secondary)] shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-[30px] saturate-[1.8] transition-[border-color,color,transform] duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)] active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
      </button>

      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      {recovery ? (
        <div
          id={recoveryId}
          data-ticker-export-recovery="open"
          className="flex w-[min(16.5rem,100%)] flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-surface-elevated px-3 py-2.5 text-left"
        >
          <p className="text-caption text-content-secondary">
            {recovery.kind === 'sign-in'
              ? 'Signal export is included with Pro. Sign in to check your access.'
              : 'Signal export is included with Pro.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              ref={recoveryLinkRef}
              href={recovery.kind === 'sign-in' ? '/sign-in' : recovery.upgradeUrl}
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              {recovery.kind === 'sign-in' ? 'Sign in' : 'Upgrade to Pro'}
            </a>
            {recovery.kind === 'sign-in' ? (
              <a href={recovery.upgradeUrl} className={buttonClass({ variant: 'ghost', size: 'sm' })}>View Pro</a>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <span aria-live="polite" className="signal-bearish text-caption inline-flex max-w-52 items-center gap-1.5">
          <CircleAlert size={13} aria-hidden="true" className="shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  )
}
