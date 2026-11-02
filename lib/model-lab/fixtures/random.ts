/**
 * Seeded randomness for the synthetic fixtures. The same seed always gives the
 * same series, so design review and browser QA see the same numbers every time.
 * Nothing here is market data.
 */

export function rng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
}

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function hex(n: number, width = 8): string {
  return n.toString(16).padStart(width, '0')
}

/** A UUID-shaped id that is stable for a given name. */
export function fixtureId(name: string): string {
  const a = hex(hash(name))
  const b = hex(hash(`${name}:b`))
  const c = hex(hash(`${name}:c`))
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${c.slice(0, 3)}-${c.slice(3, 8)}${hex(hash(`${name}:d`)).slice(0, 7)}`
}

export function series(seed: number, drift: number, vol: number, n: number): number[] {
  const r = rng(seed)
  let v = 1
  const out = [1]
  for (let i = 1; i < n; i++) {
    v *= 1 + drift + vol * gauss(r)
    out.push(v)
  }
  return out
}

export function round(value: number, digits = 1): number {
  const f = Math.pow(10, digits)
  return Math.round(value * f) / f
}
