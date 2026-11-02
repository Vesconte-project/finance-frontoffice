'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ThesisSummary } from '@/lib/model-lab/contract'
import { cn } from '@/lib/utils'
import Sparkline from './Sparkline'
import { Tag, formatWhen, pct } from './ui'

type Filter = 'all' | 'hi' | 'mid' | 'lo' | 'watching'
const FILTERS: readonly (readonly [Filter, string])[] = [['all', 'All'], ['hi', '4–5 checks hold'], ['mid', '2–3 hold'], ['lo', '0–1 hold'], ['watching', 'Watching']]

function matches(t: ThesisSummary, filter: Filter, q: string): boolean {
  const byFilter =
    filter === 'all' ? true : filter === 'watching' ? t.status === 'watching' : filter === 'hi' ? t.checksHolding >= 4 : filter === 'mid' ? t.checksHolding >= 2 && t.checksHolding <= 3 : t.checksHolding <= 1
  const needle = q.trim().toLowerCase()
  return byFilter && (!needle || `${t.statement} ${t.assets.join(' ')}`.toLowerCase().includes(needle))
}

export default function ThesisList({ theses, nowMs }: { theses: readonly ThesisSummary[]; nowMs: number }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const shown = useMemo(() => theses.filter((t) => matches(t, filter, q)), [theses, filter, q])

  return (
    <section className="space-y-3" aria-labelledby="theses-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="theses-heading" className="text-section-title text-content-primary">Theses you follow</h2>
        <span className="text-caption text-content-muted" aria-live="polite">{shown.length} of {theses.length} theses</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="thesis-search">Search theses</label>
        <input
          id="thesis-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by idea or stock"
          className="h-9 w-full max-w-[16rem] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        />
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'h-8 cursor-pointer rounded-md border px-2.5 text-label-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                filter === key ? 'border-[var(--accent)] bg-[var(--surface-soft)] text-content-primary' : 'border-[var(--line)] text-content-secondary hover:text-content-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 text-body-sm text-content-primary">
          No thesis matches.{' '}
          <button type="button" className="cursor-pointer text-[var(--color-accent)] underline underline-offset-2" onClick={() => { setFilter('all'); setQ('') }}>Clear the filter</button>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <li key={t.id}>
              <Link
                href={`/models/theses/${t.id}`}
                className="grid gap-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 hover:border-[var(--line-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>{t.checksHolding} of {t.checksTotal} checks hold</Tag>
                    <Tag>{t.status === 'watching' ? 'Watching' : t.status === 'tested' ? 'Tested' : 'Draft'}</Tag>
                    {t.testedAt ? <span className="text-caption text-content-muted">Tested {formatWhen(t.testedAt, nowMs).toLowerCase()}</span> : null}
                  </div>
                  <p className="font-[var(--font-display)] text-lg leading-snug text-content-primary">{t.statement}</p>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Stocks">
                    {t.assets.map((a) => <li key={a} className="rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[11px] text-content-secondary">{a}</li>)}
                  </ul>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end sm:justify-center">
                  {t.sparkline ? <Sparkline thesis={t.sparkline.thesis} benchmark={t.sparkline.benchmark} /> : null}
                  {t.returnAfterCosts !== null && t.benchmarkReturn !== null ? (
                    <span className="text-caption tabular-nums text-content-muted">{pct(t.returnAfterCosts)} vs {pct(t.benchmarkReturn)}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
