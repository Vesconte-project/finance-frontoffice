/** Parse both RFC Retry-After forms. Invalid values use the caller's fallback. */
export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  if (/^\d+$/.test(raw)) {
    const milliseconds = Number(raw) * 1000
    return Number.isSafeInteger(milliseconds) ? milliseconds : null
  }
  // Do not let Date.parse interpret malformed numeric delays as calendar dates.
  if (!/^[A-Za-z]{3}, /.test(raw)) return null
  const date = Date.parse(raw)
  return Number.isFinite(date) ? Math.max(0, date - now) : null
}

export function retryDelayMs(attempt: number, retryAfter: string | null, now = Date.now(), random = Math.random): number {
  const exponential = Math.min(8000, 1000 * 2 ** attempt)
  const minimum = retryAfterMs(retryAfter, now) ?? 0
  // Always pause, including Retry-After: 0. Add jitter AFTER the server's minimum.
  return Math.max(minimum, exponential) + Math.floor(random() * exponential)
}
