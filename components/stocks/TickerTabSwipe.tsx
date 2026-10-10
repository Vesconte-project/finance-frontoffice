'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import {
  stockResearchHref,
  stockResearchKeyFromPath,
  stockResearchPrimaryItems,
} from '@/components/stocks/stock-nav-config'
import styles from './TickerTabSwipe.module.css'

// A swipe must travel this far, mostly sideways, before it changes the tab.
const COMMIT_PX = 72
const INTENT_PX = 12
const SIDEWAYS_RATIO = 1.6
// How much the content follows the finger.
const FOLLOW = 0.28
// Touches this close to the screen's edge belong to the system's back gesture.
const EDGE_PX = 18

/**
 * A sideways swipe over a ticker page moves to the next or previous research tab,
 * in the order of the tab bar. Touch only: a mouse or trackpad keeps the bar.
 *
 * Gestures that already belong to something else are left alone: charts and
 * canvases (pan, measure), anything that scrolls sideways, form fields, sliders,
 * dialogs, and elements marked `data-swipe-ignore`. Vertical scrolling is never
 * blocked; a gesture only becomes a swipe once it is clearly sideways.
 *
 * While mounted the page turns off the browser's own sideways overscroll, which
 * would otherwise read the same gesture as history back. The system's edge
 * gestures are untouched: a touch that starts at the screen's edge is left alone.
 */
export default function TickerTabSwipe() {
  const pathname = usePathname()
  const router = useRouter()
  const { reducedMotion } = useScrollRuntime()
  const hintRef = useRef<HTMLDivElement>(null)

  const ticker = decodeURIComponent(pathname.split('/').filter(Boolean)[1] ?? '').toUpperCase()
  const activeKey = stockResearchKeyFromPath(pathname)
  const index = stockResearchPrimaryItems.findIndex((item) => item.key === activeKey)
  const previous = index > 0 ? stockResearchPrimaryItems[index - 1] : null
  const next = index >= 0 && index < stockResearchPrimaryItems.length - 1 ? stockResearchPrimaryItems[index + 1] : null

  useEffect(() => {
    if (!ticker) return
    const content = document.querySelector<HTMLElement>('[data-stock-ticker-layout] [data-arrival-part="content"]')
    const hint = hintRef.current
    if (!content || !hint) return

    const previousHref = previous ? stockResearchHref(ticker, previous) : null
    const nextHref = next ? stockResearchHref(ticker, next) : null
    // Fetch the destination when a swipe commits, rather than on every page mount.

    const html = document.documentElement
    const previousOverscroll = html.style.overscrollBehaviorX
    html.style.overscrollBehaviorX = 'none'

    let startX = 0, startY = 0
    let tracking = false
    let swiping = false
    let dx = 0

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

    const reset = (animate: boolean) => {
      content.style.transition = animate && !reducedMotion ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms' : ''
      content.style.transform = ''
      content.style.opacity = ''
      hint.dataset.side = ''
      hint.style.opacity = ''
      window.setTimeout(() => { content.style.transition = '' }, 240)
    }

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || blocked(event.target)) { tracking = false; return }
      const touch = event.touches[0]!
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) { tracking = false; return }
      startX = touch.clientX; startY = touch.clientY
      tracking = true; swiping = false; dx = 0
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
      }
      dx = mx
      const towards = dx < 0 ? next : previous
      // Past the first or last tab the content only gives a little.
      const give = towards ? FOLLOW : FOLLOW * 0.25
      if (!reducedMotion) {
        content.style.transform = `translateX(${dx * give}px)`
        content.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 900))
      }
      if (towards) {
        hint.textContent = dx < 0 ? `${towards.label} →` : `← ${towards.label}`
        hint.dataset.side = dx < 0 ? 'right' : 'left'
        hint.style.opacity = String(Math.min(1, Math.abs(dx) / COMMIT_PX))
      }
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (!swiping) return
      swiping = false
      const href = dx <= -COMMIT_PX ? nextHref : dx >= COMMIT_PX ? previousHref : null
      if (href) {
        hint.style.opacity = '1'
        router.push(href)
        return
      }
      reset(true)
    }

    content.addEventListener('touchstart', onStart, { passive: true })
    content.addEventListener('touchmove', onMove, { passive: true })
    content.addEventListener('touchend', onEnd)
    const onCancel = () => { tracking = false; swiping = false; reset(true) }
    content.addEventListener('touchcancel', onCancel)

    return () => {
      content.removeEventListener('touchstart', onStart)
      content.removeEventListener('touchmove', onMove)
      content.removeEventListener('touchend', onEnd)
      content.removeEventListener('touchcancel', onCancel)
      html.style.overscrollBehaviorX = previousOverscroll
      // A new tab arrives in place: clear what the swipe left on the content.
      reset(false)
    }
  }, [ticker, previous, next, reducedMotion, router])

  return <div ref={hintRef} className={styles.hint} aria-hidden="true" data-ticker-tab-swipe-hint="" />
}
