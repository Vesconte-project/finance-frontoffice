'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { cn } from '@/lib/utils'
import styles from './ExpandingSelector.module.css'

export type ExpandingSelectorOption = {
  value: string
  label: string
}

type ExpandingSelectorProps = {
  label: string
  ariaLabel: string
  value: string
  options: readonly ExpandingSelectorOption[]
  onValueChange: (value: string) => void
  className?: string
}

type PointerSession = {
  id: number
  startX: number
  startY: number
  lastX: number
  dragging: boolean
}

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

function ReelLabel({
  label,
  direction,
  reduceMotion,
}: {
  label: string
  direction: -1 | 0 | 1
  reduceMotion: boolean
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={label}
        className={styles.reelLabel}
        initial={reduceMotion ? false : { opacity: 0, x: direction * 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, x: direction * -10 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {label}
      </motion.span>
    </AnimatePresence>
  )
}

export default function ExpandingSelector({
  label,
  ariaLabel,
  value,
  options,
  onValueChange,
  className,
}: ExpandingSelectorProps) {
  const reduceMotion = Boolean(useReducedMotion())
  const viewportId = useId()
  const instrumentRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const currentRef = useRef<HTMLButtonElement>(null)
  const pointerRef = useRef<PointerSession | null>(null)
  const suppressClickRef = useRef(false)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [direction, setDirection] = useState<-1 | 0 | 1>(0)

  const valueIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const hasChoices = options.length > 1
  const expanded = hasChoices && (hovered || focusWithin || pinned || dragging)
  const currentOption = options[valueIndex] ?? options[0]
  const previousOption = options[wrapIndex(valueIndex - 1, options.length)] ?? currentOption
  const nextOption = options[wrapIndex(valueIndex + 1, options.length)] ?? currentOption

  const commitIndex = useCallback((index: number, movement: -1 | 0 | 1, focusCurrent = false) => {
    const option = options[wrapIndex(index, options.length)]
    if (!option) return
    setDirection(movement)
    setPinned(true)
    if (option.value !== value) onValueChange(option.value)
    if (focusCurrent) window.requestAnimationFrame(() => currentRef.current?.focus({ preventScroll: true }))
  }, [onValueChange, options, value])

  const cycleBy = useCallback((movement: -1 | 1, focusCurrent = false) => {
    commitIndex(valueIndex + movement, movement, focusCurrent)
  }, [commitIndex, valueIndex])

  const close = useCallback(() => {
    setPinned(false)
    setHovered(false)
    setFocusWithin(false)
    setDragging(false)
    setDirection(0)
  }, [])

  useEffect(() => {
    const handleOutsidePointer = (event: globalThis.PointerEvent) => {
      if (instrumentRef.current?.contains(event.target as Node)) return
      close()
    }
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !expanded) return
      close()
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [close, expanded])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    setPinned(true)
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      dragging: false,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    pointer.lastX = event.clientX
    const deltaX = event.clientX - pointer.startX
    const deltaY = event.clientY - pointer.startY
    if (!pointer.dragging && Math.abs(deltaX) > 7 && Math.abs(deltaX) > Math.abs(deltaY)) {
      pointer.dragging = true
      suppressClickRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
    }
    if (pointer.dragging) event.preventDefault()
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    pointerRef.current = null
    setDragging(false)
    const deltaX = pointer.lastX - pointer.startX
    if (pointer.dragging && Math.abs(deltaX) >= 24) cycleBy(deltaX < 0 ? 1 : -1, true)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    pointerRef.current = null
    suppressClickRef.current = false
    setDragging(false)
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!hasChoices) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      cycleBy(1, true)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      cycleBy(-1, true)
    } else if (event.key === 'Home') {
      event.preventDefault()
      commitIndex(0, valueIndex === 0 ? 0 : -1, true)
    } else if (event.key === 'End') {
      event.preventDefault()
      commitIndex(options.length - 1, valueIndex === options.length - 1 ? 0 : 1, true)
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setFocusWithin(false)
  }

  if (!currentOption || options.length === 0) return null

  return (
    <div className={cn(styles.stage, className)}>
      <div
        ref={instrumentRef}
        className={styles.instrument}
        data-expanding-selector=""
        data-expanded={expanded ? 'true' : 'false'}
        data-dragging={dragging ? 'true' : 'false'}
        data-value={value}
        data-options={options.map((option) => option.value).join(' ')}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover)').matches) setHovered(true)
        }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={handleBlur}
        onKeyDown={handleKeyboard}
      >
        <span className={styles.vessel} aria-hidden="true" />
        <button
          ref={triggerRef}
          type="button"
          className={styles.readout}
          aria-expanded={expanded}
          aria-controls={hasChoices ? viewportId : undefined}
          onClick={() => {
            if (expanded && pinned) close()
            else setPinned(true)
          }}
        >
          <span className={styles.eyebrow}>{label}</span>
          <span className={styles.readoutValue}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={currentOption.value}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: reduceMotion ? 0 : 0.14 }}
              >
                {currentOption.label}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="sr-only" aria-live="polite">{label} selected: {currentOption.label}</span>
        </button>

        <div className={styles.selectorShell} aria-hidden={expanded ? undefined : 'true'} inert={expanded ? undefined : true}>
          <div
            id={viewportId}
            className={styles.reel}
            role="radiogroup"
            aria-label={ariaLabel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerCancel}
            onClickCapture={(event) => {
              if (!suppressClickRef.current) return
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <button
              type="button"
              role="radio"
              aria-checked="false"
              aria-label={`Previous view: ${previousOption.label}`}
              className={styles.reelOption}
              data-position="previous"
              tabIndex={-1}
              onClick={() => cycleBy(-1, true)}
            >
              <ReelLabel label={previousOption.label} direction={direction} reduceMotion={reduceMotion} />
            </button>
            <button
              ref={currentRef}
              type="button"
              role="radio"
              aria-checked="true"
              aria-label={`Current view: ${currentOption.label}`}
              className={styles.reelOption}
              data-position="current"
              tabIndex={0}
              onClick={() => setPinned(true)}
            >
              <ReelLabel label={currentOption.label} direction={direction} reduceMotion={reduceMotion} />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked="false"
              aria-label={`Next view: ${nextOption.label}`}
              className={styles.reelOption}
              data-position="next"
              tabIndex={-1}
              onClick={() => cycleBy(1, true)}
            >
              <ReelLabel label={nextOption.label} direction={direction} reduceMotion={reduceMotion} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
