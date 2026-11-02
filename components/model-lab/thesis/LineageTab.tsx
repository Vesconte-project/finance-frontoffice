import type { Lineage } from '@/lib/model-lab/contract'
import { Section } from '../ui'

export default function LineageTab({ lineage }: { lineage: Lineage }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Provenance">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-body-sm">
          <dt className="text-content-muted">Config hash</dt><dd className="font-mono">{lineage.configHash}</dd>
          <dt className="text-content-muted">Execution hash</dt><dd className="font-mono">{lineage.executionHash}</dd>
          <dt className="text-content-muted">Code</dt><dd className="font-mono break-all">{lineage.codeSha}</dd>
          <dt className="text-content-muted">Data snapshot</dt><dd className="font-mono">{lineage.dataSnapshot}</dd>
        </dl>
        <ol className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
          {lineage.stages.map((s, i) => (
            <li key={s.stage} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[var(--line-strong)] font-mono text-caption">{i + 1}</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm font-medium text-content-primary">{s.stage}</span>
                  <span className="rounded border border-[var(--line)] px-1.5 text-caption text-content-muted">{s.owner}</span>
                  {s.reused ? <span className="text-caption text-content-muted">Reused</span> : null}
                </div>
                <div className="font-mono text-caption text-content-muted">{s.id}</div>
                <div className="text-body-sm text-content-muted">{s.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Manifest" aside="Exactly what was sent to the engine">
        <pre className="max-h-[32rem] overflow-auto rounded-md bg-[var(--surface-soft)] p-4 font-mono text-[12px] leading-relaxed text-content-primary">{JSON.stringify(lineage.manifest, null, 2)}</pre>
      </Section>
    </div>
  )
}
