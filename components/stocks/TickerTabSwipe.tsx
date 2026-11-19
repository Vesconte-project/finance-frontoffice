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
import LoadingPulse from '@/components/ui/LoadingPulse'
import loadingStyles from './TickerResearchLoading.module.css'
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

/**
 * A sideways swipe over a ticker page moves to the next or previous research tab,
 * in the order of the tab bar. Touch only: a mouse or trackpad keeps the bar.
 *
 * The page follows the finger one to one and the neighbouring tab slides in
 * beside it, showing the same loading as a tab that is loading
 * (TickerResearchLoading), so the reader sees one loading, not two. Released far
 * enough, or flicked, the page leaves and the neighbour settles into place while
 * its route loads; the panel lifts once the new tab shows its content, not its
 * loading. Otherwise both spring back. The tab bar's rail follows the same
 * progress (TICKER_TAB_SWIPE_EVENT).
 *
 * A swipe is never ignored because a tab is loading. Swipes can follow one
 * another faster than tabs arrive: the panel standing in for a tab on its way is
 * moved like the page, the next neighbour comes in beside it, and only the
 * newest destination is pushed. Gestures are read from the whole screen below
 * the top of the tab's content, so the empty space under a loading tab works
 * too. Each tab committed to is still requested: a tab swiped past mid-chain is
 * fetched and rendered once, though the reader never sees it.
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
  // The panel covering the content while the tab it stands for loads, and that tab.
  const pendingRef = useRef<{ cover: HTMLElement; index: number; timer: number } | null>(null)

  const ticker = decodeURIComponent(pathname.split('/').filter(Boolean)[1] ?? '').toUpperCase()
  const activeKey = stockResearchKeyFromPath(pathname)
  const displayCurrency = useDisplayCurrencyParam()
  const index = stockResearchPrimaryItems.findIndex((item) => item.key === activeKey)
  // The gesture outlives tab changes: it reads the current tab from here, and the
  // arrival of a tab is handed to it rather than tearing it down mid-swipe.
  const tabRef = useRef({ index, displayCurrency })
  const arriveRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    tabRef.current = { index, displayCurrency }
    arriveRef.current?.()
  }, [index, displayCurrency])

  useEffect(() => {
    if (!ticker) return
    const content = document.querySelector<HTMLElement>('[data-stock-ticker-layout] [data-arrival-part="content"]')
    const hint = hintRef.current
    const nextPeek = nextPeekRef.current
    const previousPeek = previousPeekRef.current
    if (!content || !hint || !nextPeek || !previousPeek) return
    const peeks = [previousPeek, nextPeek]
    const tabs = stockResearchPrimaryItems
    const hrefOf = (at: number) => withDisplayCurrency(stockResearchHref(ticker, tabs[at]!), tabRef.current.displayCurrency)
    const currentIndex = () => tabRef.current.index

    const html = document.documentElement
    const previousOverscroll = html.style.overscrollBehaviorX
    html.style.overscrollBehaviorX = 'none'

    const emit = (progress: number | null, from?: number) => {
      window.dispatchEvent(new CustomEvent<TickerTabSwipeDetail>(TICKER_TAB_SWIPE_EVENT, { detail: { progress, from } }))
    }
    const timers = new Set<number>()
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn() }, ms)
      timers.add(id)
    }
    const clearTimers = () => { for (const timer of timers) window.clearTimeout(timer); timers.clear() }

    const hidePeek = (peek: HTMLElement) => {
      peek.style.transition = ''
      peek.style.transform = ''
      peek.style.opacity = ''
      peek.dataset.visible = 'false'
    }
    const offsetOf = (el: HTMLElement) => new DOMMatrix(getComputedStyle(el).transform).m41
    const place = (el: HTMLElement, x: number, transition: string) => {
      el.style.transition = transition
      el.style.transform = x || el !== content ? `translate3d(${x}px, 0, 0)` : ''
    }

    // A new tab has arrived under the panel that was covering it: put the content
    // back in place, and lift the panel once the tab shows its content. While the
    // tab still shows its loading, the panel stays: it is the same loading, so
    // nothing changes for the reader until the content is there.
    let arrival: { cover: HTMLElement; observer: MutationObserver } | null = null
    const endArrival = (fade: boolean) => {
      if (!arrival) return
      const { cover, observer } = arrival
      observer.disconnect()
      arrival = null
      if (!fade) { hidePeek(cover); return }
      cover.style.transition = 'opacity 180ms ease-out'
      cover.style.opacity = '0'
      later(() => { if (cover.style.opacity === '0') hidePeek(cover) }, 200)
    }
    const loading = () => content.querySelector('[data-ticker-research-loading]') !== null
    const watchArrival = (cover: HTMLElement) => {
      endArrival(false)
      arrival = { cover, observer: new MutationObserver(() => { if (!loading()) endArrival(true) }) }
      if (!loading()) { endArrival(true); return }
      arrival.observer.observe(content, { childList: true, subtree: true })
      later(() => endArrival(true), ARRIVAL_TIMEOUT_MS)
    }
    // A panel left in front by a gesture over a tab that arrived meanwhile.
    let arrivedUnder: HTMLElement | null = null
    const arrive = () => {
      const pending = pendingRef.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      pendingRef.current = null
      // The content is now the arrived tab: back in place, behind the panel.
      content.style.transition = ''
      content.style.transform = ''
      if (swiping) {
        // Mid-gesture the panel keeps following the finger; what happens to it is
        // decided when the finger lifts.
        front = { ...front, index: currentIndex() }
        arrivedUnder = pending.cover
        return
      }
      for (const peek of peeks) if (peek !== pending.cover) hidePeek(peek)
      emit(null)
      front = { el: content, index: currentIndex(), origin: 0 }
      watchArrival(pending.cover)
    }

    // What a gesture moves: the content, or the panel standing in for a tab that
    // is still on its way. Never nothing: a swipe is never ignored for loading.
    let front: { el: HTMLElement; index: number; origin: number } = { el: content, index: currentIndex(), origin: 0 }
    let incoming: HTMLElement | null = null
    let direction = 0

    let startX = 0, startY = 0
    let tracking = false
    let swiping = false
    let dx = 0
    let width = window.innerWidth
    let samples: { t: number; x: number }[] = []

    const blocked = (target: EventTarget | null) => {
      let el = target instanceof Element ? target : null
      if (el?.closest('canvas, svg, input, textarea, select, dialog, [role="dialog"], [role="slider"], [data-swipe-ignore], .site-header')) return true
      while (el && el !== document.body) {
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
      for (const peek of peeks) peek.style.top = `${top}px`
    }

    const neighbour = (from: number, towards: number) => {
      const at = from + towards
      return towards !== 0 && at >= 0 && at < tabs.length ? at : null
    }

    // The front element at `offset`, and the neighbour on the side it moves away from.
    const follow = (offset: number) => {
      place(front.el, offset, '')
      const towards = offset < 0 ? 1 : offset > 0 ? -1 : 0
      if (towards !== direction && incoming) { hidePeek(incoming); incoming = null }
      direction = towards
      if (neighbour(front.index, towards) === null) return
      if (!incoming) {
        // Any panel but the one in front: they all show the same loading.
        incoming = towards > 0 ? (front.el === nextPeek ? previousPeek : nextPeek) : (front.el === previousPeek ? nextPeek : previousPeek)
        incoming.style.opacity = ''
        incoming.dataset.visible = 'true'
      }
      place(incoming, (towards > 0 ? width : -width) + offset, '')
    }

    const springBack = () => {
      const transition = `transform 260ms ${EASE}`
      const { el, index: at } = front
      place(el, 0, transition)
      const leaving = incoming
      if (leaving) place(leaving, direction > 0 ? width : -width, transition)
      incoming = null
      direction = 0
      emit(at === currentIndex() ? null : 0, at)
      later(() => {
        if (leaving && leaving !== front.el) hidePeek(leaving)
        if (el === content) { content.style.transition = ''; content.style.transform = '' }
        // The tab this panel stood for arrived during the gesture: lift it once the
        // tab shows its content, as on any arrival.
        if (arrivedUnder && arrivedUnder === el) {
          arrivedUnder = null
          front = { el: content, index: currentIndex(), origin: 0 }
          watchArrival(el)
        }
      }, 280)
    }

    const clearHint = () => {
      hint.dataset.side = ''
      hint.style.opacity = ''
    }

    const commit = (towards: number, velocity: number) => {
      const at = front.index + towards
      const href = hrefOf(at)
      if (reducedMotion) {
        hint.style.opacity = '1'
        router.push(href)
        return
      }
      const cover = incoming!
      arrivedUnder = null
      const target = towards > 0 ? -width : width
      const remaining = Math.abs(target - dx)
      // A fast flick finishes as fast as it was thrown; a slow release settles calmly.
      const duration = Math.round(Math.min(320, Math.max(180, remaining / Math.max(Math.abs(velocity), 1.2))))
      const transition = `transform ${duration}ms ${EASE}`
      const leaving = front.el
      place(leaving, target, transition)
      place(cover, 0, transition)
      // A panel that was standing in for a tab the reader went past is done.
      if (leaving !== content) later(() => { if (front.el !== leaving && incoming !== leaving) hidePeek(leaving) }, duration + 20)
      emit(towards, front.index)
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
      const timer = window.setTimeout(() => {
        // The destination never arrived: bring the page back.
        if (pendingRef.current?.timer !== timer) return
        pendingRef.current = null
        content.style.transition = ''
        content.style.transform = ''
        for (const peek of peeks) hidePeek(peek)
        front = { el: content, index: currentIndex(), origin: 0 }
        emit(null)
      }, ARRIVAL_TIMEOUT_MS)
      pendingRef.current = { cover, index: at, timer }
      front = { el: cover, index: at, origin: 0 }
      incoming = null
      direction = 0
      // Only the tab the reader stops on is shown: a newer push replaces an older one.
      router.push(href)
    }

    // The rest of a touch is read on the element it started on. Its events keep
    // going to that element even when a tab arriving mid-gesture replaces it,
    // and once it is out of the document they no longer bubble to it.
    let touched: EventTarget | null = null
    const release = () => {
      if (!touched) return
      touched.removeEventListener('touchmove', onMove as EventListener)
      touched.removeEventListener('touchend', onEnd as EventListener)
      touched.removeEventListener('touchcancel', onCancel)
      touched = null
    }
    const hold = (target: EventTarget) => {
      release()
      touched = target
      // Not passive: once a gesture is a swipe, it stops the page scrolling vertically.
      target.addEventListener('touchmove', onMove as EventListener, { passive: false })
      target.addEventListener('touchend', onEnd as EventListener)
      target.addEventListener('touchcancel', onCancel)
    }

    const onStart = (event: TouchEvent) => {
      tracking = false
      release()
      if (event.touches.length !== 1 || blocked(event.target)) return
      const touch = event.touches[0]!
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return
      // Anywhere from the top of the tab's content down, including the empty space
      // under a loading tab; the header and tab bar above keep their own gestures.
      if (touch.clientY < content.getBoundingClientRect().top) return
      startX = touch.clientX; startY = touch.clientY
      tracking = true; swiping = false; dx = 0
      samples = [{ t: event.timeStamp, x: touch.clientX }]
      if (event.target) hold(event.target)
    }

    const beginSwipe = () => {
      width = window.innerWidth
      clearTimers()
      placePeeks()
      // The panel waiting for a tab's content looks exactly like the tab's own
      // loading underneath, so it can go at once and the content takes the gesture.
      endArrival(false)
      const waiting = pendingRef.current
      const el = waiting ? waiting.cover : arrivedUnder ?? content
      const at = waiting ? waiting.index : currentIndex()
      // Mid-animation, the gesture picks the element up where it is.
      const origin = offsetOf(el)
      front = { el, index: at, origin }
      for (const peek of peeks) {
        if (peek === el) continue
        // A panel still on its way out (a release a moment ago) leaves now.
        hidePeek(peek)
      }
      incoming = null
      direction = 0
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
        if (!reducedMotion) beginSwipe()
        // Measure from here, so the page does not jump by the intent distance.
        startX = touch.clientX
      }
      // A sideways swipe holds the page still vertically.
      if (event.cancelable) event.preventDefault()
      const raw = touch.clientX - startX
      samples.push({ t: event.timeStamp, x: touch.clientX })
      while (samples.length > 2 && event.timeStamp - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift()
      if (reducedMotion) {
        const towards = neighbour(currentIndex(), raw < 0 ? 1 : -1)
        if (towards !== null) {
          hint.textContent = raw < 0 ? `${tabs[towards]!.label} →` : `← ${tabs[towards]!.label}`
          hint.dataset.side = raw < 0 ? 'right' : 'left'
          hint.style.opacity = String(Math.min(1, Math.abs(raw) / (width * COMMIT_SHARE)))
        }
        return
      }
      const total = front.origin + raw
      const open = neighbour(front.index, total < 0 ? 1 : -1) !== null
      dx = open ? Math.max(-width, Math.min(width, total)) : total * EDGE_GIVE
      follow(dx)
      emit(open ? dx / -width : 0, front.index)
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
      release()
      tracking = false
      if (!swiping) return
      swiping = false
      const velocity = velocityAt(event.timeStamp)
      const distance = reducedMotion ? samples[samples.length - 1]!.x - startX : dx
      const far = Math.abs(distance) >= width * COMMIT_SHARE
      const flicked = Math.abs(velocity) >= FLICK_VELOCITY && Math.abs(distance) >= FLICK_MIN_PX && Math.sign(velocity) === Math.sign(distance)
      const towards = distance < 0 ? 1 : -1
      const from = reducedMotion ? currentIndex() : front.index
      if ((far || flicked) && neighbour(from, towards) !== null && (reducedMotion || incoming)) {
        if (reducedMotion) { router.push(hrefOf(from + towards)); hint.style.opacity = '1'; return }
        commit(towards, velocity)
        return
      }
      clearHint()
      if (!reducedMotion) springBack()
    }

    const onCancel = () => {
      release()
      if (!swiping) { tracking = false; return }
      tracking = false; swiping = false
      clearHint()
      if (!reducedMotion) springBack()
    }

    arriveRef.current = arrive
    arrive()

    // On the document, not the content: the content can be off screen behind a
    // panel, or shorter than the screen while a tab loads.
    document.addEventListener('touchstart', onStart, { passive: true })

    return () => {
      arriveRef.current = null
      document.removeEventListener('touchstart', onStart)
      release()
      html.style.overscrollBehaviorX = previousOverscroll
      clearTimers()
      clearHint()
      // A panel waiting for content to arrive must not be left covering the page.
      endArrival(false)
      // While a panel stands in for a tab still on its way, the next run takes over.
      if (pendingRef.current) return
      content.style.transition = ''
      content.style.transform = ''
      for (const peek of peeks) hidePeek(peek)
    }
  }, [ticker, reducedMotion, router])

  // Clear the cover if the whole ticker layout goes away mid-swipe.
  useEffect(() => () => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
    pendingRef.current = null
  }, [])

  return (
    <>
      <div ref={previousPeekRef} className={styles.peek} aria-hidden="true" data-visible="false" data-ticker-tab-peek="previous">
        <Peek />
      </div>
      <div ref={nextPeekRef} className={styles.peek} aria-hidden="true" data-visible="false" data-ticker-tab-peek="next">
        <Peek />
      </div>
      <div ref={hintRef} className={styles.hint} aria-hidden="true" data-ticker-tab-swipe-hint="" />
    </>
  )
}

/**
 * The neighbouring tab as it slides in: exactly the loading a tab shows while
 * its route loads (TickerResearchLoading), in the content column's place.
 */
function Peek() {
  return (
    <div className={styles.peekInner}>
      <section className={loadingStyles.root}>
        <LoadingPulse label="Loading" />
      </section>
    </div>
  )
}
