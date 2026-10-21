import type { PipelineView } from '@/lib/model-lab/contract'
import { Note } from './ui'

/** The stages a run goes through, who owns each and what ids it left behind. */
export default function PipelineSteps({ view }: { view: PipelineView }) {
  return (
    <div className="space-y-3">
      <h2 className="text-section-title text-content-primary">{view.title}</h2>
      <ol className="space-y-3">
        {view.steps.map((s) => (
          <li key={s.index} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-card-title text-content-primary"><span className="mr-2 text-[var(--accent)]">{s.index + 1}</span>{s.title}</p>
              <p className="text-caption text-content-muted">{s.owner}{s.reused ? ' · reused' : ''}{s.cost !== null ? ` · ${s.cost.toFixed(1)}` : ''}</p>
            </div>
            <ul className="mt-2 space-y-1">{s.lines.map((l) => <li key={l} className="text-body-sm text-content-muted">{l}</li>)}</ul>
            {s.members ? (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{s.members.map((m) => <li key={m.id} className="text-caption text-content-muted"><span className="text-content-primary">{m.name}</span> · {m.how} · {m.note}</li>)}</ul>
            ) : null}
            <p className="mt-2 break-all font-mono text-[11px] text-content-muted">{s.ids}</p>
          </li>
        ))}
      </ol>
      {view.note ? <Note>{view.note}</Note> : null}
    </div>
  )
}
