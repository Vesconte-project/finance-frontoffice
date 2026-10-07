'use client'

import { useLayoutEffect, useRef } from 'react'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { createUniverse, ensureOwnLinks, projectUniverse, type ProjectedNode } from '@/lib/ticker-universe'
import { drawUniverseFrame, planCamera, readPalette, viewAt } from '@/lib/universe-flight'
import styles from './Rankings.module.css'

/**
 * The market universe behind the rankings header, at rest: the same faint band
 * the ticker page keeps under its identity, turning slowly around the header's
 * own node (`[data-rankings-anchor]`). Decorative and seeded per page, so each
 * reading has its own sky. Reduced motion draws one still frame.
 */
export default function RankingsUniverse({ seed }: { seed: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { reducedMotion } = useScrollRuntime()

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const g = canvas?.getContext('2d')
    const root = canvas?.parentElement
    if (!canvas || !g || !root) return
    const palette = readPalette(g)
    const universe = createUniverse(seed, root.clientWidth, window.innerHeight)
    const ownLinksFrom = ensureOwnLinks(universe)
    const plan = planCamera(universe, null)
    const projected: ProjectedNode[] = []
    let idle = 0
    let rafId = 0
    let visible = true
    let lastFrame = 0
    let dpr = 1, cssW = 0, cssH = 0

    function frame() {
      const box = canvas!.getBoundingClientRect()
      const band = root!.querySelector<HTMLElement>('[data-rankings-band]')?.getBoundingClientRect()
      const bandBottom = band ? band.bottom - box.top : 280
      const width = box.width
      const height = Math.max(1, bandBottom)
      const nextDpr = Math.min(2, window.devicePixelRatio || 1)
      if (width !== cssW || height !== cssH || nextDpr !== dpr) {
        cssW = width; cssH = height; dpr = nextDpr
        canvas!.style.height = height + 'px'
        canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr)
      }
      const anchor = root!.querySelector<HTMLElement>('[data-rankings-anchor]')?.getBoundingClientRect()
      const x = anchor ? anchor.left + anchor.width / 2 - box.left : 40
      const y = anchor ? anchor.top + anchor.height / 2 - box.top : 120
      projectUniverse(universe, viewAt(plan, 1, idle, x, y), projected)
      g!.setTransform(dpr, 0, 0, dpr, 0, 0)
      g!.clearRect(0, 0, width, height)
      drawUniverseFrame(g!, { universe, handoff: null, ownLinksFrom, projected, k: 1, done: true, width, height, bandBottom, palette })
      if (!reducedMotion) idle += 0.00026
    }

    function tick(now: number) {
      rafId = 0
      if (now - lastFrame >= 30) {
        lastFrame = now
        frame()
      }
      schedule()
    }
    function schedule() {
      if (rafId || !visible || document.hidden || reducedMotion) return
      rafId = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) schedule()
    })
    observer.observe(canvas)
    const onVisibility = () => { if (!document.hidden) schedule() }
    const onResize = () => frame()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)
    frame()
    schedule()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [seed, reducedMotion])

  return <canvas ref={canvasRef} className={styles.universe} aria-hidden="true" data-rankings-universe="" />
}
