'use client'

import { Hand, MousePointer2, ZoomIn } from 'lucide-react'
import type { RefObject } from 'react'
import Dialog from '@/components/ui/Dialog'
import type { AtlasLens } from '@/lib/atlas-model'
import styles from './AtlasHelp.module.css'

export default function AtlasHelp({ open, onClose, returnFocusRef, signedIn, pro, lens }: {
  open: boolean
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
  signedIn: boolean
  pro: boolean
  lens: AtlasLens
}) {
  return (
    <Dialog open={open} onClose={onClose} returnFocusRef={returnFocusRef} labelledBy="atlas-help-title" describedBy="atlas-help-intro" className={styles.dialog}>
      <section id="atlas-help" className={styles.help}>
        <h2 id="atlas-help-title">How to read the atlas</h2>
        <p id="atlas-help-intro" className={styles.intro}>A map of how company prices move together.</p>

        <div className={styles.overview}>
          <figure className={styles.illustration}>
            <svg viewBox="0 0 300 240" role="img" aria-label="Two nearby companies within one region and another company in a separate region. Larger circles represent larger companies.">
              <path d="M28 72Q56 32 111 51T165 113Q158 164 103 175T31 131Z" fill="var(--up)" fillOpacity=".12" stroke="var(--up)" strokeOpacity=".55" />
              <path d="M206 126Q229 92 264 117T277 180Q248 212 217 191T206 126Z" fill="var(--accent)" fillOpacity=".12" stroke="var(--accent)" strokeOpacity=".55" />
              <path d="M66 104L119 119" stroke="var(--up)" strokeWidth="1.5" />
              <circle cx="66" cy="104" r="10" fill="var(--up)" />
              <circle cx="119" cy="119" r="19" fill="var(--up)" />
              <circle cx="243" cy="155" r="14" fill="var(--accent)" />
              <path d="M66 79V68H119V89M243 179V205" fill="none" stroke="var(--text-muted)" strokeOpacity=".7" />
              <text x="93" y="27" textAnchor="middle" fill="var(--text)" fontSize="12">Similar price moves</text>
              <text x="233" y="229" textAnchor="middle" fill="var(--text)" fontSize="12">A different region</text>
            </svg>
            <figcaption>Illustration, not market data.</figcaption>
          </figure>
          <div className={styles.reading}>
            <div><h3>Start with a region</h3><p>Each coloured area groups companies that tend to move together.</p></div>
            <div><h3>Look at distance</h3><p>Nearby companies usually have more similar price moves. Bigger circles mean bigger companies by market value.</p></div>
            <div><h3>Select a company</h3><p>Open its details to explore its links and understand where it sits.</p></div>
          </div>
        </div>

        <p className={styles.context}>{lens === 'total' ? 'You are viewing total price moves, including the movement of the whole market.' : 'The default view removes the price move shared by the whole market, so the remaining relationships are easier to see.'}</p>

        <ul className={styles.gestures} aria-label="Map controls">
          <li><MousePointer2 size={17} aria-hidden="true" /><span><b>Select</b> to see details</span></li>
          <li><Hand size={17} aria-hidden="true" /><span><b>Drag</b> to move around</span></li>
          <li><ZoomIn size={17} aria-hidden="true" /><span><b>Scroll or pinch</b> to zoom</span></li>
        </ul>

        <details className={styles.more}>
          <summary>Understand the other symbols</summary>
          <dl>
            <div><dt>Empty circles</dt><dd>Companies with no strong links to others.</dd></div>
            <div><dt>Wells</dt><dd>Depressions in the grid. Deeper wells mean more companies in the region move with that company.</dd></div>
            <div><dt>Lines and bundles</dt><dd>Strong price links inside a region, or grouped links between regions. A count tells you how many links connect two regions.</dd></div>
            <div><dt>Region outlines</dt><dd>The outline holds 80% of a region&apos;s weight. Some companies can sit between regions.</dd></div>
            <div><dt>Themes</dt><dd>Companies held by thematic funds. A theme can cross regions; it does not mean its companies move together.</dd></div>
            <div><dt>Average correlation</dt><dd>How much companies move together this week, compared with the past year.</dd></div>
            <div><dt>History and movement</dt><dd>The time bar shows earlier positions. Movement arrows show companies changing regions over six months or a year.{pro ? '' : ' Available with Pro.'}</dd></div>
            <div><dt>Influence</dt><dd>A same-day relationship that repeats in both of the last two years: one group moves when another reports results. Enable it in Layers.{pro ? '' : ' Available with Pro.'}</dd></div>
          </dl>
        </details>
        {!signedIn ? <p className={styles.note}>Before sign-in, you see a sketch with the largest companies. A free account shows their real positions and links.</p> : null}
        <button type="button" className={styles.done} onClick={onClose}>Got it, explore the map</button>
      </section>
    </Dialog>
  )
}
