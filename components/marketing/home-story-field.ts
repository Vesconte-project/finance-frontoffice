import { ATLAS_CLUSTERS, ATLAS_PORTFOLIOS, ATLAS_ROUTES, ATLAS_TECH_PORTFOLIO, ORBIT_CENTRE, ORBIT_COLOURS, ORBIT_NODES, atlasRouteControl } from './home-story-geometry'

type Point = { x: number; y: number }
type Rgb = readonly [number, number, number]
type Destination = Point & { radius: number; rgb: Rgb }

export type StoryFieldNode = {
  sx: number
  sy: number
  storyWeight: number
  storyRadius: number
  storyRgb: Rgb
}

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

function ease(start: number, end: number, progress: number) {
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

function envelope(progress: number, enter: number, show: number, leave: number, gone: number) {
  return ease(enter, show, progress) * (1 - ease(leave, gone, progress))
}

function rgb(hex: string): Rgb {
  const colour = Number.parseInt(hex.slice(1), 16)
  return [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255]
}

function mapPoint(matrix: DOMMatrix, point: Point): Point {
  return { x: matrix.e + matrix.a * point.x, y: matrix.f + matrix.d * point.y }
}

function driveNode(node: StoryFieldNode, destination: Destination, matrix: DOMMatrix, amount: number, turn: number) {
  const point = mapPoint(matrix, destination)
  const dx = point.x - node.sx, dy = point.y - node.sy
  const bend = amount * (1 - amount) * turn
  node.sx += amount * dx - bend * dy
  node.sy += amount * dy + bend * dx
  const radius = Math.max(1.5, destination.radius * matrix.a)
  node.storyRadius = node.storyWeight ? mix(node.storyRadius, radius, amount) : radius
  const from = node.storyRgb
  const to = destination.rgb
  node.storyRgb = node.storyWeight
    ? [mix(from[0], to[0], amount), mix(from[1], to[1], amount), mix(from[2], to[2], amount)]
    : to
  node.storyWeight = mix(node.storyWeight, 1, amount)
}

function takeNearest<T>(available: Set<T>, target: Point, locate: (candidate: T) => Point): T {
  let selected: T | undefined
  let best = Infinity
  for (const candidate of available) {
    const point = locate(candidate)
    const distance = (point.x - target.x) ** 2 + (point.y - target.y) ** 2
    if (distance >= best) continue
    best = distance
    selected = candidate
  }
  if (selected === undefined) throw new Error('The home field must have at least as many nodes as the story')
  available.delete(selected)
  return selected
}

const orbitPoints: Destination[] = ORBIT_NODES.map((point) => ({
  ...point, radius: 7.5, rgb: rgb(ORBIT_COLOURS[point.region]),
}))
const atlasPoints = ATLAS_CLUSTERS.flatMap((cluster) => cluster.dots)
const atlasEdges = ATLAS_CLUSTERS.flatMap((cluster) => cluster.edges)

const BRIEFING_SLIDE = { start: 0.235, end: 0.33 }

const ATLAS_SETTLED = 0.785
const ATLAS_HOLD_COMPRESSION = 0.35
const SCROLL_SPAN = ATLAS_SETTLED + (1 - ATLAS_SETTLED) * ATLAS_HOLD_COMPRESSION

export function homeStoryProgress(scrollProgress: number) {
  const offset = scrollProgress * SCROLL_SPAN
  return offset <= ATLAS_SETTLED ? offset : ATLAS_SETTLED + (offset - ATLAS_SETTLED) / ATLAS_HOLD_COMPRESSION
}

export function homeStoryScrollProgress(progress: number) {
  const offset = progress <= ATLAS_SETTLED
    ? progress
    : ATLAS_SETTLED + (progress - ATLAS_SETTLED) * ATLAS_HOLD_COMPRESSION
  return offset / SCROLL_SPAN
}

const CHAPTERS = {
  flow: { enter: 0.004, show: 0.029, hold: 0.22 },
  updates: { leave: 0.355, gone: 0.40, hold: 0.33 },
  relationships: { enter: 0.38, show: 0.48, leave: 0.565, gone: 0.67, hold: 0.52 },
  atlas: { enter: 0.625, show: ATLAS_SETTLED, hold: 0.85 },
}

type ChapterName = keyof typeof CHAPTERS

function chapterOpacity(progress: number, name: ChapterName) {
  const timing = CHAPTERS[name]
  const enter = 'enter' in timing ? ease(timing.enter, timing.show, progress) : 1
  const exit = 'leave' in timing ? 1 - ease(timing.leave, timing.gone, progress) : 1
  return enter * exit
}

export function createHomeStory(story: HTMLElement, accent: Rgb, ink: Rgb) {
  const chapters = [...story.querySelectorAll<HTMLElement>('[data-market-scene]')].map((element) => ({
    element, name: element.dataset.marketScene as ChapterName,
  }))
  const clips = [...story.querySelectorAll<SVGRectElement>('[data-flow-reveal]')].map((clip) => {
    const axis = clip.dataset.flowReveal === 'height' ? 'height' : 'width'
    return { clip, axis, length: Number(clip.getAttribute(axis)) }
  })
  const orbitSvg = story.querySelector<SVGSVGElement>('[data-story-orbit]')
  const atlasSvg = story.querySelector<SVGSVGElement>('[data-story-atlas]')
  const portfolio = atlasSvg?.closest<HTMLElement>('[data-home-portfolio]')
  const orbitDestinations = [{ ...ORBIT_CENTRE, radius: 15, rgb: accent }, ...orbitPoints]
  const atlasDestinations = atlasPoints.map((point) => ({ ...point, rgb: ink }))
  let orbitMatrix: DOMMatrix | null = null
  let atlasMatrix: DOMMatrix | null = null
  let orbitNodes: StoryFieldNode[] = []
  let hubOffset: Point = { x: 0, y: 0 }
  const atlasNodes = new Map<(typeof atlasPoints)[number], StoryFieldNode>()
  let orbitAmount = 0
  let atlasAmount = 0
  let orbitLinks = 0
  let atlasLinks = 0
  let portfolioReveal = 0
  let presence = 0
  let fieldQuiet = 0

  function update(progress: number) {
    const slide = ease(BRIEFING_SLIDE.start, BRIEFING_SLIDE.end, progress)
    presence = ease(0, 0.12, progress)
    fieldQuiet = Math.max(slide * chapterOpacity(progress, 'updates'), chapterOpacity(progress, 'atlas'))
    orbitAmount = envelope(progress, 0.375, 0.482, 0.77, 0.835)
    atlasAmount = ease(0.57, ATLAS_SETTLED, progress)
    portfolioReveal = ease(0.69, 0.757, progress)
    atlasSvg?.toggleAttribute('data-atlas-settled', progress >= ATLAS_SETTLED)
    orbitLinks = envelope(progress, 0.405, 0.478, 0.58, 0.66)
    atlasLinks = ease(0.675, 0.792, progress)
    story.style.setProperty('--story-progress', progress.toFixed(3))
    chapters.forEach(({ element: chapter, name }) => {
      const offset = name === 'flow' ? -slide : name === 'updates' ? 1 - slide : 0
      const opacity = Math.abs(offset) === 1 ? 0 : chapterOpacity(progress, name)
      chapter.style.setProperty('--chapter-opacity', String(opacity))
      if (name === 'flow' || name === 'updates') {
        chapter.style.setProperty('--chapter-y', `${offset * 100}%`)
      }
      chapter.toggleAttribute('data-story-active', opacity > 0.55 && Math.abs(offset) < 0.5)
    })
    const reveal = ease(0.009, 0.15, progress)
    for (const { clip, axis, length } of clips) clip.setAttribute(axis, String(length * reveal))
    syncDiagrams()
  }

  // The canvas shares the SVG positions even after the sticky viewport releases.
  function syncDiagrams() {
    if (orbitAmount > 0 || atlasAmount > 0) {
      orbitMatrix = orbitSvg?.getScreenCTM() ?? null
      atlasMatrix = atlasSvg?.getScreenCTM() ?? null
    }
  }

  function assign(nodes: StoryFieldNode[], width: number, height: number) {
    if (!orbitMatrix || !atlasMatrix || nodes.length < atlasPoints.length) return
    const orbit = orbitMatrix
    const atlas = atlasMatrix
    const atlasSlots = new Set(atlasPoints)
    const available = new Set(nodes)
    const locate = (node: StoryFieldNode) => ({ x: node.sx, y: node.sy })
    const centre = mapPoint(orbit, ORBIT_CENTRE)
    orbitNodes = orbitDestinations.map((destination, index) => {
      const point = mapPoint(orbit, destination)
      // The hub starts near its destination. The surrounding dots arrive from
      // farther away so the shape assembles around a stable centre.
      const target = index === 0 ? centre : {
        x: Math.max(width * 0.08, Math.min(width * 0.92, centre.x + (point.x - centre.x) * 2.35)),
        y: Math.max(height * 0.17, Math.min(height * 0.88, centre.y + (point.y - centre.y) * 1.75)),
      }
      const node = takeNearest(available, target, locate)
      if (index === 0) {
        const dx = node.sx - centre.x
        const dy = node.sy - centre.y
        const scale = Math.min(1, Math.min(width, height) * 0.075 / Math.max(1, Math.hypot(dx, dy)))
        hubOffset = { x: dx * scale, y: dy * scale }
      }
      const atlasSlot = takeNearest(atlasSlots, point, (slot) => mapPoint(atlas, slot))
      atlasNodes.set(atlasSlot, node)
      return node
    })
    for (const slot of atlasSlots) {
      atlasNodes.set(slot, takeNearest(available, mapPoint(atlas, slot), locate))
    }
  }

  function apply(nodes: StoryFieldNode[], width: number, height: number) {
    if (orbitAmount === 0 && atlasAmount === 0) return
    if (!orbitNodes.length) assign(nodes, width, height)
    if (orbitMatrix && orbitAmount > 0) {
      const matrix = orbitMatrix
      const hub = orbitNodes[0]
      if (hub) {
        const centre = mapPoint(matrix, ORBIT_CENTRE)
        // Continue from the chosen screen position while the camera turns behind it.
        hub.sx = centre.x + hubOffset.x
        hub.sy = centre.y + hubOffset.y
        driveNode(hub, orbitDestinations[0], matrix, orbitAmount * (2 - orbitAmount), 0.12)
      }
      for (let index = 1; index < orbitNodes.length; index++) {
        driveNode(orbitNodes[index], orbitDestinations[index], matrix, orbitAmount, 0.63)
      }
    }
    if (atlasMatrix && atlasAmount > 0) {
      const matrix = atlasMatrix
      for (let index = 0; index < atlasPoints.length; index++) {
        const node = atlasNodes.get(atlasPoints[index])
        if (node) driveNode(node, atlasDestinations[index], matrix, atlasAmount, -0.58)
      }
    }
  }

  function drawEdges(context: CanvasRenderingContext2D, colour: string) {
    const centre = orbitNodes[0]
    if (centre && orbitLinks > 0) {
      context.lineWidth = 1.1
      context.globalAlpha = orbitLinks * 0.72
      orbitNodes.slice(1).forEach((node, index) => {
        context.strokeStyle = ORBIT_COLOURS[ORBIT_NODES[index].region]
        context.beginPath()
        context.moveTo(centre.sx, centre.sy)
        context.lineTo(node.sx, node.sy)
        context.stroke()
      })
    }
    if (atlasLinks > 0) {
      context.strokeStyle = colour
      context.lineWidth = 0.9
      context.globalAlpha = atlasLinks * 0.28
      context.beginPath()
      for (const { from, to } of atlasEdges) {
        const a = atlasNodes.get(from), b = atlasNodes.get(to)
        if (!a || !b) continue
        context.moveTo(a.sx, a.sy)
        context.lineTo(b.sx, b.sy)
      }
      context.stroke()
      context.lineWidth = 1
      context.globalAlpha = atlasLinks * 0.32
      context.beginPath()
      for (const { from, to, bend } of ATLAS_ROUTES) {
        const a = atlasNodes.get(from), b = atlasNodes.get(to)
        if (!a || !b) continue
        const control = atlasRouteControl({ x: a.sx, y: a.sy }, { x: b.sx, y: b.sy }, bend)
        context.moveTo(a.sx, a.sy)
        context.quadraticCurveTo(control.x, control.y, b.sx, b.sy)
      }
      context.stroke()
    }
    context.globalAlpha = 1
  }

  function drawArrivingPortfolio(context: CanvasRenderingContext2D) {
    if (!atlasMatrix || portfolioReveal === 0 || atlasAmount === 1) return
    const spread = portfolio?.dataset.homePortfolio === 'spread'
    const colour = spread ? '#86a8df' : `rgb(${accent.join(',')})`
    const radius = Math.max(1, atlasMatrix.a * 3)
    const ring = Math.max(2.5, atlasMatrix.a * 9)
    context.fillStyle = colour
    context.strokeStyle = colour
    context.lineWidth = Math.max(0.8, atlasMatrix.a * 1.4)
    for (const point of spread ? ATLAS_PORTFOLIOS.spread : ATLAS_PORTFOLIOS.tech) {
      const node = atlasNodes.get(point)
      if (!node) continue
      context.globalAlpha = portfolioReveal * 0.85
      context.beginPath()
      context.arc(node.sx, node.sy, radius, 0, Math.PI * 2)
      context.fill()
      context.globalAlpha = portfolioReveal * 0.6
      context.beginPath()
      context.arc(node.sx, node.sy, ring, 0, Math.PI * 2)
      context.stroke()
    }
    context.globalAlpha = 1
  }

  return {
    update,
    syncDiagrams,
    apply,
    drawEdges,
    drawArrivingPortfolio,
    get presence() { return presence },
    get fieldQuiet() { return fieldQuiet },
    resetNodes() {
      orbitNodes = []
      atlasNodes.clear()
    },
    tickerFor(node: StoryFieldNode) {
      if (portfolioReveal > 0 && portfolio?.dataset.homePortfolio === 'tech') {
        return ATLAS_TECH_PORTFOLIO.find(({ point }) => atlasNodes.get(point) === node)?.ticker
      }
      if (orbitAmount > 0.95 && atlasAmount < 0.25 && orbitNodes[0] === node) return 'NVDA'
    },
    focusProgress(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return null
      const chapter = target.closest('[data-market-scene]')
      if (chapter?.hasAttribute('data-story-active')) return null
      const name = chapters.find(({ element }) => element === chapter)?.name
      return name ? CHAPTERS[name].hold : null
    },
    reset() {
      story.removeAttribute('data-field-story-live')
      atlasSvg?.removeAttribute('data-atlas-settled')
      story.style.removeProperty('--story-progress')
      chapters.forEach(({ element: chapter }) => {
        chapter.style.removeProperty('--chapter-opacity')
        chapter.style.removeProperty('--chapter-y')
        chapter.removeAttribute('data-story-active')
      })
      for (const { clip, axis, length } of clips) clip.setAttribute(axis, String(length))
    },
  }
}
