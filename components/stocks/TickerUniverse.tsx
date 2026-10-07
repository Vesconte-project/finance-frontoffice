'use client'

import { useLayoutEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { createUniverse, ensureOwnLinks, projectUniverse, type ProjectedNode } from '@/lib/ticker-universe'
import {
  adoptFlight,
  ARRIVAL_MS,
  drawUniverseFrame,
  ease,
  endFlight,
  lerp,
  placeOrb,
  planCamera,
  readPalette,
  releaseFlight,
  rememberRest,
  rgbOf,
  viewAt,
  type RestNode,
} from '@/lib/universe-flight'
import styles from './TickerUniverse.module.css'

// The page rises over the universe this long after the flight began.
const RISE_AFTER_MS = 700
const RISE_MS = 520

/**
 * The market universe behind the ticker's identity band. Arriving from the
 * homepage it adopts the flight already under way (lib/universe-flight) and
 * finishes it behind the page: the camera turns until the homepage's node
 * lands on the identity node while the page rises over it. Otherwise it
 * builds a universe around the ticker and rests there. It stays faint so it
 * never competes with the band's text.
 */
export default function TickerUniverse() {
  const params = useParams<{ ticker: string }>()
  const ticker = decodeURIComponent(params.ticker ?? '').toUpperCase()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { reducedMotion } = useScrollRuntime()

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g || !ticker) return
    const html = document.documentElement
    const palette = readPalette(g)

    const flight = adoptFlight(ticker)
    const handoff = flight?.handoff ?? null
    const universe = flight?.universe ?? createUniverse(ticker, html.clientWidth, window.innerHeight)
    // Links the node gains here (the homepage gave it too few) fade in.
    const ownLinksFrom = flight?.ownLinksFrom ?? ensureOwnLinks(universe)
    const plan = flight?.plan ?? planCamera(universe, null)
    const projected: ProjectedNode[] = []
    const arriving = Boolean(flight) && !reducedMotion
    const startedAt = flight?.startedAt ?? performance.now()
    let idle = 0
    let rafId = 0
    let visible = true
    let done = !arriving
    let dpr = 1, cssW = 0, cssH = 0
    // Where the identity node rests is saved once, and again after a resize.
    let remembered = false

    let rising = 0
    if (arriving) {
      // The page rises on the flight's clock, however long it took to load;
      // a page that arrives late still rises, just without waiting.
      const elapsed = Math.min(RISE_AFTER_MS, performance.now() - startedAt)
      html.style.setProperty('--universe-arrival-elapsed', elapsed + 'ms')
      html.dataset.universeArrival = ''
      rising = window.setTimeout(() => delete html.dataset.universeArrival, RISE_AFTER_MS - elapsed + 360 + RISE_MS)
      // The homepage may have been scrolled; the ticker page opens at its top.
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else if (flight) {
      endFlight(flight)
    }

    const anchorOf = () => document.querySelector<HTMLElement>('[data-stock-ticker-layout] [data-selected-ticker-anchor]')
    const bandOf = () => document.querySelector<HTMLElement>('[data-stock-ticker-layout] [data-ticker-hero]')

    function frame(now: number) {
      rafId = 0
      const k = done ? 1 : ease(Math.min(1, (now - startedAt) / ARRIVAL_MS))
      const box = canvas!.getBoundingClientRect()
      const band = bandOf()?.getBoundingClientRect()
      const bandBottom = band ? band.bottom - box.top : 300
      const height = Math.max(bandBottom, k < 1 ? window.innerHeight - box.top : 0)
      const width = box.width
      const nextDpr = Math.min(2, window.devicePixelRatio || 1)
      if (width !== cssW || height !== cssH || nextDpr !== dpr) {
        cssW = width; cssH = height; dpr = nextDpr
        canvas!.style.height = height + 'px'
        canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr)
      }

      // Where the node sits: where the homepage had it, the identity node at rest.
      const anchor = anchorOf()
      const rect = anchor?.getBoundingClientRect()
      const style = anchor ? getComputedStyle(anchor) : null
      const rest: RestNode = {
        x: rect ? rect.left + rect.width / 2 - box.left : 56,
        y: rect ? rect.top + rect.height / 2 - box.top : 140,
        bandBottom,
        outer: rect ? rect.width / 2 : 8.5,
        ring: style ? Number.parseFloat(style.borderTopWidth) || 2 : 2,
        tone: style?.borderTopColor ? rgbOf(g!, style.borderTopColor) : palette.accent,
      }
      const x = handoff ? lerp(handoff.view.x - box.left, rest.x, k) : rest.x
      const y = handoff ? lerp(handoff.view.y - box.top, rest.y, k) : rest.y
      projectUniverse(universe, viewAt(plan, k, idle, x, y), projected)

      g!.setTransform(dpr, 0, 0, dpr, 0, 0)
      g!.globalCompositeOperation = 'source-over'
      g!.clearRect(0, 0, width, height)
      const { veil, labels } = drawUniverseFrame(g!, { universe, handoff, ownLinksFrom, projected, k, done, width, height, bandBottom, palette })

      // The flying node rides above the page, which rises around it.
      if (flight && handoff && !done) {
        placeOrb(flight.orb, flight.orbLabel, { handoff, k, x: x + box.left, y: y + box.top, rest, palette, veil, labels })
      }
      if (!done && k >= 1) {
        done = true
        endFlight(flight!)
      }
      if (done && rect && !remembered) {
        remembered = true
        rememberRest({ ...rest, x: rest.x + box.left, y: rest.y + box.top })
      }
      if (!reducedMotion) idle += 0.00026
      schedule()
    }

    let lastFrame = 0
    function schedule() {
      if (rafId || !visible || document.hidden || (reducedMotion && done)) return
      rafId = requestAnimationFrame(tick)
    }
    function tick(now: number) {
      rafId = 0
      // At rest the turn is slow enough for half the frame rate.
      if (done && now - lastFrame < 30) { schedule(); return }
      lastFrame = now
      frame(now)
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) schedule()
    })
    observer.observe(canvas)
    const onVisibility = () => { if (!document.hidden) schedule() }
    const onResize = () => { remembered = false; if (!rafId) frame(performance.now()) }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)
    // Draw the first frame before the browser paints, so the flight's last
    // frame over the homepage and this one are the same picture.
    frame(performance.now())

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      window.clearTimeout(rising)
      delete html.dataset.universeArrival
      if (flight && !done) releaseFlight(flight)
    }
  }, [ticker, reducedMotion])

  return <canvas ref={canvasRef} className={styles.universe} aria-hidden="true" data-ticker-universe="" />
}
