'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { PanelBelow, PanelRule, PanelSummary } from '@/lib/model-lab/contract'
import { describeError, labFetch } from '@/lib/model-lab/client'
import { RULE_TEXT } from '@/lib/model-lab/conditions'
import { Note, Section } from '../ui'

const RULES: readonly (readonly [PanelRule, string])[] = [['agree', 'Agreement'], ['spec', 'Specialists'], ['blend', 'Blend']]

export default function ModelsTab({ panel }: { panel: PanelSummary }) {
  const [rule, setRule] = useState<PanelRule>(panel.rule)
  const [needed, setNeeded] = useState(panel.agreementNeeded)
  const [below, setBelow] = useState<PanelBelow>(panel.below)
  const [hold, setHold] = useState(panel.holdDays)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const n = panel.members.length

  async function save() {
    setState('saving')
    try {
      await labFetch<PanelSummary>(`panels/${panel.id}`, { method: 'PATCH', body: { rule, agreementNeeded: Math.min(needed, n), below, holdDays: hold } })
      setState('saved')
    } catch (error) {
      setMessage(describeError(error))
      setState('error')
    }
  }

  return (
    <div className="space-y-8">
      <Section title="Models in this panel">
        <ul className="grid gap-3 md:grid-cols-2">
          {panel.members.map((m) => (
            <li key={m.id}><Card padding="md"><p className="text-card-title text-content-primary">{m.name}</p><p className="text-body-sm text-content-muted">{m.how}</p></Card></li>
          ))}
        </ul>
      </Section>

      <Section title="The rule">
        <Card padding="md" className="space-y-4">
          <div role="radiogroup" aria-label="How the models combine" className="flex flex-wrap gap-2">
            {RULES.map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={rule === key} onClick={() => { setRule(key); setState('idle') }} className={cn('min-h-11 cursor-pointer rounded-md border px-3 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]', rule === key ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)]')}>{label}</button>
            ))}
          </div>
          <p className="text-body-sm text-content-primary">{rule === 'agree' ? RULE_TEXT.agree(Math.min(needed, n), n) : rule === 'spec' ? RULE_TEXT.spec() : RULE_TEXT.blend()}.</p>
          {rule === 'agree' ? (
            <label className="flex items-center gap-3 text-body-sm text-content-primary">Agreement needed
              <input type="number" min={1} max={n} value={Math.min(needed, n)} onChange={(e) => { setNeeded(Math.max(1, Math.min(n, Number(e.target.value) || 1))); setState('idle') }} className="h-11 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2" /> of {n}
            </label>
          ) : null}
          <label className="flex items-center gap-3 text-body-sm text-content-primary">Hold a flag for at least
            <input type="number" min={1} max={20} value={hold} onChange={(e) => { setHold(Math.max(1, Math.min(20, Number(e.target.value) || 1))); setState('idle') }} className="h-11 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2" /> days
          </label>
          <label className="flex items-center gap-3 text-body-sm text-content-primary">Below the line
            <select value={below} onChange={(e) => { setBelow(e.target.value as PanelBelow); setState('idle') }} className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2">
              <option value="flat">Take no position</option><option value="half">Keep half a position</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={state === 'saving'} className={cn(buttonClass({ size: 'sm' }), 'disabled:opacity-50')}>{state === 'saving' ? 'Saving…' : 'Save rule'}</button>
            {state === 'saved' ? <span role="status" className="text-body-sm text-content-muted">Saved. The evidence now uses this rule.</span> : null}
            {state === 'error' ? <span role="alert" className="text-body-sm text-content-primary">{message}</span> : null}
          </div>
        </Card>
        <Note className="mt-3">Changing the rule re-runs the panel’s evidence on the same past data. Nothing is re-trained.</Note>
      </Section>
    </div>
  )
}
