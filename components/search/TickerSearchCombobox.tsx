'use client'

import { CircleAlert, History, Loader2, Radar, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import { buttonClass } from '@/components/ui/Button'
import {
  filterTickerIndexItems,
  getFeaturedTickerIndexResults,
  normalizeTickerIndexPayload,
  normalizeTickerSearchQuery,
  tickerEntityDisplayName,
  tickerEntitySiblingListings,
  tickerIndexItemToSearchResult,
  type CachedTickerIndex,
  type TickerIndexPayload,
  type TickerSearchResult,
} from '@/lib/ticker-search'
import { cn } from '@/lib/utils'

type TickerSearchComboboxProps = {
  className?: string
  initialValue?: string
  label?: string
  maxSuggestions?: number
  placeholder: string
  /* Cycled through the placeholder as if typed, until the field is first used.
     These are input examples, not data — the accessible name stays
     `placeholder` so a screen reader is never read a moving target. */
  typingHints?: readonly string[]
  routeForTicker: (symbol: string) => string
  submitLabel?: string | null
  variant: 'header' | 'panel'
}

type DisplaySource = 'recent' | 'featured' | 'result'

type DisplayItem = TickerSearchResult & {
  displaySource: DisplaySource
}

type DisplaySection = {
  items: DisplayItem[]
  label: string
}

const RECENT_TICKERS_STORAGE_KEY = 'spy_recent_tickers_v1'
const TICKER_INDEX_STORAGE_KEY = 'spy_ticker_index_v1'

let memoryTickerIndex: CachedTickerIndex | null = null
let memoryTickerIndexPromise: Promise<CachedTickerIndex | null> | null = null

function readSessionTickerIndex(): CachedTickerIndex | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(TICKER_INDEX_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized = normalizeTickerIndexPayload(parsed, typeof parsed.etag === 'string' ? parsed.etag : null)
    return normalized
  } catch {
    return null
  }
}

function writeSessionTickerIndex(value: CachedTickerIndex): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(TICKER_INDEX_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Ignore session storage errors.
  }
}

async function fetchTickerIndex(
  existing: CachedTickerIndex | null
): Promise<CachedTickerIndex | null> {
  const response = await fetch('/api/tickers/index', {
    cache: 'no-store',
    headers: existing?.etag ? { 'If-None-Match': existing.etag } : undefined,
  })

  if (response.status === 304) {
    return existing
  }
  if (!response.ok) {
    let errorCode = ''
    try {
      const payload = (await response.clone().json()) as { error?: unknown }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        errorCode = `: ${payload.error.trim()}`
      }
    } catch {
      // Keep the status-only error when the proxy response is not JSON.
    }
    throw new Error(`ticker index request failed (${response.status})${errorCode}`)
  }

  const payload = (await response.json()) as TickerIndexPayload
  return normalizeTickerIndexPayload(payload, response.headers.get('etag'))
}

async function loadTickerIndex(): Promise<CachedTickerIndex | null> {
  if (memoryTickerIndexPromise) return memoryTickerIndexPromise

  const existing = memoryTickerIndex ?? readSessionTickerIndex()
  if (!memoryTickerIndex && existing) {
    memoryTickerIndex = existing
  }

  memoryTickerIndexPromise = fetchTickerIndex(existing)
    .then((next) => {
      if (next) {
        memoryTickerIndex = next
        writeSessionTickerIndex(next)
        return next
      }
      return existing
    })
    .finally(() => {
      memoryTickerIndexPromise = null
    })

  return memoryTickerIndexPromise
}

