'use client'

import { useId, useRef, useState } from 'react'

export type ChartItem = Readonly<{ name: string; series: readonly number[]; color: string; dash?: string }>

type Props = Readonly<{
  dates: readonly string[]
  items: readonly ChartItem[]
  label: string
  height?: number
}>

const W = 760
const L = 8
const R = 70
const T = 12
const B = 26

const pct = (v: number) => `${v - 1 >= 0 ? '+' : ''}${((v - 1) * 100).toFixed(1)}%`

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })} ${String(d.getUTCFullYear()).slice(2)}`
}

/** Lines drawn on one scale, with a crosshair and a reading for every line. */
export default function EquityChart({ dates, items, label, height = 260 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const descId = useId()
  const n = dates.length
  const all = items.flatMap((i) => i.series)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const span = hi - lo || 1
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / span) * (height - T - B)

  function onMove(clientX: number) {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const rel = ((clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((rel - L) / (W - L - R)) * (n - 1)))))
  }

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => Math.round(t * (n - 1)))
  const gridValues = [0, 1, 2, 3].map((k) => lo + (span * k) / 3)

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-content-secondary" aria-label="Lines">
        {items.map((item) => (
          <li key={item.name} className="inline-flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" x2="22" y1="4" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray={item.dash} />
            </svg>
            {item.name}
          </li>
        ))}
      </ul>
      <div
        ref={ref}
        className="relative"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} aria-describedby={descId} className="block w-full">
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line-soft, var(--line))" />
              <text x={W - R + 8} y={y(v) + 4} className="fill-[var(--text-muted)] text-[11px]">{pct(v)}</text>
            </g>
          ))}
          {ticks.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-[var(--text-muted)] text-[11px]">{monthLabel(dates[i])}</text>
          ))}
          {items.map((item) => (
            <g key={item.name}>
              <path
                d={item.series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={item.color}
                strokeWidth={item.dash ? 1.6 : 2.2}
                strokeDasharray={item.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(n - 1)} cy={y(item.series[n - 1])} r="3.5" fill={item.color} stroke="var(--surface)" strokeWidth="2" />
            </g>
          ))}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={T} y2={height - B} stroke="var(--text-muted)" strokeDasharray="2 2" /> : null}
        </svg>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[10rem] rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-caption text-content-primary"
            style={{ left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 + 1))}%` }}
          >
            <div className="mb-1 text-content-muted">{dates[hover]}</div>
            {items.map((item) => (
              <div key={item.name} className="flex justify-between gap-4 tabular-nums">
                <span>{item.name}</span>
                <span>{pct(item.series[hover])}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p id={descId} className="sr-only">
        {items.map((i) => `${i.name} ended at ${pct(i.series[n - 1])}`).join('. ')}.
      </p>
    </div>
  )
}
