'use client'

import { useLayoutEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import {
  claimUniverseHandoff,
  createUniverse,
  ensureOwnLinks,
  projectUniverse,
  type ProjectedNode,
  type UniverseView,
} from '@/lib/ticker-universe'
import styles from './TickerUniverse.module.css'

// The camera the band settles on, relative to the arrival frame.
const TURN = 0.9
const REST_PITCH = 0.16
const REST_ZOOM = 1.1
const ARRIVAL_MS = 1400
// Below the identity band the universe is gone; it starts to fade here
// (a fraction of the band's height).
const FADE_FROM = 0.4

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * The market universe behind the ticker's identity band. Arriving from the
 * homepage's focus card it continues the homepage's own network: the camera
 * turns until the focused orb lands on the identity node while the page rises
 * over it. Otherwise it builds a universe around the ticker and rests there.
 * It stays faint so it never competes with the band's text.
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
    const theme = getComputedStyle(html)
    const token = (name: string) => theme.getPropertyValue(name).trim()
    const rgbOf = (value: string) => {
      const probe = g.fillStyle
      g.fillStyle = value
      const normalised = String(g.fillStyle)
      g.fillStyle = probe
      if (normalised.startsWith('#')) return [1, 3, 5].map((o) => Number.parseInt(normalised.slice(o, o + 2), 16)).join(',')
      return normalised.replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).map((v) => v.trim()).join(',')
    }
    const accent = rgbOf(token('--accent'))
    const lineRgb = rgbOf(token('--network-node'))
    const bg = token('--bg')
    const muted = token('--text-muted')
    const surface = token('--surface')

    const handoff = claimUniverseHandoff(ticker, Date.now())
    const universe = handoff?.universe ?? createUniverse(ticker, html.clientWidth, window.innerHeight)
    // Links the node gains here (the homepage gave it too few) fade in.
    const ownLinksFrom = ensureOwnLinks(universe)
    const { nodes, pairs, pairLengths, lightReach } = universe
    const projected: ProjectedNode[] = []
    const start: UniverseView = handoff?.view ?? { ax: 0.16, ay: 0.5, zoom: REST_ZOOM, x: 0, y: 0 }
    const end = { ax: REST_PITCH, ay: start.ay + (handoff ? TURN : 0), zoom: REST_ZOOM }
    const arriving = Boolean(handoff) && !reducedMotion
    const startedAt = performance.now()
    let idle = 0
    let rafId = 0
    let visible = true
    let done = !arriving
    let dpr = 1, cssW = 0, cssH = 0

    let orb: HTMLSpanElement | null = null
    let orbLabel: HTMLSpanElement | null = null
    if (arriving) {
      orb = document.createElement('span')
      orb.className = styles.orb
      orb.setAttribute('aria-hidden', 'true')
      orbLabel = document.createElement('span')
      orbLabel.className = styles.orbLabel
      orbLabel.textContent = ticker
      orb.append(orbLabel)
      document.body.append(orb)
      html.dataset.universeArrival = ''
      // The homepage may have been scrolled; the ticker page opens at its top.
      window.scrollTo({ top: 0, behavior: 'instant' })
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

      // Where the focused node sits: the homepage orb first, the identity node at rest.
      const anchor = anchorOf()
      const rect = anchor?.getBoundingClientRect()
      const restX = rect ? rect.left + rect.width / 2 - box.left : 56
      const restY = rect ? rect.top + rect.height / 2 - box.top : 140
      const fromX = handoff ? handoff.view.x - box.left : restX
      const fromY = handoff ? handoff.view.y - box.top : restY
      const view: UniverseView = {
        ax: lerp(start.ax, end.ax, k),
        ay: lerp(start.ay, end.ay, k) + idle,
        zoom: lerp(start.zoom, end.zoom, k),
        x: lerp(fromX, restX, k),
        y: lerp(fromY, restY, k),
      }
      projectUniverse(universe, view, projected)

      g!.setTransform(dpr, 0, 0, dpr, 0, 0)
      g!.globalCompositeOperation = 'source-over'
      g!.clearRect(0, 0, width, height)
      const lineScale = lerp(handoff?.lineScale ?? 1, 1, k)
      const progress = handoff?.progress ?? 0
      const focus = universe.focus

      // Links: the homepage's focus look, easing into a faint band.
      for (let p = 0; p < pairs.length; p += 2) {
        const ia = pairs[p], ib = pairs[p + 1]
        if (ia === focus || ib === focus) continue
        const a = nodes[ia], b = nodes[ib], pa = projected[ia], pb = projected[ib]
        const depth = Math.min(pa.depth, pb.depth)
        const clar = Math.min(a.clar, b.clar)
        const homeAlpha = (0.03 + 0.11 * depth + 0.05 * progress) * (0.06 + 0.94 * clar)
        const restAlpha = 0.02 + 0.06 * depth
        g!.strokeStyle = 'rgba(' + lineRgb + ',' + lerp(homeAlpha, restAlpha, k) + ')'
        g!.lineWidth = lineScale
        g!.beginPath(); g!.moveTo(pa.sx, pa.sy); g!.lineTo(pb.sx, pb.sy); g!.stroke()
        const peak = Math.max(a.light, b.light)
        if (peak > 0.08) {
          const length = pairLengths[p / 2]
          const strength = lerp(0.85 * (0.06 + 0.94 * clar), 0.16, k)
          const gradient = g!.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy)
          for (const s of [0, 0.25, 0.5, 0.75, 1]) {
            const along = Math.max(a.light * Math.exp(-s * length / lightReach), b.light * Math.exp(-(1 - s) * length / lightReach))
            gradient.addColorStop(s, 'rgba(' + accent + ',' + Math.max(0, (along - 0.08) / 0.92) * strength + ')')
          }
          g!.strokeStyle = gradient
          g!.lineWidth = (1 + 0.9 * peak) * lineScale
          g!.beginPath(); g!.moveTo(pa.sx, pa.sy); g!.lineTo(pb.sx, pb.sy); g!.stroke()
        }
      }
      // Nodes. Labels belong to the homepage and leave with it.
      const labels = 1 - Math.min(1, k / 0.35)
      for (let i = 0; i < nodes.length; i++) {
        if (i === focus) continue
        const n = nodes[i], pn = projected[i]
        const homeAlpha = pn.depth * (0.10 + 0.90 * n.clar)
        const restAlpha = n.signal ? 0.3 : 0.14 + 0.26 * pn.depth
        const r = Math.min(15 * lineScale, Math.max(0.5, n.r * pn.s))
        g!.globalAlpha = Math.min(1, lerp(homeAlpha, restAlpha, k))
        g!.fillStyle = n.signal ? 'rgb(' + accent + ')' : 'rgb(' + lineRgb + ')'
        g!.beginPath(); g!.arc(pn.sx, pn.sy, r, 0, 6.283); g!.fill()
        if (labels > 0 && n.label && pn.depth > 0.4) {
          g!.globalAlpha = labels
          g!.font = (n.signal ? '600 ' : '500 ') + Math.round((n.signal ? 12 : 11) * lineScale) + 'px "IBM Plex Mono", monospace'
          g!.fillStyle = n.signal ? 'rgb(' + accent + ')' : muted
          g!.fillText(n.label, pn.sx + r + 4 * lineScale, pn.sy + 3 * lineScale)
        }
      }
      g!.globalAlpha = 1

      // The band keeps the universe; below it, it is gone.
      g!.globalCompositeOperation = 'destination-in'
      const mask = g!.createLinearGradient(0, 0, 0, height)
      const fadeFrom = Math.min(0.999, (bandBottom * FADE_FROM) / height)
      const fadeTo = Math.min(1, Math.max(fadeFrom + 0.001, bandBottom / height))
      mask.addColorStop(0, 'rgba(0,0,0,1)')
      mask.addColorStop(fadeFrom, 'rgba(0,0,0,1)')
      mask.addColorStop(fadeTo, 'rgba(0,0,0,' + (1 - k) + ')')
      mask.addColorStop(1, 'rgba(0,0,0,' + (1 - k) + ')')
      g!.fillStyle = mask
      g!.fillRect(0, 0, width, height)
      // ...and it is the ticker's neighbourhood: it fades with the distance
      // from the node, so no stray piece of the network floats on its own.
      const f = projected[focus]
      const reach = Math.min(1000, Math.max(520, width * 0.5))
      const around = g!.createRadialGradient(f.sx, f.sy, 0, f.sx, f.sy, reach)
      around.addColorStop(0, 'rgba(0,0,0,1)')
      around.addColorStop(0.3, 'rgba(0,0,0,1)')
      around.addColorStop(1, 'rgba(0,0,0,' + (1 - k) + ')')
      g!.fillStyle = around
      g!.fillRect(0, 0, width, height)
      g!.globalCompositeOperation = 'source-over'

      // The ticker's own links leave the node in the accent, fading outward.
      for (let p = 0; p < pairs.length; p += 2) {
        if (pairs[p] !== focus && pairs[p + 1] !== focus) continue
        const o = projected[pairs[p] === focus ? pairs[p + 1] : pairs[p]]
        const gained = p >= ownLinksFrom && handoff && !done ? k : 1
        const gradient = g!.createLinearGradient(f.sx, f.sy, o.sx, o.sy)
        gradient.addColorStop(0, 'rgba(' + accent + ',' + lerp(0.82, 0.34, k) * gained + ')')
        gradient.addColorStop(1, 'rgba(' + accent + ',' + lerp(0.82, 0.04, k) * gained + ')')
        g!.strokeStyle = gradient
        g!.lineWidth = lerp(1.4 + 2 * (handoff ? 1 : 0), 1.2, k)
        g!.beginPath(); g!.moveTo(f.sx, f.sy); g!.lineTo(o.sx, o.sy); g!.stroke()
      }

      // The homepage's focus mode veils its field (#hc-focusDim); the veil lifts
      // as the camera turns, so the first frame matches the homepage's last.
      const veil = handoff && !done ? 0.7 * (1 - k) : 0
      if (veil > 0) {
        g!.globalAlpha = veil; g!.fillStyle = bg
        g!.fillRect(0, 0, width, height); g!.globalAlpha = 1
      }

      // The homepage orb becomes the identity node without leaving its place.
      // It rides above the page, which rises around it.
      if (orb && !done) {
        const style = anchor ? getComputedStyle(anchor) : null
        const restOuter = rect ? rect.width / 2 : 8.5
        const restRing = style ? Number.parseFloat(style.borderTopWidth) || 2 : 2
        const tone = style?.borderTopColor ? rgbOf(style.borderTopColor) : accent
        const toneMix = accent.split(',').map((v, j) => Math.round(lerp(Number(v), Number(tone.split(',')[j]), k))).join(',')
        const outer = lerp(23.1, restOuter, k)
        Object.assign(orb.style, {
          left: f.sx + box.left - outer + 'px', top: f.sy + box.top - outer + 'px',
          width: outer * 2 + 'px', height: outer * 2 + 'px',
          borderWidth: lerp(9.2, restRing, k) + 'px', borderColor: 'rgb(' + toneMix + ')',
          background: k < 0.5 ? surface : bg,
          boxShadow: '0 0 0 ' + Math.max(0, 63 * (1 - 0.6 * k) - outer) + 'px rgba(' + accent + ',' + 0.28 * (1 - k) + ')',
        })
        orb.style.opacity = String(1 - veil)
        orbLabel!.style.opacity = String(labels)
      }

      if (!done && k >= 1) {
        done = true
        delete html.dataset.universeArrival
        orb?.remove()
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
    const onResize = () => { if (!rafId) frame(performance.now()) }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)
    // Draw the first frame before the browser paints, so the homepage's last
    // frame and this one are the same picture.
    frame(performance.now())

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      delete html.dataset.universeArrival
      orb?.remove()
    }
  }, [ticker, reducedMotion])

  return <canvas ref={canvasRef} className={styles.universe} aria-hidden="true" data-ticker-universe="" />
}
