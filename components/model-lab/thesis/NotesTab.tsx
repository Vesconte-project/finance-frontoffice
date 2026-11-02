'use client'

import { useState } from 'react'
import { labFetch, describeError } from '@/lib/model-lab/client'
import type { Note as NoteDto, Version } from '@/lib/model-lab/contract'
import { Note, Section, formatWhen } from '../ui'
import Button from '@/components/ui/Button'

export default function NotesTab({ thesisId, notes, versions, holding, total, nowMs }: { thesisId: string; notes: readonly NoteDto[]; versions: readonly Version[]; holding: number; total: number; nowMs: number }) {
  const [list, setList] = useState(notes)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const note = await labFetch<NoteDto>(`theses/${thesisId}/notes`, { method: 'POST', body: { text } })
      setList((current) => [note, ...current])
      setText('')
    } catch (problem) {
      setError(describeError(problem))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <Section title="Write down what you decided">
          <form onSubmit={save} className="space-y-3">
            <label htmlFor="note" className="text-body-sm font-medium text-content-primary">Your note</label>
            <textarea
              id="note"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="For example: I will wait for the next test before adding NVDA."
              className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-caption text-content-muted">We attach today’s evidence ({holding} of {total} checks hold) so you can see what you knew when you decided.</p>
              <Button type="submit" disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Save note'}</Button>
            </div>
            {error ? <Note tone="warn">{error}</Note> : null}
          </form>
        </Section>
        <Section title="Your notes" aside={String(list.length)}>
          {list.length === 0 ? <p className="text-body-sm text-content-muted">No notes yet.</p> : (
            <ul className="space-y-4">
              {list.map((n) => (
                <li key={n.id} className="border-l-2 border-[var(--line)] pl-4">
                  <p className="text-caption text-content-muted">{formatWhen(n.at, nowMs)} · {n.checksHolding} of {total} checks held</p>
                  <p className="text-body-sm whitespace-pre-wrap text-content-primary">{n.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <Section title="Versions of this idea">
        <ul className="space-y-4">
          {versions.map((v) => (
            <li key={v.id} className="border-l-2 border-[var(--accent)] pl-4">
              <p className="text-caption text-content-muted">{formatWhen(v.at, nowMs)}</p>
              <p className="text-body-sm font-medium text-content-primary">{v.label}{v.current ? ' · Current' : ''}</p>
              <p className="text-body-sm text-content-muted">{v.summary}</p>
            </li>
          ))}
        </ul>
        <p className="text-caption mt-4 text-content-muted">Each edit keeps the old version and its tests, so you can always see what changed the evidence.</p>
      </Section>
    </div>
  )
}
