'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import styles from './SegmentedControl.module.css'

type SegmentedControlProps<T extends string> = {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
  analyticsId?: string
  fill?: boolean
}

type Drag = { id: number; x: number; y: number; started: boolean }
const DRAG_THRESHOLD = 6

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  analyticsId,
  fill = false,
}: SegmentedControlProps<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const dragRef = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const [preview, setPreview] = useState<number | null>(null)
  const selected = options.indexOf(value)

  function nearestOption(x: number) {
    let nearest = Math.max(selected, 0)
    let distance = Infinity
    buttons.current.slice(0, options.length).forEach((button, index) => {
      if (!button) return
      const box = button.getBoundingClientRect()
      const gap = Math.abs(x - box.left - box.width / 2)
      if (gap < distance) {
        nearest = index
        distance = gap
      }
    })
    return nearest
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || options.length < 2 || dragRef.current) return
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, started: false }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    if (!drag.started) {
      const x = Math.abs(event.clientX - drag.x)
      const y = Math.abs(event.clientY - drag.y)
      if (x < DRAG_THRESHOLD || x <= y) return
      drag.started = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    setPreview(nearestOption(event.clientX))
  }

  function endPointer(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    if (!drag.started) return
    setPreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!commit) return
    const index = nearestOption(event.clientX)
    if (index !== selected) buttons.current[index]?.click()
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const length = options.length
    if (!length) return
    const current = Math.max(0, selected)
    let next: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': next = (current + 1) % length; break
      case 'ArrowLeft':
      case 'ArrowUp': next = (current + length - 1) % length; break
      case 'Home': next = 0; break
      case 'End': next = length - 1; break
      default: return
    }
    event.preventDefault()
    const option = buttons.current[next]
    option?.focus()
    if (next !== selected) option?.click()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(styles.control, fill && styles.fill, className)}
      data-segmented-control=""
      data-dragging={preview !== null ? 'true' : 'false'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endPointer(event, true)}
      onPointerCancel={(event) => endPointer(event, false)}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget) endPointer(event, false)
      }}
      onPointerLeave={(event) => {
        if (!dragRef.current?.started) endPointer(event, false)
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const active = index === selected
        return (
          <button
            key={option}
            ref={(node) => { buttons.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (selected < 0 && index === 0) ? 0 : -1}
            data-active={active ? 'true' : 'false'}
            data-highlighted={index === (preview ?? selected) ? 'true' : undefined}
            data-analytics-id={analyticsId ? `${analyticsId}:${option}` : undefined}
            data-analytics-control={analyticsId}
            data-analytics-value={option}
            onClick={() => onChange(option)}
            className={styles.option}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
