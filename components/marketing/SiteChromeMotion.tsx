'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'

/**
 * Headless controller for the marketing site chrome.
 *
 * Mirrors the technique used on wolverineworldwide.com: JS only maintains a
 * handful of *state classes* on <html> and lets CSS own every transition. It
 * It consumes the shared site scroll runtime, which owns the single
 * Lenis instance and keeps this CSS state machine synchronized with both
 * smooth and reduced-motion native scrolling.
 *
 * Classes toggled on documentElement:
 *   chrome-scrolled     scrollY past the "condense" threshold — the header goes
 *                       from a boxless floating row to the liquid-glass pill
 *   chrome-past-fold    scrollY past the hide/reveal threshold
 *   chrome-scroll-down  last meaningful scroll delta was downward
 *   chrome-scroll-up    last meaningful scroll delta was upward
 *
 * The bar→pill morph is pure CSS (max-width / padding / a fading ::before glass
 * layer), so there's no geometry library and no text-scaling artifacts.
 */

const SCROLLED = 40
const FOLD_BY_PROFILE = {
  // The pinned narrative hero keeps search reachable well into the page and
  // only lets the header tuck away once the reader is deep past it.
  narrative: 1200,
  operational: 120,
  standard: 120,
} as const
const DELTA = 5

export default function SiteChromeMotion() {
  const { runtime } = useScrollRuntime()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const header = document.querySelector<HTMLElement>('.site-header')

    root.classList.toggle('chrome-scrolled', window.scrollY > SCROLLED)

    let headerHeight = 0
    let shouldMeasureHeader = true
    let lastY = window.scrollY
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const profile = root.dataset.scrollProfile
        const fold = profile === 'narrative'
          ? FOLD_BY_PROFILE.narrative
          : FOLD_BY_PROFILE[profile === 'operational' ? 'operational' : 'standard']
        if (shouldMeasureHeader) {
          headerHeight = header?.getBoundingClientRect().height ?? 0
          shouldMeasureHeader = false
        }
        const collisionElement = document.querySelector<HTMLElement>('[data-chrome-collision]')
        const collisionRect = collisionElement?.getBoundingClientRect()
        const hasCollision = Boolean(
          collisionRect && collisionRect.top < headerHeight && collisionRect.bottom > 0
        )
        root.classList.toggle('chrome-scrolled', y > SCROLLED)
        root.classList.toggle('chrome-past-fold', y > fold)
        root.classList.toggle('chrome-collision', hasCollision)
        if (Math.abs(y - lastY) > DELTA) {
          const down = y > lastY && y > SCROLLED
          root.classList.toggle('chrome-scroll-down', down)
          root.classList.toggle('chrome-scroll-up', !down)
          lastY = y
        }
        ticking = false
      })
    }
    const onResize = () => {
      shouldMeasureHeader = true
      onScroll()
    }

    const unsubscribe = runtime.subscribeScroll(onScroll)
    window.addEventListener('resize', onResize)

    return () => {
      unsubscribe()
      window.removeEventListener('resize', onResize)
      root.classList.remove(
        'chrome-scrolled',
        'chrome-past-fold',
        'chrome-scroll-down',
        'chrome-scroll-up',
        'chrome-collision'
      )
    }
  }, [pathname, runtime])

  return null
}
