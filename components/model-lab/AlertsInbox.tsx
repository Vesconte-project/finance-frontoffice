'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { buttonClass } from '@/components/ui/Button'
import type { AlertItem } from '@/lib/model-lab/contract'
import { describeError, labFetch } from '@/lib/model-lab/client'
import { alertHref } from './AlertsFeed'
import { CheckMark, formatDate } from './ui'

type Filter = 'all' | 'unread' | 'panel' | 'thesis'
const FILTERS: readonly (readonly [Filter, string])[] = [['all', 'All'], ['unread', 'Unread'], ['panel', 'Panels'], ['thesis', 'Theses']]

function dayLabel(iso: string, todayIso: string): string {
  const day = iso.slice(0, 10)
  if (day === todayIso) return 'Today'
  const diff = Math.round((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000)
  return diff === 1 ? 'Yesterday' : formatDate(iso)
}

export default function AlertsInbox({ alerts, todayIso }: { alerts: readonly AlertItem[]; todayIso: string }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set(alerts.filter((a) => a.read).map((a) => a.id)))
  const [error, setError] = useState('')

  const shown = useMemo(
    () => alerts.filter((a) => (filter === 'all' ? true : filter === 'unread' ? !read.has(a.id) : a.kind === filter)),
    [alerts, filter, read]
  )
  const groups = useMemo(() => {
    const map = new Map<string, AlertItem[]>()
    for (const a of [...shown].sort((x, y) => y.at.localeCompare(x.at))) {
      const label = dayLabel(a.at, todayIso)
      map.set(label, [...(map.get(label) ?? []), a])
    }
    return [...map.entries()]
  }, [shown, todayIso])
  const unread = alerts.filter((a) => !read.has(a.id)).length

  async function mark(ids: readonly string[] | 'all') {
    setError('')
    try {
      await labFetch('alerts/read', { method: 'POST', body: { ids } })
      setRead((current) => new Set([...current, ...(ids === 'all' ? alerts.map((a) => a.id) : ids)]))
      router.refresh()
    } catch (e) {
      setError(describeError(e))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn('h-9 cursor-pointer rounded-md border px-3 text-label-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]', filter === key ? 'border-[var(--accent)] bg-[var(--surface-soft)] text-content-primary' : 'border-[var(--line)] text-content-secondary hover:text-content-primary')}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => mark('all')} disabled={unread === 0} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'ml-auto disabled:cursor-not-allowed disabled:opacity-50')}>Mark all as read</button>
      </div>
      {error ? <p role="alert" className="text-body-sm text-content-primary">{error}</p> : null}
      {groups.length === 0 ? (
        <p className="text-body-sm text-content-muted">{alerts.length === 0 ? 'No alerts yet. When something you follow changes, it shows up here.' : 'Nothing matches this filter.'}</p>
      ) : (
        groups.map(([label, items]) => (
          <section key={label} aria-label={label} className="space-y-2">
            <h2 className="text-label-sm uppercase tracking-wide text-content-muted">{label}</h2>
            <ul className="divide-y divide-[var(--line)] rounded-md border border-[var(--line)] bg-[var(--surface)]">
              {items.map((a) => {
                const isRead = read.has(a.id)
                return (
                  <li key={a.id} className="flex items-start gap-3 p-4">
                    <CheckMark state={a.tone === 'ok' ? 'holds' : a.tone === 'warn' ? 'partly' : 'fails'} className="mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={cn('text-body-sm text-content-primary', !isRead && 'font-semibold')}>
                        {!isRead ? <span className="sr-only">Unread. </span> : null}
                        {a.title}
                      </p>
                      <p className="text-body-sm text-content-muted">{a.why}</p>
                      {a.before && a.after ? <p className="text-caption text-content-muted">Agreement: {a.before.count} of {a.before.of} → {a.after.count} of {a.after.of}</p> : null}
                      <p className="text-caption text-content-muted">{a.source} · {a.rule}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Link href={alertHref(a)} className="text-label-sm text-[var(--color-accent)] underline underline-offset-2">Open</Link>
                      {!isRead ? <button type="button" onClick={() => mark([a.id])} className="min-h-8 cursor-pointer text-caption text-content-muted underline underline-offset-2">Mark as read</button> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
