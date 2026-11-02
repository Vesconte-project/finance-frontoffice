export const GLOSSARY: readonly (readonly [string, string])[] = [
  ['Return after costs', 'What you would have made, once trading costs and slippage are taken off.'],
  ['Worst fall', 'The biggest drop from a high point to the next low, over the test.'],
  ['Points ahead', 'How many percentage points more (or less) than the benchmark it finished.'],
  ['Sharpe', 'Return for each unit of ups and downs. Higher means a smoother ride for the same gain.'],
  ['Hit rate', 'How often the call was right. Above 50% means right more often than not.'],
  ['Market conditions', 'A label for the kind of market a day was in: calm, rising, falling, high volatility, choppy.'],
  ['Out of sample', 'Days the model never saw while it was learning or while the rule was being chosen.'],
  ['Benchmark', 'What you compare against, usually the whole market. Beating cash is not enough.'],
  ['Point in time', 'Using only what was publicly known on each simulated day, not figures that were published later.'],
  ['Survivorship', 'Leaving out companies that disappeared, which makes past results look better than they were.'],
  ['Rank IC', 'How well the model’s scores put stocks in the same order as what happened next. Zero means no relationship.'],
]

export function glossaryText(term: string): string {
  return GLOSSARY.find((g) => g[0] === term)?.[1] ?? ''
}

/** A term with its plain-words meaning, reachable by hover and by keyboard. */
export function Term({ children, term }: { children: React.ReactNode; term: string }) {
  const text = glossaryText(term)
  return (
    <span className="group relative inline-block cursor-help border-b border-dotted border-[var(--text-muted)]" tabIndex={0} aria-label={`${term}: ${text}`}>
      {children}
      <span role="tooltip" aria-hidden="true" className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-64 rounded-md bg-[var(--text)] px-3 py-2 text-caption font-normal leading-snug text-[var(--bg)] group-focus:block group-hover:block">
        {text}
      </span>
    </span>
  )
}

export default function Glossary() {
  return (
    <details className="rounded-md border border-[var(--line)] bg-[var(--surface)]">
      <summary className="cursor-pointer px-5 py-3 text-card-title text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]">Words we use</summary>
      <dl className="grid gap-x-8 gap-y-3 px-5 pb-5 sm:grid-cols-2">
        {GLOSSARY.map(([term, text]) => (
          <div key={term}>
            <dt className="text-body-sm font-medium text-content-primary">{term}</dt>
            <dd className="text-body-sm text-content-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
