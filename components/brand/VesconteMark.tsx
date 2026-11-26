// The Vesconte network mark, drawn inline so it takes the surrounding text
// colour. Same geometry as scripts/build-brand-icons.mjs (keep them in step);
// the weight is tuned for the 24-30 px header size.

const NODES = [
  [58, 101],
  [702, 101],
  [271.6, 431],
  [488.4, 431],
  [380, 661.5],
] as const

const EDGES = [
  'M58 101Q204 277 271.6 431',
  'M58 101C260.4 204.5 408.4 372.5 488.4 431',
  'M702 101Q556 277 488.4 431',
  'M702 101C499.6 204.5 351.6 372.5 271.6 431',
  'M271.6 431H488.4',
  'M271.6 431Q353.4 567 380 661.5',
  'M488.4 431Q406.6 567 380 661.5',
] as const

const STROKE = 20
const RADIUS = 46

export default function VesconteMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`${58 - RADIUS} ${101 - RADIUS} ${644 + 2 * RADIUS} ${560.5 + 2 * RADIUS}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
        {EDGES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="currentColor">
        {NODES.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={RADIUS} />
        ))}
      </g>
    </svg>
  )
}
