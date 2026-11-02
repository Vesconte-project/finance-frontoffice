'use client'

import { useId } from 'react'
import ValueTrack from '@/components/model-lab/ValueTrack'
import { cn } from '@/lib/utils'
import type { ParamValue } from '@/lib/model-lab/contract'
import { formatParam, trackSpecOf, type ParamDef } from '@/lib/model-lab/params'

const SHORT_UNIT = { '': '', '%': '%', days: 'd', years: 'y', bps: '' } as const

type ParamEditorProps = {
  param: ParamDef
  values: readonly ParamValue[]
  several: boolean
  onChange: (values: ParamValue[]) => void
  onSeveral: (on: boolean) => void
}

/** One setting: a value line for numbers, a short list for choices, and an optional "compare several". */
export default function ParamEditor({ param, values, several, onChange, onSeveral }: ParamEditorProps) {
  const switchId = useId()
  const multi = several || values.length > 1

  function setSeveral(on: boolean) {
    onSeveral(on)
    if (!on) onChange(values.slice(0, 1))
  }

  return (
    <div className="space-y-2 border-t border-[var(--line)] py-4 first:border-t-0">
      <div>
        <h3 className="text-card-title text-content-primary">{param.label}</h3>
        <p className="text-body-sm text-content-muted">{param.hint}</p>
      </div>

      {param.kind === 'num' ? (
        <ValueTrack
          label={param.label}
          spec={trackSpecOf(param)}
          values={values.map(Number)}
          onChange={onChange}
          format={(v) => formatParam(param.id, v)}
          tickLabel={(v) => `${v}${SHORT_UNIT[param.unit]}`}
          multi={multi}
          unit={param.unit || 'value'}
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label={param.label}>
          {param.options.map(([key, text]) => {
            const selected = values.includes(key)
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (!multi) onChange([key])
                    else if (!selected) onChange([...values, key])
                    else if (values.length > 1) onChange(values.filter((v) => v !== key))
                  }}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer items-center rounded-md border px-3 py-2 text-left text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                    selected ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]'
                  )}
                >
                  {text}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {param.sweep ? (
        <label htmlFor={switchId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-content-primary">
          <input
            id={switchId}
            type="checkbox"
            checked={multi}
            onChange={(event) => setSeveral(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
          />
          Compare several values
        </label>
      ) : null}
    </div>
  )
}