function sourceChipClass(item: DisplayItem): string {
  if (item.readiness?.label === 'Rejected') {
    return 'border-danger/30 bg-danger/10 text-danger'
  }
  if (item.readiness?.tone === 'missing') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-500'
  }
  if (item.readiness?.tone === 'partial') {
    return 'border-primary/28 bg-primary/10 text-accent-text'
  }
  if (item.tone === 'bullish') {
    return 'signal-bg-bullish signal-bullish border-[var(--bull-200)]'
  }
  if (item.tone === 'bearish') {
    return 'signal-bg-bearish signal-bearish border-[var(--bear-200)]'
  }
  if (item.tone === 'neutral') {
    return 'signal-bg-neutral signal-neutral border-[var(--neutral-200)]'
  }
  if (item.hasSignals) {
    return 'border-primary/28 bg-primary/10 text-accent-text'
  }
  return 'border-border bg-surface-elevated text-content-muted'
}

function sourceLabel(item: DisplayItem): string | null {
  if (item.readiness && item.readiness.label !== 'Tracked') return item.readiness.label
  if (item.convictionPct !== null) return `${item.convictionPct}%`
  if (item.hasSignals) return 'Tracked'
  return null
}

function rightSubLabel(item: DisplayItem): string | null {
  if (item.convictionPct !== null && item.tone) return item.tone.toUpperCase()
  return item.exchange
}

function statusIconClass(item: DisplayItem): string {
  if (item.readiness?.label === 'Rejected') return 'border-danger/25 bg-danger/10 text-danger'
  if (item.readiness?.tone === 'missing') return 'border-amber-400/30 bg-amber-400/10 text-amber-500'
  if (item.readiness?.tone === 'partial') return 'border-primary/25 bg-primary/10 text-accent-text'
  if (item.hasSignals) return 'border-primary/25 bg-primary/10 text-accent-text'
  return 'border-border bg-surface-elevated text-content-muted'
}

function statusIcon(item: DisplayItem): typeof CircleAlert | typeof Radar | null {
  if (item.readiness?.label === 'Rejected' || item.readiness?.tone === 'missing') return CircleAlert
  if (item.readiness?.tone === 'partial' || item.hasSignals) return Radar
  return null
}

