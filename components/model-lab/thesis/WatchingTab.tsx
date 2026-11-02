'use client'

import { useState } from 'react'
import { labFetch, describeError } from '@/lib/model-lab/client'
import type { HistoryPoint, WatchSettings } from '@/lib/model-lab/contract'
import { Note, Section } from '../ui'

function HistoryChart({ history }: { history: readonly HistoryPoint[] }) {
  const W = 520
  const H = 150
  const L = 30
  const R = 14
  const T = 12
  const B = 24
  const x = (i: number) => L + (i / (history.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / 5) * (H - T - B)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Checks that hold at each re-test: ${history.map((h) => `${h.label} ${h.holding}`).join(', ')}`} className="block w-full">
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <g key={k}>
          <line x1={L} x2={W - R} y1={y(k)} y2={y(k)} stroke="var(--line)" />
          <text x={L - 8} y={y(k) + 4} textAnchor="end" className="fill-[var(--text-muted)] text-[11px]">{k}</text>
        </g>
      ))}
      <path d={history.map((h, i) => `${i ? 'L' : 'M'}${x(i)} ${y(h.holding)}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" />
      {history.map((h, i) => (
        <g key={h.label}>
          <circle cx={x(i)} cy={y(h.holding)} r="4" fill="var(--text)" stroke="var(--surface)" strokeWidth="2"><title>{`${h.label}: ${h.holding} of 5 checks hold`}</title></circle>
          <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-[var(--text-muted)] text-[11px]">{h.label}</text>
        </g>
      ))}
    </svg>
  )
}

const RETEST: readonly (readonly [WatchSettings['retest'], string])[] = [['weekly', 'Every week'], ['monthly', 'Every month'], ['quarterly', 'Every quarter'], ['off', 'Never']]

export default function WatchingTab({ thesisId, history, initial }: { thesisId: string; history: readonly HistoryPoint[]; initial: WatchSettings }) {
  const [watch, setWatch] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function save(next: WatchSettings) {
    const previous = watch
    setWatch(next)
    setState('saving')
    try {
      setWatch(await labFetch<WatchSettings>(`theses/${thesisId}/watch`, { method: 'PATCH', body: next }))
      setState('saved')
    } catch (error) {
      setWatch(previous)
      setMessage(describeError(error))
      setState('error')
    }
  }

  const toggles: readonly (readonly [keyof Pick<WatchSettings, 'alertOnWeaker' | 'alertOnBetter' | 'email' | 'inApp'>, string, string])[] = [
    ['alertOnWeaker', 'Tell me when fewer checks hold', 'When a re-test finds fewer checks holding than the last one.'],
    ['alertOnBetter', 'Tell me when more checks hold', 'When a re-test finds more checks holding than the last one.'],
    ['email', 'By email', 'A short note, never more than one a day.'],
    ['inApp', 'In the Model Lab', 'Shows up under Alerts.'],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Section title="Checks that hold, over time" aside="Out of 5">
        <HistoryChart history={history} />
        <p className="text-body-sm mt-2 text-content-muted">Each point is one re-test. The line is how many of the five checks held.</p>
      </Section>
      <Section title="Watching">
        <div className="space-y-4">
          <div>
            <label htmlFor="retest" className="text-body-sm font-medium text-content-primary">Test it again</label>
            <select
              id="retest"
              value={watch.retest}
              onChange={(e) => save({ ...watch, retest: e.target.value as WatchSettings['retest'] })}
              className="mt-1 h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              {RETEST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {toggles.map(([key, label, hint]) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3">
              <input type="checkbox" checked={watch[key]} onChange={(e) => save({ ...watch, [key]: e.target.checked })} className="mt-1 h-4 w-4 cursor-pointer accent-[var(--accent)]" />
              <span>
                <span className="block text-body-sm font-medium text-content-primary">{label}</span>
                <span className="block text-caption text-content-muted">{hint}</span>
              </span>
            </label>
          ))}
          <p className="text-caption text-content-muted" role="status" aria-live="polite">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved.' : ''}</p>
          {state === 'error' ? <Note tone="warn">{message}</Note> : null}
        </div>
      </Section>
    </div>
  )
}
