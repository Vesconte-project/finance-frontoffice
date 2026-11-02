/**
 * The platform API speaks snake_case; the frontoffice speaks camelCase. Keys are
 * converted at the edge. No key in the Model Lab contract contains an underscore
 * or a capital letter on purpose, so values and free-form maps survive a round trip.
 */

function camel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function snake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function convert(value: unknown, fn: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convert(item, fn))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[fn(key)] = convert(item, fn)
    return out
  }
  return value
}

export function camelizeKeys<T = unknown>(value: unknown): T {
  return convert(value, camel) as T
}

export function snakeizeKeys(value: unknown): unknown {
  return convert(value, snake)
}
