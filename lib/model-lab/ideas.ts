import type { ThesisSentence } from './thesis-sentence'

export type Idea = Readonly<{ key: string; title: string; sub: string; sentence: ThesisSentence }>

const BASE = { universe: 'picks', benchmark: 'market', condition: 'any', gains: [5], losses: [3] } as const

/** Starting points, written as ideas to test. They are not recommendations. */
export const IDEAS: readonly Idea[] = [
  { key: 'momentum', title: 'Winners keep winning', sub: 'Stocks that rose steadily tend to keep rising for a few weeks.', sentence: { ...BASE, who: 'momentum', does: 'outperform', horizons: [10] } },
  { key: 'lowvol', title: 'Quiet stocks hold up', sub: 'Steady names fall less in rough weeks.', sentence: { ...BASE, who: 'lowvol', does: 'fall-less', horizons: [20] } },
  { key: 'value', title: 'Cheap and sound recovers', sub: 'Low valuation plus solid profits, bought after a pullback.', sentence: { ...BASE, who: 'value', does: 'rise', condition: 'pullback', horizons: [5] } },
  { key: 'earnings', title: 'Earnings drift', sub: 'Prices tend to keep moving the way the report pushed them.', sentence: { ...BASE, who: 'earnings', does: 'outperform', horizons: [10] } },
]

export function ideaByKey(key: string | undefined): Idea | null {
  return IDEAS.find((i) => i.key === key) ?? null
}
