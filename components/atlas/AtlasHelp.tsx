'use client'

import { Hand, MousePointer2, ZoomIn } from 'lucide-react'
import type { RefObject } from 'react'
import Dialog from '@/components/ui/Dialog'
import type { AtlasLens } from '@/lib/atlas-model'
import { SymbolGlyph, type AtlasSymbol } from './atlas-symbols'
import styles from './AtlasHelp.module.css'

type Entry = { symbol: AtlasSymbol; title: string; text: string; pro?: boolean }

/** What the base map draws. Signed out, only regions, size and counts are drawn. */
const BASE: Entry[] = [
  { symbol: 'regions', title: 'Regions', text: 'Companies whose prices tend to move together. The outline holds 80% of the region.' },
  { symbol: 'size', title: 'Circle size', text: 'Bigger circles are bigger companies by market value.' },
  { symbol: 'empty', title: 'Empty circles', text: 'Companies with no strong links to others.' },
  { symbol: 'wells', title: 'Wells', text: 'Dips in the grid: the deeper, the more of its region moves with it.' },
  { symbol: 'lines', title: 'Lines', text: 'Strong price links between companies in one region.' },
  { symbol: 'bundles', title: 'Bundles', text: 'Links between two regions, drawn as one stroke.' },
  { symbol: 'count', title: 'Count', text: 'How many strong links join two regions.' },
]
const SIGNED_OUT: ReadonlySet<AtlasSymbol> = new Set(['regions', 'size', 'count'])

/** What Layers, the ETF theme and the time bar add. */
const EXTRA: Entry[] = [
  { symbol: 'theme', title: 'ETF themes', text: 'Companies held by thematic ETFs. A theme can cross regions.' },
  { symbol: 'path', title: 'Movement', text: 'Drag the time bar back: companies that changed region since that week are marked, with the way they went.', pro: true },
  { symbol: 'ring', title: 'Fidelity ring', text: 'Green when a company sits near its strongest links, red when far.', pro: true },
  { symbol: 'influence', title: 'Influence', text: 'One group moves on the day another reports results, two years running.', pro: true },
]

function Symbols({ title, entries, pro }: { title: string; entries: Entry[]; pro: boolean }) {
  return (
    <section className={styles.group} aria-label={title}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <dl className={styles.symbols}>
        {entries.map((entry) => (
          <div key={entry.symbol} className={styles.symbol}>
            <span className={styles.glyph}><SymbolGlyph symbol={entry.symbol} width={30} height={20} /></span>
            <dt>{entry.title}{entry.pro && !pro ? <span className={styles.pro}>Pro</span> : null}</dt>
            <dd>{entry.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

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
      <section id="atlas-help" className={styles.help} data-signed-in={signedIn ? 'true' : 'false'}>
        <header className={styles.head}>
          <p className={styles.kicker}>Market Atlas · Guide</p>
          <h2 id="atlas-help-title">How to read the atlas</h2>
          <p id="atlas-help-intro" className={styles.intro}>A map of how company prices move together. Close means similar, far means different.</p>
        </header>

        <div className={styles.body}>
          <div className={styles.column}>
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
            <ol className={styles.steps}>
              <li><h3>Start with a region</h3><p>Each coloured area groups companies that tend to move together.</p></li>
              <li><h3>Look at distance</h3><p>Nearby companies usually have more similar price moves.</p></li>
              <li><h3>Select a company</h3><p>Its details open on the right, with its links and where it sits.</p></li>
            </ol>
            <p className={styles.context}>{lens === 'total' ? 'You are viewing total price moves, including the movement of the whole market.' : 'The default view removes the price move shared by the whole market, so the rest is easier to see.'}</p>
          </div>

          <div className={styles.column}><Symbols title="On the map" entries={signedIn ? BASE : BASE.filter((entry) => SIGNED_OUT.has(entry.symbol))} pro={pro} /></div>

          {signedIn ? (
            <div className={styles.column}>
              <Symbols title="When you turn on more" entries={EXTRA} pro={pro} />
              <ul className={styles.asides}>
                <li><b>Browse atlas</b>, bottom left, lists the regions as large as the map draws them, and the most connected companies: the deepest wells.</li>
                <li><b>Average correlation</b>, above the map, is how much companies move together this week against the past year.</li>
              </ul>
            </div>
          ) : null}
        </div>

        <footer className={styles.foot}>
          <ul className={styles.gestures} aria-label="Map controls">
            <li><MousePointer2 size={15} aria-hidden="true" /><span><b>Select</b> to see details</span></li>
            <li><Hand size={15} aria-hidden="true" /><span><b>Drag</b> to move around</span></li>
            <li><ZoomIn size={15} aria-hidden="true" /><span><b>Scroll or pinch</b> to zoom</span></li>
          </ul>
          {!signedIn ? <p className={styles.note}>Before sign-in, you see a sketch with the largest companies. A free account shows their real positions and links.</p> : null}
          <button type="button" className={styles.done} onClick={onClose}>Got it, explore the map</button>
        </footer>
      </section>
    </Dialog>
  )
}
