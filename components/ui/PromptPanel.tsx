import type { ReactNode } from 'react'
import styles from './PromptPanel.module.css'

type PromptPanelProps = {
  /** The ticker shown at the centre of the constellation. */
  ticker: string
  eyebrow: string
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
 * Decorative constellation in the homepage's language: the ticker as the
 * selected ocre node, unlabelled neighbours and thin edges. It implies no
 * relationship data — no neighbour is named.
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

function Constellation({ ticker }: { ticker: string }) {
  return (
    <svg className={styles.constellation} viewBox="0 0 400 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {DUST.map(([x, y], index) => (
        <circle key={`dust-${index}`} className={styles.dust} cx={x} cy={y} r={1} style={{ ['--i' as never]: index }} />
      ))}
      {NEIGHBOURS.map((node, index) => (
        <line
          key={`edge-${index}`}
          className={styles.edge}
          x1={CENTER.x}
          y1={CENTER.y}
          x2={node.x}
          y2={node.y}
          pathLength={1}
          style={{ ['--i' as never]: index }}
        />
      ))}
      {OUTER.map((node, index) => {
        const from = NEIGHBOURS[node.from]
        return (
          <line
            key={`outer-edge-${index}`}
            className={styles.edgeFaint}
            x1={from.x}
            y1={from.y}
            x2={node.x}
            y2={node.y}
            pathLength={1}
            style={{ ['--i' as never]: index + NEIGHBOURS.length }}
          />
        )
      })}
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
      <circle className={styles.pulse} cx={CENTER.x} cy={CENTER.y} r={9} />
      <circle className={styles.center} cx={CENTER.x} cy={CENTER.y} r={8} />
      <text className={styles.label} x={CENTER.x + 16} y={CENTER.y + 4}>{ticker}</text>
    </svg>
  )
}

/**
 * Content for an account or plan prompt inside `Dialog`: a constellation
 * header in the site's identity, then eyebrow, serif title, description,
 * numbered points and actions, revealed in sequence.
 */
export default function PromptPanel({
  ticker,
  eyebrow,
  title,
  titleId,
  description,
  descriptionId,
  points,
  note,
  actions,
}: PromptPanelProps) {
  return (
    <div className={styles.prompt}>
      <div className={styles.visual}>
        <Constellation ticker={ticker} />
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{eyebrow}</p>
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
