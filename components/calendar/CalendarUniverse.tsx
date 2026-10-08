'use client'

import { useLayoutEffect, useRef } from 'react'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { createUniverse, projectUniverse, type ProjectedNode, type Universe } from '@/lib/ticker-universe'
import { drawUniverseFrame, readPalette, REST_PITCH } from '@/lib/universe-flight'
import styles from '@/components/picks/Rankings.module.css'

// Further back than a company page's rest camera (REST_ZOOM 1.6): a wide field with no subject.
const FAR_ZOOM = 1.25
// How much of the sphere's height survives: a disc seen nearly edge-on.
const FLATTEN = 0.2

/**
 * The seeded universe with no subject: the focus node's links are removed. The
 * ETF nodes keep their accent and the light along their links, as on every other
 * page. The sphere is flattened into a wide disc so the whole field fits the
 * header band, which is much lower than a company page's.
 */
function withoutFocus(universe: Universe): Universe {
  const pairs: number[] = []
  const pairLengths: number[] = []
  for (let p = 0; p < universe.pairs.length; p += 2) {
    if (universe.pairs[p] === universe.focus || universe.pairs[p + 1] === universe.focus) continue
    pairs.push(universe.pairs[p], universe.pairs[p + 1])
    pairLengths.push(universe.pairLengths[p / 2])
  }
  const nodes = universe.nodes.map((node) => ({ ...node, y: node.y * FLATTEN }))
  return { ...universe, nodes, pairs, pairLengths }
}

/**
 * The market universe behind the calendar's header band, seen from afar. Unlike
 * a company page or Rankings, no node is in focus: the seeded universe's focus
 * node and its links are removed, and the camera centres the field and turns it
 * slowly. Decorative; pauses off screen and in background tabs; reduced motion
 * draws one still frame.
 */
export default function CalendarUniverse({ seed }: { seed: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { reducedMotion } = useScrollRuntime()

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const g = canvas?.getContext('2d')
    const root = canvas?.parentElement
    if (!canvas || !g || !root) return
    const palette = readPalette(g)
    const universe = withoutFocus(createUniverse(seed, root.clientWidth, window.innerHeight))
    const projected: ProjectedNode[] = []
    let idle = 0
    let rafId = 0
    let visible = true
    let lastFrame = 0
    let dpr = 1, cssW = 0, cssH = 0

    function frame() {
      const box = canvas!.getBoundingClientRect()
      const band = root!.querySelector<HTMLElement>('[data-rankings-band]')?.getBoundingClientRect()
      const bandBottom = band ? band.bottom - box.top : 200
      const width = box.width
      const height = Math.max(1, bandBottom)
      const nextDpr = Math.min(2, window.devicePixelRatio || 1)
      if (width !== cssW || height !== cssH || nextDpr !== dpr) {
        cssW = width; cssH = height; dpr = nextDpr
        canvas!.style.height = height + 'px'
        canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr)
      }
      projectUniverse(universe, { ax: REST_PITCH, ay: 0.6 + idle, zoom: FAR_ZOOM, x: width / 2, y: height * 0.55 }, projected)
      g!.setTransform(dpr, 0, 0, dpr, 0, 0)
      g!.clearRect(0, 0, width, height)
      drawUniverseFrame(g!, { universe, handoff: null, ownLinksFrom: universe.pairs.length, projected, k: 1, done: true, width, height, bandBottom, palette })
      if (!reducedMotion) idle += 0.00018
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

  return <canvas ref={canvasRef} className={styles.universe} aria-hidden="true" data-calendar-universe="" />
}
