'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { filterTickerIndexItems, type CachedTickerIndex } from '@/lib/ticker-search'
import { loadTickerIndex } from '@/lib/model-lab/ticker-index-client'

const MAX_STOCKS = 100

type StockPickerProps = {
  value: readonly string[]
  onChange: (next: string[]) => void
}

/** Choose the stocks a thesis is about. Suggestions come from the ticker index, filtered here. */
export default function StockPicker({ value, onChange }: StockPickerProps) {
  const [index, setIndex] = useState<CachedTickerIndex | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [query, setQuery] = useState('')
  const inputId = useId()
  const listId = useId()

  useEffect(() => {
    let live = true
    void loadTickerIndex().then((loaded) => {
      if (!live) return
      setIndex(loaded)
      setState(loaded ? 'ready' : 'unavailable')
    })
    return () => {
      live = false
    }
  }, [])

  const results = useMemo(
    () => (index ? filterTickerIndexItems(index.items, query, 6).filter((r) => !value.includes(r.symbol)) : []),
    [index, query, value]
  )

  function add(symbol: string) {
    if (value.includes(symbol) || value.length >= MAX_STOCKS) return
    onChange([...value, symbol])
    setQuery('')
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const first = results[0]
    if (first) add(first.symbol)
  }

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block text-label-sm text-content-primary">Add a stock</label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={state === 'unavailable'}
        autoComplete="off"
        placeholder={state === 'unavailable' ? 'Stock search is unavailable right now' : 'Search by ticker or company'}
        aria-controls={listId}
        className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-body-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      />
      <ul id={listId} aria-label="Suggestions" className="grid gap-1 sm:grid-cols-2">
        {results.map((r) => (
          <li key={r.symbol}>
            <button
              type="button"
              onClick={() => add(r.symbol)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border border-[var(--line)] px-3 text-left hover:border-[var(--line-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="font-mono text-sm text-content-primary">{r.symbol}</span>
              <span className="truncate text-caption text-content-muted">{r.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {state === 'loading' ? <p className="text-caption text-content-muted" role="status">Loading stocks…</p> : null}
      {state === 'unavailable' ? <p className="text-caption text-content-muted" role="status">The stock list could not be loaded. Reload the page to try again.</p> : null}
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Chosen stocks">
          {value.map((symbol) => (
            <li key={symbol} className="inline-flex h-9 items-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-3 font-mono text-sm text-content-primary">
              {symbol}
              <button
                type="button"
                aria-label={`Remove ${symbol}`}
                onClick={() => onChange(value.filter((v) => v !== symbol))}
                className="flex h-9 w-9 cursor-pointer items-center justify-center text-content-muted hover:text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-content-muted">No stocks yet. A test needs at least two.</p>
      )}
    </div>
  )
}
