import Link from 'next/link'
import EquityChart from '@/components/model-lab/EquityChart'
import Problem from '@/components/model-lab/Problem'
import { CheckMark, PageTitle, Section, pct } from '@/components/model-lab/ui'
import { buttonClass } from '@/components/ui/Button'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError } from '@/lib/model-lab/contract'
import { isUuid } from '@/lib/model-lab/validate'

export const dynamic = 'force-dynamic'

const MIN = 2
const MAX = 4
const COLORS = ['var(--text)', 'var(--accent)', '#b45309', '#0f766e']

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const { ids: raw } = await searchParams
  const ids = [...new Set((Array.isArray(raw) ? raw.join(',') : raw ?? '').split(',').filter(Boolean))]
  const { source } = await labContext()

  if (ids.length === 0 || ids.some((id) => !isUuid(id))) {
    if (ids.some((id) => !isUuid(id))) return <Problem error={new ModelLabError('not-found')} back={{ href: '/models/compare', label: 'Choose again' }} />
    const theses = await load(() => source.listTheses())
    if (!theses.ok) return <Problem error={theses.error} />
    return (
      <div className="space-y-6">
        <PageTitle title="Compare theses">Choose {MIN} to {MAX} theses to put side by side.</PageTitle>
        {theses.data.length < MIN ? (
          <p className="text-body-sm text-content-muted">You need at least two tested theses to compare. <Link href="/models/new" className="underline">Test one</Link>.</p>
        ) : (
          <form method="get" className="space-y-4">
            <fieldset><legend className="sr-only">Theses to compare</legend>
              <ul className="space-y-2">
                {theses.data.map((t) => (
                  <li key={t.id}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
                      <input type="checkbox" name="ids" value={t.id} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                      <span className="text-body-sm text-content-primary">{t.statement}<span className="block text-caption text-content-muted">{t.checksHolding} of {t.checksTotal} checks hold</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <button type="submit" className={buttonClass()}>Compare</button>
          </form>
        )}
      </div>
    )
  }

  if (ids.length < MIN || ids.length > MAX) return <Problem error={new ModelLabError('invalid')} back={{ href: '/models/compare', label: 'Choose again' }} />
  const loaded = await Promise.all(ids.map(async (id) => ({ detail: await load(() => source.getThesis(id)), evidence: await load(() => source.getEvidence(id)) })))
  const failed = loaded.find((l) => !l.detail.ok || !l.evidence.ok)
  if (failed) {
    const error = !failed.detail.ok ? failed.detail.error : !failed.evidence.ok ? failed.evidence.error : new ModelLabError('upstream')
    return <Problem error={error} back={{ href: '/models/compare', label: 'Choose again' }} />
  }
  const rows = loaded.map((l) => ({ summary: l.detail.ok ? l.detail.data.summary : null, evidence: l.evidence.ok ? l.evidence.data : null })).filter((r): r is { summary: NonNullable<typeof r.summary>; evidence: NonNullable<typeof r.evidence> } => r.summary !== null && r.evidence !== null)
  const first = rows[0].evidence.performance.series

  return (
    <div className="space-y-8">
      <PageTitle title="Compare theses" actions={<Link href="/models/compare" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Choose different theses</Link>}>Side by side, on the same past data. Neither is a forecast.</PageTitle>
      <Section title="Checks">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Each check for each thesis</caption>
            <thead><tr className="border-b border-[var(--line)]"><th scope="col" className="py-2 pr-3" />{rows.map((r) => <th key={r.summary.id} scope="col" className="max-w-56 py-2 pr-3 align-bottom text-body-sm font-medium text-content-primary"><Link href={`/models/theses/${r.summary.id}`} className="underline underline-offset-2">{r.summary.statement}</Link></th>)}</tr></thead>
            <tbody>
              {rows[0].evidence.checks.map((c, i) => (
                <tr key={c.key} className="border-b border-[var(--line)] last:border-0">
                  <th scope="row" className="py-3 pr-3 text-body-sm font-medium text-content-primary">{c.title}</th>
                  {rows.map((r) => { const check = r.evidence.checks[i]; return <td key={r.summary.id} className="py-3 pr-3 text-body-sm text-content-muted"><CheckMark state={check.state} className="mr-2 inline-block align-middle" />{check.line}</td> })}
                </tr>
              ))}
              <tr className="border-b border-[var(--line)]"><th scope="row" className="py-3 pr-3 text-body-sm font-medium text-content-primary">Return after costs</th>{rows.map((r) => <td key={r.summary.id} className="py-3 pr-3 text-body-sm tabular-nums">{pct(r.evidence.performance.stats.returnAfterCosts)}</td>)}</tr>
              <tr><th scope="row" className="py-3 pr-3 text-body-sm font-medium text-content-primary">Worst fall</th>{rows.map((r) => <td key={r.summary.id} className="py-3 pr-3 text-body-sm tabular-nums">{pct(r.evidence.performance.stats.worstFall)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Against the benchmark">
        <EquityChart
          dates={first.dates}
          label="Each thesis and the benchmark"
          items={[...rows.map((r, i) => ({ name: r.summary.statement.slice(0, 40), series: r.evidence.performance.series.thesis, color: COLORS[i % COLORS.length] })), { name: 'Benchmark', series: first.benchmark, color: 'var(--text-muted)', dash: '4 3' }]}
        />
        <p className="mt-2 text-caption text-content-muted">Theses tested on different periods are drawn on their own dates; compare shapes, not endpoints.</p>
      </Section>
    </div>
  )
}
