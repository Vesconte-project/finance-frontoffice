'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { scrollMotionTokens } from '@/components/motion/scroll-tokens'
import { PICK_READING_CONTENT, PICK_READING_KEYS } from '@/lib/picks-content'
import { provideUniverse, startFlight } from '@/lib/universe-flight'


type HcNode = {
  bx: number; by: number; bz: number; r: number; label: string | null; signal: boolean
  rgb: [number, number, number]
  A1: number; A2: number; A3: number; S1: number; S2: number; S3: number
  P1: number; P2: number; P3: number; ph: number; sx: number; sy: number; sc: number
  da: number; hover: number; clar: number
  // How much of the ETF light reaches this node, 1 at an ETF and fading with
  // the distance travelled along the network's own links.
  light: number
}

const CSS = `
.hc-root{
  --text-2:var(--text-muted);--text-3:var(--text-muted);
  --spark:var(--accent);--spark-2:var(--accent);
  --glass:var(--surface);--glass-border:var(--line);--hairline:var(--line);
  --focus-bg:var(--surface);--focus-text:var(--text);--focus-muted:var(--text-muted);--focus-border:var(--line);--focus-shadow:none;
  position:relative;background:var(--bg);color:var(--text);font-family:var(--font-body);
}
.hc-root *{box-sizing:border-box}
.hc-root #hc-bg{position:fixed;inset:0;z-index:0;display:block;background:var(--bg)}
.hc-root .hc-veil{position:fixed;inset:0;z-index:1;pointer-events:none}
.hc-root .hc-veil::before,.hc-root .hc-veil::after{content:"";position:absolute;inset:0}
.hc-root .hc-veil::after{background:var(--bg);opacity:calc(var(--hc-field-progress,0) * .65)}
.hc-root .hc-veil::before{background:none}
.hc-root .hc-progress{display:none}
.hc-root #hc-stage{position:relative;height:100vh;z-index:10;pointer-events:none}
.hc-root .hc-beat{position:absolute;inset:0;display:flex;align-items:center;padding:0 clamp(24px,6vw,90px);will-change:opacity,transform}
.hc-root .hc-in{max-width:1080px;width:100%;margin:0 auto}
.hc-root .hc-in a,.hc-root .hc-in button{pointer-events:auto}
.hc-root .hc-card{display:flex;align-items:center;gap:16px;width:fit-content;margin-top:26px;padding:14px 18px;border-radius:6px;background:var(--surface);border:1px solid var(--line)}
.hc-root .hc-card .v{font-family:var(--font-mono);font-weight:500;font-size:20px}
.hc-root .hc-fieldcaption,.hc-root .hc-fieldreadings{position:fixed;bottom:16px;z-index:40;font-family:var(--font-mono);font-size:11px;color:var(--text-2);pointer-events:none}
.hc-root .hc-fieldcaption{left:24px}
.hc-root .hc-fieldreadings{right:24px;text-align:right}
.hc-root #hc-focusLayer{position:fixed;inset:0;z-index:70;opacity:0;pointer-events:none}
.hc-root #hc-focusDim{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.hc-root #hc-focusFront{position:absolute;top:0;left:0;pointer-events:none}
.hc-root #hc-focusCard{position:absolute;left:54%;top:50%;width:min(360px,46vw);padding:22px;border-radius:6px;background:var(--surface);color:var(--text);border:1px solid var(--line)}
.hc-root #hc-focusBack{display:block;background:none;border:none;color:var(--focus-muted);font-family:var(--font-mono);font-size:12px;cursor:pointer;padding:0;margin-bottom:14px}
.hc-root #hc-focusBack:hover{color:var(--text)}
.hc-root .hc-fc-backIcon{display:none}
.hc-root #hc-focusBack:focus-visible,.hc-root .hc-fc-open:focus-visible,.hc-root .hc-fc-connections a:focus-visible{outline:2px solid var(--spark-2);outline-offset:4px}
.hc-root #hc-focusCard[data-opened-by-pointer] #hc-focusBack:focus-visible{outline:none}
.hc-root .hc-fc-ticker{font-family:var(--font-mono);font-weight:500;font-size:36px;line-height:1;color:var(--accent)}
.hc-root .hc-fc-name{color:var(--focus-muted);font-size:13px;margin-top:3px}
.hc-root .hc-fc-connections{margin-top:18px}
.hc-root .hc-fc-connections>div{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--focus-muted)}
.hc-root .hc-fc-connections ul{display:flex;flex-wrap:wrap;gap:8px 14px;margin:8px 0 0;padding:0;list-style:none}
.hc-root .hc-fc-connections a{font-family:var(--font-mono);font-size:12px;color:var(--focus-text);text-decoration:none}
.hc-root .hc-fc-connections a:hover{text-decoration:underline;text-decoration-color:var(--spark);text-underline-offset:3px}
.hc-root .hc-fc-open{display:inline-block;margin-top:18px;font-weight:500;font-size:14px;color:var(--text);text-decoration:none}
.hc-root .hc-fc-open:hover{text-decoration:underline;text-underline-offset:4px}
@media(max-width:767px){.hc-root .hc-fieldcaption{display:none}}
@media(max-width:720px){
.hc-root #hc-focusCard{left:0;right:0;top:auto;bottom:0;width:auto;padding:22px 20px calc(20px + env(safe-area-inset-bottom));border-radius:16px 16px 0 0;border-bottom:none}
.hc-root .hc-fc-ticker{font-size:30px;padding-right:48px}
.hc-root #hc-focusBack{position:absolute;top:10px;right:10px;width:44px;height:44px;margin:0;display:grid;place-items:center;border-radius:999px;color:var(--text)}
.hc-root .hc-fc-backText{display:none}
.hc-root .hc-fc-backIcon{display:block}
.hc-root .hc-fc-connections ul{gap:0 6px;margin:4px 0 0 -8px}
.hc-root .hc-fc-connections a{display:inline-block;padding:10px 8px;font-size:14px}
.hc-root .hc-fc-open{display:flex;align-items:center;justify-content:center;min-height:48px;margin-top:16px;border-radius:8px;background:var(--text);color:var(--bg);font-size:15px}
.hc-root .hc-fc-open:hover{text-decoration:none}
}
.hc-root[data-reduced-motion="true"] #hc-focusCard{transition:none}
.hc-root[data-reduced-motion="true"] #hc-stage{height:auto;min-height:0}
.hc-root[data-reduced-motion="true"] .hc-beat{position:relative;inset:auto;min-height:0;padding-block:clamp(48px,8vh,80px);opacity:1!important;transform:none!important}
.hc-root[data-reduced-motion="true"] .hc-beat:first-child{display:none}
`

