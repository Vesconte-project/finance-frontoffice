'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type SystemProfileBlobDimension = {
  label: 'Trend' | 'Momentum' | 'Risk' | 'Yield' | 'Stability'
  score: number
  hint?: string
}

type SystemProfileBlobProps = {
  dimensions: SystemProfileBlobDimension[]
  className?: string
  compact?: boolean
  mini?: boolean
  size?: number
  marketCap?: number | null
  marketCapLabel?: string | null
}

type Point = {
  x: number
  y: number
}

const NEUTRAL = 'var(--text)'
const POSITIVE = 'var(--up)'
const WARNING = 'var(--text-muted)'
const NEGATIVE = 'var(--down)'

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp01(amount)
}

function easeOutCubic(value: number): number {
  const x = clamp01(value)
  return 1 - (1 - x) ** 3
}

function mixColor(from: string, to: string, amount: number): string {
  return `color-mix(in srgb, ${from} ${Math.round((1 - clamp01(amount)) * 100)}%, ${to})`
}

function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(clamp01(alpha) * 100)}%, transparent)`
}

function smoothClosedPath(points: Point[], tension = 1): string {
  const count = points.length
  if (count < 3) return ''

  const safeTension = Math.max(0, Math.min(1.35, tension))
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 0; index < count; index += 1) {
    const p0 = points[(index - 1 + count) % count]
    const p1 = points[index]
    const p2 = points[(index + 1) % count]
    const p3 = points[(index + 2) % count]

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * safeTension
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * safeTension
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * safeTension
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * safeTension

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  return `${path} Z`
}

function smoothOpenPath(points: Point[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    path += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`
  }

  const last = points[points.length - 1]
  path += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  return path
}

function orbitNoise(angle: number, seed: number, time: number): number {
  return (
    Math.sin(angle * 1.9 + seed * 1.7 + time * 0.26) * 0.52 +
    Math.cos(angle * 4.7 - seed * 2.3 - time * 0.18) * 0.3 +
    Math.sin(angle * 7.2 + seed * 0.9 + time * 0.1) * 0.18
  )
}

function orbitPoint({
  angle,
  center,
  radiusX,
  radiusY,
  irregularity,
  pull,
  time,
  seed,
}: {
  angle: number
  center: number
  radiusX: number
  radiusY: number
  irregularity: number
  pull: number
  time: number
  seed: number
}): Point {
  const noise = orbitNoise(angle, seed, time)
  const drag = 1 - pull * (0.14 + 0.1 * (0.5 + 0.5 * Math.sin(angle * 2 - time * 0.55)))
  const scribbleX = Math.sin(angle * 8.4 + seed * 1.4 + time * 0.34) * irregularity * radiusX * 0.06
  const scribbleY = Math.cos(angle * 6.3 - seed * 1.08 - time * 0.29) * irregularity * radiusY * 0.075
  const rotatedAngle = angle + Math.sin(angle * 2.5 + seed * 0.6) * irregularity * 0.14

  return {
    x: center + Math.cos(rotatedAngle) * radiusX * (1 + noise * irregularity * 0.16) * drag + scribbleX,
    y: center + Math.sin(angle) * radiusY * (1 + noise * irregularity * 0.19) * drag + scribbleY,
  }
}

function buildOrbitPath({
  center,
  radiusX,
  radiusY,
  irregularity,
  pull,
  time,
  seed,
}: {
  center: number
  radiusX: number
  radiusY: number
  irregularity: number
  pull: number
  time: number
  seed: number
}): string {
  const points: Point[] = []
  const steps = 56

  for (let index = 0; index < steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps
    points.push(
      orbitPoint({
        angle,
        center,
        radiusX,
        radiusY,
        irregularity,
        pull,
        time,
        seed,
      })
    )
  }

  return smoothClosedPath(points, 0.84)
}

function normalizeMarketCap(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || !value || value <= 0) return null
  return clamp01((Math.log10(value) - 8.5) / 4.2)
}

function massDescriptor(value: number): string {
  if (value >= 0.8) return 'heavy core'
  if (value >= 0.58) return 'anchored body'
  if (value >= 0.36) return 'light body'
  return 'fragile body'
}

