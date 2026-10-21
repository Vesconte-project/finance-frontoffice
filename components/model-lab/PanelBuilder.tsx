'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { LibraryModel, PanelRule, PanelSummary } from '@/lib/model-lab/contract'
import { describeError, labFetch } from '@/lib/model-lab/client'
import { CONDITION_LABELS, SKILL_THRESHOLD } from '@/lib/model-lab/conditions'
import StockPicker from './StockPicker'
import { Note, Section } from './ui'

const MIN_MODELS = 2
const MAX_MODELS = 6
const RULES: readonly { key: PanelRule; name: string; hint: string }[] = [
  { key: 'agree', name: 'Agreement', hint: 'Flag a stock when enough of the models flag it.' },
  { key: 'spec', name: 'Specialists', hint: 'Listen to the models with a good record in today’s conditions.' },
  { key: 'blend', name: 'Blend', hint: 'Average every model’s score into one.' },
]

type PanelBuilderProps = { library: readonly LibraryModel[]; preselected: readonly string[]; watchlist: readonly string[] }

/** Choose models you have tested, say how they combine, and see which conditions none of them covers. */
export default function PanelBuilder({ library, preselected, watchlist }: PanelBuilderProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<string[]>(() => preselected.filter((id) => library.some((m) => m.runId === id)).slice(0, MAX_MODELS))
  const [rule, setRule] = useState<PanelRule>('agree')
  const [needed, setNeeded] = useState(2)
  const [assets, setAssets] = useState<string[]>([...watchlist])
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [error, setError] = useState('')

  const members = library.filter((m) => chosen.includes(m.runId))
  const needNow = Math.min(needed, Math.max(1, members.length))
  const conditionKeys = Object.keys(CONDITION_LABELS)
  const blind = members.length > 0 ? conditionKeys.filter((k) => members.every((m) => (m.skill[k] ?? 0) < SKILL_THRESHOLD)) : []
  const valid = members.length >= MIN_MODELS && name.trim().length > 0

  function toggle(runId: string) {
    setChosen((current) => (current.includes(runId) ? current.filter((id) => id !== runId) : current.length >= MAX_MODELS ? current : [...current, runId]))
  }

  async function create() {
    if (!valid) return
    setState('saving')
    try {
      const panel = await labFetch<PanelSummary>('panels', { method: 'POST', body: { name: name.trim(), memberRunIds: chosen, rule, agreementNeeded: needNow, assets } })
      router.push(`/models/panels/${panel.id}`)
    } catch (e) {
      setError(describeError(e))
      setState('failed')
    }
  }

  return (
    <div className="space-y-8">
      <Section title="Name">
        <label className="block">
          <span className="sr-only">Panel name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="For example: Core panel" className="h-11 w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-body-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]" />
        </label>
      </Section>

      <Section title="Models" aside={`${members.length} of ${MAX_MODELS} chosen`}>
        {library.length === 0 ? (
          <p className="text-body-sm text-content-muted">You have no tested models yet. Run a test first, then come back.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {library.map((m) => {
              const on = chosen.includes(m.runId)
              return (
                <li key={m.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggle(m.runId)} className={cn('flex min-h-11 w-full cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)]', on ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]')}>
                    <span className="text-sm font-medium text-content-primary">{m.name}</span>
                    <span className="text-caption text-content-muted">{m.how}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {members.length > 0 && members.length < MIN_MODELS ? <p className="mt-2 text-caption text-content-muted">Choose at least {MIN_MODELS} models.</p> : null}
      </Section>

      <Section title="How they combine">
        <ul className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How they combine">
          {RULES.map((r) => (
            <li key={r.key}>
              <button type="button" role="radio" aria-checked={rule === r.key} onClick={() => setRule(r.key)} className={cn('flex min-h-11 w-full cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)]', rule === r.key ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]')}>
                <span className="text-sm font-medium text-content-primary">{r.name}</span>
                <span className="text-caption text-content-muted">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        {rule === 'agree' ? (
          <label className="mt-4 flex items-center gap-3 text-body-sm text-content-primary">
            Agreement needed
            <input type="number" min={1} max={Math.max(1, members.length)} value={needNow} onChange={(e) => setNeeded(Math.max(1, Number(e.target.value) || 1))} className="h-11 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2" />
            <span className="text-content-muted">of {members.length || '…'}</span>
          </label>
        ) : null}
      </Section>

      {members.length >= MIN_MODELS ? (
        <Section title="What these models cover">
          <Card padding="md">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">How often each model was right on days with each market condition</caption>
              <thead>
                <tr className="text-caption text-content-muted">
                  <th scope="col" className="py-1 pr-3 font-medium">Condition</th>
                  {members.map((m) => <th key={m.id} scope="col" className="py-1 pr-3 font-medium">{m.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {conditionKeys.map((k) => (
                  <tr key={k} className="border-t border-[var(--line)]">
                    <th scope="row" className="py-2 pr-3 text-body-sm font-medium text-content-primary">{CONDITION_LABELS[k]}</th>
                    {members.map((m) => {
                      const v = m.skill[k] ?? 0
                      return <td key={m.id} className={cn('py-2 pr-3 text-body-sm tabular-nums', v >= SKILL_THRESHOLD ? 'font-medium text-content-primary' : 'text-content-muted')}>{Math.round(v * 100)}%</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-caption text-content-muted">How often the model was right on days like this. Bold means 55% or more.</p>
          </Card>
          {blind.length > 0 ? <Note tone="warn" className="mt-3">None of these models has a good record in: {blind.map((k) => CONDITION_LABELS[k].toLowerCase()).join(', ')}. The panel has nothing to say on those days.</Note> : null}
        </Section>
      ) : null}

      <Section title="Stocks">
        <Card padding="md"><StockPicker value={assets} onChange={setAssets} /></Card>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={create} disabled={!valid || state === 'saving'} className={cn(buttonClass(), 'disabled:cursor-not-allowed disabled:opacity-50')}>{state === 'saving' ? 'Creating…' : 'Create panel'}</button>
        {state === 'failed' ? <p role="alert" className="text-body-sm text-content-primary">{error}</p> : null}
      </div>
    </div>
  )
}