export default function HeroConstellation() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { reducedMotion, runtime } = useScrollRuntime()
  const router = useRouter()
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router }, [router])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!
    const c = $('hc-bg') as HTMLCanvasElement
    const x = c.getContext('2d')!
    const stageEl = $('hc-stage')
    const theme = getComputedStyle(document.documentElement)
    const themeColor = (name: string) => theme.getPropertyValue(name).trim()
    const themeRgb = (name: string): [number, number, number] => {
      let hex = themeColor(name).replace('#', '')
      // The CSS minifier shortens #ffffff to #fff.
      if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join('')
      return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number]
    }
    root.dataset.reducedMotion = String(reducedMotion)

    let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0, cam = 0
    let nodes: HcNode[] = [], pairs: number[] = [], pairLengths: number[] = []
    let mx = 0, my = 0, tmx = 0, tmy = 0, mpx = -1e4, mpy = -1e4
    let rafId = 0
    let heroVisible = true
    let releaseScrollLock: (() => void) | null = null
    let scrollWithRuntime: ((top: number, onComplete: () => void) => void) | null = null
    const revealStartedAt = performance.now()
    let reveal = reducedMotion ? 1 : 0
    let revealFinishedByGesture = reducedMotion
    // The extra softening the field carries through the arrival, on its own
    // clock rather than the reveal's. It runs long and starts early — under
    // the last two words — so the network resolves *with* the copy landing on
    // it. Held to the end of the arrival instead, it read as a late snap: a
    // held value has no direction, and 290ms is not enough distance to give it
    // one.
    let introBlur = reducedMotion ? 0 : 1
    let introBlurFrom = introBlur
    let introBlurStartsAt = revealStartedAt + 470
    let introBlurClearsAt = revealStartedAt + 1500
    // A softening the field keeps once the arrival is over. The far dust is
    // drawn at a 1.1px radius, so a blur of this size takes its hard edge off
    // entirely while the labelled hubs — three times that radius — keep their
    // shape and stay the things worth reaching for.
    // Applies under reduced motion too: it is a static treatment, not motion.
    // Not free, but not a new cost either: the same CSS filter already runs at
    // 4px through the intro and 6.5px whenever the search is focused.
    // ...and only while something is painted over it. The softening exists to
    // keep the field from competing with the copy on top of it, so with nothing
    // on top there is nothing to yield to and the network comes into focus.
    //
    // Driven by presence, not by scroll position. Tying it to scroll distance
    // made it a scrubbed parameter — it moved because the reader moved, which
    // is not what it is about. It flips on a state change and then eases on its
    // own clock, so it takes the same time whether the reader arrives fast or
    // slowly.
    //
    // What counts as foreground is declared in the markup with
    // `data-field-foreground` rather than found here by selector, so a new
    // section cannot silently start or stop counting.
    const SOFTEN_FADE = 520
    // How often the roster is re-read. Presence changes on scroll, and this is
    // well inside the ease it starts, so it is imperceptible — while being
    // immune to a missed signal in a way an event subscription is not, since
    // the class this depends on is set by another component's own scroll tick.
    const FOREGROUND_POLL = 100
    let soften = 1
    let softenFrom = 1
    let softenTarget = 1
    let softenStartedAt = 0
    let foregroundReadAt = 0
    // `pointer-events` is the honest signal for whether the hero column is
    // still foreground: unlike its opacity it is not transitioned, so it flips
    // the moment the column stops being something the reader can reach, rather
    // than 450ms later when the fade finishes. It also excludes the field's own
    // two corner captions, which are permanently `pointer-events: none` — they
    // annotate the field rather than sit on top of it.
    const isPainted = (el: HTMLElement) => {
      const style = getComputedStyle(el)
      if (style.pointerEvents === 'none' || style.visibility === 'hidden') return false
      const rect = el.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    }
    const readForeground = (now: number) => {
      const marked = document.querySelectorAll<HTMLElement>('[data-field-foreground]')
      // The sections stream in after this effect mounts. An empty roster means
      // "not known yet", so hold the softening rather than sharpen for a frame.
      const present = marked.length === 0 || Array.from(marked).some(isPainted)
      const next = present ? 1 : 0
      if (next === softenTarget) return
      softenFrom = soften
      softenTarget = next
      softenStartedAt = now
    }

    const TICKERS = ['VT','ASML','NVDA','SPY','TSM','AAPL','VEA','MSFT','BABA','QQQ','AMZN','NVO','META','VWO','TSLA','SHEL','GOOGL','GLD','JPM','SONY','XOM','AVGO','AMD','LLY','V','COST','NFLX','HD','BRK.B']
    const ETF_TICKERS = new Set(['VT', 'VEA', 'VWO', 'SPY', 'QQQ', 'GLD'])
    const ETF_COUNT = ETF_TICKERS.size
    const COLORS: [number, number, number][] = [themeRgb('--network-node')]
    const G: [number, number, number] = themeRgb('--accent')
    const spark = themeColor('--accent')
    const sparkRgb = G.join(',')
    const lineRgb = themeRgb('--network-node').join(',')
    const labelColor = themeColor('--text-muted')
    const LIGHT_FLOOR = 0.08
    const LIGHT_STOPS = [0, 0.25, 0.5, 0.75, 1]
    const smooth = (a: number, b: number, t: number) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t) }
    const fib = (i: number, n: number) => { const y = 1 - (i / Math.max(1, n - 1)) * 2; const r = Math.sqrt(Math.max(0, 1 - y * y)); const th = i * 2.399963; return [Math.cos(th) * r, y, Math.sin(th) * r] }

    // On a phone the browser's URL bar shows and hides as the reader scrolls,
    // changing the window's height each time. The field is sized to the tallest
    // the viewport gets (the large viewport, with the bar hidden), so the bar
    // coming and going neither moves the camera nor changes how far the turn
    // runs; only a change of width (a rotation) rebuilds the field.
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none'
    root.appendChild(probe)
    const tallestHeight = () => Math.max(window.innerHeight, probe.getBoundingClientRect().height)
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1); W = document.documentElement.clientWidth; H = tallestHeight()
      c.width = W * DPR; c.height = H * DPR; c.style.width = W + 'px'; c.style.height = H + 'px'
      front.width = c.width; front.height = c.height; front.style.width = c.style.width; front.style.height = c.style.height
      cx = W * 0.5; cy = H * 0.5; R = Math.max(W, H) * 0.62; cam = R * 1.9
    }
    function build() {
      nodes = []; const HUBS = TICKERS.length, EXTRA = Math.max(90, Math.floor(W / 12)), N = HUBS + EXTRA
      for (let i = 0; i < N; i++) {
        let bx: number, by: number, bz: number, label: string | null = null, rad: number
        if (i < HUBS) {
          label = TICKERS[i]
          const etfIndex = [...ETF_TICKERS].indexOf(label)
          if (etfIndex >= 0) {
            const angle = (etfIndex / ETF_COUNT) * Math.PI * 2 + 0.35
            bx = Math.cos(angle) * R * 0.64
            by = Math.sin(angle) * R * 0.43
            bz = Math.sin(angle * 2) * R * 0.12
            rad = 6
          } else {
            const v = fib(i, HUBS)
            const rr = R * (0.45 + Math.random() * 0.5)
            bx = v[0] * rr; by = v[1] * rr; bz = v[2] * rr; rad = 3.0
          }
        }
        else { const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), rr = R * (0.12 + Math.random() * 0.92); bx = rr * Math.sin(ph) * Math.cos(th); by = rr * Math.cos(ph); bz = rr * Math.sin(ph) * Math.sin(th); rad = 1.1 + Math.random() * 1.3 }
        const isEtf = label !== null && ETF_TICKERS.has(label)
        nodes.push({ bx, by, bz, r: rad, label, signal: isEtf, rgb: isEtf ? G : COLORS[(Math.random() * COLORS.length) | 0],
          A1: R * (0.02 + Math.random() * 0.05), A2: R * (0.02 + Math.random() * 0.05), A3: R * (0.02 + Math.random() * 0.05),
          S1: 0.2 + Math.random() * 0.4, S2: 0.2 + Math.random() * 0.4, S3: 0.2 + Math.random() * 0.4,
          P1: Math.random() * 6.28, P2: Math.random() * 6.28, P3: Math.random() * 6.28,
          ph: Math.random() * 6.28, sx: 0, sy: 0, sc: 1, da: 1, hover: 0, clar: 1, light: 0 })
      }
      pairs = []; const TH = R * 0.34
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].bx - nodes[j].bx, dy = nodes[i].by - nodes[j].by, dz = nodes[i].bz - nodes[j].bz
        if (dx * dx + dy * dy + dz * dz < TH * TH && Math.random() < 0.5) { pairs.push(i, j); if (pairs.length > 1500) break }
      }
      // Each ETF is a light source. The light travels outward along the links,
      // weakening with the distance it has covered, so it reaches three or four
      // links before it fades out. A node lit by several paths keeps the
      // strongest (the shortest path from any ETF).
      const adjacency: [number, number][][] = nodes.map(() => [])
      pairLengths = []
      for (let k = 0; k < pairs.length; k += 2) {
        const a = nodes[pairs[k]], b = nodes[pairs[k + 1]]
        const length = Math.hypot(a.bx - b.bx, a.by - b.by, a.bz - b.bz)
        pairLengths.push(length)
        adjacency[pairs[k]].push([pairs[k + 1], length]); adjacency[pairs[k + 1]].push([pairs[k], length])
      }
      const travelled = nodes.map((n) => n.signal ? 0 : Infinity)
      const settled = nodes.map(() => false)
      for (let step = 0; step < N; step++) {
        let next = -1
        for (let i = 0; i < N; i++) if (!settled[i] && (next < 0 || travelled[i] < travelled[next])) next = i
        if (next < 0 || travelled[next] === Infinity) break
        settled[next] = true
        for (const [to, length] of adjacency[next]) travelled[to] = Math.min(travelled[to], travelled[next] + length)
      }
      lightReach = R * 0.27
      nodes.forEach((n, i) => { n.light = Math.exp(-travelled[i] / lightReach) })
    }

    let tt = 0, p = 0, targetP = 0
    let lightReach = 1
    // The camera of the last frame, handed to the ticker page with the network.
    let viewAx = 0, viewAy = 0, viewZoom = 1
    let searchMode = 0, searchModeTarget = 0, dismissingSearch = false
    const focus = { i: -1, t: 0, tone: spark as string }
    const oc = document.createElement('canvas'); const octx = oc.getContext('2d')!
    // The focused node and its links are drawn above the focus veil, so the
    // rest of the field dims while the node itself stays in full light.
    const front = $('hc-focusFront') as HTMLCanvasElement; const fx = front.getContext('2d')!
    let frontDrawn = false
    // Where the focused node settles: beside the card on a wide screen, and
    // centred in the space between the header and the card on a narrow one,
    // where the card sits at the bottom.
    const focusAnchor = () => {
      if (!window.matchMedia('(max-width:720px)').matches) return { x: W * 0.30, y: window.innerHeight * 0.5 }
      const top = document.querySelector('.site-header__row')?.getBoundingClientRect().bottom ?? 64
      const bottom = $('hc-focusCard').getBoundingClientRect().top
      return { x: W * 0.5, y: (top + bottom) / 2 }
    }

    function drawScene(g: CanvasRenderingContext2D, sig: number, mode: string) {
      const nodeReveal = smooth(0, 0.45, reveal)
      const edgeReveal = smooth(0.35, 1, reveal)
      for (let k = 0; k < pairs.length; k += 2) {
        const ia = pairs[k], ib = pairs[k + 1], conn = (ia === focus.i || ib === focus.i)
        if (mode === 'conn' && !conn) continue; if (mode === 'bg' && conn) continue
        const a = nodes[ia], b = nodes[ib], da = Math.min(a.da, b.da), hv = Math.max(a.hover, b.hover)
        const clar = conn ? 1 : Math.min(a.clar, b.clar), ld = 1 - focus.t * (1 - (0.06 + 0.94 * clar))
        const aA = conn ? (0.32 + 0.5 * focus.t) : ((0.03 + 0.11 * da + 0.05 * p + 0.25 * hv) * ld)
        g.strokeStyle = 'rgba(' + (conn ? sparkRgb : lineRgb) + ',' + (aA * edgeReveal) + ')'; g.lineWidth = 1 + hv * 0.5 + (conn ? focus.t * 2 : 0)
        g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(b.sx, b.sy); g.stroke()
        // The ETF light along this link: strongest at the end nearer an ETF,
        // fading towards the other, and never a flat colour across the link.
        const peak = Math.max(a.light, b.light)
        if (!conn && peak > LIGHT_FLOOR) {
          const length = pairLengths[k / 2]
          const along = (s: number) => Math.max(a.light * Math.exp(-s * length / lightReach), b.light * Math.exp(-(1 - s) * length / lightReach))
          const strength = 0.85 * edgeReveal * ld
          const gradient = g.createLinearGradient(a.sx, a.sy, b.sx, b.sy)
          for (const s of LIGHT_STOPS) gradient.addColorStop(s, 'rgba(' + sparkRgb + ',' + (Math.max(0, (along(s) - LIGHT_FLOOR) / (1 - LIGHT_FLOOR)) * strength) + ')')
          g.strokeStyle = gradient; g.lineWidth = 1 + 0.9 * peak + hv * 0.5
          g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(b.sx, b.sy); g.stroke()
        }
      }
      if (mode !== 'conn') {
        for (let idx = 0; idx < nodes.length; idx++) { const n = nodes[idx]
          if (idx === focus.i) continue
          n.ph += reducedMotion ? 0 : (focus.i < 0 ? 0.006 : 0.002)
          let col: string; if (n.signal) col = spark; else { col = 'rgb(' + n.rgb.join(',') + ')' }
          const r = Math.min(15, Math.max(0.5, ((n.signal ? (n.r + sig * 1.2) : n.r) + n.hover * 3) * n.sc))
          const dim = 1 - focus.t * (1 - (0.10 + 0.90 * n.clar))
          g.globalAlpha = Math.min(1, (n.da + n.hover * 0.6) * dim * nodeReveal)
          g.beginPath(); g.arc(n.sx, n.sy, r, 0, 6.28); g.fillStyle = col; g.fill()
          const lab = n.label
          if (lab && (n.da > 0.4 || n.hover > 0.25)) { g.globalAlpha = 1; g.font = n.signal ? '600 12px IBM Plex Mono, monospace' : '500 11px IBM Plex Mono, monospace'; g.fillStyle = n.signal ? spark : labelColor; g.fillText(lab, n.sx + r + 4, n.sy + 3) }
          g.globalAlpha = 1
        }
      }
    }
    function orb(g: CanvasRenderingContext2D, aX: number, aY: number) {
      const fn = nodes[focus.i], tone = focus.tone || spark, rr = 6 + focus.t * 15
      g.globalAlpha = Math.min(1, focus.t) * 0.28; g.beginPath(); g.arc(aX, aY, rr * 3, 0, 6.28); g.fillStyle = tone; g.fill()
      g.globalAlpha = Math.min(1, focus.t * 1.8); g.beginPath(); g.arc(aX, aY, rr * 1.1, 0, 6.28); g.fillStyle = tone; g.fill()
      g.globalAlpha = Math.min(1, focus.t * 2); g.beginPath(); g.arc(aX, aY, rr * 0.66, 0, 6.28); g.fillStyle = themeColor('--surface'); g.fill()
      const lab = fn.label; if (lab) { g.globalAlpha = Math.min(1, focus.t); g.font = '500 14px IBM Plex Mono, monospace'; g.fillStyle = themeColor('--text'); g.fillText(lab, aX + rr + 14, aY + 5) }
      g.globalAlpha = 1
    }
    const applyCanvasFilter = () => {
      c.style.filter = 'none'
    }
    function render() {
      rafId = 0
      if (document.hidden) return
      const now = performance.now()
      if (!revealFinishedByGesture) reveal = Math.min(1, (now - revealStartedAt) / 800)
      introBlur = introBlurFrom * (1 - smooth(introBlurStartsAt, introBlurClearsAt, now))
      // Reduced motion has no frame loop to ease on, and a blur that steps
      // between two values is worse than one that simply stays put, so there
      // the field keeps its softening throughout.
      if (!reducedMotion) {
        if (now - foregroundReadAt >= FOREGROUND_POLL) { foregroundReadAt = now; readForeground(now) }
        soften = softenFrom + (softenTarget - softenFrom) * smooth(softenStartedAt, softenStartedAt + SOFTEN_FADE, now)
      }
      tt += reducedMotion ? 0 : (focus.i < 0 ? 0.016 : 0.016 * 0.22)
      p += (targetP - p) * 0.07; if (focus.i < 0) { mx += (tmx - mx) * 0.03; my += (tmy - my) * 0.03 }
      searchMode += (searchModeTarget - searchMode) * 0.08
      const sig = smooth(0.15, 0.95, p)
      const breathe = reducedMotion ? 1 : 1 + 0.07 * Math.sin(tt * 0.10)
      // Start a touch closer (base 1.2), keeping the scrolled-in end roughly the
      // same; pull the camera back while searching ("scanning the universe").
      const zoom = breathe * (1.2 + smooth(0, 1, p) * 0.95) * (1 - 0.42 * searchMode)
      const ay = (reducedMotion ? 0 : tt * 0.016) + p * Math.PI * 1.4 + mx * 0.4
      const ax = 0.16 + (reducedMotion ? 0 : Math.sin(tt * 0.028) * 0.05) + my * 0.26
      viewAx = ax; viewAy = ay; viewZoom = zoom
      const cA = Math.cos(ax), sA = Math.sin(ax), cB = Math.cos(ay), sB = Math.sin(ay)
      for (const n of nodes) {
        const bx = n.bx + Math.sin(tt * n.S1 + n.P1) * n.A1, by = n.by + Math.cos(tt * n.S2 + n.P2) * n.A2, bz = n.bz + Math.sin(tt * n.S3 + n.P3) * n.A3
        const X0 = bx * cB - bz * sB, Z0 = bx * sB + bz * cB, Y0 = by
        const Y1 = Y0 * cA - Z0 * sA, Z1 = Y0 * sA + Z0 * cA
        const sc = cam / (cam - Z1) * zoom
        const SX = cx + X0 * sc, SY = cy + Y1 * sc
        const dx = mpx - SX, dy = mpy - SY, dd = Math.sqrt(dx * dx + dy * dy), RAD = 120
        const h = (focus.i < 0 && dd < RAD) ? (1 - dd / RAD) : 0; n.hover += (h - n.hover) * 0.1
        n.sx = SX; n.sy = SY; n.sc = sc; n.da = 0.26 + 0.74 * ((Z1 + R) / (2 * R))
      }
      if (focus.i >= 0 && nodes[focus.i]) { const fn = nodes[focus.i]; for (const n of nodes) { const ddx = n.bx - fn.bx, ddy = n.by - fn.by, ddz = n.bz - fn.bz; n.clar = 1 - smooth(R * 0.12, R * 0.95, Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz)) } } else { for (const n of nodes) n.clar = 1 }
      stageEl.style.opacity = String(Math.max(0, 1 - focus.t * 1.3))
      applyCanvasFilter()
      if (focus.t < 0.01 || focus.i < 0 || !nodes[focus.i]) {
        x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, W, H)
        drawScene(x, sig, 'all')
        if (frontDrawn) { fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, front.width, front.height); frontDrawn = false }
      } else {
        const fn = nodes[focus.i], anchor = focusAnchor()
        const aX = fn.sx + (anchor.x - fn.sx) * focus.t, aY = fn.sy + (anchor.y - fn.sy) * focus.t, fs = 1 + focus.t * 3.0
        if (oc.width !== c.width || oc.height !== c.height) { oc.width = c.width; oc.height = c.height }
        octx.setTransform(DPR, 0, 0, DPR, 0, 0); octx.clearRect(0, 0, W, H)
        octx.save(); octx.translate(aX, aY); octx.scale(fs, fs); octx.translate(-fn.sx, -fn.sy)
        drawScene(octx, sig, 'bg')
        octx.restore()
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height)
        x.drawImage(oc, 0, 0)
        fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, front.width, front.height)
        fx.setTransform(DPR, 0, 0, DPR, 0, 0)
        for (let k = 0; k < pairs.length; k += 2) {
          const ia = pairs[k], ib = pairs[k + 1]
          if (ia !== focus.i && ib !== focus.i) continue
          const o = (ia === focus.i) ? nodes[ib] : nodes[ia]
          const ox = aX + (o.sx - fn.sx) * fs, oy = aY + (o.sy - fn.sy) * fs
          fx.strokeStyle = 'rgba(' + sparkRgb + ',' + (0.68 * focus.t) + ')'; fx.lineWidth = 1.4
          fx.beginPath(); fx.moveTo(aX, aY); fx.lineTo(ox, oy); fx.stroke()
        }
        orb(fx, aX, aY)
        frontDrawn = true
      }
      if (!reducedMotion) rafId = requestAnimationFrame(render)
    }

    const onMove = (e: MouseEvent) => { tmx = (e.clientX / window.innerWidth - .5); tmy = (e.clientY / window.innerHeight - .5); mpx = e.clientX; mpy = e.clientY }
    const onOut = () => { mpx = -1e4; mpy = -1e4 }
    const onResize = () => {
      if (document.documentElement.clientWidth === W) {
        // A browser without the large viewport unit only learns the tallest
        // height once the bar first hides: grow the canvas, keep the field.
        if (tallestHeight() > H) { resize(); if (reducedMotion) render() }
        return
      }
      resize(); build(); if (reducedMotion) render()
    }
    if (!reducedMotion) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseout', onOut)
    }
    window.addEventListener('resize', onResize)
    const finishReveal = () => {
      revealFinishedByGesture = true
      reveal = 1
      // Cut the softening short from wherever it currently is rather than
      // dropping it to zero. Somebody who acts during the arrival should not be
      // shown a step change as their reward for it.
      const now = performance.now()
      if (now < introBlurClearsAt) {
        introBlurFrom = introBlur
        introBlurStartsAt = now
        introBlurClearsAt = now + 220
      }
    }
    window.addEventListener('pointerdown', finishReveal, { passive: true })
    window.addEventListener('keydown', finishReveal)
    window.addEventListener('wheel', finishReveal, { passive: true })
    window.addEventListener('touchstart', finishReveal, { passive: true })
    window.addEventListener('focusin', finishReveal)
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId)
        rafId = 0
      } else if (reducedMotion) {
        render()
      } else if (!rafId) {
        rafId = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    resize(); build(); onVisibilityChange()

    // beats
    const beats = Array.from(root.querySelectorAll<HTMLElement>('.hc-beat'))
    const win = [[-0.06, 0.16], [0.20, 0.37], [0.41, 0.57], [0.61, 0.77], [0.81, 1.01]]
    const updateBeats = (prog: number) => beats.forEach((el, i) => { const [a, b] = win[i]; const inn = smooth(a, a + 0.05, prog), out = 1 - smooth(b - 0.05, b, prog); const o = Math.max(0, Math.min(1, inn * out)); el.style.opacity = String(o); el.style.transform = 'translateY(' + ((1 - o) * 18) + 'px)' })
    updateBeats(0)
    const setP = (v: number) => { targetP = v; $('hc-prog').style.width = (v * 100) + '%'; const caption = $('hc-caption'); const readings = $('hc-readings'); const opacity = v > 0.02 ? '0' : '1'; caption.style.opacity = opacity; readings.style.opacity = opacity; updateBeats(v) }

    // How many screens of scroll the camera's turn spans.
    const TURN_SCREENS = 1.6
    const updateField = (progress: number, interactive = progress < 0.999) => {
      const strength = Math.max(0, Math.min(1, progress))
      heroVisible = interactive
      c.style.opacity = String(1 - strength * 0.55)
      c.style.pointerEvents = interactive ? 'auto' : 'none'
      root.style.setProperty('--hc-field-progress', String(strength))
      $('hc-prog').style.opacity = String(1 - strength)
    }
    // Native reduced-motion flow has no pinned scene. Preserve the initial veil,
    // then settle the static field before the content reaches the viewport.
    const unsubscribeStaticScroll = reducedMotion
      ? runtime.subscribeScroll(() => updateField(
          window.scrollY / Math.max(1, root.offsetTop),
          root.getBoundingClientRect().top >= 0,
        ))
      : undefined

    const unregisterScrollScene = runtime.registerScene(({ gsap: runtimeGsap, lenis, ScrollTrigger }) => {
      scrollWithRuntime = (top, onComplete) => lenis.scrollTo(top, { duration: 0.28, lock: false, onComplete })
      // Nothing is pinned: the sections scroll in over the field from the
      // first wheel tick while the camera turns and closes in behind them, so
      // the turn is still under way as the first section passes.
      const s = { p: 0 }
      const tween = runtimeGsap.to(s, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: stageEl,
          start: 'top top',
          end: () => `+=${H * TURN_SCREENS}`,
          scrub: scrollMotionTokens.scrub.cinematic,
          onUpdate: self => setP(self.progress),
        },
      })
      // Recede as the first section rises to cover the screen.
      const hideTrigger = ScrollTrigger.create({
        trigger: stageEl,
        start: 'top top',
        end: () => `+=${H}`,
        onUpdate: self => updateField(self.progress),
        onRefresh: self => updateField(self.progress),
      })
      updateField(hideTrigger.progress)

      return () => {
        scrollWithRuntime = null
        tween.scrollTrigger?.kill()
        tween.kill()
        hideTrigger.kill()
        updateField(0)
      }
    })

    // focus / zoom-into-node
    const fL = $('hc-focusLayer'), fCard = $('hc-focusCard'), fDim = $('hc-focusDim')
    const focusConnections = $('hc-fcC')
    let focusReturn: HTMLElement | null = null
    let focusAbort: AbortController | null = null
    let focusGeneration = 0
    const neighborhoodCache = new Map<string, string[]>()
    const tickerName = (ticker: string) => {
      try {
        const raw = window.sessionStorage.getItem('spy_ticker_index_v1')
        const payload = raw ? JSON.parse(raw) as { items?: Array<{ symbol?: unknown; name?: unknown }> } : null
        const item = payload?.items?.find((entry) => String(entry.symbol ?? '').trim().toUpperCase() === ticker)
        return typeof item?.name === 'string' && item.name.trim() && item.name.trim() !== ticker ? item.name.trim() : ''
      } catch {
        return ''
      }
    }
    const renderConnections = (connections: string[]) => {
      focusConnections.replaceChildren()
      if (!connections.length) return
      const label = document.createElement('div')
      label.textContent = 'Moves with'
      const list = document.createElement('ul')
      for (const connection of connections) {
        const item = document.createElement('li')
        const link = document.createElement('a')
        link.href = '/stocks/' + encodeURIComponent(connection)
        link.textContent = connection
        item.append(link)
        list.append(item)
      }
      focusConnections.append(label, list)
    }
    const readConnections = (ticker: string, payload: { focus?: unknown; edges?: Array<{ source?: unknown; target?: unknown; strength?: unknown }> }) => {
      if (String(payload.focus ?? '').trim().toUpperCase() !== ticker) return []
      const strengths = new Map<string, number>()
      for (const edge of payload.edges ?? []) {
        const source = String(edge.source ?? '').trim().toUpperCase()
        const target = String(edge.target ?? '').trim().toUpperCase()
        const symbol = source === ticker ? target : target === ticker ? source : ''
        const strength = Number(edge.strength)
        if (!symbol || !Number.isFinite(strength)) continue
        strengths.set(symbol, Math.max(strengths.get(symbol) ?? -Infinity, strength))
      }
      return [...strengths.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([symbol]) => symbol)
    }
    const updateCard = () => {
      fL.style.opacity = focus.t > 0.001 ? '1' : '0'
      fCard.style.opacity = String(Math.max(0, (focus.t - 0.45) / 0.55))
      const narrow = window.matchMedia('(max-width:720px)').matches
      fCard.style.transform = (narrow ? 'translateY(0)' : 'translateY(-50%)') + ' translateX(' + ((1 - focus.t) * -20) + 'px)'
    }
    // Focus moves to the back button when the card opens, so a keyboard user
    // lands inside it. Opened by a tap or click, its ring would only look like
    // a selection, so it stays hidden until the reader reaches for the keys.
    let openedByKey = false
    const noteKey = () => { openedByKey = true; delete fCard.dataset.openedByPointer }
    const notePointer = () => { openedByKey = false }
    window.addEventListener('keydown', noteKey, true)
    window.addEventListener('pointerdown', notePointer, true)
    const openFocus = (idx: number) => {
      if (openedByKey) delete fCard.dataset.openedByPointer
      else fCard.dataset.openedByPointer = ''
      gsap.killTweensOf(focus)
      const n = nodes[idx]; if (!n.label) n.label = TICKERS[idx % TICKERS.length]
      const ticker = n.label
      const generation = ++focusGeneration
      focusAbort?.abort()
      focusAbort = null
      focus.tone = spark
      $('hc-fcT').textContent = ticker
      $('hc-fcN').textContent = tickerName(ticker)
      renderConnections(neighborhoodCache.get(ticker) ?? [])
      ;($('hc-fcO') as HTMLAnchorElement).href = '/stocks/' + encodeURIComponent(n.label)
      routerRef.current.prefetch('/stocks/' + encodeURIComponent(n.label))
      focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null
      focus.i = idx; fL.setAttribute('aria-hidden', 'false'); fL.style.pointerEvents = 'auto'; releaseScrollLock ??= runtime.acquireLock()
      if (reducedMotion) { focus.t = 1; updateCard(); backBtn.focus() } else gsap.to(focus, { t: 1, duration: 0.55, ease: 'power2.out', onUpdate: updateCard, onComplete: () => backBtn.focus() })
      if (neighborhoodCache.has(ticker)) return
      const controller = new AbortController()
      focusAbort = controller
      void fetch('/api/network/atlas/neighborhoods/' + encodeURIComponent(ticker), { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ focus?: unknown; edges?: Array<{ source?: unknown; target?: unknown; strength?: unknown }> }> : null)
        .then((payload) => {
          if (!payload || controller.signal.aborted) return
          const connections = readConnections(ticker, payload)
          neighborhoodCache.set(ticker, connections)
          if (generation !== focusGeneration || focus.i !== idx || fL.getAttribute('aria-hidden') !== 'false') return
          renderConnections(connections)
        })
        .catch(() => undefined)
    }
    const closeFocus = () => {
      if (focus.i < 0 && focus.t < 0.01) return
      focusGeneration += 1
      focusAbort?.abort()
      focusAbort = null
      gsap.killTweensOf(focus)
      fL.style.pointerEvents = 'none'
      const finishClose = () => {
        focus.t = 0; focus.i = -1; fL.setAttribute('aria-hidden', 'true'); updateCard()
        releaseScrollLock?.()
        releaseScrollLock = null
        if (focusReturn?.isConnected) focusReturn.focus()
        focusReturn = null
      }
      if (reducedMotion) { finishClose(); render() } else gsap.to(focus, { t: 0, duration: 0.28, ease: 'power2.in', onUpdate: updateCard, onComplete: finishClose })
    }
    const backBtn = $('hc-focusBack'); backBtn.addEventListener('click', closeFocus)
    fDim.addEventListener('click', closeFocus)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && focus.i >= 0) closeFocus() }
    window.addEventListener('keydown', onKey)

    // Opening the focused node's full page hands this network to the ticker
    // page (TickerUniverse), which keeps the same world going and turns the
    // camera until the orb lands on the ticker's identity node. A modified
    // click (new tab, new window) stays an ordinary link.
    const openLink = $('hc-fcO') as HTMLAnchorElement
    // The network as it stands this frame, with `index` as the node the
    // ticker page will carry.
    const universeNow = (index: number) => ({
      nodes: nodes.map((n) => ({
        x: n.bx + Math.sin(tt * n.S1 + n.P1) * n.A1, y: n.by + Math.cos(tt * n.S2 + n.P2) * n.A2, z: n.bz + Math.sin(tt * n.S3 + n.P3) * n.A3,
        r: n.r, label: n.label, signal: n.signal, light: n.light, clar: n.clar,
      })),
      pairs: [...pairs], pairLengths: [...pairLengths], lightReach, R, cam, focus: index,
    })
    const onOpen = (event: MouseEvent) => {
      const fn = focus.i >= 0 ? nodes[focus.i] : null
      if (!fn?.label || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      const fs = 1 + focus.t * 3, anchor = focusAnchor()
      startFlight({
        ticker: fn.label,
        universe: universeNow(focus.i),
        view: { ax: viewAx, ay: viewAy, zoom: viewZoom * fs, x: fn.sx + (anchor.x - fn.sx) * focus.t, y: fn.sy + (anchor.y - fn.sy) * focus.t },
        lineScale: fs,
        progress: p,
        // Same geometry as orb() at focus.t = 1.
        orb: { outer: 23.1, ring: 9.2, glow: 63, label: true },
        veil: 0.7,
        focusLinks: 1,
        createdAt: Date.now(),
      })
      routerRef.current.push(openLink.getAttribute('href') ?? '/stocks/' + encodeURIComponent(fn.label))
    }
    // A search from the homepage carries the network too: a node with no
    // ticker of its own, picked at random among those on screen, becomes the
    // searched ticker and the camera turns it into place on the ticker page.
    const releaseUniverse = provideUniverse((ticker) => {
      // The focus card zooms the field; its own link already hands over.
      if (focus.i >= 0 || focus.t > 0.01) return null
      // Only nodes on the left of the visible universe: the ticker page keeps
      // its node at the band's left edge, so the world must lie to its right
      // and the camera never has to swing round to find it.
      const candidates: number[] = []
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.label || n.signal || n.da < 0.45) continue
        if (n.sx < W * 0.06 || n.sx > W * 0.4 || n.sy < H * 0.15 || n.sy > H * 0.85) continue
        candidates.push(i)
      }
      if (!candidates.length) return null
      const index = candidates[Math.floor(Math.random() * candidates.length)]
      const n = nodes[index]
      const radius = Math.max(1.5, n.r * n.sc)
      return {
        ticker,
        universe: universeNow(index),
        view: { ax: viewAx, ay: viewAy, zoom: viewZoom, x: n.sx, y: n.sy },
        lineScale: 1,
        progress: p,
        orb: { outer: radius, ring: radius, glow: 0, label: false },
        veil: 0,
        focusLinks: 0,
        createdAt: Date.now(),
      }
    })
    openLink.addEventListener('click', onOpen)
    let pendingFocus = false
    const openAfterChromeSettles = (idx: number) => {
      if (pendingFocus || focus.i >= 0) return
      if (window.scrollY > 40) { openFocus(idx); return }
      pendingFocus = true
      const finish = () => {
        pendingFocus = false
        openFocus(idx)
      }
      if (reducedMotion) {
        window.scrollTo({ top: 48, behavior: 'auto' })
        requestAnimationFrame(() => requestAnimationFrame(finish))
      } else if (scrollWithRuntime) {
        scrollWithRuntime(48, finish)
      } else {
        finish()
      }
    }
    // If a search field is focused when the press starts, the click is dismissing
    // it — don't also grab a particle.
    const searchSel = 'input,textarea,[data-dock-search],[data-header-search],[data-pill-search]'
    const onDown = () => {
      const ae = document.activeElement as HTMLElement | null
      const dismissingDisclosure = Boolean(document.querySelector('[data-site-header-row][data-menu-open]'))
      dismissingSearch = dismissingDisclosure || !!(ae && ae.closest && ae.closest(searchSel))
    }
    window.addEventListener('mousedown', onDown, true)
    const onClick = (e: MouseEvent) => {
      if (dismissingSearch) { dismissingSearch = false; return }
      if (focus.i >= 0 || !heroVisible) return
      const tgt = e.target as HTMLElement
      if (tgt && tgt.closest && tgt.closest('.hc-in a,.hc-in button,#hc-focusCard,header,nav,[data-dock-search]')) return
      let best = -1, bd = 48
      for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; const d = Math.hypot(n.sx - e.clientX, n.sy - e.clientY); if (d < bd) { bd = d; best = i } }
      if (best >= 0) openAfterChromeSettles(best)
    }
    window.addEventListener('click', onClick, true)
    let wheelDistance = 0
    let touchStartY: number | null = null
    const closeForScroll = () => {
      wheelDistance = 0
      touchStartY = null
      closeFocus()
    }
    const onWheel = (event: WheelEvent) => {
      if (focus.i < 0) return
      wheelDistance += Math.abs(event.deltaY)
      if (wheelDistance >= 60) closeForScroll()
    }
    const onTouchStart = (event: TouchEvent) => { touchStartY = focus.i >= 0 ? event.touches[0]?.clientY ?? null : null }
    const onTouchMove = (event: TouchEvent) => {
      if (focus.i < 0 || touchStartY === null) return
      if (Math.abs((event.touches[0]?.clientY ?? touchStartY) - touchStartY) >= 48) closeForScroll()
    }
    window.addEventListener('wheel', onWheel, { passive: true, capture: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true, capture: true })
    // Zoom-out + blur the constellation while the hero search is focused.
    const onSearchFocus = (e: Event) => { searchModeTarget = (e as CustomEvent).detail?.focused ? 1 : 0 }
    window.addEventListener('meridian:search-focus', onSearchFocus)
    updateCard()

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      unsubscribeStaticScroll?.()
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseout', onOut); window.removeEventListener('resize', onResize)
      probe.remove()
      window.removeEventListener('pointerdown', finishReveal); window.removeEventListener('keydown', finishReveal); window.removeEventListener('wheel', finishReveal); window.removeEventListener('touchstart', finishReveal); window.removeEventListener('focusin', finishReveal)
      window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick, true)
      openLink.removeEventListener('click', onOpen); releaseUniverse()
      window.removeEventListener('mousedown', onDown, true); window.removeEventListener('meridian:search-focus', onSearchFocus)
      window.removeEventListener('wheel', onWheel, true); window.removeEventListener('touchstart', onTouchStart, true); window.removeEventListener('touchmove', onTouchMove, true)
      backBtn.removeEventListener('click', closeFocus); fDim.removeEventListener('click', closeFocus)
      window.removeEventListener('keydown', noteKey, true); window.removeEventListener('pointerdown', notePointer, true)
      focusAbort?.abort()
      releaseScrollLock?.()
      unregisterScrollScene()
    }
  }, [reducedMotion, runtime])

  return (
    <div className="hc-root" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <canvas id="hc-bg" aria-hidden="true" />
      <div className="hc-veil" />
      <div className="hc-progress" id="hc-prog" />

      <div id="hc-stage">
        {/* Beat 0 is intentionally empty — the DockingSearch overlay is the
            focal point of the first screen and docks into the header on scroll. */}
        <div className="hc-beat"><div className="hc-in" /></div>
      </div>

      <div className="hc-fieldcaption" id="hc-caption">Nothing moves alone.</div>
      <div className="hc-fieldreadings" id="hc-readings">{PICK_READING_KEYS.map((key) => PICK_READING_CONTENT[key].label).join(' · ')}</div>

      <div id="hc-focusLayer" aria-hidden="true">
        <div id="hc-focusDim" />
        <canvas id="hc-focusFront" aria-hidden="true" />
        <div id="hc-focusCard" role="dialog" aria-modal="true" aria-labelledby="hc-fcT" aria-describedby="hc-fcN">
          <button id="hc-focusBack" type="button" aria-label="Back to the network">
            <span className="hc-fc-backText" aria-hidden="true">← back</span>
            <svg className="hc-fc-backIcon" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <div className="hc-fc-ticker" id="hc-fcT" />
          <div className="hc-fc-name" id="hc-fcN" />
          <div className="hc-fc-connections" id="hc-fcC" />
          <a className="hc-fc-open" id="hc-fcO" href="#">Open full page →</a>
        </div>
      </div>
    </div>
  )
}
