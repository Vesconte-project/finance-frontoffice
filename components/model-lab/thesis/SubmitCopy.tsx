'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { labFetch, describeError } from '@/lib/model-lab/client'
import Button from '@/components/ui/Button'
import { Note } from '../ui'

export default function SubmitCopy({ thesisId, submitted }: { thesisId: string; submitted: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await labFetch(`theses/${thesisId}/submit`, { method: 'POST', body: {} })
      setConfirming(false)
      router.refresh()
    } catch (problem) {
      setError(describeError(problem))
    } finally {
      setBusy(false)
    }
  }

  if (submitted) return <span className="inline-flex h-9 items-center rounded-md border border-[var(--line)] px-3 text-label-sm text-content-secondary">Copy submitted</span>
  return (
    <>
      <Button variant="secondary" size="sm" aria-expanded={confirming} onClick={() => setConfirming((v) => !v)}>Submit to Vesconte</Button>
      {confirming ? (
        <div role="group" aria-label="Submit a copy" className="basis-full space-y-3 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-4">
          <p className="text-card-title text-content-primary">Submit a copy to Vesconte?</p>
          <p className="text-body-sm text-content-muted">We keep a copy of the recipe: settings, parameters and results. Only the copy is visible to our team, and it can be considered as a candidate. Your thesis stays private, and you can keep editing or delete it.</p>
          {error ? <Note tone="warn">{error}</Note> : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit a copy'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
