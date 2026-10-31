import type { ReactNode } from 'react'

/** Every symbol drawn on the map, with the glyph the guide and the browse panel share. */
export type AtlasSymbol = 'regions' | 'size' | 'empty' | 'wells' | 'lines' | 'bundles' | 'count' | 'theme' | 'path' | 'ring' | 'influence'

const accent = 'var(--accent)'
const muted = 'var(--text-muted)'

const GLYPHS: Record<AtlasSymbol, ReactNode> = {
  regions: <path d="M5 13 C4 5 14 3 19 6 S33 6 31 14 S20 22 13 20 S6 18 5 13Z" fill={accent} fillOpacity="0.16" stroke={accent} strokeOpacity="0.55" />,
  size: <><circle cx="6" cy="14" r="2.5" fill={muted} /><circle cx="15" cy="13" r="4" fill={muted} /><circle cx="27" cy="12" r="6.5" fill={muted} /></>,
  empty: <circle cx="18" cy="12" r="6" fill="none" stroke={muted} strokeWidth="1.6" strokeDasharray="2.5 2" />,
  wells: <><ellipse cx="18" cy="13" rx="15" ry="7" fill="none" stroke={muted} strokeOpacity="0.35" /><ellipse cx="18" cy="13" rx="9.5" ry="4.5" fill="none" stroke={muted} strokeOpacity="0.6" /><circle cx="18" cy="13" r="3" fill="var(--text)" /></>,
  lines: <><circle cx="5" cy="17" r="2.4" fill={muted} /><circle cx="17" cy="8" r="2.4" fill={muted} /><circle cx="31" cy="15" r="2.4" fill={muted} /><path d="M5 17 L17 8 L31 15" fill="none" stroke={muted} strokeWidth="1.1" /></>,
  bundles: <path d="M3 4 C14 6 22 12 33 8 M3 11 C14 11 22 12 33 12 M3 19 C14 16 22 12 33 17" fill="none" stroke={accent} strokeWidth="1.1" strokeOpacity="0.8" />,
  count: <><rect x="2" y="5" width="32" height="14" rx="7" fill="var(--surface)" stroke={muted} strokeOpacity="0.4" /><text x="18" y="15.5" fontSize="8.5" textAnchor="middle" fill={accent}>38 ties</text></>,
  theme: <><circle cx="12" cy="12" r="4" fill={accent} /><circle cx="12" cy="12" r="7" fill="none" stroke={accent} strokeWidth="1.6" /><circle cx="27" cy="12" r="3.5" fill={muted} fillOpacity="0.3" /></>,
  path: <><path d="M5 17 L13 10 L22 13 L29 7" fill="none" stroke={accent} strokeWidth="1.4" strokeLinejoin="round" /><circle cx="30" cy="7" r="3.4" fill="none" stroke={accent} strokeWidth="1.4" /><circle cx="5" cy="17" r="2.6" fill={accent} /></>,
  ring: <><circle cx="11" cy="12" r="4" fill={muted} /><circle cx="11" cy="12" r="6.5" fill="none" stroke="var(--up)" strokeWidth="2" /><circle cx="26" cy="12" r="4" fill={muted} /><circle cx="26" cy="12" r="6.5" fill="none" stroke="var(--down)" strokeWidth="2" /></>,
  influence: <><path d="M3 16 Q18 2 31 12" fill="none" stroke="var(--down)" strokeWidth="2" strokeDasharray="5 4" /><path d="M34 14 L27 14 L31 8Z" fill="var(--down)" /></>,
}

/** Short names and one-line meanings, for the browse panel's key of the layers on screen. */
export const SYMBOL_TEXT: Record<AtlasSymbol, [string, string]> = {
  regions: ['Regions', 'similar price moves'],
  size: ['Size', 'company market value'],
  empty: ['Empty', 'no strong links'],
  wells: ['Wells', 'deeper = more links'],
  lines: ['Lines', 'links within regions'],
  bundles: ['Bundles', 'links across regions'],
  count: ['Count', 'number of links'],
  theme: ['ETF theme', 'highlighted companies'],
  path: ['Path', 'changed region since, ringed today'],
  ring: ['Ring', 'green near links, red far'],
  influence: ['Influence', 'green ↑, red ↓'],
}

export function SymbolGlyph({ symbol, width = 28, height = 20 }: { symbol: AtlasSymbol; width?: number; height?: number }) {
  return <svg viewBox="0 0 36 24" width={width} height={height} aria-hidden="true">{GLYPHS[symbol]}</svg>
}
