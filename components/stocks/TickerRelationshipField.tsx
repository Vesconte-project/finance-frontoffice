'use client'

import gsap from 'gsap'
import { use, useEffect, useMemo, useRef } from 'react'
import styles from './TickerRelationshipField.module.css'

export type TickerRelationshipFieldNode = {
  symbol: string
  strength: number | null
  confidence: number | null
}

type TickerRelationshipFieldProps = {
  ticker: string
  accentColor: string
  relationships: Promise<TickerRelationshipFieldNode[]>
}

type FieldNode = {
  bx: number
  by: number
  bz: number
  radius: number
  phaseX: number
  phaseY: number
  phaseZ: number
  speedX: number
  speedY: number
  speedZ: number
  travelX: number
  travelY: number
  travelZ: number
  strength: number
  confidence: number
  relationship: boolean
  sx: number
  sy: number
  scale: number
  depth: number
}

type ProjectedPoint = {
  x: number
  y: number
}

const RELATIONSHIP_POSITIONS = [
  { x: 0.63, y: 0.14, z: -0.2 },
  { x: 0.84, y: 0.28, z: 0.24 },
  { x: 0.72, y: 0.57, z: -0.04 },
  { x: 0.91, y: 0.76, z: 0.18 },
  { x: 0.51, y: 0.82, z: -0.28 },
  { x: 0.43, y: 0.43, z: 0.32 },
] as const

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let state = seed || 1
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeConfidence(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0.5
  return clamp(Math.abs(value) > 1 ? Math.abs(value) / 100 : Math.abs(value), 0, 1)
}

function fibonacciPoint(index: number, total: number): [number, number, number] {
  const y = 1 - (index / Math.max(1, total - 1)) * 2
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = index * 2.399963
  return [Math.cos(theta) * radius, y, Math.sin(theta) * radius]
}

function rotateFieldPoint(
  [x, y, z]: [number, number, number],
  yaw: number,
  pitch: number,
  roll: number,
): [number, number, number] {
  const yawX = x * Math.cos(yaw) - z * Math.sin(yaw)
  const yawZ = x * Math.sin(yaw) + z * Math.cos(yaw)
  const pitchY = y * Math.cos(pitch) - yawZ * Math.sin(pitch)
  const pitchZ = y * Math.sin(pitch) + yawZ * Math.cos(pitch)

  return [
    yawX * Math.cos(roll) - pitchY * Math.sin(roll),
    yawX * Math.sin(roll) + pitchY * Math.cos(roll),
    pitchZ,
  ]
}

