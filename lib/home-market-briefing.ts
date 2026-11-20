import { PICK_READING_KEYS, type PickReadingKey } from './picks-content'

export type HomeScoreChange = {
  symbol: string
  reading: PickReadingKey
  previous: number
  next: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
}

/** An empty array is a valid publication. Null means this panel is unavailable. */
export function parseHomeScoreChanges(payload: unknown): HomeScoreChange[] | null {
  if (!isRecord(payload) || !isRecord(payload.scoreChanges)) return null
  const { status, items } = payload.scoreChanges
  if (status !== 'available' || !Array.isArray(items) || items.length > 3) return null

  const changes: HomeScoreChange[] = []
  for (const item of items) {
    if (!isRecord(item)) return null
    const { ticker, previous, next } = item
    const reading = PICK_READING_KEYS.find(key => key === item.reading)
    if (typeof ticker !== 'string' || !ticker.trim() || !reading || !isScore(previous) || !isScore(next)) return null
    changes.push({ symbol: ticker, reading, previous, next })
  }
  return changes
}
