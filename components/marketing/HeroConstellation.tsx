'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { scrollMotionTokens } from '@/components/motion/scroll-tokens'
import { parseCompanyPanel } from '@/lib/atlas-model'
import { PICK_READING_CONTENT, PICK_READING_KEYS } from '@/lib/picks-content'
import { provideUniverse, startFlight } from '@/lib/universe-flight'
import { createHomeStory, homeStoryProgress, homeStoryScrollProgress, type StoryFieldNode } from './home-story-field'


type HcNode = StoryFieldNode & {
  bx: number; by: number; bz: number; r: number; label: string | null; signal: boolean
  rgb: [number, number, number]
  A1: number; A2: number; A3: number; S1: number; S2: number; S3: number
  P1: number; P2: number; P3: number; ph: number; sx: number; sy: number; sc: number
  da: number; hover: number; clar: number
  // How much of the ETF light reaches this node, 1 at an ETF and fading with
  // the distance travelled along the network's own links.
  light: number
  // How much of the node is left after the foreground has made room: 1 in the
  // open, near 0 while a block of copy sits over it.
  fg: number
  // Whether it counts as under the foreground, which it keeps until it is well clear.
  cov: number
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
.hc-root .hc-veil::after{background:var(--bg);opacity:calc(var(--hc-field-progress,0) * .65 * (1 - var(--hc-story-presence,0)))}
.hc-root .hc-veil::before{background:none}
.hc-root .hc-progress{display:none}
.hc-root #hc-stage{position:relative;height:100vh;z-index:10;pointer-events:none}
.marketing-home:has([data-field-story-live]) #hc-stage{height:28svh}
.hc-root .hc-beat{position:absolute;inset:0;display:flex;align-items:center;padding:0 clamp(24px,6vw,90px);will-change:opacity,transform}
.hc-root .hc-in{max-width:1080px;width:100%;margin:0 auto}
.hc-root .hc-in a,.hc-root .hc-in button{pointer-events:auto}
.hc-root .hc-card{display:flex;align-items:center;gap:16px;width:fit-content;margin-top:26px;padding:14px 18px;border-radius:6px;background:var(--surface);border:1px solid var(--line)}
.hc-root .hc-card .v{font-family:var(--font-mono);font-weight:500;font-size:20px}
.hc-root .hc-fieldcaption,.hc-root .hc-fieldreadings{position:fixed;bottom:16px;z-index:40;font-family:var(--font-mono);font-size:11px;color:var(--text-2);pointer-events:none}
.hc-root .hc-fieldcaption{left:24px}
.hc-root .hc-fieldreadings{right:24px;text-align:right}
.hc-root #hc-focusLayer{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;background:transparent;color:inherit;opacity:0}
.hc-root #hc-focusLayer::backdrop{background:transparent}
html:has(#hc-focusLayer[open]){overflow:hidden;scrollbar-gutter:stable}
.hc-root #hc-focusDim{position:absolute;inset:0;background:var(--bg);opacity:0}
.hc-root #hc-focusFront{position:absolute;top:0;left:0;pointer-events:none}
.hc-root #hc-focusCard{position:absolute;left:54%;top:50%;width:min(360px,46vw);padding:22px;border-radius:6px;background:var(--surface);color:var(--text);border:1px solid var(--line);max-height:calc(100% - 24px);overflow:auto;overscroll-behavior:contain}
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
    // Half the extent of the universe in each direction: across and up it follows the
    // screen (wide on a wide screen, tall on a phone) and is larger than it, so the
    // field runs off every edge instead of ending in a shape; in depth it is as deep
    // as the sphere it replaced, because the contrast between near and far is what
    // gives the field a background.
    let spanX = 0, spanY = 0, spanZ = 0
    let nodes: HcNode[] = [], pairs: number[] = [], pairLengths: number[] = []
    // Each link grows out of one of its two nodes: how far it has grown, 0..1, which
    // node it grows from, and how quickly (a link's own pace, so they do not all
    // move as one).
    let edgeV = new Float32Array(0), edgeDir = new Uint8Array(0), edgeSpd = new Float32Array(0)
    // A fixed draw per link: the ones that fall under FG_KEEP stay up behind the
    // foreground, and how strongly they show.
    let edgeKeep = new Float32Array(0), edgeDim = new Float32Array(0)
    // What the foreground currently asks of each link (1 up, 0 away), when that
    // last changed, and the answer the link has acted on: a link only acts on a
    // change that has held for EDGE_DWELL, so something sweeping past does not
    // make it flash.
    // Whether each link is held up by the foreground. It takes hold when the link
    // reaches a box and lets go only once the link is well clear of it, so a link
    // swaying along the edge of a box does not go in and out with every swing.
    let edgeBlocked = new Uint8Array(0)
    let edgeWant = new Uint8Array(0), edgeWantSince = new Float64Array(0), edgeTarget = new Uint8Array(0)
    let occlusionPrimed = false
    let mx = 0, my = 0, tmx = 0, tmy = 0, mpx = -1e4, mpy = -1e4
    let rafId = 0
    let releaseScrollLock: (() => void) | null = null
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
    const COLORS: [number, number, number][] = [themeRgb('--network-node')]
    const G: [number, number, number] = themeRgb('--accent')
    const spark = themeColor('--accent')
    const sparkRgb = G.join(',')
    const lineRgb = themeRgb('--network-node').join(',')
    const labelColor = themeColor('--text-muted')
    const storyElement = root.parentElement?.querySelector<HTMLElement>('[data-field-story]')
    const story = !reducedMotion && storyElement ? createHomeStory(storyElement, G, COLORS[0]) : null
    let storyProgress = 0, footerReveal = 0
    // One camera path for the whole story. Each visit varies the framing slightly.
    const closestAt = 0.405 + Math.random() * 0.025
    const closestZoom = 1.7 + Math.random() * 0.10
    const endZoom = 0.87 + Math.random() * 0.09
    const turn = Math.PI * (0.88 + Math.random() * 0.12)
    // The ETF light is thin and faint, so it travels past the first node without
    // competing with the foreground in either theme.
    const LIGHT_STRENGTH = 0.35
    const LIGHT_WIDTH = 0.6
    const LIGHT_FLOOR = 0.08
    const LIGHT_STOPS = [0, 0.25, 0.5, 0.75, 1]
    const smooth = (a: number, b: number, t: number) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t) }

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
      spanX = W * 0.78; spanY = H * 0.62; spanZ = R * 0.9
    }
    function build() {
      story?.resetNodes()
      nodes = []; const HUBS = TICKERS.length, EXTRA = Math.min(260, Math.max(120, Math.round(Math.sqrt(W * H) / 5.8))), N = HUBS + EXTRA
      // Nothing about the layout is regular: a few clusters at random places, with
      // the rest of the nodes scattered between them. The ETFs take a random cell of
      // a loose 3x2 grid over the visible part, so there is always one near each
      // part of the screen but never a pattern.
      const rand = (half: number) => (Math.random() * 2 - 1) * half
      const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.6
      // One cluster in each cell of a grid whose shape follows the screen's, at a random
      // place in its cell, so no part of the screen is left without one.
      const cols = Math.max(1, Math.round(Math.sqrt(8 * W / H))), rows = Math.ceil(8 / cols)
      const clusters = Array.from({ length: cols * rows }, (_, i) => [
        (-1 + ((i % cols) + Math.random()) * (2 / cols)) * spanX * 0.9,
        (-1 + (((i / cols) | 0) + Math.random()) * (2 / rows)) * spanY * 0.9,
        rand(spanZ * 0.85),
      ])
      // Every node belongs to a cell, dealt round the cells in turn, so each part of
      // the screen gets the same share of nodes whatever the random draw; within its
      // cell a node either gathers round the cell's cluster or lands anywhere in it.
      const order = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5)
      const place = (index: number, clustered: boolean): [number, number, number] => {
        const cell = order[index % order.length]
        if (!clustered) return [(-1 + ((cell % cols) + Math.random()) * (2 / cols)) * spanX, (-1 + (((cell / cols) | 0) + Math.random()) * (2 / rows)) * spanY, rand(spanZ)]
        const c = clusters[cell]
        const clamp = (v: number, half: number) => Math.max(-half * 1.15, Math.min(half * 1.15, v))
        return [clamp(c[0] + gauss() * spanX * 0.22, spanX), clamp(c[1] + gauss() * spanY * 0.22, spanY), clamp(c[2] + gauss() * spanZ * 0.22, spanZ)]
      }
      const etfCols = Math.max(1, Math.round(Math.sqrt(ETF_TICKERS.size * W / H))), etfRows = Math.ceil(ETF_TICKERS.size / etfCols)
      const cells = Array.from({ length: etfCols * etfRows }, (_, i) => i).sort(() => Math.random() - 0.5)
      for (let i = 0; i < N; i++) {
        let bx: number, by: number, bz: number, label: string | null = null, rad: number
        if (i < HUBS) {
          label = TICKERS[i]
          const etfIndex = [...ETF_TICKERS].indexOf(label)
          if (etfIndex >= 0) {
            const cell = cells[etfIndex], col = cell % etfCols, row = (cell / etfCols) | 0
            bx = (-0.6 + (col + Math.random()) * (1.2 / etfCols)) * W
            by = (-0.55 + (row + Math.random()) * (1.1 / etfRows)) * H
            bz = rand(spanZ * 0.5)
            rad = 6
          } else {
            [bx, by, bz] = place(i, Math.random() < 0.5); rad = 3.0
          }
        }
        else { [bx, by, bz] = place(i, Math.random() < 0.55); rad = 1.1 + Math.random() * 1.3 }
        const isEtf = label !== null && ETF_TICKERS.has(label)
        nodes.push({ bx, by, bz, r: rad, label, signal: isEtf, rgb: isEtf ? G : COLORS[(Math.random() * COLORS.length) | 0],
          A1: R * (0.02 + Math.random() * 0.05), A2: R * (0.02 + Math.random() * 0.05), A3: R * (0.02 + Math.random() * 0.05),
          S1: 0.2 + Math.random() * 0.4, S2: 0.2 + Math.random() * 0.4, S3: 0.2 + Math.random() * 0.4,
          P1: Math.random() * 6.28, P2: Math.random() * 6.28, P3: Math.random() * 6.28,
          ph: Math.random() * 6.28, sx: 0, sy: 0, sc: 1, da: 1, hover: 0, clar: 1, light: 0, fg: 1, cov: 0, storyWeight: 0, storyRadius: 0, storyRgb: [0, 0, 0] })
      }
      // Nearby nodes link at random, but each takes only a handful of links and the
      // shortest first, so the links are spread over the whole universe instead of
      // being used up on the nodes that happen to come first; the ETFs take more so
      // their light still spreads.
      pairs = []; const TH = R * 0.7
      const candidates: [number, number, number][] = []
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].bx - nodes[j].bx, dy = nodes[i].by - nodes[j].by, dz = nodes[i].bz - nodes[j].bz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < TH * TH && Math.random() < 0.5) candidates.push([i, j, d2])
      }
      candidates.sort((u, v) => u[2] - v[2])
      const degree = new Array<number>(N).fill(0)
      const maxDegree = (i: number) => nodes[i].signal ? 9 : 5
      for (const [i, j] of candidates) {
        if (degree[i] >= maxDegree(i) || degree[j] >= maxDegree(j)) continue
        degree[i]++; degree[j]++; pairs.push(i, j)
      }
      edgeV = new Float32Array(pairs.length / 2).fill(1)
      edgeDir = Uint8Array.from({ length: pairs.length / 2 }, () => (Math.random() < 0.5 ? 1 : 0))
      edgeSpd = Float32Array.from({ length: pairs.length / 2 }, () => 0.7 + Math.random() * 0.8)
      edgeKeep = Float32Array.from({ length: pairs.length / 2 }, () => Math.random())
      edgeDim = new Float32Array(pairs.length / 2).fill(1)
      edgeBlocked = new Uint8Array(pairs.length / 2)
      edgeWant = new Uint8Array(pairs.length / 2).fill(1)
      edgeTarget = new Uint8Array(pairs.length / 2).fill(1)
      edgeWantSince = new Float64Array(pairs.length / 2)
      occlusionPrimed = false
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

    let tt = 0, p = 0, targetP = 0, cameraProgress = 0
    let lightReach = 1
    // The camera of the last frame, handed to the ticker page with the network.
    let viewAx = 0, viewAy = 0, viewZoom = 1
    let searchMode = 0, searchModeTarget = 0, dismissingSearch = false
    const focus = { i: -1, t: 0, ticker: '' }
    const FOCUS_ZOOM = 1.35
    // The zoomed field is drawn on the dialog layer above the foreground.
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

    // The foreground makes room in the field. The headline, the search and its
    // buttons and, further down, the copy of each section claim a padded box. A
    // link that touches one is taken away: it draws back into one of its nodes
    // and is gone. Once nothing is over it any more it grows out of that node to
    // the other, so as the page scrolls the links are dismantled where something
    // is about to be read and built again where it has left. Nodes under a box
    // fade rather than go. Elsewhere the network stays full.
    const OBSTACLES = '[data-field-obstacle], [data-dock-search] :is(.dock-search__title, .dock-search__subtitle, .dock-search__field, .dock-search__cta), [data-field-foreground]:not([data-dock-search]) :is(h1, h2, h3, h4, p, li, a, button, input, th, td, label, figcaption)'
    // The share of links crossing the foreground that stay up behind it, so the
    // field thins there rather than opening a hole, and how much of their
    // strength they keep so the copy still reads over them.
    const FG_KEEP = 0.6
    const FG_DIM = 0.85
    // How long a link takes to grow or draw back, before its own pace is applied,
    // and how long the foreground has to keep asking before a link acts on it.
    // Long enough that a link reads as moving rather than appearing.
    const EDGE_MS = 700
    const EDGE_DWELL = 300
    // How far clear of a box something has to get before the foreground lets go of it.
    const FG_RELEASE = 100
    type Box = { l: number; t: number; r: number; b: number; L: number; T: number; R: number; B: number }
    let obstacles: { el: HTMLElement; dock: boolean; pad: number }[] = []
    let obstaclesReadAt = -1e9
    let boxes: Box[] = []
    let occludedAt = 0
    const readBoxes = (now: number) => {
      if (now - obstaclesReadAt > 400) {
        obstaclesReadAt = now
        obstacles = Array.from(document.querySelectorAll<HTMLElement>(OBSTACLES)).map((el) => ({
          el,
          dock: Boolean(el.closest('[data-dock-search]')),
          pad: el.matches('.dock-search__title') ? 16 : el.matches('h1, h2, h3, h4') ? 14 : 10,
        }))
      }
      // Once the hero column is docked into the header it is no longer over the field.
      const dock = document.querySelector<HTMLElement>('[data-dock-search]')
      const dockLive = !!dock && getComputedStyle(dock).pointerEvents !== 'none'
      boxes = []
      for (const o of obstacles) {
        if (o.dock && !dockLive) continue
        const rect = o.el.getBoundingClientRect()
        if (rect.width < 4 || rect.height < 4 || rect.bottom < -40 || rect.top > H + 40) continue
        const l = rect.left - o.pad, t = rect.top - o.pad, r = rect.right + o.pad, b = rect.bottom + o.pad
        boxes.push({ l, t, r, b, L: l - FG_RELEASE, T: t - FG_RELEASE, R: r + FG_RELEASE, B: b + FG_RELEASE })
      }
    }
    // Whether the segment a-b passes through the box (Liang-Barsky).
    const segmentHits = (ax: number, ay: number, dx: number, dy: number, bl: number, bt: number, br: number, bb: number) => {
      let t0 = 0, t1 = 1
      const edges: [number, number][] = [[-dx, ax - bl], [dx, br - ax], [-dy, ay - bt], [dy, bb - ay]]
      for (const [pp, q] of edges) {
        if (pp === 0) { if (q < 0) return false; continue }
        const t = q / pp
        if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t }
      }
      return true
    }
    const updateOcclusion = (now: number) => {
      const live = focus.i < 0 && focus.t < 0.01
      // While the search is open the camera draws back over the whole universe and
      // everything sweeps across the screen, so no link is taken away for the copy:
      // the ones that were held back grow out again, and none is taken away again.
      // The nodes still fade under the copy, so their names do not run through it.
      const carving = live
      const cutLinks = live && searchMode < 0.02
      const dt = Math.min(64, now - occludedAt); occludedAt = now
      // The first pass after the links are built, reduced motion and the focus
      // view all settle at once; only a live field animates.
      const animate = live && !reducedMotion && occlusionPrimed
      if (carving) readBoxes(now); else boxes = []
      const dimEase = 1 - Math.exp(-dt / 260)
      for (let k = 0; k < pairs.length; k += 2) {
        const e = k >> 1
        const a = nodes[pairs[k]], b = nodes[pairs[k + 1]]
        const dx = b.sx - a.sx, dy = b.sy - a.sy
        let want = 1, dimTarget = 1, hit = false
        if (boxes.length && cutLinks) {
          const held = edgeBlocked[e] === 1
          const minX = Math.min(a.sx, b.sx), maxX = Math.max(a.sx, b.sx), minY = Math.min(a.sy, b.sy), maxY = Math.max(a.sy, b.sy)
          for (const box of boxes) {
            const l = held ? box.L : box.l, t = held ? box.T : box.t, r = held ? box.R : box.r, bt = held ? box.B : box.b
            if (r < minX || l > maxX || bt < minY || t > maxY) continue
            if (segmentHits(a.sx, a.sy, dx, dy, l, t, r, bt)) { hit = true; break }
          }
        }
        edgeBlocked[e] = hit ? 1 : 0
        if (hit) { if (edgeKeep[e] < FG_KEEP) dimTarget = FG_DIM; else want = 0 }
        if (!animate) { edgeWant[e] = want; edgeTarget[e] = want; edgeV[e] = want; edgeDim[e] = dimTarget; continue }
        if (want !== edgeWant[e]) { edgeWant[e] = want; edgeWantSince[e] = now }
        if (want !== edgeTarget[e] && now - edgeWantSince[e] >= EDGE_DWELL) edgeTarget[e] = want
        const target = edgeTarget[e]
        edgeDim[e] += (dimTarget - edgeDim[e]) * dimEase
        const step = (dt * edgeSpd[e]) / EDGE_MS
        edgeV[e] = target > edgeV[e] ? Math.min(target, edgeV[e] + step) : Math.max(target, edgeV[e] - step)
      }
      occlusionPrimed = true
      const nodeEase = animate ? 1 - Math.exp(-dt / 240) : 1
      for (const n of nodes) {
        let covered = false
        for (const box of boxes) {
          const held = n.cov === 1
          if (n.sx >= (held ? box.L : box.l) && n.sx <= (held ? box.R : box.r) && n.sy >= (held ? box.T : box.t) && n.sy <= (held ? box.B : box.b)) { covered = true; break }
        }
        n.cov = covered ? 1 : 0
        n.fg += ((covered ? 0.25 : 1) - n.fg) * nodeEase
      }
    }
    // A link as far as it has grown from its own node: the whole link at 1, none of it at 0.
    function edgePath(g: CanvasRenderingContext2D, a: HcNode, b: HcNode, v: number, from: number) {
      if (v <= 0.002) return
      const s = from ? a : b, t = from ? b : a
      g.moveTo(s.sx, s.sy)
      g.lineTo(v >= 0.999 ? t.sx : s.sx + (t.sx - s.sx) * v, v >= 0.999 ? t.sy : s.sy + (t.sy - s.sy) * v)
    }

    // Scratch lists for drawScene: links grouped by opacity, and the ETF-lit ones.
    const ALPHA_LEVELS = 20
    const alphaBuckets: number[][] = Array.from({ length: ALPHA_LEVELS + 1 }, () => [])
    const litEdges: number[] = []
    const ambientOpacity = () => (1 - (story?.presence ?? 0) * 0.78) * (1 - (story?.fieldQuiet ?? 0) * 0.6) * (1 - footerReveal)
    function drawScene(g: CanvasRenderingContext2D, sig: number, focused: boolean) {
      const nodeReveal = smooth(0, 0.45, reveal)
      const ambient = focused ? 0.42 : ambientOpacity()
      const edgeReveal = smooth(0.35, 1, reveal) * ambient
      for (let k = 0; k < pairs.length; k += 2) {
        const ia = pairs[k], ib = pairs[k + 1], conn = (ia === focus.i || ib === focus.i)
        if (focused && conn) continue
        const a = nodes[ia], b = nodes[ib]
        // A link wholly outside the screen is not worth drawing (not while the focus
        // view has the field scaled around a node).
        if (focus.t < 0.01 && ((a.sx < -40 && b.sx < -40) || (a.sx > W + 40 && b.sx > W + 40) || (a.sy < -40 && b.sy < -40) || (a.sy > H + 40 && b.sy > H + 40))) continue
        const da = Math.min(a.da, b.da), hv = Math.max(a.hover, b.hover)
        const clar = conn ? 1 : Math.min(a.clar, b.clar), ld = 1 - focus.t * (1 - (0.06 + 0.94 * clar))
        const aA = (conn ? (0.32 + 0.5 * focus.t) : ((0.03 + 0.11 * da + 0.05 * p + 0.25 * hv) * ld * edgeDim[k >> 1] * smooth(0, 0.7, edgeV[k >> 1]))) * edgeReveal
        const topology = 1 - Math.max(a.storyWeight, b.storyWeight)
        const peak = Math.max(a.light, b.light)
        const lit = !conn && peak > LIGHT_FLOOR
        if (conn || hv >= 0.02) {
          // Under the pointer, or joined to the focused node: drawn on its own.
          g.strokeStyle = 'rgba(' + (conn ? sparkRgb : lineRgb) + ',' + aA * topology + ')'; g.lineWidth = 1 + hv * 0.5 + (conn ? focus.t * 2 : 0)
          g.beginPath(); edgePath(g, a, b, edgeV[k >> 1], edgeDir[k >> 1]); g.stroke()
        } else {
          // Every other link shares a stroke with the others of about its opacity,
          // so the field costs a handful of draws rather than one per link.
          const q = Math.min(ALPHA_LEVELS, Math.round(aA * topology * ALPHA_LEVELS * 2))
          if (q > 0) alphaBuckets[q].push(k)
        }
        // The ETF light along this link: strongest at the end nearer an ETF,
        // fading towards the other, and never a flat colour across the link.
        if (lit) litEdges.push(k, LIGHT_STRENGTH * topology * edgeReveal * ld * edgeDim[k >> 1] * smooth(0, 0.7, edgeV[k >> 1]), 1 + LIGHT_WIDTH * peak + hv * 0.5)
      }
      for (let q = 1; q <= ALPHA_LEVELS; q++) {
        const bucket = alphaBuckets[q]
        if (!bucket.length) continue
        g.strokeStyle = 'rgba(' + lineRgb + ',' + q / (ALPHA_LEVELS * 2) + ')'; g.lineWidth = 1
        g.beginPath()
        for (const k of bucket) edgePath(g, nodes[pairs[k]], nodes[pairs[k + 1]], edgeV[k >> 1], edgeDir[k >> 1])
        g.stroke()
        bucket.length = 0
      }
      for (let m = 0; m < litEdges.length; m += 3) {
        const k = litEdges[m], strength = litEdges[m + 1]
        const a = nodes[pairs[k]], b = nodes[pairs[k + 1]], length = pairLengths[k / 2]
        const along = (s: number) => Math.max(a.light * Math.exp(-s * length / lightReach), b.light * Math.exp(-(1 - s) * length / lightReach))
        const gradient = g.createLinearGradient(a.sx, a.sy, b.sx, b.sy)
        for (const s of LIGHT_STOPS) gradient.addColorStop(s, 'rgba(' + sparkRgb + ',' + (Math.max(0, (along(s) - LIGHT_FLOOR) / (1 - LIGHT_FLOOR)) * strength) + ')')
        g.strokeStyle = gradient; g.lineWidth = litEdges[m + 2]
        g.beginPath(); edgePath(g, a, b, edgeV[k >> 1], edgeDir[k >> 1]); g.stroke()
      }
      litEdges.length = 0
      if (!focused) story?.drawEdges(g, 'rgb(' + lineRgb + ')')
      for (let idx = 0; idx < nodes.length; idx++) { const n = nodes[idx]
        if (idx === focus.i) continue
        n.ph += reducedMotion ? 0 : (focus.i < 0 ? 0.006 : 0.002)
        const weight = n.storyWeight
        const baseRadius = Math.min(15, Math.max(0.5, ((n.signal ? (n.r + sig * 1.2) : n.r) + n.hover * 3) * n.sc))
        const r = baseRadius + (n.storyRadius - baseRadius) * weight
        const dim = 1 - focus.t * (1 - (0.10 + 0.90 * n.clar))
        const baseAlpha = Math.min(1, (n.da + n.hover * 0.6) * dim * nodeReveal) * n.fg * ambient
        const storyAlpha = focused ? 0.48 : 0.96
        g.globalAlpha = baseAlpha + (storyAlpha - baseAlpha) * weight
        const colour = weight > 0
          ? n.rgb.map((channel, index) => Math.round(channel + (n.storyRgb[index] - channel) * weight)).join(',')
          : n.rgb.join(',')
        g.beginPath(); g.arc(n.sx, n.sy, r, 0, 6.28); g.fillStyle = 'rgb(' + colour + ')'; g.fill()
        const lab = n.label
        // The label fades in and out with the node's depth, its hover and the foreground, rather than switching at a threshold.
        const labelAlpha = Math.max(smooth(0.32, 0.5, n.da), smooth(0.15, 0.3, n.hover)) * smooth(0.3, 0.75, n.fg) * ambient * (1 - weight)
        if (lab && labelAlpha > 0.01) { g.globalAlpha = labelAlpha; g.font = n.signal ? '600 12px IBM Plex Mono, monospace' : '500 11px IBM Plex Mono, monospace'; g.fillStyle = n.signal ? spark : labelColor; g.fillText(lab, n.sx + r + 4, n.sy + 3) }
        g.globalAlpha = 1
      }
      if (!focused) story?.drawArrivingPortfolio(g)
    }
    function orb(g: CanvasRenderingContext2D, aX: number, aY: number) {
      const tone = spark, rr = 6 + focus.t * 15
      g.globalAlpha = Math.min(1, focus.t) * 0.28; g.beginPath(); g.arc(aX, aY, rr * 3, 0, 6.28); g.fillStyle = tone; g.fill()
      g.globalAlpha = Math.min(1, focus.t * 1.8); g.beginPath(); g.arc(aX, aY, rr * 1.1, 0, 6.28); g.fillStyle = tone; g.fill()
      g.globalAlpha = Math.min(1, focus.t * 2); g.beginPath(); g.arc(aX, aY, rr * 0.66, 0, 6.28); g.fillStyle = themeColor('--surface'); g.fill()
      const lab = focus.ticker; if (lab) { g.globalAlpha = Math.min(1, focus.t); g.font = '500 14px IBM Plex Mono, monospace'; g.fillStyle = themeColor('--text'); g.fillText(lab, aX + rr + 14, aY + 5) }
      g.globalAlpha = 1
    }
    const applyCanvasFilter = () => {
      c.style.filter = 'none'
    }
    // The camera for the search view is worked out from the nodes themselves, so it
    // fits whatever the screen: project them as they would be seen from above, take
    // the span they cover (leaving out the few strays at each end) and scale and
    // shift that to fill SEARCH_FILL of the screen, centred: far enough back to see the
    // universe as one body with room round it, part of it behind the search box and its
    // suggestions. The result is eased, as the nodes sway and the universe turns.
    const SEARCH_TILT = 0.6
    const SEARCH_FILL = 0.6
    const searchFit = { zoom: 0, mx: 0, my: 0, ready: false }
    // Where the middle of the universe sits in the search view: the middle of the screen,
    // and a little higher the taller the screen is than it is wide. The suggestions fill
    // the top of the screen and, on a phone, the on-screen keyboard takes the bottom,
    // so what is left in view is a band in the upper half; the universe is already
    // there, rather than being moved or remade when the keyboard comes.
    const searchCentre = () => (0.5 - 0.1 * Math.min(1, Math.max(0, H / W - 1))) * H
    const fitXs: number[] = [], fitYs: number[] = []
    function fitSearchView(ay: number) {
      const cA = Math.cos(SEARCH_TILT), sA = Math.sin(SEARCH_TILT), cB = Math.cos(ay), sB = Math.sin(ay)
      fitXs.length = 0; fitYs.length = 0
      for (const n of nodes) {
        const X0 = n.bx * cB - n.bz * sB, Z0 = n.bx * sB + n.bz * cB
        const Y1 = n.by * cA - Z0 * sA, Z1 = n.by * sA + Z0 * cA
        const k = cam / (cam - Z1)
        fitXs.push(X0 * k); fitYs.push(Y1 * k)
      }
      fitXs.sort((a, b) => a - b); fitYs.sort((a, b) => a - b)
      const lo = Math.floor(fitXs.length * 0.04), hi = Math.ceil(fitXs.length * 0.96) - 1
      const zoom = Math.min(1.2, SEARCH_FILL * Math.min(W / Math.max(1, fitXs[hi] - fitXs[lo]), H / Math.max(1, fitYs[hi] - fitYs[lo])))
      const mx = (fitXs[lo] + fitXs[hi]) / 2, my = (fitYs[lo] + fitYs[hi]) / 2
      const ease = searchFit.ready && !reducedMotion ? 0.1 : 1
      searchFit.zoom += (zoom - searchFit.zoom) * ease; searchFit.mx += (mx - searchFit.mx) * ease; searchFit.my += (my - searchFit.my) * ease
      searchFit.ready = true
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
      if (focus.i < 0) {
        p += (targetP - p) * 0.07
        cameraProgress += (storyProgress - cameraProgress) * 0.12
        mx += (tmx - mx) * 0.03
        my += (tmy - my) * 0.03
      }
      searchMode += (searchModeTarget - searchMode) * 0.08
      const sig = smooth(0.15, 0.95, p)
      const breathe = reducedMotion ? 1 : 1 + 0.03 * Math.sin(tt * 0.10)
      const approach = smooth(0, closestAt, cameraProgress)
      const pullback = smooth(closestAt, 0.615, cameraProgress)
      const heroZoom = 1.2 + (closestZoom - 1.2) * approach + (endZoom - closestZoom) * pullback
      const ay = cameraProgress * turn + (reducedMotion ? 0 : tt * 0.016) + mx * 0.09
      const heroTilt = 0.16 + Math.sin(cameraProgress * Math.PI) * 0.10 + my * 0.065
      if (searchMode > 0.001) fitSearchView(ay)
      const zoom = breathe * (heroZoom + (searchFit.zoom - heroZoom) * searchMode)
      const ax = heroTilt + (SEARCH_TILT - heroTilt) * searchMode
      const panX = -zoom * searchFit.mx * searchMode, panY = (searchCentre() - cy - zoom * searchFit.my) * searchMode
      viewAx = ax; viewAy = ay; viewZoom = zoom
      const cA = Math.cos(ax), sA = Math.sin(ax), cB = Math.cos(ay), sB = Math.sin(ay)
      for (const n of nodes) {
        const bx = n.bx + Math.sin(tt * n.S1 + n.P1) * n.A1, by = n.by + Math.cos(tt * n.S2 + n.P2) * n.A2, bz = n.bz + Math.sin(tt * n.S3 + n.P3) * n.A3
        const X0 = bx * cB - bz * sB, Z0 = bx * sB + bz * cB, Y0 = by
        const Y1 = Y0 * cA - Z0 * sA, Z1 = Y0 * sA + Z0 * cA
        const sc = cam / (cam - Z1) * zoom
        const SX = cx + panX + X0 * sc, SY = cy + panY + Y1 * sc
        const dx = mpx - SX, dy = mpy - SY, dd = Math.sqrt(dx * dx + dy * dy), RAD = 80
        const h = (focus.i < 0 && dd < RAD) ? (1 - dd / RAD) * 0.26 : 0; n.hover += (h - n.hover) * 0.1
        n.sx = SX; n.sy = SY; n.sc = sc; n.da = 0.26 + 0.74 * ((Z1 + R) / (2 * R)); n.storyWeight = 0
      }
      if (focus.i >= 0 && nodes[focus.i]) { const fn = nodes[focus.i]; for (const n of nodes) { const ddx = n.bx - fn.bx, ddy = n.by - fn.by, ddz = n.bz - fn.bz; n.clar = 1 - smooth(R * 0.12, R * 0.95, Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz)) } } else { for (const n of nodes) n.clar = 1 }
      updateOcclusion(now)
      story?.apply(nodes, W, H)
      stageEl.style.opacity = String(Math.max(0, 1 - focus.t * 1.3))
      applyCanvasFilter()
      const selected = nodes[focus.i]
      if (!selected || focus.t < 0.68) {
        x.setTransform(DPR, 0, 0, DPR, 0, 0)
        x.clearRect(0, 0, W, H)
        drawScene(x, sig, false)
      }
      if (selected && focus.t >= 0.01) {
        const anchor = focusAnchor()
        const aX = selected.sx + (anchor.x - selected.sx) * focus.t
        const aY = selected.sy + (anchor.y - selected.sy) * focus.t
        const fs = 1 + focus.t * FOCUS_ZOOM
        fx.setTransform(DPR, 0, 0, DPR, 0, 0)
        fx.clearRect(0, 0, W, H)
        fx.save()
        fx.translate(aX, aY)
        fx.scale(fs, fs)
        fx.translate(-selected.sx, -selected.sy)
        drawScene(fx, sig, true)
        fx.restore()

        fx.strokeStyle = 'rgba(' + sparkRgb + ',' + (0.68 * focus.t) + ')'
        fx.lineWidth = 1.4
        fx.beginPath()
        for (let k = 0; k < pairs.length; k += 2) {
          const ia = pairs[k], ib = pairs[k + 1]
          if (ia !== focus.i && ib !== focus.i) continue
          const neighbour = nodes[ia === focus.i ? ib : ia]
          fx.moveTo(aX, aY)
          fx.lineTo(aX + (neighbour.sx - selected.sx) * fs, aY + (neighbour.sy - selected.sy) * fs)
        }
        fx.stroke()
        orb(fx, aX, aY)
        frontDrawn = true
      } else if (frontDrawn) {
        fx.setTransform(DPR, 0, 0, DPR, 0, 0)
        fx.clearRect(0, 0, W, H)
        frontDrawn = false
      }
      if (!reducedMotion) rafId = requestAnimationFrame(render)
    }

    const interactiveForeground = 'a,button,input,textarea,select,label,header,nav,footer,[contenteditable],[data-dock-search],[role="button"],[role="radio"]'
    const isForegroundControl = (target: EventTarget | null) => target instanceof Element && !!target.closest(interactiveForeground)
    const particleAt = (clientX: number, clientY: number, touch = false) => {
      const ambient = ambientOpacity()
      let best = -1
      let distance = Infinity
      nodes.forEach((node, i) => {
        const visibility = node.storyWeight * 0.96 + (1 - node.storyWeight) * node.da * node.fg * ambient
        if (visibility < 0.025 || node.sx < 0 || node.sx > W || node.sy < 0 || node.sy > window.innerHeight) return
        const radius = node.storyWeight ? node.storyRadius : Math.min(15, node.r * node.sc)
        const gap = Math.hypot(node.sx - clientX, node.sy - clientY)
        if (gap > Math.max(touch ? 22 : 12, radius + 5)) return
        const hit = gap - 2 * node.storyWeight
        if (hit >= distance) return
        best = i
        distance = hit
      })
      return best
    }

    const onMove = (event: MouseEvent) => {
      tmx = event.clientX / window.innerWidth - 0.5
      tmy = event.clientY / window.innerHeight - 0.5
      mpx = event.clientX
      mpy = event.clientY
    }
    const onOut = (event: MouseEvent) => {
      if (event.relatedTarget) return
      tmx = tmy = 0
      mpx = mpy = -1e4
    }
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
    c.style.pointerEvents = 'none'
    let fieldStrength = 0
    const updateField = (progress: number) => {
      const strength = Math.max(0, Math.min(1, progress))
      fieldStrength = strength
      c.style.opacity = String(1 - strength * 0.55 * (1 - (story?.presence ?? 0)))
      root.style.setProperty('--hc-field-progress', String(strength))
      $('hc-prog').style.opacity = String(1 - strength)
    }
    // Native reduced-motion flow has no pinned scene. Preserve the initial veil,
    // then settle the static field before the content reaches the viewport.
    const unsubscribeStaticScroll = reducedMotion
      ? runtime.subscribeScroll(() => updateField(
          window.scrollY / Math.max(1, root.offsetTop),
        ))
      : undefined

    const unregisterScrollScene = runtime.registerScene(({ gsap: runtimeGsap, lenis, ScrollTrigger }) => {
      // The original camera turn follows the first screens of scroll.
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

      const updateStory = (progress: number) => {
        storyProgress = homeStoryProgress(progress)
        story?.update(storyProgress)
        const presence = story?.presence ?? 0
        root.style.setProperty('--hc-story-presence', String(presence))
        c.style.opacity = String(1 - fieldStrength * 0.55 * (1 - presence))
      }
      let storyTrigger: ReturnType<typeof ScrollTrigger.create> | undefined
      let footerTrigger: ReturnType<typeof ScrollTrigger.create> | undefined
      const revealFocusedChapter = (event: FocusEvent) => {
        if (focus.i >= 0) return
        const progress = story?.focusProgress(event.target)
        if (progress == null || !storyTrigger) return
        lenis.scrollTo(storyTrigger.start + (storyTrigger.end - storyTrigger.start) * homeStoryScrollProgress(progress), { immediate: true })
        ScrollTrigger.update()
      }
      if (story && storyElement) {
        storyElement.setAttribute('data-field-story-live', '')
        storyTrigger = ScrollTrigger.create({
          trigger: storyElement,
          start: 'clamp(top bottom)',
          end: 'bottom bottom',
          onUpdate: ({ progress }) => updateStory(progress),
          onRefresh: ({ progress }) => updateStory(progress),
        })
        const updateFooter = ({ progress }: { progress: number }) => {
          footerReveal = smooth(0, 1, progress)
          story.syncDiagrams()
        }
        footerTrigger = ScrollTrigger.create({
          trigger: storyElement,
          start: 'bottom bottom',
          end: 'max',
          onUpdate: updateFooter,
          onRefresh: updateFooter,
        })
        storyElement.addEventListener('focusin', revealFocusedChapter)
        updateStory(storyTrigger.progress)
      }

      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
        hideTrigger.kill()
        storyTrigger?.kill()
        footerTrigger?.kill()
        cameraProgress = storyProgress = footerReveal = 0
        storyElement?.removeEventListener('focusin', revealFocusedChapter)
        story?.reset()
        root.style.removeProperty('--hc-story-presence')
        updateField(0)
      }
    })

    // focus / zoom-into-node
    const fL = $('hc-focusLayer') as HTMLDialogElement, fCard = $('hc-focusCard'), fDim = $('hc-focusDim')
    const focusConnections = $('hc-fcC')
    let focusReturn: HTMLElement | null = null
    let pressFocus: HTMLElement | null = null
    let focusAbort: AbortController | null = null
    let focusGeneration = 0
    let closingFocus = false
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
    // The company's strongest ties on the weekly atlas, strongest first.
    const readConnections = (ticker: string, payload: unknown) => {
      const panel = parseCompanyPanel(payload)
      if (!panel || panel.symbol !== ticker) return []
      return panel.neighbours.filter((neighbour) => neighbour.symbol !== ticker).slice(0, 3).map((neighbour) => neighbour.symbol)
    }
    const updateCard = () => {
      fL.style.opacity = focus.t > 0.001 ? '1' : '0'
      fDim.style.opacity = String(smooth(0.04, 0.67, focus.t))
      front.style.opacity = String(smooth(0.02, 0.42, focus.t))
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
      const n = nodes[idx]
      const ticker = story?.tickerFor(n) ?? n.label ?? TICKERS[idx % TICKERS.length]
      const generation = ++focusGeneration
      focusAbort?.abort()
      focusAbort = null
      focus.ticker = ticker
      $('hc-fcT').textContent = ticker
      $('hc-fcN').textContent = tickerName(ticker)
      renderConnections(neighborhoodCache.get(ticker) ?? [])
      ;($('hc-fcO') as HTMLAnchorElement).href = '/stocks/' + encodeURIComponent(ticker)
      const returnRect = pressFocus?.getBoundingClientRect()
      const returnChapter = pressFocus?.closest('[data-market-scene]')
      focusReturn = returnRect && returnRect.bottom > 0 && returnRect.top < window.innerHeight
        && (!story || !returnChapter || returnChapter.hasAttribute('data-story-active')) ? pressFocus : null
      focus.i = idx
      fL.showModal()
      releaseScrollLock ??= runtime.acquireLock()
      backBtn.focus({ preventScroll: true })
      if (reducedMotion) { focus.t = 1; updateCard(); render() }
      else gsap.to(focus, { t: 1, duration: 0.55, ease: 'power2.out', onUpdate: updateCard })
      if (neighborhoodCache.has(ticker)) return
      const controller = new AbortController()
      focusAbort = controller
      void fetch('/api/atlas/companies/' + encodeURIComponent(ticker), { signal: controller.signal })
        .then(async (response) => {
          const payload: unknown = response.ok ? await response.json() : null
          // Signed out the atlas sends a company's zone but never its ties, or refuses it outright.
          const signedOut = response.status === 401 || response.status === 403 || parseCompanyPanel(payload)?.access.tier === 'signedOut'
          if (signedOut) {
            if (generation === focusGeneration) {
              const container=$('hc-fcC')
              container.replaceChildren()
              const link=document.createElement('a')
              link.href='/sign-in'
              link.textContent='Sign in to explore relationships'
              container.append(link)
            }
            return null
          }
          return payload
        })
        .then((payload) => {
          if (!payload || controller.signal.aborted) return
          const connections = readConnections(ticker, payload)
          neighborhoodCache.set(ticker, connections)
          if (generation !== focusGeneration || focus.i !== idx || !fL.open || closingFocus) return
          renderConnections(connections)
        })
        .catch(() => undefined)
    }
    const closeFocus = () => {
      if (!fL.open || closingFocus) return
      closingFocus = true
      focusGeneration += 1
      focusAbort?.abort()
      focusAbort = null
      gsap.killTweensOf(focus)
      const finishClose = () => {
        focus.t = 0
        closingFocus = false
        fL.close()
        updateCard()
        releaseScrollLock?.()
        releaseScrollLock = null
        if (focusReturn?.isConnected) focusReturn.focus({ preventScroll: true })
        focusReturn = null
        focus.i = -1
        focus.ticker = ''
      }
      if (reducedMotion) { finishClose(); render() } else gsap.to(focus, { t: 0, duration: 0.28, ease: 'power2.in', onUpdate: updateCard, onComplete: finishClose })
    }
    const backBtn = $('hc-focusBack'); backBtn.addEventListener('click', closeFocus)
    fDim.addEventListener('click', closeFocus)
    const onCancel = (event: Event) => {
      event.preventDefault()
      closeFocus()
    }
    fL.addEventListener('cancel', onCancel)

    // Opening the focused node's full page hands this network to the ticker
    // page (TickerUniverse), which keeps the same world going and turns the
    // camera until the orb lands on the ticker's identity node. A modified
    // click (new tab, new window) stays an ordinary link.
    const openLink = $('hc-fcO') as HTMLAnchorElement
    // The network as it stands this frame, with `index` as the node the
    // ticker page will carry.
    const universeNow = (index: number, ticker?: string) => ({
      nodes: nodes.map((n, nodeIndex) => ({
        x: n.bx + Math.sin(tt * n.S1 + n.P1) * n.A1, y: n.by + Math.cos(tt * n.S2 + n.P2) * n.A2, z: n.bz + Math.sin(tt * n.S3 + n.P3) * n.A3,
        r: n.r, label: nodeIndex === index && ticker ? ticker : n.label, signal: n.signal, light: n.light, clar: n.clar,
      })),
      pairs: [...pairs], pairLengths: [...pairLengths], lightReach, R, cam, focus: index,
    })
    const onOpen = (event: MouseEvent) => {
      const fn = focus.i >= 0 ? nodes[focus.i] : null
      if (!fn || !focus.ticker || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      const fs = 1 + focus.t * FOCUS_ZOOM, anchor = focusAnchor()
      startFlight({
        ticker: focus.ticker,
        universe: universeNow(focus.i, focus.ticker),
        view: { ax: viewAx, ay: viewAy, zoom: viewZoom * fs, x: fn.sx + (anchor.x - fn.sx) * focus.t, y: fn.sy + (anchor.y - fn.sy) * focus.t },
        lineScale: fs,
        progress: p,
        // Same geometry as orb() at focus.t = 1.
        orb: { outer: 23.1, ring: 9.2, glow: 63, label: true },
        veil: 0.7,
        focusLinks: 1,
        createdAt: Date.now(),
      })
      routerRef.current.push(openLink.getAttribute('href') ?? '/stocks/' + encodeURIComponent(focus.ticker))
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
    // If a search field is focused when the press starts, the click is dismissing
    // it — don't also grab a particle.
    const searchSel = 'input,textarea,[data-dock-search],[data-header-search],[data-pill-search]'
    const onDown = () => {
      const ae = document.activeElement
      pressFocus = ae instanceof HTMLElement ? ae : null
      const dismissingDisclosure = Boolean(document.querySelector('[data-site-header-row][data-menu-open]'))
      dismissingSearch = dismissingDisclosure || !!(ae && ae.closest && ae.closest(searchSel))
    }
    window.addEventListener('pointerdown', onDown, true)
    const onClick = (event: MouseEvent) => {
      if (dismissingSearch) { dismissingSearch = false; return }
      if (fL.open || event.button !== 0 || event.defaultPrevented || isForegroundControl(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const index = particleAt(event.clientX, event.clientY, event instanceof PointerEvent && event.pointerType === 'touch')
      if (index >= 0) openFocus(index)
    }
    window.addEventListener('click', onClick, true)
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
      fL.removeEventListener('cancel', onCancel)
      window.removeEventListener('click', onClick, true)
      openLink.removeEventListener('click', onOpen); releaseUniverse()
      window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('meridian:search-focus', onSearchFocus)
      backBtn.removeEventListener('click', closeFocus); fDim.removeEventListener('click', closeFocus)
      window.removeEventListener('keydown', noteKey, true); window.removeEventListener('pointerdown', notePointer, true)
      focusAbort?.abort()
      gsap.killTweensOf(focus)
      if (fL.open) fL.close()
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

      <dialog id="hc-focusLayer" aria-labelledby="hc-fcT" aria-describedby="hc-fcN">
        <div id="hc-focusDim" />
        <canvas id="hc-focusFront" aria-hidden="true" />
        <div id="hc-focusCard">
          <button id="hc-focusBack" type="button" aria-label="Back to the network">
            <span className="hc-fc-backText" aria-hidden="true">← back</span>
            <svg className="hc-fc-backIcon" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <div className="hc-fc-ticker" id="hc-fcT" />
          <div className="hc-fc-name" id="hc-fcN" />
          <div className="hc-fc-connections" id="hc-fcC" />
          <a className="hc-fc-open" id="hc-fcO" href="#">Open full page →</a>
        </div>
      </dialog>
    </div>
  )
}