export default function TickerSearchCombobox({
  className,
  initialValue = '',
  label,
  maxSuggestions = 8,
  placeholder,
  typingHints,
  routeForTicker,
  submitLabel = null,
  variant,
}: TickerSearchComboboxProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialValue)
  const [typedHint, setTypedHint] = useState<string | null>(null)
  const [caretOn, setCaretOn] = useState(true)
  const lastKeystrokeAt = useRef(0)
  const [tickerIndex, setTickerIndex] = useState<CachedTickerIndex | null>(memoryTickerIndex)
  const [recentTickers, setRecentTickers] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasLoadedIndexOnce, setHasLoadedIndexOnce] = useState(Boolean(memoryTickerIndex?.items.length))
  const [loadAttemptToken, setLoadAttemptToken] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputId = useId()
  const listboxId = `${inputId}-listbox`
  const normalizedSearch = normalizeTickerSearchQuery(search)

  const hintsActive = !!typingHints?.length && !isOpen && !search
  useEffect(() => {
    if (!hintsActive || !typingHints?.length) {
      setTypedHint(null)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    // The first thing erased is the real placeholder, so the hint grows out of
    // the label the field already had instead of replacing it in one frame.
    let current = placeholder
    let index = -1
    let cut = placeholder.length
    let erasing = true

    const step = () => {
      if (cancelled) return
      // Idle in a background tab rather than typing to nobody.
      if (document.hidden) {
        timer = setTimeout(step, 400)
        return
      }
      cut += erasing ? -1 : 1
      lastKeystrokeAt.current = Date.now()
      setTypedHint(current.slice(0, cut))

      let wait = erasing ? 55 : 120
      if (!erasing && cut >= current.length) {
        erasing = true
        wait = 2800
      } else if (erasing && cut <= 0) {
        erasing = false
        index += 1
        current = typingHints[index % typingHints.length]
        wait = 700
      }
      timer = setTimeout(step, wait)
    }

    // The hints are a nudge for someone who has not acted, not an animation that
    // plays at everyone. The real placeholder holds well past the point where a
    // visitor who knew what they wanted would already be typing — and note this
    // clock starts at mount, roughly a second before the field finishes
    // arriving. The same wait is the pause before hints return once someone
    // opens the field and leaves without typing.
    timer = setTimeout(step, 7000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [hintsActive, typingHints, placeholder])

  // A real caret holds steady while characters are landing and blinks once the
  // typing pauses. A block that never blinks reads as a glyph, not a cursor.
  useEffect(() => {
    if (!hintsActive) return
    const id = setInterval(() => {
      if (Date.now() - lastKeystrokeAt.current < 400) {
        setCaretOn(true)
        return
      }
      setCaretOn((on) => !on)
    }, 530)
    return () => clearInterval(id)
  }, [hintsActive])

  useEffect(() => {
    setSearch(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (memoryTickerIndex) {
      setTickerIndex(memoryTickerIndex)
      setHasLoadedIndexOnce(memoryTickerIndex.items.length > 0)
    }

    const cached = readSessionTickerIndex()
    if (!memoryTickerIndex && cached) {
      memoryTickerIndex = cached
      setTickerIndex(cached)
      if (cached.items.length > 0) {
        setHasLoadedIndexOnce(true)
      }
    }

    setLoadAttemptToken((value) => value + 1)
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_TICKERS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const next = parsed
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(value))
        .slice(0, 6)
      setRecentTickers(next)
    } catch {
      setRecentTickers([])
    }
  }, [])

  useEffect(() => {
    if (loadAttemptToken === 0) return

    let isCurrent = true
    const cached = memoryTickerIndex ?? readSessionTickerIndex()
    if (cached) {
      memoryTickerIndex = cached
      setTickerIndex(cached)
    }

    if (cached?.items.length && hasLoadedIndexOnce && !memoryTickerIndexPromise) return

    setIsLoading(true)
    setLoadError(null)

    void (async () => {
      try {
        const next = await loadTickerIndex()
        if (!isCurrent) return

        if (next) {
          setTickerIndex(next)
          setHasLoadedIndexOnce(next.items.length > 0)
          return
        }

        setHasLoadedIndexOnce(Boolean(cached?.items.length))
      } catch (error) {
        if (!isCurrent) return
        if (!cached) setTickerIndex(null)
        setHasLoadedIndexOnce(Boolean(cached?.items.length))
        setLoadError('The ticker index is unavailable right now.')
        console.warn('[TickerSearchCombobox] ticker index unavailable; autocomplete suggestions may be limited.', {
          message: error instanceof Error ? error.message : 'Unknown ticker index error',
        })
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    })()

    return () => {
      isCurrent = false
    }
  }, [hasLoadedIndexOnce, loadAttemptToken])

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [normalizedSearch])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  const featuredBase = useMemo(() => {
    if (tickerIndex) return getFeaturedTickerIndexResults(tickerIndex.items, 8)
    return []
  }, [tickerIndex])

  const tickerIndexBySymbol = useMemo(() => {
    const items = new Map<string, TickerSearchResult>()
    for (const item of tickerIndex?.items ?? []) {
      items.set(item.symbol, tickerIndexItemToSearchResult(item))
    }
    return items
  }, [tickerIndex])

  const resultSuggestions = useMemo<DisplayItem[]>(() => {
    if (!tickerIndex || !normalizedSearch) return []
    return filterTickerIndexItems(tickerIndex.items, normalizedSearch, 8).map((item) => ({
      ...item,
      displaySource: 'result' as const,
    }))
  }, [normalizedSearch, tickerIndex])

  const recentSuggestions = useMemo<DisplayItem[]>(() => {
    return recentTickers.flatMap((symbol) => {
      const match = tickerIndexBySymbol.get(symbol)
      if (!match) return []
      return [{
        ...match,
        displaySource: 'recent',
      }]
    })
  }, [recentTickers, tickerIndexBySymbol])

  const featuredSuggestions = useMemo<DisplayItem[]>(() => {
    const recentSet = new Set(recentTickers)
    return featuredBase
      .filter((item) => !recentSet.has(item.symbol))
      .slice(0, 8)
      .map((item) => ({
        ...item,
        displaySource: 'featured' as const,
      }))
  }, [featuredBase, recentTickers])

  const sections = useMemo<DisplaySection[]>(() => {
    if (normalizedSearch.length > 0) {
      const nextSections: DisplaySection[] = []

      if (resultSuggestions.length > 0) {
        nextSections.push({
          label: '',
          items: resultSuggestions,
        })
      }

      return nextSections
    }

    const nextSections: DisplaySection[] = []
    if (recentSuggestions.length > 0) {
      nextSections.push({ label: '', items: recentSuggestions })
    }
    if (featuredSuggestions.length > 0) {
      nextSections.push({
        label: '',
        items: featuredSuggestions,
      })
    }
    return nextSections
  }, [
    featuredSuggestions,
    normalizedSearch.length,
    recentSuggestions,
    resultSuggestions,
  ])

  const visibleSections = useMemo<DisplaySection[]>(() => {
    let remaining = Math.max(1, maxSuggestions)

    return sections.flatMap((section) => {
      if (remaining <= 0) return []
      const items = section.items.slice(0, remaining)
      remaining -= items.length
      return items.length > 0 ? [{ ...section, items }] : []
    })
  }, [maxSuggestions, sections])

  const selectableItems = useMemo(() => visibleSections.flatMap((section) => section.items), [visibleSections])
  const shouldShowDropdown = isOpen && (sections.length > 0 || normalizedSearch.length > 0)
  const highlightedItem = highlightedIndex >= 0 ? selectableItems[highlightedIndex] : undefined
  const activeDescendantId = highlightedItem
    ? `${listboxId}-option-${highlightedItem.displaySource}-${highlightedItem.symbol}`
    : undefined

  function queueTickerIndexLoad() {
    const cached = memoryTickerIndex ?? tickerIndex ?? readSessionTickerIndex()
    if (cached && cached !== tickerIndex) {
      memoryTickerIndex = cached
      setTickerIndex(cached)
      if (cached.items.length > 0) {
        setHasLoadedIndexOnce(true)
      }
    }

    const hasUsableIndex = Boolean(cached?.items.length)

    if (hasUsableIndex && hasLoadedIndexOnce) return
    if (isLoading) return

    setLoadError(null)
    setLoadAttemptToken((value) => value + 1)
  }

  function pushRecentTicker(ticker: string) {
    const symbol = ticker.trim().toUpperCase()
    if (!symbol) return

    setRecentTickers((prev) => {
      const next = [symbol, ...prev.filter((value) => value !== symbol)].slice(0, 6)
      try {
        window.localStorage.setItem(RECENT_TICKERS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors.
      }
      return next
    })
  }

  function handleSearchChange(nextValue: string) {
    setSearch(nextValue)
    setIsOpen(true)

    if (nextValue.trim().length > 0) {
      queueTickerIndexLoad()
    }
  }

  function navigateToTicker(tickerRaw: string) {
    const symbol = tickerRaw.trim().toUpperCase()
    if (!symbol) return
    pushRecentTicker(symbol)
    setSearch(symbol)
    setIsOpen(false)
    setHighlightedIndex(-1)
    router.push(routeForTicker(symbol))
  }

  function submitSearch() {
    const firstResult = resultSuggestions[0]
    if (firstResult) {
      navigateToTicker(firstResult.symbol)
      return
    }
  }

  function cancelBlurClose() {
    if (!blurTimeoutRef.current) return
    clearTimeout(blurTimeoutRef.current)
    blurTimeoutRef.current = null
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      if (!selectableItems.length) return
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((prev) => (prev + 1) % selectableItems.length)
      return
    }

    if (event.key === 'ArrowUp') {
      if (!selectableItems.length) return
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((prev) => (prev <= 0 ? selectableItems.length - 1 : prev - 1))
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < selectableItems.length) {
        const selected = selectableItems[highlightedIndex]
        if (selected) navigateToTicker(selected.symbol)
        return
      }

      submitSearch()
    }
  }

  function renderSuggestion(item: DisplayItem, index: number) {
    const labelText = sourceLabel(item)
    const subLabelText = rightSubLabel(item)
    const StatusIcon = statusIcon(item)
    const siblingListings = tickerEntitySiblingListings(item)
    const displayName = tickerEntityDisplayName(item)
    const optionId = `${listboxId}-option-${item.displaySource}-${item.symbol}`
    return (
      <li key={`${item.displaySource}-${item.symbol}`} role="presentation">
        <button
          id={optionId}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={index === highlightedIndex}
          data-highlighted={index === highlightedIndex ? 'true' : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => navigateToTicker(item.symbol)}
          className={cn(
            'state-interactive grid w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-inset',
            index === highlightedIndex ? 'bg-surface-hover' : 'hover:bg-surface-elevated'
          )}
        >
          <div className="flex items-center justify-center">
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-full border', statusIconClass(item))}>
              {StatusIcon ? (
                <StatusIcon className="h-4 w-4" />
              ) : (
                <span className="text-micro font-semibold">{item.symbol.slice(0, 1)}</span>
              )}
            </span>
          </div>
          <div className="ticker-search__option-content min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="ticker-search__name min-w-0 truncate text-body-sm font-semibold text-content-primary" title={displayName}>
                {displayName}
              </div>
              <span className="ticker-search__symbol numeric-tabular shrink-0 text-micro font-semibold text-content-secondary">
                {item.symbol}
              </span>
              {item.displaySource === 'recent' ? (
                <span className="ticker-search__source inline-flex shrink-0 items-center gap-1 text-micro text-content-muted">
                  <History className="h-3.5 w-3.5" />
                  Recent
                </span>
              ) : item.displaySource === 'featured' && item.hasSignals ? (
                <span className="ticker-search__source inline-flex shrink-0 items-center gap-1 text-micro text-content-muted">
                  <Radar className="h-3.5 w-3.5" />
                  Tracked
                </span>
              ) : item.hasSignals ? (
                <span className="ticker-search__source inline-flex shrink-0 items-center gap-1 text-micro text-content-muted">
                  <Radar className="h-3.5 w-3.5" />
                  Signal
                </span>
              ) : null}
            </div>
            {siblingListings ? (
              <span className="sr-only">Also listed: {siblingListings.filter((symbol) => symbol !== item.symbol).join(', ')}</span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-right">
            {labelText ? (
              <span className={cn('ticker-search__status-chip rounded-full border px-1.5 py-0.5 text-micro', sourceChipClass(item))}>
                {labelText}
              </span>
            ) : null}
            {subLabelText ? <span className="text-micro text-content-muted">{subLabelText}</span> : null}
          </div>
        </button>
      </li>
    )
  }

  const inputClassName =
    variant === 'header'
      ? 'no-lift-interaction h-12 rounded-full border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] pl-11 pr-10 shadow-[var(--glass-shadow)] backdrop-blur-xl placeholder:text-content-muted/80 hover:border-[color:var(--app-border-strong,var(--glass-border))] hover:bg-[color:var(--surface-hover)] focus-visible:border-brand-spark focus-visible:ring-brand-spark/30'
      : 'h-11 pr-24 pl-9 uppercase'

  const panelClassName =
    variant === 'header'
      ? 'ticker-search__panel mt-2 rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] shadow-[var(--glass-shadow-strong,var(--glass-shadow))] ring-1 ring-[color:var(--glass-border)] backdrop-blur-[24px]'
      : 'mt-1 rounded-xl border border-border bg-surface-card shadow-sm'

  return (
    <div
      className={cn('ticker-search__root relative', className)}
      data-open={shouldShowDropdown ? 'true' : 'false'}
    >
      {label ? <label htmlFor={inputId} className="text-filter-label mb-2 block">{label}</label> : null}

      <Search
        className={cn(
          'ticker-search__icon pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-content-muted',
          label ? 'top-[calc(50%+17px)]' : 'left-4'
        )}
      />

      <Input
        id={inputId}
        type="text"
        value={search}
        onChange={(event) => handleSearchChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          cancelBlurClose()
          setIsOpen(true)
          queueTickerIndexLoad()
        }}
        onBlur={() => {
          cancelBlurClose()
          blurTimeoutRef.current = setTimeout(() => {
            setIsOpen(false)
            blurTimeoutRef.current = null
          }, 120)
        }}
        placeholder={typedHint === null ? placeholder : `${typedHint}${caretOn ? '\u258f' : ' '}`}
        className={inputClassName}
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={shouldShowDropdown ? activeDescendantId : undefined}
        aria-haspopup="listbox"
        aria-label={label ? undefined : placeholder}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
      />

      {submitLabel ? (
        <button
          type="button"
          onClick={submitSearch}
          className={cn(buttonClass({ variant: 'primary', size: 'sm' }), 'absolute right-1.5 top-1.5 h-8')}
        >
          {submitLabel}
        </button>
      ) : null}

      {isLoading ? (
        <div
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-muted',
            submitLabel ? 'right-16' : ''
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : null}

      <div
        id={listboxId}
        className={cn('absolute left-0 right-0 top-full z-50 overflow-hidden', panelClassName)}
        role="listbox"
        aria-label="Ticker suggestions"
        aria-busy={isLoading}
        data-open={shouldShowDropdown ? 'true' : 'false'}
        data-query={normalizedSearch.length > 0 ? 'true' : 'false'}
        aria-hidden={!shouldShowDropdown}
        inert={!shouldShowDropdown ? true : undefined}
      >
          <div data-lenis-prevent className="ticker-search__scroll max-h-[28rem] overflow-auto p-1.5">
            {visibleSections.map((section, sectionGroupIndex) => {
              let runningIndex = 0
              for (const previousSection of visibleSections) {
                if (previousSection === section) break
                runningIndex += previousSection.items.length
              }

              return (
                <div
                  key={`section-${sectionGroupIndex}`}
                  className={sectionGroupIndex > 0 ? 'border-t border-border/70' : undefined}
                >
                  {section.label ? (
                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted/90">
                      {section.label}
                    </div>
                  ) : null}
                  <ul role="presentation">
                    {section.items.map((item, sectionIndex) => renderSuggestion(item, runningIndex + sectionIndex))}
                  </ul>
                </div>
              )
            })}

            {isLoading && normalizedSearch.length > 0 ? (
              <div role="status" className="flex items-center gap-2 border-t border-border/70 px-4 py-4 text-body-sm text-content-secondary">
                <Loader2 className="h-4 w-4 animate-spin text-brand-spark" aria-hidden="true" />
                Loading indexed tickers…
              </div>
            ) : null}

            {!isLoading && loadError && normalizedSearch.length > 0 && resultSuggestions.length === 0 ? (
              <div className="border-t border-border/70 px-4 py-4">
                <div className="text-body-sm text-content-primary">Ticker search is unavailable.</div>
                <div className="mt-1 text-caption text-content-muted">{loadError} Try again in a moment.</div>
              </div>
            ) : null}

            {!isLoading && !loadError && normalizedSearch.length > 0 && resultSuggestions.length === 0 ? (
              <div className="border-t border-border/70 px-4 py-4">
                <div className="text-body-sm text-content-primary">No exact match found.</div>
                <div className="mt-1 text-caption text-content-muted">
                  Try a symbol, company name, or exchange from the indexed universe.
                </div>
              </div>
            ) : null}
          </div>
      </div>
    </div>
  )
}
