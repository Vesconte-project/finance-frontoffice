import type { PanelSummary, PanelToday } from '@/lib/model-lab/contract'
import Card from '@/components/ui/Card'
import { CheckMark, Section, formatDate } from '../ui'

export default function TodayTab({ panel, today }: { panel: PanelSummary; today: PanelToday }) {
  const n = panel.members.length
  return (
    <div className="space-y-8">
      <Section title="Today’s conditions" aside={`Data up to ${formatDate(today.asOf)}`}>
        <ul className="grid gap-3 sm:grid-cols-3">
          {today.conditions.map((c) => (
            <li key={c.label}>
              <Card padding="md" className="h-full">
                <p className="text-caption text-content-muted">{c.label}</p>
                <p className="text-card-title text-content-primary">{c.value}</p>
                <p className="text-body-sm mt-1 text-content-muted">{c.detail}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Stock by stock" aside={`${panel.agreementNeeded} of ${n} models must agree`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Which models flag each stock today</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Stock</th>
                {panel.members.map((m) => <th key={m.id} scope="col" className="max-w-28 py-2 pr-3 font-medium normal-case tracking-normal">{m.name}</th>)}
                <th scope="col" className="py-2 pr-3 font-medium">Agree</th>
                <th scope="col" className="py-2 font-medium">Since yesterday</th>
              </tr>
            </thead>
            <tbody>
              {today.rows.map((r) => (
                <tr key={r.ticker} className="border-b border-[var(--line)] last:border-0">
                  <th scope="row" className="py-3 pr-3 font-mono text-sm text-content-primary">{r.ticker}</th>
                  {r.flagged.map((f, i) => (
                    <td key={i} className="py-3 pr-3">
                      <CheckMark state={f ? 'holds' : 'partly'} />
                      <span className="sr-only">{f ? 'Flags it' : 'Does not flag it'}{r.fits[i] ? '' : ', not suited to today’s conditions'}</span>
                    </td>
                  ))}
                  <td className="py-3 pr-3 text-body-sm tabular-nums text-content-primary">{r.votes} of {n}</td>
                  <td className="py-3 text-body-sm text-content-muted">{r.changed ? `Was ${r.previousVotes} of ${n}` : 'No change'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-caption text-content-muted">A flag says which models agree today. It is not a prediction.</p>
      </Section>
    </div>
  )
}
