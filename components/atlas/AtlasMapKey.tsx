'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './AtlasExplorer.module.css'

/** What the map key explains beyond the base map: only the layers on screen. */
export type KeyExtras = { arrowsSince: string | null; paths: boolean; fidelity: boolean; influence: boolean; theme: boolean }

export default function AtlasMapKey({ signedIn, extras, open, onOpen }: { signedIn: boolean; extras: KeyExtras; open: boolean; onOpen: (open: boolean) => void }) {
  const icon = (body: ReactNode) => <svg viewBox="0 0 36 24" width="28" height="20" aria-hidden="true">{body}</svg>
  const accent = 'var(--accent)'
  const muted = 'var(--text-muted)'
  const items: Array<[ReactNode, string]> = [
    [icon(<path d="M5 13 C4 5 14 3 19 6 S33 6 31 14 S20 22 13 20 S6 18 5 13Z" fill={accent} fillOpacity="0.16" stroke={accent} strokeOpacity="0.55" />),
      'Regions: similar price moves'],
    [icon(<><circle cx="6" cy="14" r="2.5" fill={muted} /><circle cx="15" cy="13" r="4" fill={muted} /><circle cx="27" cy="12" r="6.5" fill={muted} /></>), 'Size: company market value'],
  ]
  if (signedIn) {
    items.push(
      [icon(<circle cx="18" cy="12" r="6" fill="none" stroke={muted} strokeWidth="1.6" strokeDasharray="2.5 2" />), 'Empty: no strong links'],
      [icon(<><ellipse cx="18" cy="13" rx="15" ry="7" fill="none" stroke={muted} strokeOpacity="0.35" /><ellipse cx="18" cy="13" rx="9.5" ry="4.5" fill="none" stroke={muted} strokeOpacity="0.6" /><circle cx="18" cy="13" r="3" fill="var(--text)" /></>), 'Wells: deeper = more links'],
      [icon(<><circle cx="5" cy="17" r="2.4" fill={muted} /><circle cx="17" cy="8" r="2.4" fill={muted} /><circle cx="31" cy="15" r="2.4" fill={muted} /><path d="M5 17 L17 8 L31 15" fill="none" stroke={muted} strokeWidth="1.1" /></>), 'Lines: links within regions'],
      [icon(<path d="M3 4 C14 6 22 12 33 8 M3 11 C14 11 22 12 33 12 M3 19 C14 16 22 12 33 17" fill="none" stroke={accent} strokeWidth="1.1" strokeOpacity="0.8" />), 'Bundles: links across regions'],
    )
  }
  items.push([icon(<><rect x="2" y="5" width="32" height="14" rx="7" fill="var(--surface)" stroke={muted} strokeOpacity="0.4" /><text x="18" y="15.5" fontSize="8.5" textAnchor="middle" fill={accent}>38 ties</text></>),
    'Count: number of links'])
  if (extras.theme) items.push([icon(<><circle cx="12" cy="12" r="4" fill={accent} /><circle cx="12" cy="12" r="7" fill="none" stroke={accent} strokeWidth="1.6" /><circle cx="27" cy="12" r="3.5" fill={muted} fillOpacity="0.3" /></>), 'Theme: highlighted companies'])
  if (extras.arrowsSince) items.push([icon(<><path d="M4 18 Q18 4 30 12" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" /><path d="M33 14 L26 14 L30 8Z" fill={accent} /></>), 'Movement: changed regions'])
  if (extras.paths) items.push([icon(<><circle cx="5" cy="17" r="2.6" fill={accent} /><path d="M5 17 L13 10 L22 13 L31 6" fill="none" stroke={accent} strokeWidth="1.4" strokeLinejoin="round" /></>), 'Path: earlier positions'])
  if (extras.fidelity) items.push([icon(<><circle cx="11" cy="12" r="4" fill={muted} /><circle cx="11" cy="12" r="6.5" fill="none" stroke="var(--up)" strokeWidth="2" /><circle cx="26" cy="12" r="4" fill={muted} /><circle cx="26" cy="12" r="6.5" fill="none" stroke="var(--down)" strokeWidth="2" /></>), 'Ring: green near links, red far'])
  if (extras.influence) items.push([icon(<><path d="M3 16 Q18 2 31 12" fill="none" stroke="var(--down)" strokeWidth="2" strokeDasharray="5 4" /><path d="M34 14 L27 14 L31 8Z" fill="var(--down)" /></>), 'Influence: green ↑, red ↓'])
  return (
    <div id="atlas-key" className={styles.key} role="group" aria-label="Map key" data-lenis-prevent="" data-atlas-legend="">
      <button type="button" className={styles.keyToggle} aria-expanded={open} aria-controls="atlas-legend" onClick={() => onOpen(!open)}>
        <span>Legend</span>{open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronUp size={13} aria-hidden="true" />}
      </button>
      <ul id="atlas-legend" hidden={!open}>
        {items.map(([symbol, text]) => {
          const separator = text.indexOf(':')
          return <li key={text}>{symbol}<span><b>{text.slice(0, separator)}</b> · {text.slice(separator + 2)}</span></li>
        })}
      </ul>
    </div>
  )
}
