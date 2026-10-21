'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './AtlasExplorer.module.css'

/** What the map key explains beyond the base map: only the layers on screen. */
export type KeyExtras = { arrowsSince: string | null; paths: boolean; fidelity: boolean; influence: boolean; theme: boolean }

export default function AtlasMapKey({ signedIn, extras, onClose }: { signedIn: boolean; extras: KeyExtras; onClose: () => void }) {
  const icon = (body: ReactNode) => <svg viewBox="0 0 36 24" width="36" height="24" aria-hidden="true">{body}</svg>
  const accent = 'var(--accent)'
  const muted = 'var(--text-muted)'
  const items: Array<[ReactNode, string]> = [
    [icon(<path d="M5 13 C4 5 14 3 19 6 S33 6 31 14 S20 22 13 20 S6 18 5 13Z" fill={accent} fillOpacity="0.16" stroke={accent} strokeOpacity="0.55" />),
      signedIn ? 'Region: companies whose prices move together. The line holds 80% of its weight' : 'Region: where companies that move together sit. A free account shows its real outline'],
    [icon(<><circle cx="6" cy="14" r="2.5" fill={muted} /><circle cx="15" cy="13" r="4" fill={muted} /><circle cx="27" cy="12" r="6.5" fill={muted} /></>), 'Size: market value'],
  ]
  if (signedIn) {
    items.push(
      [icon(<circle cx="18" cy="12" r="6" fill="none" stroke={muted} strokeWidth="1.6" strokeDasharray="2.5 2" />), 'Hollow: no strong ties, it moves on its own'],
      [icon(<><ellipse cx="18" cy="13" rx="15" ry="7" fill="none" stroke={muted} strokeOpacity="0.35" /><ellipse cx="18" cy="13" rx="9.5" ry="4.5" fill="none" stroke={muted} strokeOpacity="0.6" /><circle cx="18" cy="13" r="3" fill="var(--text)" /></>), 'Well: how many companies move with it'],
      [icon(<><circle cx="5" cy="17" r="2.4" fill={muted} /><circle cx="17" cy="8" r="2.4" fill={muted} /><circle cx="31" cy="15" r="2.4" fill={muted} /><path d="M5 17 L17 8 L31 15" fill="none" stroke={muted} strokeWidth="1.1" /></>), 'Line: the strongest ties inside a region'],
      [icon(<path d="M3 4 C14 6 22 12 33 8 M3 11 C14 11 22 12 33 12 M3 19 C14 16 22 12 33 17" fill="none" stroke={accent} strokeWidth="1.1" strokeOpacity="0.8" />), 'Bundle: real ties between two regions. More strands, more ties'],
    )
  }
  items.push([icon(<><rect x="2" y="5" width="32" height="14" rx="7" fill="var(--surface)" stroke={muted} strokeOpacity="0.4" /><text x="18" y="15.5" fontSize="8.5" textAnchor="middle" fill={accent}>38 ties</text></>),
    signedIn ? 'Count: strong ties in a bundle, where it reaches the other region' : 'Count: strong ties between two regions'])
  if (extras.theme) items.push([icon(<><circle cx="12" cy="12" r="4" fill={accent} /><circle cx="12" cy="12" r="7" fill="none" stroke={accent} strokeWidth="1.6" /><circle cx="27" cy="12" r="3.5" fill={muted} fillOpacity="0.3" /></>), 'Theme: its companies in colour, the rest dimmed'])
  if (extras.arrowsSince) items.push([icon(<><path d="M4 18 Q18 4 30 12" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" /><path d="M33 14 L26 14 L30 8Z" fill={accent} /></>), `Arrow: companies that moved between regions since ${extras.arrowsSince} (width = how many)`])
  if (extras.paths) items.push([icon(<><circle cx="5" cy="17" r="2.6" fill={accent} /><path d="M5 17 L13 10 L22 13 L31 6" fill="none" stroke={accent} strokeWidth="1.4" strokeLinejoin="round" /></>), 'Path: where a company was, from a year ago to the date shown'])
  if (extras.fidelity) items.push([icon(<><circle cx="11" cy="12" r="4" fill={muted} /><circle cx="11" cy="12" r="6.5" fill="none" stroke="var(--up)" strokeWidth="2" /><circle cx="26" cy="12" r="4" fill={muted} /><circle cx="26" cy="12" r="6.5" fill="none" stroke="var(--down)" strokeWidth="2" /></>), 'Green: placed among its ties. Red: the map had to stretch it'])
  if (extras.influence) items.push([icon(<><path d="M3 16 Q18 2 31 12" fill="none" stroke="var(--down)" strokeWidth="2" strokeDasharray="5 4" /><path d="M34 14 L27 14 L31 8Z" fill="var(--down)" /></>), 'Influence: one group moves another the same day (red ↓, green ↑)'])
  return (
    <div id="atlas-key" className={styles.key} role="group" aria-label="Map key" data-lenis-prevent="">
      <div className={styles.keyHead}>
        <span className={styles.eyebrow}>Map key</span>
        <button type="button" className={styles.keyClose} onClick={onClose} aria-label="Close the map key"><X size={14} aria-hidden="true" /></button>
      </div>
      <ul>
        {items.map(([symbol, text]) => <li key={text}>{symbol}<span>{text}</span></li>)}
      </ul>
      <p className={styles.keyFoot}>Scroll or pinch to zoom · drag to move · select a region or company for details</p>
    </div>
  )
}
