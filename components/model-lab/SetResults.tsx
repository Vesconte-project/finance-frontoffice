'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { ParamValue, TestResults, Variant } from '@/lib/model-lab/contract'
import EquityChart, { type ChartItem } from './EquityChart'
import { Note, Section } from './ui'

type Metric = 'excess' | 'net' | 'sharpe' | 'hit'
const METRICS: readonly { key: Metric; label: string; read: (v: Variant) => number; text: (n: number) => string }[] = [
  { key: 'excess', label: 'Points vs benchmark', read: (v) => v.excessPoints, text: (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}` },
  { key: 'net', label: 'Return after costs', read: (v) => v.netReturn, text: (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` },
  { key: 'sharpe', label: 'Return for the risk taken', read: (v) => v.sharpe, text: (n) => n.toFixed(2) },
  { key: 'hit', label: 'Right more often than not', read: (v) => v.hitRate, text: (n) => `${(n * 100).toFixed(1)}%` },
]
const MAX_PINNED = 3
const LINE_COLORS = ['var(--accent)', '#b45309', '#0f766e']

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export default function SetResults({ results }: { results: TestResults }) {
  const [metricKey, setMetricKey] = useState<Metric>('excess')
  const [pinned, setPinned] = useState<string[]>([])
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0]
  const [rowDim, colDim, ...sliceDims] = results.dimensions
  const [slice, setSlice] = useState<Record<string, ParamValue>>(() => Object.fromEntries(sliceDims.map((d) => [d.id, d.values[0]])))

  const visible = useMemo(() => results.variants.filter((v) => sliceDims.every((d) => v.values[d.id] === slice[d.id])), [results.variants, sliceDims, slice])
  const numbers = visible.map(metric.read)
  const lo = Math.min(...numbers)
  const hi = Math.max(...numbers)

  const best = visible.reduce<Variant | null>((a, v) => (a === null || metric.read(v) > metric.read(a) ? v : a), null)
  const typical = numbers.length ? median(numbers) : 0
  const spread = numbers.length ? median(numbers.map((n) => Math.abs(n - typical))) : 0
  const spiky = best !== null && visible.length >= 9 && metric.read(best) - typical > Math.max(2.5 * spread, metricKey === 'excess' ? 1.5 : 0.01)

  function cell(rowValue: ParamValue | undefined, colValue: ParamValue | undefined): Variant | undefined {
    return visible.find((v) => (rowDim ? v.values[rowDim.id] === rowValue : true) && (colDim ? v.values[colDim.id] === colValue : true))
  }

  function togglePin(id: string) {
    setPinned((current) => (current.includes(id) ? current.filter((p) => p !== id) : current.length >= MAX_PINNED ? current : [...current, id]))
  }

  const chartItems: ChartItem[] = [
    { name: 'Benchmark', series: results.benchmarkSeries, color: 'var(--text-muted)', dash: '4 3' },
    ...pinned.flatMap((id, i) => {
      const v = results.variants.find((x) => x.id === id)
      return v ? [{ name: dimsLabel(results, v), series: v.series, color: LINE_COLORS[i % LINE_COLORS.length] }] : []
    }),
  ]

  const rowValues = rowDim?.values ?? [undefined]
  const colValues = colDim?.values ?? [undefined]

  return (
    <div className="space-y-8">
      <Section title="How the variants compare" aside={`${results.variants.length} variants`}>
        <div role="group" aria-label="Measure" className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === metricKey}
              onClick={() => setMetricKey(m.key)}
              className={cn(
                'min-h-11 cursor-pointer rounded-md border px-3 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                m.key === metricKey ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {sliceDims.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-4">
            {sliceDims.map((d) => (
              <label key={d.id} className="text-body-sm text-content-primary">
                <span className="mr-2 text-content-muted">{d.label}</span>
                <select
                  value={String(slice[d.id])}
                  onChange={(event) => setSlice((current) => ({ ...current, [d.id]: d.values.find((v) => String(v) === event.target.value) ?? d.values[0] }))}
                  className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2"
                >
                  {d.values.map((v, i) => <option key={String(v)} value={String(v)}>{d.labels[i]}</option>)}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="border-collapse text-center">
            <caption className="sr-only">{metric.label} for each variant. Select a cell to draw it on the chart.</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left text-caption font-normal text-content-muted">{rowDim && colDim ? `${rowDim.label} ↓  ${colDim.label} →` : rowDim?.label ?? ''}</th>
                {colDim ? colDim.labels.map((l) => <th key={l} scope="col" className="p-2 text-caption font-medium text-content-primary">{l}</th>) : <th scope="col" className="p-2 text-caption font-medium text-content-primary">Result</th>}
              </tr>
            </thead>
            <tbody>
              {rowValues.map((rv, ri) => (
                <tr key={String(rv ?? 'single')}>
                  <th scope="row" className="p-2 text-left text-caption font-medium text-content-primary">{rowDim ? rowDim.labels[ri] : 'This test'}</th>
                  {colValues.map((cv, ci) => {
                    const v = cell(rv, cv)
                    if (!v) return <td key={ci} className="p-2 text-caption text-content-muted">–</td>
                    const n = metric.read(v)
                    const t = hi === lo ? 0.3 : (n - lo) / (hi - lo)
                    const on = pinned.includes(v.id)
                    return (
                      <td key={ci} className="p-0.5">
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${dimsLabel(results, v)}: ${metric.text(n)}`}
                          onClick={() => togglePin(v.id)}
                          style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(8 + t * 40)}%, var(--surface))` }}
                          className={cn('h-11 min-w-16 cursor-pointer rounded-sm border px-2 text-sm tabular-nums text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]', on ? 'border-[var(--text)]' : 'border-transparent')}
                        >
                          {metric.text(n)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-caption text-content-muted">Darker is higher on this measure. Select up to {MAX_PINNED} cells to draw them below.</p>

        {spiky && best ? (
          <Note tone="warn" className="mt-4">
            One variant ({dimsLabel(results, best)}) is {metric.text(metric.read(best))}, while the middle of the set is {metric.text(typical)}. A single high cell next to ordinary ones is often luck. Check whether its neighbours agree before leaning on it.
          </Note>
        ) : null}
      </Section>

      <Section title="Drawn against the benchmark">
        <Card padding="md">
          <EquityChart dates={results.dates} items={chartItems} label="Pinned variants against the benchmark" />
          {pinned.length === 0 ? <p className="mt-2 text-body-sm text-content-muted">Select a cell above to draw it here.</p> : null}
        </Card>
      </Section>

      <div className="flex flex-wrap gap-2">
        <Link href={`/models/theses/${results.thesisId}`} className={buttonClass({ variant: 'secondary' })}>Back to the thesis</Link>
        <Link href={`/models/panels/new`} className={buttonClass()}>Combine into a panel</Link>
      </div>
      <p className="text-caption text-content-muted">This shows what happened in past data. It is not a forecast and it is not investment advice.</p>
    </div>
  )
}

function dimsLabel(results: TestResults, v: Variant): string {
  if (results.dimensions.length === 0) return 'This test'
  return results.dimensions.map((d) => `${d.label} ${d.labels[d.values.findIndex((x) => x === v.values[d.id])] ?? v.values[d.id]}`).join(', ')
}
