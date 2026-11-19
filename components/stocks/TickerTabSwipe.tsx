'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import {
  stockResearchHref,
  stockResearchKeyFromPath,
  stockResearchPrimaryItems,
  TICKER_TAB_SWIPE_EVENT,
  type TickerTabSwipeDetail,
} from '@/components/stocks/stock-nav-config'
import { useDisplayCurrencyParam } from '@/hooks/useDisplayCurrency'
import { withDisplayCurrency } from '@/lib/display-currency'
import styles from './TickerTabSwipe.module.css'

// A gesture becomes a swipe once it has moved this far, mostly sideways.
const INTENT_PX = 10
const SIDEWAYS_RATIO = 1.4
// Released past this share of the width, the swipe changes the tab...
const COMMIT_SHARE = 0.33
// ...or earlier, when flicked at least this fast (px/ms) over at least this distance.
const FLICK_VELOCITY = 0.45
const FLICK_MIN_PX = 48
// Past the first or last tab the content only gives a little.
const EDGE_GIVE = 0.22
// Touches this close to the screen's edge belong to the system's back gesture.
const EDGE_PX = 18
// Velocity is read from the last samples inside this window.
const VELOCITY_WINDOW_MS = 90
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
// If the destination never arrives, the cover lifts and the page comes back.
const ARRIVAL_TIMEOUT_MS = 10000

type Side = 'next' | 'previous'

/**
 * A sideways swipe over a ticker page moves to the next or previous research tab,
 * in the order of the tab bar. Touch only: a mouse or trackpad keeps the bar.
 *
 * The page follows the finger one to one and the neighbouring tab slides in
 * beside it, as a panel carrying its name. Released far enough, or flicked, the
 * page leaves and the neighbour settles into place while its route loads; the
 * panel lifts once the new tab has arrived. Otherwise both spring back. The tab
 * bar's rail follows the same progress (TICKER_TAB_SWIPE_EVENT).
 *
 * Gestures that already belong to something else are left alone: charts and
 * canvases (pan, measure), anything that scrolls sideways, form fields, sliders,
 * dialogs, and elements marked `data-swipe-ignore`. A gesture only becomes a
 * swipe once it is clearly sideways; from then on it holds the page still
 * vertically, and a vertical gesture is never taken.
 *
 * While mounted the page turns off the browser's own sideways overscroll, which
 * would otherwise read the same gesture as history back. The system's edge
 * gestures are untouched: a touch that starts at the screen's edge is left alone.
 * The destination is fetched when a swipe commits, never on mount.
 */
