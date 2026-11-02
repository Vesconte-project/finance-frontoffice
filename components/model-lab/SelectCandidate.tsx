'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { labFetch, describeError } from '@/lib/model-lab/client'
import Button from '@/components/ui/Button'
import { Note } from './ui'

/** Admins only. Selecting is the frontoffice step; approval happens in the backoffice. */
export default function SelectCandidate({ thesisId, selected }: { thesisId: string; selected: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function select() {
    setBusy(true)
    setError('')
    try {
      await labFetch('admin/candidates', { method: 'POST', body: { thesisId } })
      router.refresh()
    } catch (problem) {
      setError(describeError(problem))
    } finally {
      setBusy(false)
    }
  }

  if (selected) return <span className="inline-flex h-9 items-center rounded-md border border-[var(--line)] px-3 text-label-sm text-content-secondary">Candidate</span>
  return (
    <>
      <Button variant="secondary" size="sm" onClick={select} disabled={busy}>{busy ? 'Selecting…' : 'Select as candidate'}</Button>
      {error ? <div className="basis-full"><Note tone="warn">{error}</Note></div> : null}
    </>
  )
}
