'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Sora, JetBrains_Mono, Inter } from 'next/font/google'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { scrollMotionTokens } from '@/components/motion/scroll-tokens'
import { PICK_READING_CONTENT, PICK_READING_KEYS } from '@/lib/picks-content'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

type HcNode = {
  bx: number; by: number; bz: number; r: number; label: string | null; signal: boolean
  rgb: [number, number, number]
  A1: number; A2: number; A3: number; S1: number; S2: number; S3: number
  P1: number; P2: number; P3: number; ph: number; sx: number; sy: number; sc: number
  da: number; hover: number; clar: number
}
type HcPulse = { a: number; b: number; t: number; sp: number }

const CSS = `
.hc-root{
  --font-display:"Sora",system-ui,sans-serif;--font-body:"Inter",system-ui,sans-serif;--font-mono:"JetBrains Mono",ui-monospace,monospace;
  --bg:#f3efe6;--text:#142943;--text-2:#5b6978;--text-3:#87929b;
  --spark:#0b8178;--spark-2:#1ba69a;
  --glass:rgba(255,255,255,.66);--glass-border:rgba(20,41,67,.16);--hairline:rgba(20,41,67,.12);
  --focus-bg:rgba(243,239,230,.94);--focus-text:var(--text);--focus-muted:var(--text-2);--focus-border:var(--hairline);--focus-shadow:0 28px 80px rgba(20,41,67,.18);
  position:relative;background:var(--bg);color:var(--text);font-family:var(--font-body);
}
.hc-root[data-theme="dark"],[data-theme="dark"] .hc-root{
  --bg:#04060c;--text:#eaf0ff;--text-2:#9fb0d0;--text-3:#61708f;
  --spark:#19c9b6;--spark-2:#3fe0cd;
  --glass:rgba(255,255,255,.05);--glass-border:rgba(255,255,255,.14);--hairline:rgba(255,255,255,.10);
  --focus-bg:rgba(4,6,12,.94);--focus-text:var(--text);--focus-muted:var(--text-2);--focus-border:var(--hairline);--focus-shadow:0 40px 100px -30px #000;
}
.hc-root *{box-sizing:border-box}
.hc-root #hc-bg{position:fixed;inset:0;z-index:0;display:block;background:var(--bg)}
.hc-root .hc-veil{position:fixed;inset:0;z-index:1;pointer-events:none}
.hc-root .hc-veil::before,.hc-root .hc-veil::after{content:"";position:absolute;inset:0}
.hc-root .hc-veil::after{background:var(--bg);opacity:calc(var(--hc-field-progress,0) * .65)}
.hc-root .hc-veil::before{opacity:calc(1 - var(--hc-field-progress,0));background:
  linear-gradient(90deg,rgba(243,239,230,.76),rgba(243,239,230,.34) 34%,rgba(243,239,230,.08) 60%,transparent 80%),
  radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(243,239,230,.24))}
.hc-root[data-theme="dark"] .hc-veil::before,[data-theme="dark"] .hc-root .hc-veil::before{background:
  linear-gradient(90deg,rgba(4,6,12,.93),rgba(4,6,12,.58) 34%,rgba(4,6,12,.16) 60%,transparent 80%),
  radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(4,6,12,.55))}
.hc-root .hc-progress{position:fixed;left:0;top:0;height:2px;width:0;background:linear-gradient(90deg,var(--spark),var(--spark-2));z-index:60;box-shadow:0 0 12px var(--spark)}
.hc-root #hc-stage{position:relative;height:100vh;z-index:10;pointer-events:none}
.hc-root .hc-beat{position:absolute;inset:0;display:flex;align-items:center;padding:0 clamp(24px,6vw,90px);will-change:opacity,transform}
.hc-root .hc-in{max-width:1080px;width:100%;margin:0 auto}
.hc-root .hc-in a,.hc-root .hc-in button{pointer-events:auto}
.hc-root .hc-card{display:flex;align-items:center;gap:16px;width:fit-content;margin-top:26px;padding:14px 18px;border-radius:18px;background:var(--glass);border:1px solid var(--glass-border);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 24px 60px -24px #000;backdrop-filter:blur(16px) saturate(1.5);-webkit-backdrop-filter:blur(16px) saturate(1.5)}
.hc-root .hc-card .v{font-family:var(--font-display);font-weight:700;font-size:20px}
.hc-root .hc-fieldcaption,.hc-root .hc-fieldreadings{position:fixed;bottom:16px;z-index:40;font-family:var(--font-mono);font-size:11px;color:var(--text-2);pointer-events:none}
.hc-root .hc-fieldcaption{left:24px}
.hc-root .hc-fieldreadings{right:24px;text-align:right}
.hc-root #hc-focusLayer{position:fixed;inset:0;z-index:70;opacity:0;pointer-events:none}
.hc-root #hc-focusDim{position:absolute;inset:0;background:rgba(20,41,67,.16)}
.hc-root #hc-focusCard{position:absolute;left:54%;top:50%;width:min(360px,46vw);padding:22px;border-radius:20px;background:var(--focus-bg);color:var(--focus-text);border:1px solid var(--focus-border);box-shadow:var(--focus-shadow);backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15)}
.hc-root #hc-focusBack{background:none;border:none;color:var(--focus-muted);font-family:var(--font-mono);font-size:12px;cursor:pointer;padding:0;margin-bottom:14px}
.hc-root #hc-focusBack:hover{color:var(--text)}
.hc-root #hc-focusBack:focus-visible,.hc-root .hc-fc-open:focus-visible,.hc-root .hc-fc-connections a:focus-visible{outline:2px solid var(--spark-2);outline-offset:4px}
.hc-root .hc-fc-ticker{font-family:var(--font-display);font-weight:800;font-size:36px;letter-spacing:-.03em;line-height:1;color:var(--spark)}
.hc-root .hc-fc-name{color:var(--focus-muted);font-size:13px;margin-top:3px}
.hc-root .hc-fc-connections{margin-top:18px}
.hc-root .hc-fc-connections>div{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--focus-muted)}
.hc-root .hc-fc-connections ul{display:flex;flex-wrap:wrap;gap:8px 14px;margin:8px 0 0;padding:0;list-style:none}
.hc-root .hc-fc-connections a{font-family:var(--font-mono);font-size:12px;color:var(--focus-text);text-decoration:none}
.hc-root .hc-fc-connections a:hover{text-decoration:underline;text-decoration-color:var(--spark);text-underline-offset:3px}
.hc-root .hc-fc-open{display:inline-block;margin-top:18px;font-weight:600;font-size:14px;color:var(--spark);text-decoration:none}
.hc-root .hc-fc-open:hover{text-decoration:underline;text-underline-offset:4px}
html[data-theme="dark"] .hc-root #hc-focusDim,.hc-root[data-theme="dark"] #hc-focusDim{background:rgba(0,4,10,.52)}
@media(max-width:767px){.hc-root .hc-fieldcaption{display:none}}
@media(max-width:720px){.hc-root #hc-focusCard{left:12px;right:12px;top:auto;bottom:16px;width:auto;padding:20px}.hc-root .hc-fc-ticker{font-size:30px}}
.hc-root[data-reduced-motion="true"] #hc-focusCard{transition:none}
.hc-root[data-reduced-motion="true"] #hc-stage{height:auto;min-height:0}
.hc-root[data-reduced-motion="true"] .hc-beat{position:relative;inset:auto;min-height:0;padding-block:clamp(48px,8vh,80px);opacity:1!important;transform:none!important}
.hc-root[data-reduced-motion="true"] .hc-beat:first-child{display:none}
`