function movementCallout({
  riskHeat,
  cleanEnergy,
  instability,
}: {
  riskHeat: number
  cleanEnergy: number
  instability: number
}): string {
  if (instability >= 0.7) return 'orbit breaking'
  if (riskHeat >= 0.66) return 'hot drift'
  if (cleanEnergy >= 0.66) return 'clean drive'
  return 'held line'
}

export default function SystemProfileBlob({
  dimensions,
  className,
  compact = false,
  mini = false,
  size,
  marketCap = null,
  marketCapLabel = null,
}: SystemProfileBlobProps) {
  const [clock, setClock] = useState({ time: 0, intro: 0 })

  useEffect(() => {
    let frame = 0
    const started = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - started) / 1000
      setClock({
        time: elapsed,
        intro: easeOutCubic(Math.min(1, elapsed / 1.05)),
      })
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const ordered = useMemo(() => {
    const byLabel = new Map(dimensions.map((dimension) => [dimension.label, dimension]))
    const orderedLabels: SystemProfileBlobDimension['label'][] = [
      'Trend',
      'Momentum',
      'Risk',
      'Yield',
      'Stability',
    ]

    return orderedLabels.map((label) => ({
      label,
      score: clampScore(byLabel.get(label)?.score ?? 50),
    }))
  }, [dimensions])

  const scoreByLabel = new Map(ordered.map((dimension) => [dimension.label, dimension.score]))
  const trend = (scoreByLabel.get('Trend') ?? 50) / 100
  const momentum = (scoreByLabel.get('Momentum') ?? 50) / 100
  const riskControl = (scoreByLabel.get('Risk') ?? 50) / 100
  const yieldValue = (scoreByLabel.get('Yield') ?? 50) / 100
  const stability = (scoreByLabel.get('Stability') ?? 50) / 100
  const riskHeat = 1 - riskControl
  const capMass = normalizeMarketCap(marketCap)
  const mass = capMass ?? clamp01(0.44 + stability * 0.16 - riskHeat * 0.12)

  const instability = clamp01(riskHeat * 0.46 + (1 - stability) * 0.74 + (1 - mass) * 0.34)
  const heavyContainment = clamp01(mass * 0.66 + stability * 0.22)
  const microBurst = clamp01(instability * (1 - mass * 0.72))
  const cleanEnergy = clamp01(momentum * 0.44 + trend * 0.24 + stability * 0.32)

  const resolvedSize = size ?? (mini ? 80 : compact ? 264 : 420)
  const miniScale = mini ? resolvedSize / 80 : 1
  const center = resolvedSize / 2
  const maxRadius = mini ? 28 * miniScale : compact ? 92 : 154
  const orbitRadiusX = lerp(maxRadius * 0.34, maxRadius * 0.9, trend) * clock.intro
  const orbitRadiusY = orbitRadiusX * lerp(0.76, 0.96, 1 - yieldValue * 0.18) * lerp(1.04, 0.82, yieldValue)
  const coreRadius = lerp(
    mini ? 6.5 * miniScale : compact ? 16 : 20,
    mini ? 11.5 * miniScale : compact ? 32 : 45,
    mass
  )
  const pull = lerp(0.06, 0.34, clamp01(yieldValue * 0.78 + mass * 0.22))
  const irregularity = lerp(0.03, 0.56, clamp01(microBurst * 0.82 + instability * 0.18))
  const angularSpeed =
    lerp(0.54, 2.45, momentum) * lerp(1.08, 0.58, mass) * (mini ? 0.5 : 1)
  const orbitBrokenness = clamp01(instability * 0.82 - heavyContainment * 0.18 + riskHeat * 0.14)
  const trailStrength = clamp01(momentum * 0.44 + riskHeat * 0.28 + microBurst * 0.48)

  const coolGlow = mixColor(NEUTRAL, POSITIVE, cleanEnergy * 0.92)
  const hotGlow = mixColor(WARNING, NEGATIVE, riskHeat * 0.94)
  const orbitGlow = mixColor(coolGlow, hotGlow, riskHeat * 0.7)
  const particleGlow = mixColor(coolGlow, hotGlow, riskHeat * 0.88 + microBurst * 0.12)
  const coreGlow = mixColor(NEUTRAL, WARNING, riskHeat * 0.58 + mass * 0.16 + yieldValue * 0.16)

  const baseAngle =
    clock.time * angularSpeed +
    Math.sin(clock.time * (8 + microBurst * 16)) * microBurst * 0.18 +
    Math.cos(clock.time * (3.2 + momentum * 2)) * instability * 0.05

  const particleBase = orbitPoint({
    angle: baseAngle,
    center,
    radiusX: orbitRadiusX,
    radiusY: orbitRadiusY,
    irregularity: irregularity * (1 + microBurst * 0.45),
    pull,
    time: clock.time,
    seed: 0.82,
  })

  const jitterRadius = maxRadius * (microBurst * 0.042 + (1 - stability) * 0.014)
  const particle = {
    x: particleBase.x + Math.sin(clock.time * 34 + baseAngle * 2.1) * jitterRadius,
    y: particleBase.y + Math.cos(clock.time * 28 - baseAngle * 1.7) * jitterRadius * 0.9,
  }

  const orbitPaths = [0.2, 1.18, 2.14].map((seed, index) =>
    buildOrbitPath({
      center,
      radiusX: orbitRadiusX * (1 + index * 0.018),
      radiusY: orbitRadiusY * (1 - index * 0.014),
      irregularity: irregularity * (1 + index * 0.18),
      pull,
      time: clock.time,
      seed,
    })
  )

  const trailPointCount = mini ? 0 : compact ? 16 : 24
  const trailPoints = Array.from({ length: trailPointCount }, (_, index) => {
    const progress = index / trailPointCount
    const angle = baseAngle - progress * lerp(1.1, 2.9, trailStrength)
    const point = orbitPoint({
      angle,
      center,
      radiusX: orbitRadiusX,
      radiusY: orbitRadiusY,
      irregularity: irregularity * (1 + progress * 0.4),
      pull,
      time: clock.time - progress * 0.22,
      seed: 0.82,
    })

    const noise = maxRadius * microBurst * 0.022 * (1 - progress * 0.4)
    return {
      x: point.x + Math.sin(clock.time * 22 + index * 0.8) * noise,
      y: point.y + Math.cos(clock.time * 18 + index * 0.72) * noise,
      radius: lerp(compact ? 1.2 : 1.5, compact ? 6 : 8.5, 1 - progress),
      opacity: (1 - progress) * lerp(0.16, 0.78, trailStrength),
    }
  })
  const trailPath = smoothOpenPath(trailPoints.slice(0, compact ? 10 : 14))

  const sparkCount = compact || mini
    ? 0
    : Math.round(
        lerp(0, 12, clamp01(microBurst * 0.9 + riskHeat * 0.22 + orbitBrokenness * 0.28 - 0.26))
      )
  const sparks = Array.from({ length: sparkCount }, (_, index) => {
    const sparkAngle =
      baseAngle +
      index * ((Math.PI * 2) / Math.max(1, sparkCount)) +
      Math.sin(clock.time * 2.2 + index * 0.9) * 0.4
    const length = lerp(8, 24, clamp01(microBurst * 0.82 + momentum * 0.18)) * (0.68 + (index % 4) * 0.12)
    return {
      x1: particle.x + Math.cos(sparkAngle) * 4,
      y1: particle.y + Math.sin(sparkAngle) * 4,
      x2: particle.x + Math.cos(sparkAngle) * length,
      y2: particle.y + Math.sin(sparkAngle) * length,
      opacity: 0.16 + ((index + 1) / Math.max(1, sparkCount)) * 0.46,
    }
  })

  const particlePulse = 1 + Math.sin(clock.time * (6.8 + momentum * 5.2)) * (0.05 + trailStrength * 0.08)
  const particleCoreRadius =
    lerp(mini ? 5.2 * miniScale : compact ? 5.2 : 7, mini ? 7.6 * miniScale : compact ? 7.6 : 11.4, momentum) *
    lerp(0.88, 1.14, mass) *
    particlePulse
  const particleHaloRadius = particleCoreRadius * lerp(2.4, 4.8, clamp01(trailStrength * 0.72 + microBurst * 0.28))
  const particleShockRadius = particleCoreRadius * lerp(1.45, 2.3, clamp01(momentum * 0.5 + riskHeat * 0.24 + microBurst * 0.26))

  const massText = massDescriptor(mass)
  const actionText = movementCallout({ riskHeat, cleanEnergy, instability })
  const orbitDasharray =
    orbitBrokenness > 0.18
      ? `${lerp(compact ? 42 : 62, compact ? 7 : 9, orbitBrokenness).toFixed(1)} ${lerp(compact ? 8 : 10, compact ? 26 : 38, orbitBrokenness).toFixed(1)}`
      : undefined
  const fractureDasharray = `${lerp(compact ? 18 : 26, compact ? 5 : 6.5, orbitBrokenness).toFixed(1)} ${lerp(compact ? 10 : 16, compact ? 20 : 28, orbitBrokenness).toFixed(1)}`

  return (
    <div
      className={cn(
        'relative mx-auto aspect-square w-full overflow-hidden rounded-[28px] border border-[var(--line)]',
        mini ? 'rounded-[12px]' : compact ? 'max-w-[240px]' : undefined,
        className
      )}
      style={{
        width: `${resolvedSize}px`,
        maxWidth: '100%',
        background: 'var(--surface)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage: 'none',
        }}
      />
      {!compact && !mini ? (
        <div className="pointer-events-none absolute left-4 top-3 z-10 text-[12px] uppercase tracking-[0.32em] text-[var(--text)]">
          <span className="font-semibold text-[var(--text)]">lb/</span> signal orbit
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
        className="relative z-[1] h-full w-full"
        role="img"
        aria-label="Animated signal orbit showing trend, momentum, risk control, yield, stability, and mass."
      >
        <defs>
        </defs>

        <path
          d={`M ${resolvedSize * 0.1} ${resolvedSize * 0.2} Q ${resolvedSize * 0.18} ${resolvedSize * 0.15} ${resolvedSize * 0.26} ${resolvedSize * 0.22}`}
          fill="none"
          stroke={withAlpha(NEUTRAL, 0.18)}
          strokeWidth={compact ? 1.1 : 1.6}
          strokeLinecap="round"
        />
        <path
          d={`M ${resolvedSize * 0.78} ${resolvedSize * 0.82} Q ${resolvedSize * 0.88} ${resolvedSize * 0.76} ${resolvedSize * 0.92} ${resolvedSize * 0.86}`}
          fill="none"
          stroke={withAlpha(WARNING, 0.16)}
          strokeWidth={compact ? 1.1 : 1.6}
          strokeLinecap="round"
        />

        <circle
          cx={center}
          cy={center}
          r={coreRadius * lerp(2.9, 4.3, mass + riskHeat * 0.18)}
          fill={withAlpha(coreGlow, 0.12 + mass * 0.12 + riskHeat * 0.06)}

        />
        <circle
          cx={center}
          cy={center}
          r={coreRadius * (1.55 + yieldValue * 0.5)}
          fill="none"
          stroke={withAlpha(coreGlow, 0.4 + mass * 0.1)}
          strokeWidth={compact ? 1.1 : 1.6}
          strokeDasharray={compact ? '8 6' : '12 7'}
        />
        <circle cx={center} cy={center} r={coreRadius} fill="color-mix(in srgb, var(--text) 12%, transparent)" />
        <circle
          cx={center}
          cy={center}
          r={coreRadius + 5}
          fill="none"
          stroke={withAlpha(coreGlow, 0.72)}
          strokeWidth={compact ? 1.3 : 1.8}
          strokeDasharray={compact ? '10 7' : '14 9'}
        />

        {orbitPaths.map((path, index) => (
          <path
            key={`orbit-layer-${index}`}
            d={path}
            fill="none"
            stroke={withAlpha(orbitGlow, index === 0 ? 0.9 : index === 1 ? 0.42 : 0.24)}
            strokeWidth={compact ? (index === 0 ? 2.2 : 1.1) : index === 0 ? 3 : 1.35}
            strokeDasharray={index === 0 ? orbitDasharray : fractureDasharray}
            strokeDashoffset={index === 0 ? clock.time * angularSpeed * -14 : clock.time * (6 + index * 3)}
            strokeLinecap="round"
          />
        ))}

        {orbitBrokenness > 0.34 ? (
          <path
            d={orbitPaths[0] ?? ''}
            fill="none"
            stroke={withAlpha(hotGlow, 0.42)}
            strokeWidth={compact ? 1.3 : 1.9}
            strokeDasharray={compact ? '4 18' : '5 24'}
            strokeDashoffset={clock.time * 16}
            strokeLinecap="round"
          />
        ) : null}

        {trailPath ? (
          <>
            <path
              d={trailPath}
              fill="none"
              stroke={withAlpha(particleGlow, 0.28 + trailStrength * 0.32)}
              strokeWidth={compact ? 5 : 7.5}
              strokeLinecap="round"
              strokeLinejoin="round"

            />
            <path
              d={trailPath}
              fill="none"
              stroke={withAlpha(particleGlow, 0.62)}
              strokeWidth={compact ? 1.6 : 2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {trailPoints.map((point, index) => (
          <circle
            key={`trail-${index}`}
            cx={point.x}
            cy={point.y}
            r={point.radius}
            fill={withAlpha(particleGlow, point.opacity)}
          />
        ))}

        {sparks.map((spark, index) => (
          <line
            key={`spark-${index}`}
            x1={spark.x1}
            y1={spark.y1}
            x2={spark.x2}
            y2={spark.y2}
            stroke={withAlpha(hotGlow, spark.opacity)}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        ))}

        <circle
          cx={particle.x}
          cy={particle.y}
          r={particleHaloRadius}
          fill={withAlpha(particleGlow, 0.16 + trailStrength * 0.1)}

        />
        <circle
          cx={particle.x}
          cy={particle.y}
          r={particleShockRadius}
          fill="none"
          stroke={withAlpha(particleGlow, 0.38 + momentum * 0.18)}
          strokeWidth={compact ? 1.1 : 1.5}
          strokeDasharray={compact ? '5 7' : '7 10'}
        />
        <circle cx={particle.x} cy={particle.y} r={particleCoreRadius} fill="color-mix(in srgb, var(--text) 12%, transparent)" />
        <circle cx={particle.x} cy={particle.y} r={particleCoreRadius * 0.34} fill={withAlpha(NEUTRAL, 0.98)} />

        {!compact && !mini ? (
          <g
            fontFamily='"Bradley Hand", "Comic Sans MS", cursive'
            fill="var(--text)"
          >
            <text x={24} y={64} fontSize="18" fill="var(--text)">
              real signal
            </text>
            <path
              d={`M 30 70 Q 46 78 76 74`}
              fill="none"
              stroke={withAlpha(WARNING, 0.85)}
              strokeWidth={2}
              strokeLinecap="round"
            />

            <text x={resolvedSize - 132} y={82} fontSize="16" fill="var(--text)">
              {actionText}
            </text>
            <path
              d={`M ${resolvedSize - 140} 90 Q ${resolvedSize - 108} 102 ${particle.x.toFixed(1)} ${(particle.y - 8).toFixed(1)}`}
              fill="none"
              stroke={withAlpha(particleGlow, 0.54)}
              strokeWidth={1.6}
              strokeLinecap="round"
            />

            <text x={resolvedSize - 148} y={resolvedSize - 56} fontSize="16" fill="var(--text)">
              {massText}
            </text>
            {marketCapLabel ? (
              <text x={resolvedSize - 146} y={resolvedSize - 36} fontSize="12" fill="var(--text-muted)">
                {marketCapLabel}
              </text>
            ) : null}
            <path
              d={`M ${resolvedSize - 138} ${resolvedSize - 62} Q ${resolvedSize - 104} ${resolvedSize - 90} ${center + 8} ${center + 18}`}
              fill="none"
              stroke={withAlpha(coreGlow, 0.48)}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </g>
        ) : null}
      </svg>
    </div>
  )
}
