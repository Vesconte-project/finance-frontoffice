import TemporalLineChart from '@/components/charts/TemporalLineChart'
import { BACKEND_HISTORY_PERIOD_DAYS_MAX, getHistoricalData } from '@/lib/finance'
import { historyThrough, type lifecycleView } from '@/lib/listing-lifecycle'
import type { TickerPageSummary } from '@/lib/ticker-data'

type Suspended = Extract<ReturnType<typeof lifecycleView>, { state: 'suspended' }>

export default async function SuspendedStockHistory({ ticker, summary, lifecycle }: {
  ticker: string; summary: TickerPageSummary; lifecycle: Suspended
}) {
  let points: { date: string; value: number }[] = []
  let failed = false
  try {
    points = historyThrough(await getHistoricalData(ticker, BACKEND_HISTORY_PERIOD_DAYS_MAX), lifecycle.date)
      .map((point) => ({ date: point.date, value: point.close }))
  } catch { failed = true }
  return (
    <section className="space-y-6" data-suspended-ticker="" lang="pt">
      <div role="status" className="max-w-prose space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-content-primary">Dados temporariamente suspensos</h2>
        <p className="text-sm text-content-secondary">{lifecycle.reason}</p>
        <p className="text-sm text-content-secondary">Suspensão em <time dateTime={summary.suspended_at ?? lifecycle.date}>{lifecycle.date}</time>. O histórico disponível continua acessível. Os indicadores e rankings atuais estão suspensos.</p>
        {lifecycle.reviewBy ? <p className="text-sm text-content-secondary">Revisão prevista até <time dateTime={summary.review_by ?? lifecycle.reviewBy}>{lifecycle.reviewBy}</time>; esta data não garante a retoma.</p> : null}
      </div>
      <div className="space-y-3" data-suspended-history="">
        <h2 className="text-lg font-semibold text-content-primary">Histórico até à suspensão</h2>
        <p className="text-sm text-content-secondary">Preços ajustados. Última sessão disponível: {points.at(-1)?.date ?? 'indisponível'}.</p>
        <TemporalLineChart points={points} ariaLabel={`Histórico de ${ticker} até à suspensão`} valueFormat={summary.asset?.currency || summary.fundamentalsSummary?.currency ? "currency" : "number"}
          currency={summary.asset?.currency ?? summary.fundamentalsSummary?.currency ?? undefined}
          emptyState={<p>{failed ? 'Não foi possível carregar o histórico. Tenta novamente mais tarde.' : 'Sem histórico disponível até à suspensão.'}</p>} />
      </div>
    </section>
  )
}
