'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Run, Unit } from '@/lib/model-lab/contract'
import { describeError, labFetch } from '@/lib/model-lab/client'
import { Note } from './ui'

const POLL_MS = 2000
const TERMINAL: ReadonlySet<Run['state']> = new Set(['completed', 'failed', 'cancelled'])

function amount(value: number, unit: Unit): string {
  const text = value.toFixed(1)
  return `${text} ${text === '1.0' ? unit.one : unit.many}`
}

/** Follows one run until it ends. Progress is the platform's; this page never estimates it. */
export default function RunProgress({ initial }: { initial: Run }) {
  const [run, setRun] = useState<Run>(initial)
  const [problem, setProblem] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const id = initial.id
  const ended = TERMINAL.has(run.state)

  useEffect(() => {
    if (ended) return
    let live = true
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      labFetch<Run>(`runs/${id}`)
        .then((next) => {
          if (!live) return
          setRun(next)
          setProblem('')
          if (!TERMINAL.has(next.state)) timer = setTimeout(tick, POLL_MS)
        })
        .catch((error: unknown) => {
          if (!live) return
          setProblem(describeError(error))
          timer = setTimeout(tick, POLL_MS * 3)
        })
    }
    timer = setTimeout(tick, POLL_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [id, ended])

  async function cancel() {
    setCancelling(true)
    try {
      setRun(await labFetch<Run>(`runs/${id}/cancel`, { method: 'POST' }))
    } catch (error) {
      setProblem(describeError(error))
    } finally {
      setCancelling(false)
    }
  }

  const heading =
    run.state === 'completed' ? 'Your test is ready' : run.state === 'failed' ? 'The test did not finish' : run.state === 'cancelled' ? 'The test was cancelled' : 'Running your test'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/models" className="text-label-sm text-content-secondary hover:text-content-primary">← All theses</Link>
      </div>
      <div className="space-y-2">
        <h1 className="text-page-title text-content-primary">{heading}</h1>
        <p className="font-[var(--font-display)] text-lg leading-snug text-content-primary">{run.statement}</p>
      </div>

      <Card padding="lg">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-content-muted">
            {run.isSet ? 'A set of variants' : 'A single test'} · {amount(run.cost, run.unit)}
            {run.reused ? ' · reusing a trained model' : ''}
          </span>
          <span className="text-body-sm tabular-nums text-content-primary">{Math.round(run.progress)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Test progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(run.progress)}
          className="mt-3 h-2 overflow-hidden rounded-sm bg-[var(--line)]"
        >
          <div className={cn('h-full', run.state === 'failed' ? 'bg-[var(--down)]' : 'bg-[var(--accent)]')} style={{ width: `${Math.min(100, run.progress)}%` }} />
        </div>

        <ol className="mt-5 space-y-3" aria-label="Stages">
          {run.stages.map((stage) => {
            const state = stage.skipped ? 'skipped' : run.state === 'completed' || stage.index < run.currentStage ? 'done' : stage.index === run.currentStage && !ended ? 'now' : stage.index === run.currentStage && run.state === 'failed' ? 'failed' : 'later'
            return (
              <li key={stage.index} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border',
                    state === 'done' && 'border-[var(--accent)] bg-[var(--accent)]',
                    state === 'now' && 'border-[var(--accent)] bg-[var(--surface)] ring-2 ring-[var(--accent)]/30',
                    state === 'failed' && 'border-[var(--down)] bg-[var(--down)]',
                    (state === 'later' || state === 'skipped') && 'border-[var(--line-strong)] bg-[var(--surface)]'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-content-primary">
                    {stage.name}
                    <span className="sr-only">: {state === 'now' ? 'in progress' : state}</span>
                    {state === 'skipped' ? <span className="ml-2 text-caption font-normal text-content-muted">Reused, not repeated</span> : null}
                  </p>
                  <p className="text-caption text-content-muted">{stage.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
        {problem ? <p role="status" className="mt-4 text-body-sm text-content-muted">We could not refresh the progress: {problem} Trying again.</p> : null}
      </Card>

      {run.state === 'failed' && run.failure ? (
        <Note tone="warn">
          <strong className="font-medium">{run.failure.stage}.</strong> {run.failure.message}{' '}
          {run.failure.refunded ? `${amount(run.cost, run.unit)} were returned to you.` : 'No refund was made. Contact support if this looks wrong.'}
        </Note>
      ) : null}
      {run.state === 'cancelled' ? <Note>The test was stopped. Work that had not started was not charged.</Note> : null}

      <div className="flex flex-wrap gap-2">
        {!ended ? (
          <button type="button" onClick={cancel} disabled={cancelling} className={cn(buttonClass({ variant: 'secondary' }), 'disabled:opacity-50')}>
            {cancelling ? 'Cancelling…' : 'Cancel test'}
          </button>
        ) : null}
        {run.state === 'completed' && run.thesisId ? <Link href={`/models/theses/${run.thesisId}`} className={buttonClass()}>See the evidence</Link> : null}
        {run.state === 'completed' && run.isSet && run.resultTestId ? <Link href={`/models/tests/${run.resultTestId}`} className={buttonClass({ variant: 'secondary' })}>Compare the variants</Link> : null}
        {(run.state === 'failed' || run.state === 'cancelled') ? <Link href={run.thesisId ? `/models/new?thesis=${run.thesisId}` : '/models/new'} className={buttonClass()}>Change the test</Link> : null}
      </div>
    </div>
  )
}
