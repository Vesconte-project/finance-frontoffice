'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { describeError, labFetch } from '@/lib/model-lab/client'
import { isUuid } from '@/lib/model-lab/validate'

/** Looking at someone’s unsubmitted experiment is exceptional: it needs a reason and ends on its own. The owner is told. */
export default function AccessRequestForm() {
  const router = useRouter()
  const [experimentId, setExperimentId] = useState('')
  const [reason, setReason] = useState('')
  const [expires, setExpires] = useState<'24h' | '7d'>('24h')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const valid = isUuid(experimentId.trim()) && reason.trim().length >= 10

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setState('sending')
    try {
      await labFetch('admin/access-requests', { method: 'POST', body: { experimentId: experimentId.trim(), reason: reason.trim(), expires } })
      setState('sent')
      setExperimentId('')
      setReason('')
      router.refresh()
    } catch (error) {
      setMessage(describeError(error))
      setState('error')
    }
  }

  return (
    <form onSubmit={send} className="space-y-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="text-card-title text-content-primary">Ask to look at an unsubmitted experiment</h3>
      <label className="block text-body-sm text-content-primary">Experiment id
        <input value={experimentId} onChange={(e) => setExperimentId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-sm" />
      </label>
      <label className="block text-body-sm text-content-primary">Why you need to see it
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm" />
        <span className="text-caption text-content-muted">At least 10 characters. The owner is told, and the reason is kept in the audit log.</span>
      </label>
      <label className="block text-body-sm text-content-primary">Access lasts
        <select value={expires} onChange={(e) => setExpires(e.target.value as '24h' | '7d')} className="mt-1 h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2">
          <option value="24h">24 hours</option><option value="7d">7 days</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!valid || state === 'sending'} className={cn(buttonClass({ size: 'sm' }), 'disabled:cursor-not-allowed disabled:opacity-50')}>{state === 'sending' ? 'Sending…' : 'Request access'}</button>
        {state === 'sent' ? <span role="status" className="text-body-sm text-content-muted">Requested. The owner has been notified.</span> : null}
        {state === 'error' ? <span role="alert" className="text-body-sm text-content-primary">{message}</span> : null}
      </div>
    </form>
  )
}
