import type { ReactNode } from 'react'
import { Hourglass, Lock, Star, TriangleAlert, type LucideIcon } from 'lucide-react'
import styles from './PromptPanel.module.css'

/**
 * What kind of moment the prompt is. Each status has its own signature —
 * colour, glyph, constellation and motion — so it can be told apart at a
 * glance, before any copy is read; the status label carries the same meaning
 * in words, so colour is never the only cue.
 *
 * - `invite`: something an account unlocks. Ocre, a star, a connected field.
 * - `locked`: a paid feature. Ocre, a lock, a quieter field.
 * - `error`: something went wrong. The negative token, a warning glyph that
 *   shakes once, and a field whose edges are broken.
 * - `empty`: nothing is wrong, there is just nothing yet. Neutral grey, an
 *   hourglass, and nodes that are not yet connected.
 */
export type PromptStatus = 'invite' | 'locked' | 'error' | 'empty'

const GLYPHS: Record<PromptStatus, LucideIcon> = {
  invite: Star,
  locked: Lock,
  error: TriangleAlert,
  empty: Hourglass,
}

type PromptPanelProps = {
  /** The ticker named beside the status glyph. */
  ticker: string
  status: PromptStatus
  /** Short category in words, shown as the status label: "Error", "Pro feature"… */
  statusLabel: string
  title: ReactNode
  titleId: string
  description: ReactNode
  descriptionId: string
  /** Optional numbered points, in reading order. */
  points?: readonly ReactNode[]
  note?: ReactNode
  actions: ReactNode
}

/*
 * Decorative constellation in the homepage's language. It implies no
 * relationship data — no neighbour is named — and changes with the status.
 */
const CENTER = { x: 200, y: 64 }
const NEIGHBOURS = [
  { x: 92, y: 30, r: 3, accent: true },
  { x: 128, y: 100, r: 2.4, accent: false },
  { x: 286, y: 28, r: 3.2, accent: false },
  { x: 318, y: 94, r: 2.6, accent: true },
  { x: 246, y: 114, r: 2.2, accent: false },
] as const
const OUTER = [
  { x: 150, y: 16, r: 1.8, from: 0 },
  { x: 362, y: 54, r: 2, from: 2 },
  { x: 46, y: 82, r: 2, from: 1 },
  { x: 372, y: 118, r: 1.6, from: 3 },
] as const
const DUST = [
  [22, 24], [64, 120], [176, 120], [226, 12], [340, 18], [392, 86], [12, 58], [270, 70],
] as const

/** Edges begin outside the glyph so they read as leaving it. */
const GLYPH_CLEARANCE = 30

function edgeStart(to: { x: number; y: number }) {
  const dx = to.x - CENTER.x
  const dy = to.y - CENTER.y
  const length = Math.hypot(dx, dy)
  return { x: CENTER.x + (dx / length) * GLYPH_CLEARANCE, y: CENTER.y + (dy / length) * GLYPH_CLEARANCE }
}

/** Where an edge stops when the field is drawn broken. */
function edgeEnd(from: { x: number; y: number }, to: { x: number; y: number }, index: number, broken: boolean) {
  if (!broken || index % 2 === 0) return to
  const reach = 0.5
  return { x: from.x + (to.x - from.x) * reach, y: from.y + (to.y - from.y) * reach }
}

function Constellation({ status }: { status: PromptStatus }) {
  const broken = status === 'error'
  // Nothing connected yet: an empty prompt draws its nodes without edges.
  const connected = status !== 'empty'

  return (
    <svg className={styles.constellation} viewBox="0 0 400 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {DUST.map(([x, y], index) => (
        <circle key={`dust-${index}`} className={styles.dust} cx={x} cy={y} r={1} style={{ ['--i' as never]: index }} />
      ))}
      {connected
        ? NEIGHBOURS.map((node, index) => {
            const start = edgeStart(node)
            const end = edgeEnd(start, node, index, broken)
            return (
              <line
                key={`edge-${index}`}
                className={styles.edge}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                pathLength={1}
                style={{ ['--i' as never]: index }}
              />
            )
          })
        : null}
      {connected
        ? OUTER.map((node, index) => {
            const from = NEIGHBOURS[node.from]
            const end = edgeEnd(from, node, index + 1, broken)
            return (
              <line
                key={`outer-edge-${index}`}
                className={styles.edgeFaint}
                x1={from.x}
                y1={from.y}
                x2={end.x}
                y2={end.y}
                pathLength={1}
                style={{ ['--i' as never]: index + NEIGHBOURS.length }}
              />
            )
          })
        : null}
      {[...NEIGHBOURS, ...OUTER].map((node, index) => (
        <circle
          key={`node-${index}`}
          className={'accent' in node && node.accent ? styles.nodeAccent : styles.node}
          cx={node.x}
          cy={node.y}
          r={node.r}
          style={{ ['--i' as never]: index }}
        />
      ))}
    </svg>
  )
}

/**
 * Content for an account, plan or outcome prompt inside `Dialog`. The header
 * shows the status at a glance — glyph, colour and field — beside the ticker;
 * then the status label, a title that states the outcome, the reason, and the
 * next step.
 */
export default function PromptPanel({
  ticker,
  status,
  statusLabel,
  title,
  titleId,
  description,
  descriptionId,
  points,
  note,
  actions,
}: PromptPanelProps) {
  const Glyph = GLYPHS[status]

  return (
    <div className={styles.prompt} data-status={status}>
      <div className={styles.visual}>
        <Constellation status={status} />
        <span className={styles.badge} aria-hidden="true">
          <span className={styles.badgeRing} />
          <Glyph size={20} strokeWidth={1.75} className={styles.glyph} />
        </span>
        <span className={styles.ticker} aria-hidden="true">{ticker}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.status} data-prompt-status={status}>
          <span className={styles.statusDot} aria-hidden="true" />
          {statusLabel}
        </p>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <p id={descriptionId} className={styles.description}>{description}</p>
        {points && points.length > 0 ? (
          <ol className={styles.points}>
            {points.map((point, index) => (
              <li key={index} className={styles.point} style={{ ['--i' as never]: index }}>
                <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className={styles.actions} style={{ ['--i' as never]: points?.length ?? 0 }}>
          {actions}
        </div>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </div>
  )
}
