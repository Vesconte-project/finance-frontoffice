import Link from 'next/link'
import EquityChart from '../EquityChart'
import Glossary, { Term } from '../Glossary'
import { CheckMark, LimitMark, Note, Section, Tag, formatDate, pct } from '../ui'
import type { EvidenceCheck, ThesisEvidence, ThesisSummary } from '@/lib/model-lab/contract'
import type { Depth } from '@/lib/model-lab/params'
import { describeChange, describeChecks } from '@/lib/model-lab/read-back'
import { buttonClass } from '@/components/ui/Button'

function PeriodBars({ periods }: { periods: readonly number[] }) {
  const max = Math.max(6, ...periods.map((p) => Math.abs(p)))
  return (
    <div className="mt-3 space-y-1">
      {periods.map((p, i) => (
        <div key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-caption text-content-muted">
          <span>Period {i + 1}</span>
          <span className="relative block h-2 rounded-sm bg-[var(--line)]" aria-hidden="true">
            <i className="absolute inset-y-0 block rounded-sm" style={{ [p >= 0 ? 'left' : 'right']: '50%', width: `${(Math.abs(p) / max) * 50}%`, background: p >= 0 ? 'var(--up)' : 'var(--down)' }} />
          </span>
          <span className="text-right tabular-nums">{p >= 0 ? '+' : ''}{p.toFixed(1)}</span>
        </div>
      ))}
      <p className="pt-1 text-caption text-content-muted">Points ahead of (+) or behind (−) the benchmark.</p>
    </div>
  )
}

function CheckCard({ check }: { check: EvidenceCheck }) {
  return (
    <li className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <CheckMark state={check.state} />
        <h3 className="text-body-sm font-medium text-content-primary">{check.title}</h3>
      </div>
      <p className="text-body-sm mt-2 text-content-primary">{check.line}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-caption text-content-muted focus-visible:outline-2 focus-visible:outline-[var(--accent)]">Why this matters</summary>
        <p className="text-body-sm mt-2 text-content-muted">{check.why}</p>
        {check.periods ? <PeriodBars periods={check.periods} /> : null}
      </details>
    </li>
  )
}

type Props = Readonly<{ summary: ThesisSummary; evidence: ThesisEvidence; depth: Depth; lastTestId: string | null }>

