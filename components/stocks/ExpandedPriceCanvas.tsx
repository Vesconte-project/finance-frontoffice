'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type RefObject, type PointerEvent, type WheelEvent } from 'react'
import { candleDirection } from '@/lib/candles'
import { LONG_PRESS_MS } from '@/lib/chart-measure'
import { formatMoney } from '@/lib/currency'
import {
  fibonacciLevels,
  panView,
  priceTicks,
  timeAxisLabels,
  visibleExtent,
  zoomView,
  type ChartView,
} from '@/lib/expanded-chart'
import type { OhlcPoint } from '@/lib/ohlc-data'
import styles from './ExpandedChart.module.css'

export type ChartKind = 'candles' | 'line'
export type DrawingTool = 'fibonacci' | 'trend'
export type ChartAnchor = { index: number; price: number }
export type ChartDrawing = { tool: DrawingTool; first: ChartAnchor; second: ChartAnchor }
/** Two bar indices a reader measures between, in the order picked. */
export type ChartMeasure = { first: number; second: number }

type Palette = { up: string; down: string; accent: string; text: string; muted: string; line: string; surface: string; font: string }

type Geometry = {
  width: number
  height: number
  plotWidth: number
  axisWidth: number
  axisHeight: number
  priceTop: number
  priceBottom: number
  volumeTop: number
  volumeBottom: number
  mainBottom: number
  barWidth: number
  first: number
  last: number
  min: number
  max: number
  maxVolume: number
}

type Gesture =
  | { type: 'pending'; x: number; y: number; view: ChartView; mouse: boolean; timer: number | null }
  | { type: 'measure'; first: number }
  | { type: 'pan'; x: number; view: ChartView; mouse: boolean }
  | { type: 'pinch'; distance: number; view: ChartView; anchor: number }

type ExpandedPriceCanvasProps = {
  /** Receives the canvas element, so the dialog can focus it on open. */
  focusRef?: RefObject<HTMLCanvasElement | null>
  bars: readonly OhlcPoint[]
  currency: string
  kind: ChartKind
  showVolume: boolean
  /** Changes whenever the parent asks for a new view, such as a range button. */
  viewRequest: { view: ChartView; id: number }
  drawTool: DrawingTool | null
  drawings: readonly ChartDrawing[]
  pending: ChartAnchor | null
  onPick: (anchor: ChartAnchor) => void
  measure: ChartMeasure | null
  /** Called while a measurement is dragged (done=false) and when it is released. */
  onMeasure: (measure: ChartMeasure | null, done: boolean) => void
  /** Index of the bar under the reader's pointer or tap, or null for the latest bar. */
  onInspect: (index: number | null) => void
  onViewChange: (view: ChartView) => void
  /** Double tap or double click: return to the selected range. */
  onReset: () => void
  ariaLabel: string
  describedBy: string
}

const AXIS_HEIGHT = 24
const TAP_SLOP = 6
const DOUBLE_TAP_MS = 320

function readPalette(element: Element): Palette {
  const styles = getComputedStyle(element)
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    up: token('--up', '#3E7A55'),
    down: token('--down', '#A34A3C'),
    accent: token('--accent', '#A87A2A'),
    text: token('--text', '#15202E'),
    muted: token('--text-muted', '#3B4657'),
    line: token('--line', '#D9D2C4'),
    surface: token('--surface', '#FAF7F1'),
    // next/font renames the family, so take the resolved one from CSS.
    font: `11px ${styles.fontFamily || 'ui-monospace, monospace'}`,
  }
}

