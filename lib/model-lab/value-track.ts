export type TrackScale = 'linear' | 'log' | 'sqrt'

export type TrackSpec = Readonly<{
  min: number
  max: number
  step: number
  scale?: TrackScale
  /** Values worth offering as ticks. They are shortcuts, never the only choices. */
  presets: readonly number[]
}>

/** Largest number of values a single track will hold. */
export const TRACK_MAX_VALUES = 8

function scaleOf(spec: TrackSpec): TrackScale {
  return spec.scale ?? 'linear'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function decimalsOf(step: number): number {
  const text = String(step)
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

export function assertTrackSpec(spec: TrackSpec): void {
  if (!Number.isFinite(spec.min) || !Number.isFinite(spec.max) || spec.min >= spec.max) {
    throw new Error('A value track needs a finite min below its max')
  }
  if (!Number.isFinite(spec.step) || spec.step <= 0) {
    throw new Error('A value track needs a positive step')
  }
  if (scaleOf(spec) === 'log' && spec.min <= 0) {
    throw new Error('A log track needs a min above zero')
  }
}

/** Where a value sits on the rail, from 0 (left) to 1 (right). */
export function trackPosition(spec: TrackSpec, value: number): number {
  const v = clamp(value, spec.min, spec.max)
  const scale = scaleOf(spec)
  if (scale === 'log') {
    return (Math.log(v) - Math.log(spec.min)) / (Math.log(spec.max) - Math.log(spec.min))
  }
  const linear = (v - spec.min) / (spec.max - spec.min)
  return scale === 'sqrt' ? Math.sqrt(linear) : linear
}

/**
 * Rounds a value onto the track: onto the step grid, inside the range. On a log
 * track, values from 10 up first snap to two significant digits so a drag lands on
 * round numbers instead of an arbitrary grid point.
 */
export function snapTrackValue(spec: TrackSpec, value: number): number {
  let v = clamp(value, spec.min, spec.max)
  if (scaleOf(spec) === 'log' && v >= 10) {
    const unit = Math.pow(10, Math.floor(Math.log10(v)) - 1)
    v = Math.round(v / unit) * unit
  }
  const snapped = Math.round((v - spec.min) / spec.step) * spec.step + spec.min
  return Number(clamp(snapped, spec.min, spec.max).toFixed(Math.max(decimalsOf(spec.step), 6)))
}

/** The value under a rail position `t` between 0 and 1, snapped onto the track. */
export function trackValueAt(spec: TrackSpec, t: number): number {
  const p = clamp(t, 0, 1)
  const scale = scaleOf(spec)
  let raw: number
  if (scale === 'log') {
    raw = Math.exp(Math.log(spec.min) + p * (Math.log(spec.max) - Math.log(spec.min)))
  } else if (scale === 'sqrt') {
    raw = spec.min + p * p * (spec.max - spec.min)
  } else {
    raw = spec.min + p * (spec.max - spec.min)
  }
  return snapTrackValue(spec, raw)
}

/** Snapped, in range, no repeats, ascending. */
export function normaliseTrackValues(spec: TrackSpec, values: readonly number[]): number[] {
  const unique = new Set<number>()
  for (const value of values) {
    if (Number.isFinite(value)) unique.add(snapTrackValue(spec, value))
  }
  return [...unique].sort((a, b) => a - b).slice(0, TRACK_MAX_VALUES)
}

export function addTrackValue(spec: TrackSpec, values: readonly number[], value: number): number[] {
  return normaliseTrackValues(spec, [...values, value])
}

/** Removes a value, but never the last one: a test always has something to test. */
export function removeTrackValue(spec: TrackSpec, values: readonly number[], value: number): number[] {
  if (values.length <= 1) return normaliseTrackValues(spec, values)
  return normaliseTrackValues(
    spec,
    values.filter((v) => v !== value)
  )
}

/** Moves one point to a new value. Landing on another point merges the two. */
export function moveTrackValue(
  spec: TrackSpec,
  values: readonly number[],
  from: number,
  to: number
): number[] {
  return normaliseTrackValues(spec, [...values.filter((v) => v !== from), to])
}

/** One keyboard step from a value, or a coarse step of ten. */
export function stepTrackValue(
  spec: TrackSpec,
  value: number,
  direction: 1 | -1,
  coarse = false
): number {
  const size = spec.step * (coarse ? 10 : 1)
  return snapTrackValue(spec, value + direction * size)
}

/** The preset closest to a rail position, used to decide whether a click meant a tick. */
export function nearestPreset(spec: TrackSpec, t: number, tolerance: number): number | null {
  let best: number | null = null
  let bestDistance = tolerance
  for (const preset of spec.presets) {
    const distance = Math.abs(trackPosition(spec, preset) - t)
    if (distance <= bestDistance) {
      best = preset
      bestDistance = distance
    }
  }
  return best
}