export default function EvidenceTab({ summary, evidence, depth, lastTestId }: Props) {
  const e = evidence
  const holding = e.checks.filter((c) => c.state === 'holds').length
  const change = describeChange(e.change, e.checks, formatDate(e.asOf))
  const perf = e.performance
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        {e.staleDays ? <Note tone="warn"><b>Prices are {e.staleDays} days old.</b> This result uses data up to {formatDate(e.asOf)}.</Note> : null}
        {e.coverage.left.length ? (
          <Note tone="warn"><b>{e.coverage.left.length} of {e.coverage.total} stocks were left out.</b> {e.coverage.left.join(' and ')} had gaps in their price history. The result covers the rest.</Note>
        ) : null}

        <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="font-[var(--font-display)] text-3xl text-content-primary">{holding} of {e.checks.length} checks hold</p>
            <div className="space-y-1">
              <p className="text-body-sm text-content-primary">{describeChecks(e.checks)}</p>
              <p className="text-body-sm text-content-muted">{e.fading ? 'The last check has been slipping for three tests in a row.' : 'Nothing has changed since the last test.'}</p>
            </div>
          </div>
        </section>

        <Section title="Since the last test" aside={<Link href={`/models/theses/${summary.id}?tab=watching`} className="text-[var(--color-accent)] underline underline-offset-2">See the history</Link>}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-4" aria-label={`${e.change.previousHolding} of ${e.checks.length} before, ${e.change.currentHolding} now`}>
              <Dots count={e.change.previousHolding} of={e.checks.length} label="Last time" />
              <span aria-hidden="true">→</span>
              <Dots count={e.change.currentHolding} of={e.checks.length} label="Now" />
            </div>
            <div className="min-w-[14rem] flex-1">
              <p className="text-body-sm font-medium text-content-primary">{change.headline}</p>
              <p className="text-body-sm text-content-muted">{change.detail}</p>
            </div>
          </div>
        </Section>

        <Section title="Against the benchmark, after costs" aside={`SPY · ${formatDate(perf.series.dates[0])} to ${formatDate(perf.series.dates[perf.series.dates.length - 1])}`}>
          <EquityChart
            dates={perf.series.dates}
            label="Cumulative return of the thesis, the simple rule and the benchmark over the test year"
            items={[
              { name: 'This thesis', series: perf.series.thesis, color: 'var(--text)' },
              { name: 'Simple rule, no model', series: perf.series.baseline, color: 'var(--accent)', dash: '1.5 3.5' },
              { name: 'Benchmark (SPY)', series: perf.series.benchmark, color: 'var(--text-muted)', dash: '5 3' },
            ]}
          />
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <Stat label={<Term term="Return after costs">Return after costs</Term>} value={pct(perf.stats.returnAfterCosts)} />
            <Stat label={<Term term="Worst fall">Worst fall</Term>} value={pct(perf.stats.worstFall)} />
            {depth !== 'guided' ? <Stat label={<Term term="Sharpe">Sharpe</Term>} value={perf.stats.sharpe.toFixed(2)} /> : null}
            <Stat label={<Term term="Benchmark">Benchmark</Term>} value={pct(perf.stats.benchmarkReturn)} />
          </dl>
        </Section>

        <section className="space-y-3" aria-labelledby="checks-heading">
          <h2 id="checks-heading" className="text-section-title text-content-primary">Does it hold up?</h2>
          <ul className="grid gap-3 md:grid-cols-2">{e.checks.map((c) => <CheckCard key={c.key} check={c} />)}</ul>
        </section>

        <Section title="What this test can and cannot support" aside="Facts about the data, not a verdict">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">What the data behind this test can support</caption>
            <tbody>
              {e.limits.map((l) => (
                <tr key={l.key} className="border-b border-[var(--line)] last:border-0 align-top">
                  <td className="w-8 py-3 pr-2"><LimitMark state={l.state} /></td>
                  <th scope="row" className="w-48 py-3 pr-4 text-body-sm font-medium text-content-primary">{l.title}</th>
                  <td className="py-3 text-body-sm text-content-muted">{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {e.ordering && depth === 'lab' ? (
          <Section title="Ordering measures" aside="From the model, before any trading rule">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Measure name={<Term term="Rank IC">Rank IC</Term>} value={e.ordering.rankIc.toFixed(3)} text="Average over days of how well the scores order the stocks against what happened next." />
              <Measure name="Rank IC stability" value={e.ordering.rankIcStability.toFixed(2)} text="Rank IC divided by how much it moves from day to day." />
              <Measure name="Top minus bottom tenth" value={`${e.ordering.topMinusBottomBps >= 0 ? '+' : ''}${e.ordering.topMinusBottomBps} bps`} text="Average gap between the stocks the model scored highest and lowest." />
              <Measure name="Test periods with positive rank IC" value={`${e.ordering.positivePeriods} of ${e.ordering.periods}`} text="In how many separate test periods the average was above zero." />
              <Measure name="Permutation p-value" value={e.ordering.permutationP.toFixed(3)} text="How often a shuffled version of the scores does as well. Smaller means shuffling rarely matches it." />
            </dl>
          </Section>
        ) : null}

        <Section title="Which stocks drove it" aside="Share of the result">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)] text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Stock</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Contribution</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium"><Term term="Hit rate">Right more often than not</Term></th>
                  {depth !== 'guided' ? <th scope="col" className="py-2 text-right font-medium">Signals</th> : null}
                </tr>
              </thead>
              <tbody>
                {e.contributions.map((c) => (
                  <tr key={c.ticker} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 pr-3 font-mono text-body-sm text-content-primary">{c.ticker}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="block h-2 w-32 rounded-sm bg-[var(--line)]" aria-hidden="true"><i className="block h-full rounded-sm bg-[var(--text)]" style={{ width: `${(c.share / Math.max(...e.contributions.map((x) => x.share))) * 100}%` }} /></span>
                        <span className="text-caption tabular-nums text-content-muted">{Math.round(c.share * 100)}%</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-body-sm tabular-nums">{Math.round(c.hitRate * 100)}%</td>
                    {depth !== 'guided' ? <td className="py-2 text-right text-body-sm tabular-nums">{c.signals}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Glossary />
        <p className="text-caption text-content-muted">This shows what happened in past data. It is not a forecast and it is not investment advice.</p>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start" aria-label="What you can do next">
        <Section title="What would change this">
          <p className="text-body-sm mb-3 text-content-muted">Ideas that usually move the evidence. Changing only the rules reuses the model you already have.</p>
          <div className="flex flex-col gap-2">
            {lastTestId ? <Link href={`/models/new?thesis=${summary.id}&reuse=${lastTestId}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Try other rules on the same model</Link> : null}
            <Link href={`/models/new?thesis=${summary.id}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>Test again</Link>
            <Link href={`/models/compare?ids=${summary.id}`} className={buttonClass({ variant: 'ghost', size: 'sm' })}>Compare with another thesis</Link>
          </div>
        </Section>
        <Tag>Snapshot {e.snapshot.id}</Tag>
      </aside>
    </div>
  )
}

function Stat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-wide text-content-muted">{label}</dt>
      <dd className="font-[var(--font-display)] text-2xl tabular-nums text-content-primary">{value}</dd>
    </div>
  )
}

function Measure({ name, value, text }: { name: React.ReactNode; value: string; text: string }) {
  return (
    <div>
      <dt className="text-body-sm font-medium text-content-primary">{name} <span className="ml-2 tabular-nums">{value}</span></dt>
      <dd className="text-body-sm text-content-muted">{text}</dd>
    </div>
  )
}

function Dots({ count, of, label }: { count: number; of: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-caption uppercase tracking-wide text-content-muted">{label}</div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => <span key={i} className={`block h-3.5 w-3.5 rounded-full border-2 ${i < count ? 'border-[var(--text)] bg-[var(--text)]' : 'border-[var(--line-strong)]'}`} />)}
      </div>
    </div>
  )
}
