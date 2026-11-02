'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { labFetch, describeError } from '@/lib/model-lab/client'
import Button from '@/components/ui/Button'
import { Note } from '../ui'

/** Admins only. Sharing is between admins; a customer's model is never shared. */
export default function ShareWithAdmins({ thesisId, shared }: { thesisId: string; shared: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function share() {
    setBusy(true)
    setError('')
    try {
      await labFetch(`theses/${thesisId}/share`, { method: 'POST', body: {} })
      setConfirming(false)
      router.refresh()
    } catch (problem) {
      setError(describeError(problem))
    } finally {
      setBusy(false)
    }
  }

  if (shared) return <span className="inline-flex h-9 items-center rounded-md border border-[var(--line)] px-3 text-label-sm text-content-secondary">Shared with admins</span>
  return (
    <>
      <Button variant="secondary" size="sm" aria-expanded={confirming} onClick={() => setConfirming((v) => !v)}>Share with admins</Button>
      {confirming ? (
        <div role="group" aria-label="Share with admins" className="basis-full space-y-3 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-4">
          <p className="text-card-title text-content-primary">Share this thesis with the other admins?</p>
          <p className="text-body-sm text-content-muted">They see the thesis, its checks and its results, and can select it as a candidate for production. Only you can edit it.</p>
          {error ? <Note tone="warn">{error}</Note> : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={share} disabled={busy}>{busy ? 'Sharing…' : 'Share'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
