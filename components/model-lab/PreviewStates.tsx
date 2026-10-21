'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { FIXTURE_STATE_COOKIE, serializeFixtureState, type FixtureState } from '@/lib/model-lab/fixtures/source'
import { setPreferenceCookie } from '@/lib/model-lab/cookies'
import { cn } from '@/lib/utils'

const GROUPS: readonly { key: keyof FixtureState; label: string; options: readonly (readonly [string, string])[] }[] = [
  { key: 'role', label: 'Who', options: [['investor', 'Investor'], ['team', 'Team member']] },
  { key: 'plan', label: 'Plan', options: [['pro', 'Pro'], ['free', 'Free']] },
  { key: 'account', label: 'Account', options: [['full', 'With theses'], ['empty', 'Empty']] },
  { key: 'credits', label: 'Credit', options: [['plenty', 'Plenty'], ['low', 'Almost out']] },
  { key: 'run', label: 'Next run', options: [['ok', 'Works'], ['fail', 'Fails']] },
  { key: 'data', label: 'Data', options: [['fresh', 'Fresh'], ['partial', 'Partial'], ['stale', 'Stale']] },
]

/** Only rendered on fixture data: lets a reviewer put the whole Model Lab into any state. */
export default function PreviewStates({ state }: { state: FixtureState }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, start] = useTransition()

  function set(key: keyof FixtureState, value: string) {
    const next = { ...state, [key]: value } as FixtureState
    setPreferenceCookie(FIXTURE_STATE_COOKIE, serializeFixtureState(next))
    if (key === 'role' && value !== 'team') setPreferenceCookie('model_lab_depth', 'guided')
    start(() => router.refresh())
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div role="group" aria-label="Preview states" className="w-72 space-y-3 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-4 shadow-none">
          <p className="text-caption uppercase tracking-[0.14em] text-content-muted">Preview states · synthetic data</p>
          {GROUPS.map((g) => (
            <div key={g.key} role="group" aria-label={g.label} className="space-y-1">
              <div className="text-caption text-content-muted">{g.label}</div>
              <div className="flex flex-wrap gap-1">
                {g.options.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-preview={`${g.key}|${value}`}
                    aria-pressed={state[g.key] === value}
                    onClick={() => set(g.key, value)}
                    className={cn(
                      'h-8 cursor-pointer rounded-md border px-2.5 text-label-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                      state[g.key] === value ? 'border-[var(--accent)] bg-[var(--surface-soft)] text-content-primary' : 'border-[var(--line)] text-content-secondary hover:text-content-primary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-9 cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-label-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        States
      </button>
    </div>
  )
}
