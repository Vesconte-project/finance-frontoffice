'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  TRACK_MAX_VALUES,
  addTrackValue,
  moveTrackValue,
  removeTrackValue,
  snapTrackValue,
  stepTrackValue,
  trackPosition,
  trackValueAt,
  type TrackSpec,
} from '@/lib/model-lab/value-track'

const RAIL_PAD = 22

type ValueTrackProps = {
  label: string
  spec: TrackSpec
  values: readonly number[]
  onChange: (values: number[]) => void
  format: (value: number) => string
  /** A shorter form for the labels under the line. Defaults to `format`. */
  tickLabel?: (value: number) => string
  /** Whether several points can be placed on the line. */
  multi: boolean
  unit: string
}

function leftOf(spec: TrackSpec, value: number): string {
  return `calc(${RAIL_PAD}px + (100% - ${RAIL_PAD * 2}px) * ${trackPosition(spec, value).toFixed(4)})`
}

/**
 * A line on which each chosen value is a point. Click the line to place a point,
 * drag a point to move it, use the arrow keys on a focused point, or type an exact
 * number. Every action has a keyboard route; the line is never the only way in.
 */
export default function ValueTrack({ label, spec, values, onChange, format, tickLabel, multi, unit }: ValueTrackProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const [typed, setTyped] = useState('')
  const inputId = useId()
  const helpId = useId()

  function valueFromPointer(clientX: number): number {
    const rail = railRef.current
    if (!rail) return values[0]
    const rect = rail.getBoundingClientRect()
    const span = rect.width - RAIL_PAD * 2
    return trackValueAt(spec, span > 0 ? (clientX - rect.left - RAIL_PAD) / span : 0)
  }

  function place(value: number) {
    onChange(multi ? addTrackValue(spec, values, value) : [snapTrackValue(spec, value)])
  }

  function onRailPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    place(valueFromPointer(event.clientX))
  }

  function onThumbPointerDown(event: React.PointerEvent<HTMLDivElement>, value: number) {
    if (event.button !== 0) return
    event.stopPropagation()
    dragging.current = value
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
  }

  function onThumbPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const from = dragging.current
    if (from === null) return
    const to = valueFromPointer(event.clientX)
    if (to === from) return
    dragging.current = to
    onChange(multi ? moveTrackValue(spec, values, from, to) : [to])
  }

  function onThumbPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function onThumbKeyDown(event: React.KeyboardEvent<HTMLDivElement>, value: number) {
    let next: number | null = null
    const coarse = event.shiftKey
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = stepTrackValue(spec, value, 1, coarse)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = stepTrackValue(spec, value, -1, coarse)
    else if (event.key === 'PageUp') next = stepTrackValue(spec, value, 1, true)
    else if (event.key === 'PageDown') next = stepTrackValue(spec, value, -1, true)
    else if (event.key === 'Home') next = spec.min
    else if (event.key === 'End') next = spec.max
    else if ((event.key === 'Delete' || event.key === 'Backspace') && multi && values.length > 1) {
      event.preventDefault()
      onChange(removeTrackValue(spec, values, value))
      return
    }
    if (next === null) return
    event.preventDefault()
    onChange(multi ? moveTrackValue(spec, values, value, next) : [next])
  }

  function submitTyped(event: React.FormEvent) {
    event.preventDefault()
    const parsed = Number(typed)
    if (!typed.trim() || !Number.isFinite(parsed)) return
    place(parsed)
    setTyped('')
  }

  const full = multi && values.length >= TRACK_MAX_VALUES

  return (
    <div className="space-y-3">
      <div
        ref={railRef}
        role="group"
        aria-label={`${label}, value line`}
        aria-describedby={helpId}
        onPointerDown={full ? undefined : onRailPointerDown}
        className="relative h-16 cursor-pointer touch-none select-none"
      >
        <div
          aria-hidden="true"
          className="absolute top-[22px] h-1 rounded-sm bg-[var(--line-strong)]"
          style={{ left: RAIL_PAD, right: RAIL_PAD }}
        />
        {spec.presets.map((preset) => {
          const active = values.includes(preset)
          return (
            <button
              key={`tick-${preset}`}
              type="button"
              aria-pressed={active}
              aria-label={format(preset)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => place(preset)}
              className="absolute top-0 flex h-11 w-8 -translate-x-1/2 cursor-pointer flex-col items-center justify-start focus-visible:outline-2 focus-visible:outline-[var(--accent)] [@media(pointer:coarse)]:w-11"
              style={{ left: leftOf(spec, preset) }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[17px] block h-3 w-3 rounded-full border',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--line-strong)] bg-[var(--surface)]'
                )}
              />
              <span aria-hidden="true" className="mt-4 text-caption text-content-muted">
                {(tickLabel ?? format)(preset)}
              </span>
            </button>
          )
        })}
        {values.map((value, index) => (
          <div
            key={`thumb-${index}`}
            className="pointer-events-none absolute top-0 flex h-11 w-11 -translate-x-1/2 items-center justify-center"
            style={{ left: leftOf(spec, value) }}
          >
            <div
              role="slider"
              tabIndex={0}
              aria-label={multi && values.length > 1 ? `${label}, point ${index + 1} of ${values.length}` : label}
              aria-valuemin={spec.min}
              aria-valuemax={spec.max}
              aria-valuenow={value}
              aria-valuetext={format(value)}
              onPointerDown={(event) => onThumbPointerDown(event, value)}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              onPointerCancel={onThumbPointerUp}
              onKeyDown={(event) => onThumbKeyDown(event, value)}
              className="group pointer-events-auto flex h-7 w-7 cursor-grab touch-none items-center justify-center focus-visible:outline-none active:cursor-grabbing [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
            >
              <span
                aria-hidden="true"
                className="block h-5 w-5 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] shadow-[0_0_0_1px_var(--accent)] group-focus-visible:shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--accent)]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {multi && values.length > 1
          ? values.map((value) => (
              <span
                key={`chip-${value}`}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] pl-2 text-label-sm text-content-primary"
              >
                {format(value)}
                <button
                  type="button"
                  aria-label={`Remove ${format(value)}`}
                  onClick={() => onChange(removeTrackValue(spec, values, value))}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center text-content-muted hover:text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            ))
          : null}
        <form onSubmit={submitTyped} className="ml-auto flex items-center gap-2">
          <label htmlFor={inputId} className="text-caption text-content-muted">
            Exact value ({unit})
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="h-9 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={full}
            className="h-9 cursor-pointer rounded-md border border-[var(--text)] px-3 text-xs font-medium text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {multi ? 'Add' : 'Set'}
          </button>
        </form>
      </div>
      <p id={helpId} className="text-caption text-content-muted">
        {multi
          ? 'Click the line to add a value. Drag a point to move it. With a point focused, arrow keys move it and Delete removes it.'
          : 'Click the line or drag the point. With the point focused, arrow keys move it.'}
        {full ? ` You can compare up to ${TRACK_MAX_VALUES} values.` : ''}
      </p>
    </div>
  )
}
