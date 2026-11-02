export default function Sparkline({ thesis, benchmark }: { thesis: readonly number[]; benchmark: readonly number[] }) {
  const W = 150
  const H = 44
  const all = [...thesis, ...benchmark]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const path = (a: readonly number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${((i / (a.length - 1)) * W).toFixed(1)} ${(H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="The thesis against the benchmark, small chart">
      <path d={path(benchmark)} fill="none" stroke="var(--line-strong)" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d={path(thesis)} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
