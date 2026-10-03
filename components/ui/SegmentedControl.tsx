'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import styles from './SegmentedControl.module.css'

type SegmentedControlProps<T extends string> = {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
  /** Names this control in telemetry so segment changes are attributable. */
  analyticsId?: string
  /** Fill the available width, sharing it equally between the options. */
  fill?: boolean
}

type Layout = {
  width: number
  height: number
  segments: Array<{ left: number; width: number; top: number; height: number }>
}

type Spring = { value: number; velocity: number; target: number }

type Pointer = { id: number; startX: number; startY: number; dragging: boolean; index: number }

const DRAG_THRESHOLD = 6
const MAGNIFICATION = 0.32
// While lifted the drop is at least this wide, so a magnified label fits it.
const LIFTED_MIN_WIDTH = 56

function spring(value: number): Spring {
  return { value, velocity: 0, target: value }
}

/** Advances a damped spring; returns true while it is still moving. */
function step(state: Spring, stiffness: number, damping: number, dt: number): boolean {
  const force = (state.target - state.value) * stiffness - state.velocity * damping
  state.velocity += force * dt
  state.value += state.velocity * dt
  if (Math.abs(state.target - state.value) < 0.01 && Math.abs(state.velocity) < 0.01) {
    state.value = state.target
    state.velocity = 0
    return false
  }
  return true
}

function sameLayout(a: Layout | null, b: Layout): boolean {
  if (!a || a.width !== b.width || a.height !== b.height || a.segments.length !== b.segments.length) return false
  return a.segments.every((segment, index) => {
    const other = b.segments[index]
    return segment.left === other.left && segment.width === other.width && segment.top === other.top && segment.height === other.height
  })
}