export default function HeroConstellation() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { reducedMotion, runtime } = useScrollRuntime()

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!
    const c = $('hc-bg') as HTMLCanvasElement
    const x = c.getContext('2d')!
    const stageEl = $('hc-stage')
    const darkMode = Boolean(root.closest('[data-theme="dark"]') || document.documentElement.matches('[data-theme="dark"]'))
    root.dataset.reducedMotion = String(reducedMotion)

    let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0, cam = 0
    let nodes: HcNode[] = [], pairs: number[] = []
    const pulses: HcPulse[] = []
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
    const FIELD_SOFTEN = 1
    // ...and only while something is painted over it. The softening exists to
    // keep the field from competing with the copy on top of it, so with nothing
    // on top there is nothing to yield to and the network comes into focus.
    // Between the hero column fading out and the sections arriving, the field
    // has a full viewport to itself; that stretch is the one where it is sharp.
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

    const TICKERS = ['SPY','NVDA','AAPL','MSFT','QQQ','AMZN','META','TSLA','GOOGL','JPM','XOM','AVGO','AMD','LLY','V','COST','NFLX','HD','BRK.B','GLD']
    const COLORS: [number, number, number][] = darkMode ? [[25,201,182],[63,224,205],[139,123,255],[110,168,255]] : [[43,73,96],[78,103,119],[110,110,128],[86,106,123]]
    const G: [number, number, number] = darkMode ? [52,211,153] : [11,129,120]
    const spark = darkMode ? '#3fe0cd' : '#0b8178'
    const sparkRgb = darkMode ? '25,201,182' : '11,129,120'
    const lineRgb = darkMode ? '25,201,182' : '30,57,79'
    const labelColor = darkMode ? 'rgba(234,240,255,0.82)' : 'rgba(20,41,67,0.62)'
    const smooth = (a: number, b: number, t: number) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t) }
    const fib = (i: number, n: number) => { const y = 1 - (i / Math.max(1, n - 1)) * 2; const r = Math.sqrt(Math.max(0, 1 - y * y)); const th = i * 2.399963; return [Math.cos(th) * r, y, Math.sin(th) * r] }

    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1); W = document.documentElement.clientWidth; H = window.innerHeight
      c.width = W * DPR; c.height = H * DPR; c.style.width = W + 'px'; c.style.height = H + 'px'
      cx = W * 0.5; cy = H * 0.5; R = Math.max(W, H) * 0.62; cam = R * 1.9
    }
    function build() {
      nodes = []; const HUBS = TICKERS.length, EXTRA = Math.max(90, Math.floor(W / 12)), N = HUBS + EXTRA
      for (let i = 0; i < N; i++) {
        let bx: number, by: number, bz: number, label: string | null = null, rad: number
        if (i === 0) { bx = by = bz = 0; label = 'SPY'; rad = 7 }
        else if (i < HUBS) { const v = fib(i, HUBS); const rr = R * (0.45 + Math.random() * 0.5); bx = v[0] * rr; by = v[1] * rr; bz = v[2] * rr; label = TICKERS[i]; rad = 3.0 }
        else { const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), rr = R * (0.12 + Math.random() * 0.92); bx = rr * Math.sin(ph) * Math.cos(th); by = rr * Math.cos(ph); bz = rr * Math.sin(ph) * Math.sin(th); rad = 1.1 + Math.random() * 1.3 }
        const dm = i === 0 ? 0.25 : 1
        nodes.push({ bx, by, bz, r: rad, label, signal: i === 0, rgb: i === 0 ? G : COLORS[(Math.random() * COLORS.length) | 0],
          A1: R * (0.02 + Math.random() * 0.05) * dm, A2: R * (0.02 + Math.random() * 0.05) * dm, A3: R * (0.02 + Math.random() * 0.05) * dm,
          S1: 0.2 + Math.random() * 0.4, S2: 0.2 + Math.random() * 0.4, S3: 0.2 + Math.random() * 0.4,
          P1: Math.random() * 6.28, P2: Math.random() * 6.28, P3: Math.random() * 6.28,
          ph: Math.random() * 6.28, sx: 0, sy: 0, sc: 1, da: 1, hover: 0, clar: 1 })
      }
      pairs = []; const TH = R * 0.34
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].bx - nodes[j].bx, dy = nodes[i].by - nodes[j].by, dz = nodes[i].bz - nodes[j].bz
        if (dx * dx + dy * dy + dz * dz < TH * TH && Math.random() < 0.5) { pairs.push(i, j); if (pairs.length > 1500) break }
      }
    }

    let tt = 0, p = 0, targetP = 0
    let searchMode = 0, searchModeTarget = 0, dismissingSearch = false
    const focus = { i: -1, t: 0, tone: spark as string }
    const oc = document.createElement('canvas'); const octx = oc.getContext('2d')!

    function drawScene(g: CanvasRenderingContext2D, sig: number, mode: string) {
      const nodeReveal = smooth(0, 0.45, reveal)
      const edgeReveal = smooth(0.35, 1, reveal)
      if (mode !== 'conn') { const gg = g.createRadialGradient(cx, cy, 0, cx, cy, R); gg.addColorStop(0, 'rgba(' + sparkRgb + ',' + ((darkMode ? 0.08 : 0.018) + (darkMode ? 0.06 : 0.012) * p) * (1 - focus.t) + ')'); gg.addColorStop(1, 'rgba(' + sparkRgb + ',0)'); g.fillStyle = gg; g.fillRect(0, 0, W, H) }
      for (let k = 0; k < pairs.length; k += 2) {
        const ia = pairs[k], ib = pairs[k + 1], conn = (ia === focus.i || ib === focus.i)
        if (mode === 'conn' && !conn) continue; if (mode === 'bg' && conn) continue
        const a = nodes[ia], b = nodes[ib], da = Math.min(a.da, b.da), hv = Math.max(a.hover, b.hover)
        const clar = conn ? 1 : Math.min(a.clar, b.clar), ld = 1 - focus.t * (1 - (0.06 + 0.94 * clar))
        const aA = conn ? (0.32 + 0.5 * focus.t) : ((0.03 + 0.11 * da + 0.05 * p + 0.25 * hv) * ld)
        g.strokeStyle = (conn ? (darkMode ? 'rgba(150,245,228,' : 'rgba(19,128,119,') : 'rgba(' + lineRgb + ',') + (aA * edgeReveal) + ')'; g.lineWidth = 1 + hv * 0.5 + (conn ? focus.t * 2 : 0)
        g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(b.sx, b.sy); g.stroke()
      }
      if (mode !== 'conn' && focus.i < 0) {
        if (!reducedMotion && Math.random() < 0.03 && pairs.length) { const k = ((Math.random() * pairs.length / 2) | 0) * 2; pulses.push({ a: pairs[k], b: pairs[k + 1], t: 0, sp: .006 + Math.random() * .006 }) }
        for (let i = pulses.length - 1; i >= 0; i--) { const P = pulses[i]; P.t += P.sp; if (P.t >= 1) { pulses.splice(i, 1); continue } const a = nodes[P.a], b = nodes[P.b]; const px = a.sx + (b.sx - a.sx) * P.t, py = a.sy + (b.sy - a.sy) * P.t; g.beginPath(); g.arc(px, py, 2, 0, 6.28); g.fillStyle = spark; g.shadowColor = spark; g.shadowBlur = darkMode ? 12 : 4; g.fill(); g.shadowBlur = 0 }
      }
      if (mode !== 'conn') {
        for (let idx = 0; idx < nodes.length; idx++) { const n = nodes[idx]
          if (idx === focus.i) continue
          n.ph += reducedMotion ? 0 : (focus.i < 0 ? 0.006 : 0.002); const glow = reducedMotion ? 1 : 0.6 + Math.sin(n.ph) * 0.4
          let col: string; if (n.signal) col = 'rgb(52,211,153)'; else { const bias = sig * (n.label ? 0.55 : 0.25); col = 'rgb(' + Math.round(n.rgb[0] + (G[0] - n.rgb[0]) * bias) + ',' + Math.round(n.rgb[1] + (G[1] - n.rgb[1]) * bias) + ',' + Math.round(n.rgb[2] + (G[2] - n.rgb[2]) * bias) + ')' }
          const r = Math.min(24, Math.max(0.5, ((n.signal ? (n.r + sig * 6) : n.r) + n.hover * 5) * n.sc))
          const dim = 1 - focus.t * (1 - (0.10 + 0.90 * n.clar))
          g.globalAlpha = Math.min(1, (n.da + n.hover * 0.6) * dim * nodeReveal)
          g.beginPath(); g.arc(n.sx, n.sy, r, 0, 6.28); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = (darkMode ? (n.label ? 12 : 5) + n.hover * 16 : (n.label ? 2 : 0) + n.hover * 5) * glow; g.fill(); g.shadowBlur = 0
          const lab = n.label
          if (lab && (n.da > 0.4 || n.hover > 0.25)) { g.globalAlpha = Math.min(1, (n.da * 0.8 + n.hover) * dim * nodeReveal); g.font = '600 10px JetBrains Mono, monospace'; g.fillStyle = labelColor; g.fillText(lab, n.sx + r + 4, n.sy + 3) }
          g.globalAlpha = 1
        }
      }
    }
    function orb(g: CanvasRenderingContext2D, aX: number, aY: number) {
      const fn = nodes[focus.i], tone = focus.tone || spark, rr = 6 + focus.t * 15
      g.globalAlpha = Math.min(1, focus.t) * 0.28; g.beginPath(); g.arc(aX, aY, rr * 3, 0, 6.28); g.fillStyle = tone; g.fill()
      g.globalAlpha = Math.min(1, focus.t * 1.8); g.beginPath(); g.arc(aX, aY, rr * 1.1, 0, 6.28); g.fillStyle = tone; g.shadowColor = tone; g.shadowBlur = 50; g.fill(); g.shadowBlur = 0
      g.globalAlpha = Math.min(1, focus.t * 2); g.beginPath(); g.arc(aX, aY, rr * 0.66, 0, 6.28); g.fillStyle = darkMode ? '#ffffff' : '#fffdf7'; g.shadowColor = g.fillStyle; g.shadowBlur = darkMode ? 26 : 8; g.fill(); g.shadowBlur = 0
      const lab = fn.label; if (lab) { g.globalAlpha = Math.min(1, focus.t); g.font = '700 14px JetBrains Mono, monospace'; g.fillStyle = darkMode ? '#eef3ff' : '#142943'; g.fillText(lab, aX + rr + 14, aY + 5) }
      g.globalAlpha = 1
    }
    const applyCanvasFilter = () => {
      const canvasBlur = FIELD_SOFTEN * soften + searchMode * 6.5 + introBlur * 4
      c.style.filter = canvasBlur > 0.002 ? 'blur(' + canvasBlur.toFixed(2) + 'px)' : 'none'
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
      } else {
        const fn = nodes[focus.i]
        const aX = fn.sx + (W * 0.30 - fn.sx) * focus.t, aY = fn.sy + (H * 0.5 - fn.sy) * focus.t, fs = 1 + focus.t * 3.0
        if (oc.width !== c.width || oc.height !== c.height) { oc.width = c.width; oc.height = c.height }
        octx.setTransform(DPR, 0, 0, DPR, 0, 0); octx.clearRect(0, 0, W, H)
        octx.save(); octx.translate(aX, aY); octx.scale(fs, fs); octx.translate(-fn.sx, -fn.sy)
        drawScene(octx, sig, 'bg')
        octx.restore()
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height)
        x.filter = 'blur(' + (focus.t * 6 * DPR) + 'px)'; x.drawImage(oc, 0, 0); x.filter = 'none'
        x.setTransform(DPR, 0, 0, DPR, 0, 0)
        for (let k = 0; k < pairs.length; k += 2) {
          const ia = pairs[k], ib = pairs[k + 1]
          if (ia !== focus.i && ib !== focus.i) continue
          const o = (ia === focus.i) ? nodes[ib] : nodes[ia]
          const ox = aX + (o.sx - fn.sx) * fs, oy = aY + (o.sy - fn.sy) * fs
          const gr = x.createLinearGradient(aX, aY, ox, oy)
          gr.addColorStop(0, (darkMode ? 'rgba(190,252,240,' : 'rgba(19,128,119,') + (0.68 * focus.t) + ')')
          gr.addColorStop(0.45, (darkMode ? 'rgba(150,245,228,' : 'rgba(19,128,119,') + (0.2 * focus.t) + ')')
          gr.addColorStop(1, darkMode ? 'rgba(150,245,228,0)' : 'rgba(19,128,119,0)')
          x.strokeStyle = gr; x.lineWidth = 1.4
          x.beginPath(); x.moveTo(aX, aY); x.lineTo(ox, oy); x.stroke()
        }
        orb(x, aX, aY)
      }
      if (!reducedMotion) rafId = requestAnimationFrame(render)
    }

    const onMove = (e: MouseEvent) => { tmx = (e.clientX / window.innerWidth - .5); tmy = (e.clientY / window.innerHeight - .5); mpx = e.clientX; mpy = e.clientY }
    const onOut = () => { mpx = -1e4; mpy = -1e4 }
    const onResize = () => { resize(); build(); if (reducedMotion) render() }
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
      const s = { p: 0 }
      const tween = runtimeGsap.to(s, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: stageEl,
          start: 'top top',
          end: () => `+=${window.innerHeight}`,
          scrub: scrollMotionTokens.scrub.cinematic,
          pin: true,
          anticipatePin: 1,
          onUpdate: self => setP(self.progress),
        },
      })
      // Recede by pin release, before the first content frame enters the view.
      const hideTrigger = ScrollTrigger.create({
        trigger: stageEl,
        start: 'top top',
        end: () => `+=${window.innerHeight}`,
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
    const openFocus = (idx: number) => {
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
      window.removeEventListener('pointerdown', finishReveal); window.removeEventListener('keydown', finishReveal); window.removeEventListener('wheel', finishReveal); window.removeEventListener('touchstart', finishReveal); window.removeEventListener('focusin', finishReveal)
      window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick, true)
      window.removeEventListener('mousedown', onDown, true); window.removeEventListener('meridian:search-focus', onSearchFocus)
      window.removeEventListener('wheel', onWheel, true); window.removeEventListener('touchstart', onTouchStart, true); window.removeEventListener('touchmove', onTouchMove, true)
      backBtn.removeEventListener('click', closeFocus); fDim.removeEventListener('click', closeFocus)
      focusAbort?.abort()
      releaseScrollLock?.()
      unregisterScrollScene()
    }
  }, [reducedMotion, runtime])

  return (
    <div className="hc-root" ref={rootRef} style={{ ['--font-display' as never]: sora.style.fontFamily, ['--font-body' as never]: inter.style.fontFamily, ['--font-mono' as never]: mono.style.fontFamily }}>
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
        <div id="hc-focusCard" role="dialog" aria-modal="true" aria-labelledby="hc-fcT" aria-describedby="hc-fcN">
          <button id="hc-focusBack" type="button">← back</button>
          <div className="hc-fc-ticker" id="hc-fcT" />
          <div className="hc-fc-name" id="hc-fcN" />
          <div className="hc-fc-connections" id="hc-fcC" />
          <a className="hc-fc-open" id="hc-fcO" href="#">Open full page →</a>
        </div>
      </div>
    </div>
  )
}