function crisp(value: number): number {
  return Math.round(value) + 0.5
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * The expanded chart's drawing surface: candles or a close line, volume, axes,
 * a reading crosshair and the reader's drawings, on one Canvas 2D context.
 * Pointer, wheel and keyboard input move and zoom the view; the bars
 * themselves are drawn exactly as the backend supplied them.
 */
export default function ExpandedPriceCanvas({
  focusRef,
  bars,
  currency,
  kind,
  showVolume,
  viewRequest,
  drawTool,
  drawings,
  pending,
  onPick,
  measure,
  onMeasure,
  onInspect,
  onViewChange,
  onReset,
  ariaLabel,
  describedBy,
}: ExpandedPriceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<ChartView>(viewRequest.view)
  const geometryRef = useRef<Geometry | null>(null)
  const crossRef = useRef<{ x: number; y: number } | null>(null)
  const frameRef = useRef(0)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const gestureRef = useRef<Gesture | null>(null)
  const lastTapRef = useRef(0)
  const inspectedRef = useRef<number | null>(null)
  const paletteRef = useRef<Palette | null>(null)

  // Latest props for the imperative draw and input handlers.
  const propsRef = useRef({ bars, currency, kind, showVolume, drawTool, drawings, pending, measure, onPick, onMeasure, onInspect, onViewChange, onReset })
  useLayoutEffect(() => {
    propsRef.current = { bars, currency, kind, showVolume, drawTool, drawings, pending, measure, onPick, onMeasure, onInspect, onViewChange, onReset }
  })

  const draw = useCallback(() => {
    frameRef.current = 0
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { bars: data, currency: code, kind: chartKind, showVolume: volumeOn, drawings: shapes, pending: pick, measure: span } = propsRef.current
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr))
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const width = rect.width
    const height = rect.height
    ctx.clearRect(0, 0, width, height)
    if (data.length === 0 || width < 40 || height < 60) return

    const palette = paletteRef.current ?? (paletteRef.current = readPalette(canvas))
    const view = viewRef.current
    const extent = visibleExtent(data, view.from, view.to, chartKind)
    if (!extent) return

    ctx.font = palette.font
    ctx.textBaseline = 'middle'
    const money = (value: number) => formatMoney(value, code)

    // Size the price axis to its widest label so long prices never clip.
    const provisionalTicks = priceTicks(extent.min, extent.max, 6)
    const axisWidth = Math.ceil(
      Math.max(56, ...provisionalTicks.map((tick) => ctx.measureText(money(tick)).width), ctx.measureText(money(data[data.length - 1].close)).width) + 16,
    )
    const plotWidth = width - axisWidth
    const mainBottom = height - AXIS_HEIGHT
    const volumeHeight = volumeOn ? Math.round(mainBottom * 0.18) : 0
    const geometry: Geometry = {
      width,
      height,
      plotWidth,
      axisWidth,
      axisHeight: AXIS_HEIGHT,
      priceTop: 10,
      priceBottom: mainBottom - volumeHeight - (volumeHeight ? 8 : 6),
      volumeTop: mainBottom - volumeHeight,
      volumeBottom: mainBottom,
      mainBottom,
      barWidth: plotWidth / (view.to - view.from),
      first: Math.max(0, Math.floor(view.from)),
      last: Math.min(data.length - 1, Math.ceil(view.to)),
      min: extent.min,
      max: extent.max,
      maxVolume: 1,
    }
    for (let i = geometry.first; i <= geometry.last; i += 1) {
      const volume = data[i].volume
      if (volume !== null && volume > geometry.maxVolume) geometry.maxVolume = volume
    }
    geometryRef.current = geometry

    const xOf = (index: number) => (index - view.from + 0.5) * geometry.barWidth
    const yOf = (price: number) =>
      geometry.priceTop + ((geometry.max - price) / (geometry.max - geometry.min)) * (geometry.priceBottom - geometry.priceTop)

    // Grid
    const ticks = priceTicks(geometry.min, geometry.max, Math.max(2, (geometry.priceBottom - geometry.priceTop) / 56))
    const labels = timeAxisLabels(data, view, plotWidth)
    ctx.strokeStyle = palette.line
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const tick of ticks) {
      const y = crisp(yOf(tick))
      ctx.moveTo(0, y)
      ctx.lineTo(plotWidth, y)
    }
    for (const label of labels) {
      const x = crisp(xOf(label.index))
      ctx.moveTo(x, 0)
      ctx.lineTo(x, mainBottom)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, plotWidth, mainBottom)
    ctx.clip()

    // Volume: only where the backend supplied a value, never a zero bar.
    if (volumeOn) {
      const barWidth = Math.max(1, geometry.barWidth * 0.7)
      const groups = { up: new Path2D(), down: new Path2D(), unknown: new Path2D() }
      for (let i = geometry.first; i <= geometry.last; i += 1) {
        const bar = data[i]
        if (bar.volume === null) continue
        const barHeight = (bar.volume / geometry.maxVolume) * (geometry.volumeBottom - geometry.volumeTop)
        groups[candleDirection(bar.open, bar.close)].rect(xOf(i) - barWidth / 2, geometry.volumeBottom - barHeight, barWidth, barHeight)
      }
      ctx.globalAlpha = 0.42
      for (const side of ['up', 'down', 'unknown'] as const) {
        ctx.fillStyle = side === 'unknown' ? palette.muted : palette[side]
        ctx.fill(groups[side])
      }
      ctx.globalAlpha = 1
    }

    // Measurement band between two days, behind the price.
    const spanFirst = span ? Math.max(0, Math.min(data.length - 1, Math.round(Math.min(span.first, span.second)))) : -1
    const spanLast = span ? Math.max(0, Math.min(data.length - 1, Math.round(Math.max(span.first, span.second)))) : -1
    if (span && spanLast > spanFirst) {
      const left = xOf(spanFirst)
      const right = xOf(spanLast)
      const falling = data[spanLast].close < data[spanFirst].close
      ctx.globalAlpha = 0.12
      ctx.fillStyle = falling ? palette.down : palette.up
      ctx.fillRect(left, 0, right - left, mainBottom)
      ctx.globalAlpha = 1
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = palette.muted
      ctx.beginPath()
      ctx.moveTo(crisp(left), 0)
      ctx.lineTo(crisp(left), mainBottom)
      ctx.moveTo(crisp(right), 0)
      ctx.lineTo(crisp(right), mainBottom)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Price
    if (chartKind === 'candles') {
      const bodyWidth = Math.max(1, Math.min(14, geometry.barWidth * 0.68))
      const paths = {
        up: { wick: new Path2D(), body: new Path2D() },
        down: { wick: new Path2D(), body: new Path2D() },
        unknown: { wick: new Path2D(), body: new Path2D() },
      }
      for (let i = geometry.first; i <= geometry.last; i += 1) {
        const bar = data[i]
        const x = xOf(i)
        const side = paths[candleDirection(bar.open, bar.close)]
        if (bar.high !== null && bar.low !== null) {
          side.wick.moveTo(crisp(x), yOf(bar.high))
          side.wick.lineTo(crisp(x), yOf(bar.low))
        }
        if (bar.open !== null) {
          const yOpen = yOf(bar.open)
          const yClose = yOf(bar.close)
          side.body.rect(x - bodyWidth / 2, Math.min(yOpen, yClose), bodyWidth, Math.max(1, Math.abs(yClose - yOpen)))
        } else {
          // No open from the backend: mark the close alone rather than invent a body.
          side.body.rect(x - bodyWidth / 2, yOf(bar.close) - 0.5, bodyWidth, 1)
        }
      }
      ctx.lineWidth = 1
      for (const [color, path] of [[palette.up, paths.up], [palette.down, paths.down], [palette.muted, paths.unknown]] as const) {
        ctx.strokeStyle = color
        ctx.stroke(path.wick)
        ctx.fillStyle = color
        ctx.fill(path.body)
      }
    } else {
      ctx.beginPath()
      for (let i = geometry.first; i <= geometry.last; i += 1) {
        const x = xOf(i)
        const y = yOf(data[i].close)
        if (i === geometry.first) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = palette.text
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.lineWidth = 1
    }

    // Latest close
    const latest = data[data.length - 1].close
    const latestY = crisp(yOf(latest))
    ctx.setLineDash([2, 3])
    ctx.strokeStyle = palette.accent
    ctx.beginPath()
    ctx.moveTo(0, latestY)
    ctx.lineTo(plotWidth, latestY)
    ctx.stroke()
    ctx.setLineDash([])

    // Reader's drawings
    for (const shape of shapes) {
      const x1 = xOf(shape.first.index)
      const x2 = xOf(shape.second.index)
      if (shape.tool === 'trend') {
        const y1 = yOf(shape.first.price)
        const y2 = yOf(shape.second.price)
        ctx.strokeStyle = palette.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.fillStyle = palette.accent
        for (const [x, y] of [[x1, y1], [x2, y2]]) {
          ctx.beginPath()
          ctx.arc(x, y, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
        continue
      }
      const left = Math.min(x1, x2)
      for (const level of fibonacciLevels(shape.first.price, shape.second.price)) {
        const y = crisp(yOf(level.price))
        const edge = level.ratio === 0 || level.ratio === 1
        ctx.strokeStyle = edge ? palette.text : palette.accent
        ctx.globalAlpha = edge || level.ratio === 0.5 || level.ratio === 0.618 ? 0.95 : 0.6
        ctx.setLineDash(edge ? [] : [4, 3])
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(plotWidth, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        const text = `${Number((level.ratio * 100).toFixed(1))}%  ${money(level.price)}`
        const textWidth = ctx.measureText(text).width
        ctx.fillStyle = palette.surface
        ctx.globalAlpha = 0.85
        ctx.fillRect(left + 2, y - 16, textWidth + 8, 14)
        ctx.globalAlpha = 1
        ctx.fillStyle = palette.text
        ctx.textAlign = 'left'
        ctx.fillText(text, left + 6, y - 9)
      }
    }
    if (span && spanLast > spanFirst) {
      ctx.fillStyle = palette.text
      ctx.strokeStyle = palette.surface
      ctx.lineWidth = 2
      for (const index of [spanFirst, spanLast]) {
        ctx.beginPath()
        ctx.arc(xOf(index), yOf(data[index].close), 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.lineWidth = 1
    }
    if (pick) {
      ctx.fillStyle = palette.accent
      ctx.beginPath()
      ctx.arc(xOf(pick.index), yOf(pick.price), 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Axes
    ctx.fillStyle = palette.surface
    ctx.fillRect(plotWidth, 0, axisWidth, height)
    ctx.fillRect(0, mainBottom, width, AXIS_HEIGHT)
    ctx.strokeStyle = palette.line
    ctx.beginPath()
    ctx.moveTo(crisp(plotWidth), 0)
    ctx.lineTo(crisp(plotWidth), mainBottom)
    ctx.lineTo(0, crisp(mainBottom))
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = palette.muted
    for (const tick of ticks) {
      const y = yOf(tick)
      // Skip labels the latest-price tag would cover.
      if (y > 8 && y < geometry.priceBottom - 4 && Math.abs(y - latestY) > 14) ctx.fillText(money(tick), plotWidth + 8, y)
    }
    ctx.textAlign = 'center'
    for (const label of labels) {
      ctx.fillStyle = label.year ? palette.text : palette.muted
      ctx.fillText(label.text, xOf(label.index), mainBottom + AXIS_HEIGHT / 2)
    }

    const axisTag = (y: number, text: string, background: string, foreground: string) => {
      const tagHeight = 18
      const top = Math.min(Math.max(y - tagHeight / 2, 0), mainBottom - tagHeight)
      ctx.fillStyle = background
      roundRect(ctx, plotWidth + 2, top, axisWidth - 4, tagHeight, 4)
      ctx.fill()
      ctx.fillStyle = foreground
      ctx.textAlign = 'left'
      ctx.fillText(text, plotWidth + 8, top + tagHeight / 2)
    }
    axisTag(latestY, money(latest), palette.accent, palette.surface)

    // Crosshair
    let inspected: number | null = null
    const cross = crossRef.current
    if (cross && cross.x < plotWidth) {
      const index = Math.round(view.from + cross.x / geometry.barWidth - 0.5)
      if (index >= 0 && index < data.length) {
        inspected = index
        const x = crisp(xOf(index))
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = palette.muted
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, mainBottom)
        const inPrice = cross.y >= geometry.priceTop && cross.y <= geometry.priceBottom
        if (inPrice) {
          ctx.moveTo(0, crisp(cross.y))
          ctx.lineTo(plotWidth, crisp(cross.y))
        }
        ctx.stroke()
        ctx.setLineDash([])
        if (inPrice) {
          const price = geometry.max - ((cross.y - geometry.priceTop) / (geometry.priceBottom - geometry.priceTop)) * (geometry.max - geometry.min)
          axisTag(cross.y, money(price), palette.text, palette.surface)
        }
        const dateText = DATE_FORMAT.format(new Date(`${data[index].date}T00:00:00Z`))
        const tagWidth = ctx.measureText(dateText).width + 12
        const tagLeft = Math.min(Math.max(x - tagWidth / 2, 0), plotWidth - tagWidth)
        ctx.fillStyle = palette.text
        roundRect(ctx, tagLeft, mainBottom + 3, tagWidth, AXIS_HEIGHT - 6, 4)
        ctx.fill()
        ctx.fillStyle = palette.surface
        ctx.textAlign = 'center'
        ctx.fillText(dateText, tagLeft + tagWidth / 2, mainBottom + AXIS_HEIGHT / 2)
      }
    }
    if (inspected !== inspectedRef.current) {
      inspectedRef.current = inspected
      propsRef.current.onInspect(inspected)
    }
  }, [])

  const schedule = useCallback(() => {
    if (!frameRef.current) frameRef.current = window.requestAnimationFrame(draw)
  }, [draw])

  const setView = useCallback((view: ChartView) => {
    viewRef.current = view
    propsRef.current.onViewChange(view)
    schedule()
  }, [schedule])

  useEffect(() => {
    viewRef.current = viewRequest.view
    crossRef.current = null
    propsRef.current.onViewChange(viewRequest.view)
    schedule()
  }, [viewRequest, schedule])

  useEffect(() => {
    schedule()
  }, [bars, currency, kind, showVolume, drawings, pending, measure, schedule])

  useEffect(() => {
    if (!drawTool) return
    crossRef.current = null
    schedule()
  }, [drawTool, schedule])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = new ResizeObserver(() => schedule())
    resize.observe(canvas)
    const refreshTheme = () => {
      paletteRef.current = null
      schedule()
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', refreshTheme)
    const themeObserver = new MutationObserver(refreshTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    void document.fonts?.ready.then(refreshTheme)
    return () => {
      resize.disconnect()
      media.removeEventListener('change', refreshTheme)
      themeObserver.disconnect()
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [schedule])

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handleTap = (point: { x: number; y: number }, mouse: boolean) => {
    const geometry = geometryRef.current
    if (!geometry || point.x >= geometry.plotWidth) return
    const { drawTool: tool, onPick: pick, onReset: reset } = propsRef.current
    const view = viewRef.current
    if (tool) {
      if (point.y < geometry.priceTop || point.y > geometry.priceBottom) return
      const index = view.from + point.x / geometry.barWidth - 0.5
      const price = geometry.max - ((point.y - geometry.priceTop) / (geometry.priceBottom - geometry.priceTop)) * (geometry.max - geometry.min)
      pick({ index, price })
      return
    }
    const now = performance.now()
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0
      crossRef.current = null
      reset()
      return
    }
    lastTapRef.current = now
    if (!mouse) {
      crossRef.current = point
      schedule()
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = localPoint(event)
    const pointers = pointersRef.current
    pointers.set(event.pointerId, point)
    if (pointers.size === 1) {
      const mouse = event.pointerType === 'mouse'
      const geometry = geometryRef.current
      const indexAt = (x: number) => (geometry ? Math.round(viewRef.current.from + x / geometry.barWidth - 0.5) : 0)
      const { drawTool: tool, onMeasure: measureTo } = propsRef.current
      if (mouse && event.shiftKey && !tool && geometry && point.x < geometry.plotWidth) {
        // Shift + drag measures; a plain drag keeps panning.
        const first = indexAt(point.x)
        gestureRef.current = { type: 'measure', first }
        crossRef.current = null
        measureTo({ first, second: first }, false)
        return
      }
      const pending: Gesture = { type: 'pending', x: point.x, y: point.y, view: viewRef.current, mouse, timer: null }
      if (!mouse && !tool) {
        // A touch held still starts a measurement.
        pending.timer = window.setTimeout(() => {
          if (gestureRef.current !== pending || pointersRef.current.size !== 1) return
          const first = indexAt(pending.x)
          gestureRef.current = { type: 'measure', first }
          crossRef.current = null
          propsRef.current.onMeasure({ first, second: first }, false)
        }, LONG_PRESS_MS)
      }
      gestureRef.current = pending
    } else if (pointers.size === 2 && geometryRef.current) {
      const previous = gestureRef.current
      if (previous?.type === 'pending' && previous.timer) window.clearTimeout(previous.timer)
      // A second finger turns a measurement into a pinch.
      if (previous?.type === 'measure') propsRef.current.onMeasure(null, true)
      const [a, b] = Array.from(pointers.values())
      const centre = (a.x + b.x) / 2
      const view = viewRef.current
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        view,
        anchor: view.from + centre / geometryRef.current.barWidth - 0.5,
      }
      crossRef.current = null
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event)
    const pointers = pointersRef.current
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point)
    const gesture = gestureRef.current
    const geometry = geometryRef.current
    if (!geometry) return
    const count = propsRef.current.bars.length
    if (!gesture) {
      if (event.pointerType === 'mouse' && !propsRef.current.drawTool) {
        crossRef.current = point
        schedule()
      }
      return
    }
    if (gesture.type === 'measure') {
      const second = Math.max(0, Math.min(count - 1, Math.round(viewRef.current.from + point.x / geometry.barWidth - 0.5)))
      propsRef.current.onMeasure({ first: gesture.first, second }, false)
      return
    }
    if (gesture.type === 'pinch' && pointers.size === 2) {
      const [a, b] = Array.from(pointers.values())
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const centre = (a.x + b.x) / 2
      setView(zoomView(gesture.view, gesture.distance / distance, gesture.anchor, centre / geometry.plotWidth, count))
      return
    }
    if (gesture.type === 'pending' && Math.hypot(point.x - gesture.x, point.y - gesture.y) > TAP_SLOP) {
      if (gesture.timer) window.clearTimeout(gesture.timer)
      gestureRef.current = { type: 'pan', x: gesture.x, view: gesture.view, mouse: gesture.mouse }
      if (!gesture.mouse) crossRef.current = null
      event.currentTarget.dataset.panning = 'true'
    }
    const current = gestureRef.current
    if (current?.type === 'pan') {
      setView(panView(current.view, -(point.x - current.x) / geometry.barWidth, count))
      if (current.mouse && !propsRef.current.drawTool) crossRef.current = point
    }
  }

  const endPointer = (event: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const pointers = pointersRef.current
    const gesture = gestureRef.current
    pointers.delete(event.pointerId)
    if (gesture?.type === 'pending' && gesture.timer) window.clearTimeout(gesture.timer)
    if (gesture?.type === 'measure') {
      const current = propsRef.current.measure
      propsRef.current.onMeasure(cancelled ? null : current, true)
    }
    if (!cancelled && gesture?.type === 'pending' && pointers.size === 0) handleTap(localPoint(event), gesture.mouse)
    if (pointers.size === 0) {
      gestureRef.current = null
      delete event.currentTarget.dataset.panning
    } else if (gesture?.type === 'pinch') {
      const [remaining] = Array.from(pointers.values())
      gestureRef.current = { type: 'pan', x: remaining.x, view: viewRef.current, mouse: false }
    }
  }

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    const geometry = geometryRef.current
    if (!geometry) return
    const count = propsRef.current.bars.length
    const point = localPoint(event)
    const view = viewRef.current
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
      setView(panView(view, (event.deltaX || event.deltaY) / geometry.barWidth, count))
    } else {
      const anchor = view.from + point.x / geometry.barWidth - 0.5
      setView(zoomView(view, Math.exp(event.deltaY * 0.0015), anchor, point.x / geometry.plotWidth, count))
    }
  }

  // React attaches wheel listeners as passive, so the page-scroll default is
  // prevented with a native non-passive listener.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stop = (event: globalThis.WheelEvent) => event.preventDefault()
    canvas.addEventListener('wheel', stop, { passive: false })
    return () => canvas.removeEventListener('wheel', stop)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Escape' && propsRef.current.measure) {
      // Escape clears the measurement first, before it closes the dialog.
      event.preventDefault()
      event.stopPropagation()
      propsRef.current.onMeasure(null, true)
      return
    }
    const view = viewRef.current
    const count = propsRef.current.bars.length
    const span = view.to - view.from
    const mid = (view.from + view.to) / 2
    const step = Math.max(1, span * 0.1)
    let next: ChartView | null = null
    if (event.key === '+' || event.key === '=') next = zoomView(view, 0.8, mid - 0.5, 0.5, count)
    else if (event.key === '-' || event.key === '_') next = zoomView(view, 1.25, mid - 0.5, 0.5, count)
    else if (event.key === 'ArrowLeft') next = panView(view, -step, count)
    else if (event.key === 'ArrowRight') next = panView(view, step, count)
    else if (event.key === 'Home') next = panView(view, -view.from - 2, count)
    else if (event.key === 'End') next = panView(view, count + 4 - view.to, count)
    if (!next) return
    event.preventDefault()
    setView(next)
  }

  return (
    <canvas
      ref={(element) => {
        canvasRef.current = element
        if (focusRef) focusRef.current = element
      }}
      className={styles.canvas}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      data-draw-tool={drawTool ?? undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endPointer(event, false)}
      onPointerCancel={(event) => endPointer(event, true)}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse' && !gestureRef.current) {
          crossRef.current = null
          schedule()
        }
      }}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    />
  )
}
