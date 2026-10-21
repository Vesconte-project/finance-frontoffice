import Link from 'next/link'
import type { TestSummary, Unit } from '@/lib/model-lab/contract'
import { Section, formatWhen } from '../ui'
import { buttonClass } from '@/components/ui/Button'

const KIND: Readonly<Record<TestSummary['kind'], string>> = { single: 'Single test', set: 'Set of variants', reuse: 'New rules on the same model' }
const STATUS: Readonly<Record<TestSummary['status'], string>> = { completed: 'Complete', failed: 'Failed', running: 'Running', cancelled: 'Cancelled' }

export default function TestsTab({ thesisId, tests, unit, nowMs }: { thesisId: string; tests: readonly TestSummary[]; unit: Unit; nowMs: number }) {
  return (
    <Section title="Tests on this thesis" aside={<Link href={`/models/new?thesis=${thesisId}`} className={buttonClass({ size: 'sm' })}>New test</Link>}>
      {tests.length === 0 ? (
        <p className="text-body-sm text-content-muted">No tests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Tests run on this thesis, newest first</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Test</th>
                <th scope="col" className="py-2 pr-3 font-medium">When</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Variants</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Cost ({unit.many})</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-3 pr-3">
                    {t.kind === 'set' && t.status === 'completed' ? (
                      <Link href={`/models/tests/${t.id}`} className="text-body-sm font-medium text-[var(--color-accent)] underline underline-offset-2">{KIND[t.kind]} of {t.variants}</Link>
                    ) : (
                      <span className="text-body-sm font-medium text-content-primary">{KIND[t.kind]}</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-body-sm">{formatWhen(t.at, nowMs)}</td>
                  <td className="py-3 pr-3 text-right text-body-sm tabular-nums">{t.variants}</td>
                  <td className="py-3 pr-3 text-right text-body-sm tabular-nums">{t.cost.toFixed(1)}</td>
                  <td className="py-3 text-body-sm">{STATUS[t.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