function colorWithAlpha(color: string, alpha: number): string {
  const match = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!match) return color
  return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${alpha})`
}

function buildField(
  width: number,
  height: number,
  ticker: string,
  relationships: TickerRelationshipFieldNode[],
): { nodes: FieldNode[]; pairs: Array<[number, number]>; relationshipCount: number } {
  const rankedRelationships = [...relationships]
    .sort((left, right) => Math.abs(right.strength ?? 0) - Math.abs(left.strength ?? 0))
    .slice(0, width < 640 ? 4 : 6)
  const seedInput = `${ticker}:${rankedRelationships.map((item) => `${item.symbol}:${item.strength ?? ''}`).join(':')}`
  const random = seededRandom(hashString(seedInput))
  const motifRandom = seededRandom(hashString(`${ticker}:ambient-field`))
  const worldRadius = Math.max(width, height) * 0.5
  const ambientCount = width < 640 ? 24 : width < 1024 ? 38 : 58
  const nodes: FieldNode[] = []
  const motifPhase = motifRandom() * Math.PI * 2
  const motifFrequency = 1.25 + motifRandom() * 2.35
  const motifYaw = (motifRandom() - 0.5) * Math.PI * 2
  const motifPitch = (motifRandom() - 0.5) * 1.3
  const motifRoll = (motifRandom() - 0.5) * 1.05
  const motifStretchX = 0.72 + motifRandom() * 0.58
  const motifStretchY = 0.64 + motifRandom() * 0.5
  const motifStretchZ = 0.72 + motifRandom() * 0.54
  const motifBendX = (motifRandom() < 0.5 ? -1 : 1) * (0.08 + motifRandom() * 0.16)
  const motifBendY = (motifRandom() < 0.5 ? -1 : 1) * (0.06 + motifRandom() * 0.13)
  const motifBendZ = (motifRandom() < 0.5 ? -1 : 1) * (0.05 + motifRandom() * 0.1)

  rankedRelationships.forEach((relationship, index) => {
    const position = RELATIONSHIP_POSITIONS[index] ?? RELATIONSHIP_POSITIONS[0]
    const strength = clamp(Math.abs(relationship.strength ?? 0.42), 0.18, 1)
    const confidence = normalizeConfidence(relationship.confidence)
    nodes.push({
      bx: (position.x - 0.52) * width * 0.94,
      by: (position.y - 0.48) * height * 0.92,
      bz: position.z * worldRadius,
      radius: 2.8 + strength * 2.2,
      phaseX: random() * Math.PI * 2,
      phaseY: random() * Math.PI * 2,
      phaseZ: random() * Math.PI * 2,
      speedX: 0.18 + random() * 0.12,
      speedY: 0.15 + random() * 0.12,
      speedZ: 0.12 + random() * 0.1,
      travelX: 10 + random() * 14,
      travelY: 8 + random() * 12,
      travelZ: 7 + random() * 12,
      strength,
      confidence,
      relationship: true,
      sx: 0,
      sy: 0,
      scale: 1,
      depth: 1,
    })
  })

  for (let index = 0; index < ambientCount; index += 1) {
    const [rotatedX, rotatedY, rotatedZ] = rotateFieldPoint(
      fibonacciPoint(index + 1, ambientCount + 1),
      motifYaw,
      motifPitch,
      motifRoll,
    )
    const wave = (index / ambientCount) * Math.PI * 2 * motifFrequency + motifPhase
    const fieldX = rotatedX * motifStretchX + Math.sin(wave + rotatedY * 2.3) * motifBendX
    const fieldY = rotatedY * motifStretchY + Math.cos(wave * 0.73 + rotatedZ * 2.1) * motifBendY
    const fieldZ = rotatedZ * motifStretchZ + Math.sin(wave * 0.57 + rotatedX * 2.2) * motifBendZ
    const radius = worldRadius * (0.34 + random() * 0.72)
    nodes.push({
      bx: fieldX * radius + (random() - 0.5) * worldRadius * 0.14,
      by: fieldY * radius * 0.72 + (random() - 0.5) * worldRadius * 0.1,
      bz: fieldZ * radius + (random() - 0.5) * worldRadius * 0.08,
      radius: 0.9 + random() * 1.7,
      phaseX: random() * Math.PI * 2,
      phaseY: random() * Math.PI * 2,
      phaseZ: random() * Math.PI * 2,
      speedX: 0.08 + random() * 0.12,
      speedY: 0.08 + random() * 0.1,
      speedZ: 0.06 + random() * 0.09,
      travelX: 6 + random() * 14,
      travelY: 5 + random() * 12,
      travelZ: 5 + random() * 12,
      strength: 0,
      confidence: 0,
      relationship: false,
      sx: 0,
      sy: 0,
      scale: 1,
      depth: 1,
    })
  }

  const pairKeys = new Set<string>()
  const pairs: Array<[number, number]> = []
  nodes.forEach((node, index) => {
    const nearest = nodes
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance: candidateIndex === index
          ? Number.POSITIVE_INFINITY
          : Math.hypot(node.bx - candidate.bx, node.by - candidate.by, node.bz - candidate.bz),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, node.relationship ? 3 : random() > 0.62 ? 2 : 1)

    nearest.forEach(({ candidateIndex }) => {
      const start = Math.min(index, candidateIndex)
      const end = Math.max(index, candidateIndex)
      const key = `${start}:${end}`
      if (pairKeys.has(key)) return
      pairKeys.add(key)
      pairs.push([start, end])
    })
  })

  return { nodes, pairs, relationshipCount: rankedRelationships.length }
}

export function TickerRelationshipFieldFallback({
  accentColor,
}: Pick<TickerRelationshipFieldProps, 'accentColor'>) {
  return (
    <div
      className={styles.fallback}
      data-ticker-relationship-field="fallback"
      style={{ ['--relationship-accent' as never]: accentColor }}
      aria-hidden="true"
    />
  )
}

export default function TickerRelationshipField({
  ticker,
  accentColor,
  relationships: relationshipsPromise,
}: TickerRelationshipFieldProps) {
  const relationships = use(relationshipsPromise)
  const relationshipKey = useMemo(
    () => relationships.map((item) => `${item.symbol}:${item.strength ?? ''}:${item.confidence ?? ''}`).join('|'),
    [relationships],
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const anchorElement = root?.closest('[data-ticker-hero]')?.querySelector<HTMLElement>('[data-selected-ticker-anchor]')
    if (!root || !canvas || !context || !anchorElement) return

    const backgroundCanvas = document.createElement('canvas')
    const backgroundContext = backgroundCanvas.getContext('2d')
    if (!backgroundContext) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const focus = { progress: motionQuery.matches ? 1 : 0 }
    let focusTween: ReturnType<typeof gsap.to> | null = null
    let reduceMotion = motionQuery.matches
    let width = 0
    let height = 0
    let dpr = 1
    let worldRadius = 1
    let camera = 1
    let fieldNodes: FieldNode[] = []
    let pairs: Array<[number, number]> = []
    let relationshipCount = 0
    let anchor: ProjectedPoint = { x: 30, y: 44 }
    let frame = 0
    let visible = true
    let pageVisible = document.visibilityState === 'visible'
    let disposed = false

    const colors = () => {
      const computed = window.getComputedStyle(root)
      return {
        accent: computed.getPropertyValue('--relationship-accent').trim() || '#0b8178',
        line: computed.getPropertyValue('--relationship-line').trim() || '#142943',
        node: computed.getPropertyValue('--relationship-node').trim() || '#617789',
      }
    }

    const focusedPoint = (node: FieldNode): ProjectedPoint => {
      const scale = 1 + focus.progress * (width < 640 ? 0.18 : 0.34)
      return {
        x: anchor.x + (node.sx - anchor.x) * scale,
        y: anchor.y + (node.sy - anchor.y) * scale,
      }
    }

    const projectNodes = (time: number) => {
      const motionTime = reduceMotion ? 0 : time * 0.001
      const yaw = reduceMotion ? -0.08 : -0.08 + motionTime * 0.025
      const pitch = reduceMotion ? 0.08 : 0.08 + Math.sin(motionTime * 0.12) * 0.045
      const cosYaw = Math.cos(yaw)
      const sinYaw = Math.sin(yaw)
      const cosPitch = Math.cos(pitch)
      const sinPitch = Math.sin(pitch)
      const centerX = width * 0.53
      const centerY = height * 0.49

      fieldNodes.forEach((node) => {
        const bx = node.bx + Math.sin(motionTime * node.speedX + node.phaseX) * node.travelX
        const by = node.by + Math.cos(motionTime * node.speedY + node.phaseY) * node.travelY
        const bz = node.bz + Math.sin(motionTime * node.speedZ + node.phaseZ) * node.travelZ
        const rotatedX = bx * cosYaw - bz * sinYaw
        const rotatedZ = bx * sinYaw + bz * cosYaw
        const rotatedY = by * cosPitch - rotatedZ * sinPitch
        const depthZ = by * sinPitch + rotatedZ * cosPitch
        const perspective = camera / Math.max(camera * 0.34, camera - depthZ)

        node.sx = centerX + rotatedX * perspective
        node.sy = centerY + rotatedY * perspective
        node.scale = perspective
        node.depth = clamp(0.18 + 0.82 * ((depthZ + worldRadius) / (worldRadius * 2)), 0.12, 1)
      })
    }

    const drawBackground = (palette: ReturnType<typeof colors>) => {
      backgroundContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      backgroundContext.clearRect(0, 0, width, height)

      const atmosphere = backgroundContext.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, Math.max(width, height) * 0.82)
      atmosphere.addColorStop(0, colorWithAlpha(palette.accent, 0.055))
      atmosphere.addColorStop(0.45, colorWithAlpha(palette.node, 0.018))
      atmosphere.addColorStop(1, colorWithAlpha(palette.node, 0))
      backgroundContext.fillStyle = atmosphere
      backgroundContext.fillRect(0, 0, width, height)

      backgroundContext.lineWidth = 0.8
      pairs.forEach(([startIndex, endIndex]) => {
        const start = fieldNodes[startIndex]
        const end = fieldNodes[endIndex]
        if (!start || !end) return
        backgroundContext.globalAlpha = (0.028 + Math.min(start.depth, end.depth) * 0.075) * (1 - focus.progress * 0.32)
        backgroundContext.strokeStyle = palette.line
        backgroundContext.beginPath()
        backgroundContext.moveTo(start.sx, start.sy)
        backgroundContext.lineTo(end.sx, end.sy)
        backgroundContext.stroke()
      })

      fieldNodes.forEach((node) => {
        backgroundContext.globalAlpha = (node.relationship ? 0.18 : 0.085 + node.depth * 0.19) * (1 - focus.progress * 0.28)
        backgroundContext.fillStyle = palette.node
        backgroundContext.beginPath()
        backgroundContext.arc(node.sx, node.sy, clamp(node.radius * node.scale, 0.7, 5.5), 0, Math.PI * 2)
        backgroundContext.fill()
      })
      backgroundContext.globalAlpha = 1
    }

    const drawFocusedLayer = (palette: ReturnType<typeof colors>) => {
      const backgroundScale = 1 + focus.progress * (width < 640 ? 0.18 : 0.34)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.save()
      context.translate(anchor.x * dpr, anchor.y * dpr)
      context.scale(backgroundScale, backgroundScale)
      context.translate(-anchor.x * dpr, -anchor.y * dpr)
      context.filter = `blur(${(focus.progress * (width < 640 ? 2.8 : 4.2) * dpr).toFixed(2)}px)`
      context.globalAlpha = 0.9 - focus.progress * 0.18
      context.drawImage(backgroundCanvas, 0, 0)
      context.restore()

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const haloRadius = width < 640 ? 120 : 190
      const halo = context.createRadialGradient(anchor.x, anchor.y, 0, anchor.x, anchor.y, haloRadius)
      halo.addColorStop(0, colorWithAlpha(palette.accent, 0.15 * focus.progress))
      halo.addColorStop(0.32, colorWithAlpha(palette.accent, 0.045 * focus.progress))
      halo.addColorStop(1, colorWithAlpha(palette.accent, 0))
      context.fillStyle = halo
      context.fillRect(0, 0, width, height)

      const continuationPoints = relationshipCount > 0
        ? [
            { x: -width * 0.14, y: anchor.y + height * 0.12 },
            { x: anchor.x + width * 0.24, y: -height * 0.14 },
          ]
        : []

      context.save()
      context.filter = `blur(${((width < 640 ? 0.85 : 1.35) * dpr).toFixed(2)}px)`

      continuationPoints.forEach((point) => {
        const gradient = context.createLinearGradient(anchor.x, anchor.y, point.x, point.y)
        gradient.addColorStop(0, colorWithAlpha(palette.accent, 0.08 * focus.progress))
        gradient.addColorStop(0.55, colorWithAlpha(palette.accent, 0.025 * focus.progress))
        gradient.addColorStop(1, colorWithAlpha(palette.accent, 0))
        context.strokeStyle = gradient
        context.lineWidth = width < 640 ? 0.65 : 0.75
        context.beginPath()
        context.moveTo(anchor.x, anchor.y)
        context.lineTo(point.x, point.y)
        context.stroke()
      })

      for (let index = 0; index < relationshipCount; index += 1) {
        const node = fieldNodes[index]
        if (!node) continue
        const point = focusedPoint(node)
        const lineAlpha = (0.07 + node.strength * 0.12 + node.confidence * 0.04) * focus.progress
        const gradient = context.createLinearGradient(anchor.x, anchor.y, point.x, point.y)
        gradient.addColorStop(0, colorWithAlpha(palette.accent, lineAlpha * 0.78))
        gradient.addColorStop(0.5, colorWithAlpha(palette.accent, lineAlpha * 0.34))
        gradient.addColorStop(1, colorWithAlpha(palette.accent, lineAlpha * 0.06))
        context.strokeStyle = gradient
        context.lineWidth = width < 640 ? 0.8 : 0.9 + node.strength * 0.28
        context.beginPath()
        context.moveTo(anchor.x, anchor.y)
        context.lineTo(point.x, point.y)
        context.stroke()

        context.globalAlpha = clamp(0.14 + node.strength * 0.22, 0, 0.38) * focus.progress
        context.fillStyle = palette.node
        context.beginPath()
        context.arc(point.x, point.y, clamp(node.radius * node.scale, 1.8, 4.2), 0, Math.PI * 2)
        context.fill()
      }
      context.restore()

      context.save()
      context.filter = `blur(${((width < 640 ? 0.22 : 0.32) * dpr).toFixed(2)}px)`
      context.lineCap = 'round'

      const drawAnchorFocus = (point: ProjectedPoint, localAlpha: number, lineWidth: number) => {
        const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y)
        const focusRatio = Math.min(1, (width < 640 ? 34 : 52) / Math.max(1, distance))
        const focusPoint = {
          x: anchor.x + (point.x - anchor.x) * focusRatio,
          y: anchor.y + (point.y - anchor.y) * focusRatio,
        }
        const localGradient = context.createLinearGradient(anchor.x, anchor.y, focusPoint.x, focusPoint.y)
        localGradient.addColorStop(0, colorWithAlpha(palette.accent, localAlpha))
        localGradient.addColorStop(0.38, colorWithAlpha(palette.accent, localAlpha * 0.62))
        localGradient.addColorStop(1, colorWithAlpha(palette.accent, 0))
        context.strokeStyle = localGradient
        context.lineWidth = lineWidth
        context.beginPath()
        context.moveTo(anchor.x, anchor.y)
        context.lineTo(focusPoint.x, focusPoint.y)
        context.stroke()
      }

      continuationPoints.forEach((point) => {
        drawAnchorFocus(point, 0.16 * focus.progress, width < 640 ? 0.85 : 0.95)
      })

      for (let index = 0; index < relationshipCount; index += 1) {
        const node = fieldNodes[index]
        if (!node) continue
        const point = focusedPoint(node)
        const localAlpha = (0.09 + node.strength * 0.11 + node.confidence * 0.03) * focus.progress
        drawAnchorFocus(point, localAlpha, width < 640 ? 0.95 : 1.05 + node.strength * 0.22)
      }
      context.restore()
      context.globalAlpha = 1
    }

    const draw = (time = 0) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      projectNodes(time)
      const palette = colors()
      drawBackground(palette)
      drawFocusedLayer(palette)
    }

    const queue = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      root.dataset.motion = reduceMotion ? 'static' : 'ambient'
      if (!visible || !pageVisible) return
      if (reduceMotion) {
        draw(0)
        return
      }
      const render = (time: number) => {
        draw(time)
        frame = window.requestAnimationFrame(render)
      }
      frame = window.requestAnimationFrame(render)
    }

    const resize = () => {
      if (disposed) return
      const bounds = root.getBoundingClientRect()
      const anchorBounds = anchorElement.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      dpr = Math.min(2, window.devicePixelRatio || 1)
      worldRadius = Math.max(width, height) * 0.5
      camera = worldRadius * 2.15
      anchor = {
        x: anchorBounds.left - bounds.left + anchorBounds.width / 2,
        y: anchorBounds.top - bounds.top + anchorBounds.height / 2,
      }
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      backgroundCanvas.width = canvas.width
      backgroundCanvas.height = canvas.height
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const field = buildField(width, height, ticker, relationships)
      fieldNodes = field.nodes
      pairs = field.pairs
      relationshipCount = field.relationshipCount
      queue()
    }

    const onMotionChange = () => {
      reduceMotion = motionQuery.matches
      focusTween?.kill()
      focus.progress = 1
      queue()
    }
    const onVisibilityChange = () => {
      pageVisible = document.visibilityState === 'visible'
      queue()
    }
    const resizeObserver = new ResizeObserver(resize)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      queue()
    }, { rootMargin: '120px' })

    resizeObserver.observe(root)
    resizeObserver.observe(anchorElement)
    intersectionObserver.observe(root)
    motionQuery.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    resize()

    if (!reduceMotion) {
      focusTween = gsap.to(focus, {
        progress: 1,
        duration: 0.55,
        ease: 'power2.out',
      })
    }

    void document.fonts?.ready.then(() => {
      if (!disposed) resize()
    })

    return () => {
      disposed = true
      focusTween?.kill()
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      motionQuery.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [relationshipKey, relationships, ticker])

  return (
    <div
      ref={rootRef}
      className={styles.field}
      data-ticker-relationship-field="canvas"
      data-projection="focused-3d"
      data-anchor-source="selected-ticker-node"
      style={{ ['--relationship-accent' as never]: accentColor }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
