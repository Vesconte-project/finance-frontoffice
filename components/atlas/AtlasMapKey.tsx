'use client'

import { ChevronDown, ChevronUp, Network } from 'lucide-react'
import type { ReactNode } from 'react'
import { SYMBOL_TEXT, SymbolGlyph, type AtlasSymbol } from './atlas-symbols'
import styles from './AtlasExplorer.module.css'

/** What the key explains beyond the base map: only the layers on screen. */
export type KeyExtras = { paths: boolean; fidelity: boolean; influence: boolean; theme: boolean }

/**
 * The map's legend is the atlas itself: its regions in their colours, with the
 * links, groups and market behind tabs. The symbols are explained in "How to
 * read"; only the extra layers on screen get a key here.
 */
export default function AtlasMapKey({ extras, open, onOpen, summary, children }: {
  extras: KeyExtras
  open: boolean
  onOpen: (open: boolean) => void
  summary: string
  children: ReactNode
}) {
  const active: AtlasSymbol[] = []
  if (extras.theme) active.push('theme')
  if (extras.paths) active.push('path')
  if (extras.fidelity) active.push('ring')
  if (extras.influence) active.push('influence')
  return (
    <div id="atlas-key" className={styles.key} data-open={open ? 'true' : 'false'} data-lenis-prevent="" data-atlas-legend="">
      {/* Folded, a quiet line names it; open, only a chevron beside the tabs folds it again. */}
      <button type="button" className={styles.keyToggle} aria-expanded={open} aria-controls="atlas-browse" aria-label="Browse atlas" title={open ? 'Fold' : undefined} onClick={() => onOpen(!open)}>
        {open ? <ChevronDown size={15} aria-hidden="true" /> : (
          <>
            <Network size={14} aria-hidden="true" />
            <span className={styles.keyTitle}>Browse<span className={styles.keyWide}> atlas</span></span>
            <span className={styles.keySummary}>{summary}</span>
            <ChevronUp size={14} aria-hidden="true" />
          </>
        )}
      </button>
      <section id="atlas-browse" className={styles.keyBody} hidden={!open} aria-label="Browse the market">
        {children}
        {active.length ? (
          <ul id="atlas-legend" className={styles.keyExtras} aria-label="Layers on the map">
            {active.map((symbol) => (
              <li key={symbol}><SymbolGlyph symbol={symbol} width={24} height={16} /><span><b>{SYMBOL_TEXT[symbol][0]}</b> · {SYMBOL_TEXT[symbol][1]}</span></li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
