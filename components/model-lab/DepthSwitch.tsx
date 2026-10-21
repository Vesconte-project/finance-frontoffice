'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setPreferenceCookie } from '@/lib/model-lab/cookies'
import { cn } from '@/lib/utils'
import type { Depth } from '@/lib/model-lab/params'

const DEPTHS: readonly { key: Depth; label: string; hint: string }[] = [
  { key: 'guided', label: 'Guided', hint: 'The sentence and the essentials' },
  { key: 'advanced', label: 'Advanced', hint: 'Every rule and trading assumption' },
  { key: 'lab', label: 'Lab', hint: 'The full engine, for team members' },
]

export default function DepthSwitch({ depth, lab }: { depth: Depth; lab: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function choose(next: Depth) {
    if (next === depth) return
    setPreferenceCookie('model_lab_depth', next)
    start(() => router.refresh())
  }

  return (
    <div role="group" aria-label="How much detail" className={cn('inline-flex rounded-md border border-[var(--line)] bg-[var(--surface)] p-0.5', pending && 'opacity-70')}>
      {DEPTHS.filter((d) => d.key !== 'lab' || lab).map((d) => (
        <button
          key={d.key}
          type="button"
          aria-pressed={depth === d.key}
          title={d.hint}
          onClick={() => choose(d.key)}
          className={cn(
            'h-8 cursor-pointer rounded px-3 text-label-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
            depth === d.key ? 'bg-[var(--surface-soft)] text-content-primary' : 'text-content-secondary hover:text-content-primary'
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