export default function TickerTabSwipe() {
  const pathname = usePathname()
  const router = useRouter()
  const { reducedMotion } = useScrollRuntime()
  const hintRef = useRef<HTMLDivElement>(null)
  const nextPeekRef = useRef<HTMLDivElement>(null)
  const previousPeekRef = useRef<HTMLDivElement>(null)
  // The side whose panel is covering the content while its route loads.
  const pendingRef = useRef<{ side: Side; timer: number } | null>(null)

  const ticker = decodeURIComponent(pathname.split('/').filter(Boolean)[1] ?? '').toUpperCase()
  const activeKey = stockResearchKeyFromPath(pathname)
  const displayCurrency = useDisplayCurrencyParam()
  const index = stockResearchPrimaryItems.findIndex((item) => item.key === activeKey)
  const previous = index > 0 ? stockResearchPrimaryItems[index - 1] : null
  const next = index >= 0 && index < stockResearchPrimaryItems.length - 1 ? stockResearchPrimaryItems[index + 1] : null

  useEffect(() => {
    if (!ticker) return
    const content = document.querySelector<HTMLElement>('[data-stock-ticker-layout] [data-arrival-part="content"]')
    const hint = hintRef.current
    const nextPeek = nextPeekRef.current
    const previousPeek = previousPeekRef.current
    if (!content || !hint || !nextPeek || !previousPeek) return

    const previousHref = previous ? withDisplayCurrency(stockResearchHref(ticker, previous), displayCurrency) : null
    const nextHref = next ? withDisplayCurrency(stockResearchHref(ticker, next), displayCurrency) : null

    const html = document.documentElement
    const previousOverscroll = html.style.overscrollBehaviorX
    html.style.overscrollBehaviorX = 'none'

    const peekOf = (side: Side) => (side === 'next' ? nextPeek : previousPeek)
    const emit = (progress: number | null) => {
      window.dispatchEvent(new CustomEvent<TickerTabSwipeDetail>(TICKER_TAB_SWIPE_EVENT, { detail: { progress } }))
    }
    const timers = new Set<number>()
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn() }, ms)
      timers.add(id)
    }

    const hidePeek = (peek: HTMLElement) => {
      peek.style.transition = ''
      peek.style.transform = ''
      peek.style.opacity = ''
      peek.dataset.visible = 'false'
    }

    // A new tab has arrived under the panel that was covering it: put the content
    // back in place and lift the panel.
    const pending = pendingRef.current
    if (pending) {
      window.clearTimeout(pending.timer)
      pendingRef.current = null
      const cover = peekOf(pending.side)
      content.style.transition = ''
      content.style.transform = ''
      cover.style.transition = 'opacity 180ms ease-out'
      cover.style.opacity = '0'
      later(() => hidePeek(cover), 200)
      emit(null)
    }

    let startX = 0, startY = 0
    let tracking = false
    let swiping = false
    let dx = 0
    let width = window.innerWidth
    let samples: { t: number; x: number }[] = []

    const blocked = (target: EventTarget | null) => {
      let el = target instanceof Element ? target : null
      if (el?.closest('canvas, svg, input, textarea, select, dialog, [role="slider"], [data-swipe-ignore]')) return true
      while (el && el !== content) {
        if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
          const overflow = getComputedStyle(el).overflowX
          if (overflow === 'auto' || overflow === 'scroll') return true
        }
        el = el.parentElement
      }
      return false
    }

    // The panels start where the content does, or at the top once it has scrolled past.
    const placePeeks = () => {
      const top = Math.max(0, content.getBoundingClientRect().top)
      for (const side of ['next', 'previous'] as const) {
        const peek = peekOf(side)
        peek.style.top = `${top}px`
        const title = peek.querySelector<HTMLElement>('[data-ticker-tab-peek-title]')
        if (title) title.textContent = (side === 'next' ? next : previous)?.label ?? ''
      }
    }

    const position = (offset: number, transition: string) => {
      content.style.transition = transition
      content.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : ''
      for (const side of ['next', 'previous'] as const) {
        const peek = peekOf(side)
        const target = side === 'next' ? next : previous
        const active = target && (side === 'next' ? offset < 0 : offset > 0)
        if (!active) { if (!transition) hidePeek(peek); continue }
        peek.dataset.visible = 'true'
        peek.style.transition = transition
        const base = side === 'next' ? width : -width
        peek.style.transform = `translate3d(${base + offset}px, 0, 0)`
      }
    }

    const springBack = () => {
      const transition = `transform 260ms ${EASE}`
      position(0, transition)
      for (const peek of [nextPeek, previousPeek]) {
        if (peek.dataset.visible !== 'true') continue
        const base = peek === nextPeek ? width : -width
        peek.style.transition = transition
        peek.style.transform = `translate3d(${base}px, 0, 0)`
      }
      emit(null)
      later(() => {
        content.style.transition = ''
        content.style.transform = ''
        hidePeek(nextPeek)
        hidePeek(previousPeek)
      }, 280)
    }

    const clearHint = () => {
      hint.dataset.side = ''
      hint.style.opacity = ''
    }

    const commit = (side: Side, href: string, velocity: number) => {
      if (reducedMotion) {
        hint.style.opacity = '1'
        router.push(href)
        return
      }
      const target = side === 'next' ? -width : width
      const remaining = Math.abs(target - dx)
      // A fast flick finishes as fast as it was thrown; a slow release settles calmly.
      const duration = Math.round(Math.min(320, Math.max(180, remaining / Math.max(Math.abs(velocity), 1.2))))
      const transition = `transform ${duration}ms ${EASE}`
      content.style.transition = transition
      content.style.transform = `translate3d(${target}px, 0, 0)`
      const cover = peekOf(side)
      cover.dataset.visible = 'true'
      cover.style.transition = transition
      cover.style.transform = 'translate3d(0, 0, 0)'
      emit(side === 'next' ? 1 : -1)
      const timer = window.setTimeout(() => {
        // The destination never arrived: bring the page back.
        if (pendingRef.current?.timer !== timer) return
        pendingRef.current = null
        dx = side === 'next' ? -width : width
        springBack()
      }, ARRIVAL_TIMEOUT_MS)
      pendingRef.current = { side, timer }
      router.push(href)
    }

    const onStart = (event: TouchEvent) => {
      if (pendingRef.current || event.touches.length !== 1 || blocked(event.target)) { tracking = false; return }
      const touch = event.touches[0]!
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) { tracking = false; return }
      startX = touch.clientX; startY = touch.clientY
      tracking = true; swiping = false; dx = 0
      samples = [{ t: event.timeStamp, x: touch.clientX }]
    }

    const onMove = (event: TouchEvent) => {
      if (!tracking) return
      const touch = event.touches[0]!
      const mx = touch.clientX - startX
      const my = touch.clientY - startY
      if (!swiping) {
        if (Math.abs(mx) < INTENT_PX && Math.abs(my) < INTENT_PX) return
        // Vertical first: this is a scroll, not a swipe.
        if (Math.abs(mx) < Math.abs(my) * SIDEWAYS_RATIO) { tracking = false; return }
        swiping = true
        width = window.innerWidth
        placePeeks()
        for (const timer of timers) window.clearTimeout(timer)
        timers.clear()
        // Measure from here, so the page does not jump by the intent distance.
        startX = touch.clientX
      }
      // A sideways swipe holds the page still vertically.
      if (event.cancelable) event.preventDefault()
      const raw = touch.clientX - startX
      samples.push({ t: event.timeStamp, x: touch.clientX })
      while (samples.length > 2 && event.timeStamp - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift()
      const towards = raw < 0 ? next : previous
      dx = towards ? Math.max(-width, Math.min(width, raw)) : raw * EDGE_GIVE
      if (reducedMotion) {
        if (towards) {
          hint.textContent = raw < 0 ? `${towards.label} →` : `← ${towards.label}`
          hint.dataset.side = raw < 0 ? 'right' : 'left'
          hint.style.opacity = String(Math.min(1, Math.abs(raw) / (width * COMMIT_SHARE)))
        }
        return
      }
      position(dx, '')
      emit(towards ? dx / -width : 0)
    }

    const velocityAt = (now: number) => {
      const first = samples[0]
      const last = samples[samples.length - 1]
      // A finger that stopped before letting go threw nothing.
      if (!first || !last || last.t === first.t || now - last.t > VELOCITY_WINDOW_MS) return 0
      return (last.x - first.x) / (last.t - first.t)
    }

    const onEnd = (event: TouchEvent) => {
      if (!tracking) return
      tracking = false
      if (!swiping) return
      swiping = false
      const velocity = velocityAt(event.timeStamp)
      const distance = reducedMotion ? samples[samples.length - 1]!.x - startX : dx
      const far = Math.abs(distance) >= width * COMMIT_SHARE
      const flicked = Math.abs(velocity) >= FLICK_VELOCITY && Math.abs(distance) >= FLICK_MIN_PX && Math.sign(velocity) === Math.sign(distance)
      const side: Side = distance < 0 ? 'next' : 'previous'
      const href = side === 'next' ? nextHref : previousHref
      if ((far || flicked) && href) {
        commit(side, href, velocity)
        return
      }
      clearHint()
      if (!reducedMotion) springBack()
    }

    const onCancel = () => {
      if (!swiping) { tracking = false; return }
      tracking = false; swiping = false
      clearHint()
      if (!reducedMotion) springBack()
    }

    content.addEventListener('touchstart', onStart, { passive: true })
    // Not passive: once a gesture is a swipe, it stops the page scrolling vertically.
    content.addEventListener('touchmove', onMove, { passive: false })
    content.addEventListener('touchend', onEnd)
    content.addEventListener('touchcancel', onCancel)

    return () => {
      content.removeEventListener('touchstart', onStart)
      content.removeEventListener('touchmove', onMove)
      content.removeEventListener('touchend', onEnd)
      content.removeEventListener('touchcancel', onCancel)
      html.style.overscrollBehaviorX = previousOverscroll
      for (const timer of timers) window.clearTimeout(timer)
      clearHint()
      // While a panel covers a tab that is still loading, the next run lifts it.
      if (pendingRef.current) return
      content.style.transition = ''
      content.style.transform = ''
      hidePeek(nextPeek)
      hidePeek(previousPeek)
    }
  }, [ticker, previous, next, reducedMotion, router, displayCurrency])

  // Clear the cover if the whole ticker layout goes away mid-swipe.
  useEffect(() => () => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
    pendingRef.current = null
  }, [])

  return (
    <>
      <div ref={previousPeekRef} className={styles.peek} aria-hidden="true" data-visible="false" data-ticker-tab-peek="previous">
        <Peek ticker={ticker} />
      </div>
      <div ref={nextPeekRef} className={styles.peek} aria-hidden="true" data-visible="false" data-ticker-tab-peek="next">
        <Peek ticker={ticker} />
      </div>
      <div ref={hintRef} className={styles.hint} aria-hidden="true" data-ticker-tab-swipe-hint="" />
    </>
  )
}

/**
 * The neighbouring tab as it slides in: its name, and a pulse while its route
 * loads. The swipe writes the name when a gesture starts, so it cannot change
 * to the new neighbour while the panel still covers the tab that just arrived.
 */
function Peek({ ticker }: { ticker: string }) {
  return (
    <div className={styles.peekInner}>
      <span className={styles.peekEyebrow}>{ticker}</span>
      <span className={styles.peekTitle} data-ticker-tab-peek-title="" />
      <span className={styles.peekPulse}>
        {Array.from({ length: 7 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 90}ms` }} />)}
      </span>
    </div>
  )
}
