import Card from '@/components/ui/Card'
import type { PanelEvidence } from '@/lib/model-lab/contract'
import EquityChart from '../EquityChart'
import { Note, Section, formatDate, pct } from '../ui'

export default function EvidenceTab({ evidence }: { evidence: PanelEvidence }) {
  const { series, rows, heldOut, agreement, conditions, fit, correlations } = evidence
  const names = ['Panel', ...fit.models.map((m) => m.name)]
  return (
    <div className="space-y-8">
      <Section title="The panel against its parts">
        <Card padding="md">
          <EquityChart
            dates={series.dates}
            label="Panel, best single model and benchmark"
            items={[
              { name: 'Panel', series: series.panel, color: 'var(--text)' },
              { name: 'Best single model', series: series.best, color: 'var(--accent)', dash: '2 3' },
              { name: 'Benchmark', series: series.benchmark, color: 'var(--text-muted)', dash: '4 3' },
            ]}
          />
        </Card>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <caption className="sr-only">Return and risk for the panel and each model</caption>
            <thead><tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
              <th scope="col" className="py-2 pr-3 font-medium">&nbsp;</th><th scope="col" className="py-2 pr-3 text-right font-medium">Return after costs</th><th scope="col" className="py-2 pr-3 text-right font-medium">Worst fall</th><th scope="col" className="py-2 pr-3 text-right font-medium">Invested</th><th scope="col" className="py-2 text-right font-medium">Position changes</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-[var(--line)] last:border-0">
                  <th scope="row" className="py-2 pr-3 text-body-sm font-medium text-content-primary">{r.name}</th>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{pct(r.returnAfterCosts)}</td>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{pct(r.worstFall)}</td>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{Math.round(r.invested * 100)}%</td>
                  <td className="py-2 text-right text-body-sm tabular-nums">{r.positionChanges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="On days it was not chosen on" aside={`${formatDate(heldOut.chosenOnTo)} onwards · ${heldOut.days} days`}>
        <p className="text-body-sm text-content-muted">The models were picked using data up to {formatDate(heldOut.chosenOnTo)}. This is how each did afterwards.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <caption className="sr-only">Results on the period the models were picked on and on the period after</caption>
            <thead><tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
              <th scope="col" className="py-2 pr-3 font-medium">&nbsp;</th><th scope="col" className="py-2 pr-3 text-right font-medium">Picked on</th><th scope="col" className="py-2 pr-3 text-right font-medium">Afterwards</th><th scope="col" className="py-2 pr-3 text-right font-medium">Place then → now</th><th scope="col" className="py-2 text-right font-medium">Worst fall</th>
            </tr></thead>
            <tbody>
              {heldOut.rows.map((r) => (
                <tr key={r.name} className="border-b border-[var(--line)] last:border-0">
                  <th scope="row" className="py-2 pr-3 text-body-sm font-medium text-content-primary">{r.name}</th>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{pct(r.chosenOnReturn)}</td>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{pct(r.heldOutReturn)}</td>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{r.chosenOnPlace} → {r.heldOutPlace}</td>
                  <td className="py-2 text-right text-body-sm tabular-nums">{pct(r.heldOutWorstFall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {heldOut.agreementHitRate !== null ? (
          <p className="mt-3 text-body-sm text-content-primary">When enough models agreed in that period ({heldOut.agreementDays} days), the stock was higher five days later {Math.round(heldOut.agreementHitRate * 100)}% of the time.</p>
        ) : (
          <Note className="mt-3">Too few days of agreement in that period to say anything ({heldOut.agreementDays}).</Note>
        )}
      </Section>

      <Section title="What happened as more models agreed">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-left">
            <caption className="sr-only">Average five-day move by number of models agreeing</caption>
            <thead><tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Models agreeing</th><th scope="col" className="py-2 pr-3 text-right font-medium">Days</th><th scope="col" className="py-2 pr-3 text-right font-medium">Average move after 5 days</th><th scope="col" className="py-2 text-right font-medium">Higher after 5 days</th>
            </tr></thead>
            <tbody>
              {agreement.map((b) => (
                <tr key={b.votes} className="border-b border-[var(--line)] last:border-0">
                  <th scope="row" className="py-2 pr-3 text-body-sm font-medium text-content-primary">{b.votes}</th>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{b.days}</td>
                  <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{b.averageMove === null ? '–' : pct(b.averageMove)}</td>
                  <td className="py-2 text-right text-body-sm tabular-nums">{b.hitRate === null ? '–' : `${Math.round(b.hitRate * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Who earned what, by condition" aside="Points per month while the condition held">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left">
            <caption className="sr-only">Points per month by market condition for the panel and each model</caption>
            <thead><tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Condition</th>{names.map((n) => <th key={n} scope="col" className="py-2 pr-3 text-right font-medium normal-case tracking-normal">{n}</th>)}
            </tr></thead>
            <tbody>
              {conditions.map((c, i) => (
                <tr key={c.key} className="border-b border-[var(--line)] last:border-0">
                  <th scope="row" className="py-2 pr-3 text-body-sm font-medium text-content-primary">{c.label} <span className="font-normal text-content-muted">· {c.days} days</span></th>
                  {[fit.panel[i], ...fit.models.map((m) => m.pointsPerMonth[i])].map((v, j) => <td key={j} className="py-2 pr-3 text-right text-body-sm tabular-nums">{v >= 0 ? '+' : ''}{v.toFixed(1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="How independent the models are">
        <p className="text-body-sm text-content-primary">{names.length - 1} models give about {evidence.independentOpinions} independent opinions. Models that move together count once, not twice.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="border-collapse text-center">
            <caption className="sr-only">Correlation between the models’ positions</caption>
            <thead><tr><th className="p-1" />{names.slice(1).map((n) => <th key={n} scope="col" className="max-w-24 p-1 text-caption font-medium text-content-muted">{n}</th>)}</tr></thead>
            <tbody>
              {correlations.map((row, i) => (
                <tr key={i}>
                  <th scope="row" className="p-1 text-left text-caption font-medium text-content-muted">{names[i + 1]}</th>
                  {row.map((v, j) => <td key={j} className="p-1 text-body-sm tabular-nums text-content-primary" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(Math.max(0, v) * 40)}%, var(--surface))` }}>{v.toFixed(2)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <p className="text-caption text-content-muted">This shows what happened in past data. It is not a forecast and it is not investment advice.</p>
    </div>
  )
}