/**
 * Liquid-glass segmented control, used as a radio group.
 *
 * A glass drop marks the selected option. It can be dragged: while the pointer
 * moves it lifts, stretches with its speed and magnifies the labels beneath it;
 * on release it settles on the nearest option and only then commits that
 * choice. Taps, clicks and the arrow keys select directly. Reduced motion
 * removes the springs and stretch; reduced transparency makes the drop solid.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  analyticsId,
  fill = false,
}: SegmentedControlProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLSpanElement>(null)
  const surfaceRefs = useRef<Array<HTMLSpanElement | null>>([])
  const stripRef = useRef<HTMLSpanElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const layoutRef = useRef<Layout | null>(null)
  const pointerRef = useRef<Pointer | null>(null)
  const suppressClickRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const motionRef = useRef({ x: spring(0), width: spring(0), lift: spring(0), placed: false })
  const [layout, setLayout] = useState<Layout | null>(null)
  const [dragging, setDragging] = useState(false)

  const activeIndex = options.indexOf(value)

  const render = useCallback(() => {
    const drop = dropRef.current
    const strip = stripRef.current
    const currentLayout = layoutRef.current
    if (!drop || !strip || !currentLayout) return
    const motion = motionRef.current
    const x = motion.x.value
    const width = motion.width.value
    const lift = Math.max(0, motion.lift.value)
    const segment = currentLayout.segments[0]
    const top = segment?.top ?? 0
    const height = segment?.height ?? currentLayout.height

    // Speed stretches the drop along its travel and thins it slightly; lifting
    // grows it beyond the track, as a drop of liquid would.
    const speed = reducedMotionRef.current ? 0 : Math.abs(motion.x.velocity)
    const stretchX = 1 + Math.min(0.26, speed / 2600)
    const stretchY = 1 - Math.min(0.12, speed / 5200)
    // Lifted, the drop swells past the track's edges.
    const scaleX = (1 + 0.08 * lift) * stretchX
    const scaleY = (1 + 0.7 * lift) * stretchY
    const magnification = 1 + MAGNIFICATION * lift

    drop.style.transform = `translate3d(${x}px, ${top}px, 0)`
    drop.style.width = `${width}px`
    drop.style.height = `${height}px`
    for (const surface of surfaceRefs.current) {
      if (surface) surface.style.transform = `scale(${scaleX}, ${scaleY})`
    }
    // The strip mirrors the labels in control coordinates. It is counter-scaled
    // so that, inside the stretched lens, text grows uniformly by the
    // magnification and stays centred on the drop.
    strip.style.width = `${currentLayout.width}px`
    strip.style.height = `${currentLayout.height}px`
    strip.style.transformOrigin = `${x + width / 2}px ${top + height / 2}px`
    strip.style.transform = `translate3d(${-x}px, ${-top}px, 0) scale(${magnification / scaleX}, ${magnification / scaleY})`
    drop.dataset.placed = motion.placed ? 'true' : 'false'
  }, [])

  const animate = useCallback(() => {
    if (frameRef.current !== null) return
    const tick = (time: number) => {
      const motion = motionRef.current
      const previous = lastFrameRef.current ?? time
      const dt = Math.min(1 / 30, Math.max(0, (time - previous) / 1000))
      lastFrameRef.current = time
      let moving = false
      if (reducedMotionRef.current) {
        for (const state of [motion.x, motion.width, motion.lift]) {
          state.value = state.target
          state.velocity = 0
        }
      } else {
        moving = step(motion.x, 520, 36, dt) || moving
        moving = step(motion.width, 520, 36, dt) || moving
        moving = step(motion.lift, 380, 30, dt) || moving
      }
      render()
      if (moving || pointerRef.current?.dragging) {
        frameRef.current = window.requestAnimationFrame(tick)
      } else {
        frameRef.current = null
        lastFrameRef.current = null
      }
    }
    frameRef.current = window.requestAnimationFrame(tick)
  }, [render])

  const settleOn = useCallback((index: number, immediate = false) => {
    const segment = layoutRef.current?.segments[index]
    if (!segment) return
    const motion = motionRef.current
    motion.x.target = segment.left
    motion.width.target = segment.width
    if (immediate || !motion.placed) {
      motion.x.value = segment.left
      motion.width.value = segment.width
      motion.x.velocity = 0
      motion.width.velocity = 0
      motion.placed = true
      render()
      return
    }
    animate()
  }, [animate, render])

  const measure = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const segments = buttonRefs.current.slice(0, options.length).map((button) => ({
      left: button?.offsetLeft ?? 0,
      width: button?.offsetWidth ?? 0,
      top: button?.offsetTop ?? 0,
      height: button?.offsetHeight ?? 0,
    }))
    const next = { width: root.clientWidth, height: root.clientHeight, segments }
    if (sameLayout(layoutRef.current, next)) return
    layoutRef.current = next
    setLayout(next)
  }, [options.length])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      reducedMotionRef.current = query.matches
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    measure()
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [measure, options])

  // Geometry changed: snap to the selected option without animating.
  useLayoutEffect(() => {
    if (!layout || activeIndex < 0 || pointerRef.current?.dragging) return
    settleOn(activeIndex, true)
  }, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  // Selection changed: travel to it.
  useLayoutEffect(() => {
    if (!layoutRef.current || activeIndex < 0 || pointerRef.current?.dragging) return
    settleOn(activeIndex)
  }, [activeIndex, settleOn])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  const nearestIndex = (clientX: number): number => {
    const root = rootRef.current
    const currentLayout = layoutRef.current
    if (!root || !currentLayout) return Math.max(0, activeIndex)
    const x = clientX - root.getBoundingClientRect().left - root.clientLeft
    let best = 0
    let bestDistance = Number.POSITIVE_INFINITY
    currentLayout.segments.forEach((segment, index) => {
      const distance = Math.abs(segment.left + segment.width / 2 - x)
      if (distance < bestDistance) {
        best = index
        bestDistance = distance
      }
    })
    return best
  }

  const followPointer = (clientX: number) => {
    const root = rootRef.current
    const currentLayout = layoutRef.current
    if (!root || !currentLayout || currentLayout.segments.length === 0) return
    const motion = motionRef.current
    const index = nearestIndex(clientX)
    const width = Math.max(currentLayout.segments[index].width, LIFTED_MIN_WIDTH)
    const first = currentLayout.segments[0]
    const last = currentLayout.segments[currentLayout.segments.length - 1]
    // Centred on the pointer; at either end it may spill past the track.
    const centre = clientX - root.getBoundingClientRect().left - root.clientLeft
    const clamped = Math.max(first.left + first.width / 2, Math.min(last.left + last.width / 2, centre))
    motion.x.target = clamped - width / 2
    motion.width.target = width
    const pointer = pointerRef.current
    if (pointer && pointer.index !== index) {
      pointer.index = index
      // A light tick as the drop crosses an option, where the device supports it.
      if (!reducedMotionRef.current && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(6)
        } catch {
          // Vibration is optional feedback.
        }
      }
    }
    animate()
  }

  const commit = (index: number) => {
    const button = buttonRefs.current[index]
    if (!button) return
    if (options[index] === value) {
      settleOn(index)
      return
    }
    // Through the option's own click, so selection and telemetry stay identical
    // to a tap.
    button.click()
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || options.length < 2) return
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      index: Math.max(0, activeIndex),
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    const deltaX = event.clientX - pointer.startX
    const deltaY = event.clientY - pointer.startY
    if (!pointer.dragging) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return
      pointer.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
      motionRef.current.lift.target = 1
      setDragging(true)
    }
    event.preventDefault()
    followPointer(event.clientX)
  }

  function endDrag(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    pointerRef.current = null
    if (!pointer.dragging) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    motionRef.current.lift.target = 0
    setDragging(false)
    if (cancelled) {
      settleOn(Math.max(0, activeIndex))
    } else {
      commit(nearestIndex(event.clientX))
      // The browser's own click after a drag must not select a second time.
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
    animate()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (options.length === 0) return
    const current = Math.max(0, activeIndex)
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    if (next === null) return
    event.preventDefault()
    const button = buttonRefs.current[next]
    button?.focus()
    if (next !== current) button?.click()
  }

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(styles.control, fill && styles.fill, className)}
      data-segmented-control=""
      data-dragging={dragging ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={handleKeyDown}
    >
      {layout && activeIndex >= 0 ? (
        <span ref={dropRef} className={styles.drop} aria-hidden="true" data-segmented-drop="">
          <span ref={(node) => { surfaceRefs.current[0] = node }} className={styles.pane} />
          <span ref={(node) => { surfaceRefs.current[1] = node }} className={styles.lens}>
            <span ref={stripRef} className={styles.strip}>
              {options.map((option, index) => {
                const segment = layout.segments[index]
                if (!segment) return null
                return (
                  <span
                    key={option}
                    className={styles.stripLabel}
                    data-active={index === activeIndex ? 'true' : 'false'}
                    style={{ left: segment.left + segment.width / 2, top: segment.top + segment.height / 2 }}
                  >
                    {option}
                  </span>
                )
              })}
            </span>
          </span>
          <span ref={(node) => { surfaceRefs.current[2] = node }} className={styles.rim} />
        </span>
      ) : null}
      {options.map((option, index) => {
        const active = index === activeIndex
        return (
          <button
            key={option}
            ref={(node) => { buttonRefs.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (activeIndex < 0 && index === 0) ? 0 : -1}
            data-active={active ? 'true' : 'false'}
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
