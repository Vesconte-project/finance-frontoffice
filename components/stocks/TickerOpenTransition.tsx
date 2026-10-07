'use client'

import { useEffect } from 'react'

/*
 * Receiving end of the homepage handoff: the focused orb morphs into the
 * identity node while this page opens as a circle from where the orb sat
 * (30% / 50% of the viewport, matching HeroConstellation). The homepage only
 * lets that one navigation animate; leaving a ticker page never does.
 */
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  @view-transition { navigation: auto; }
  [data-selected-ticker-anchor] { view-transition-name: ticker-node; }
  ::view-transition-group(ticker-node) {
    animation-duration: 640ms;
    animation-timing-function: cubic-bezier(0.3, 0.7, 0.1, 1);
  }
  ::view-transition-old(root),
  ::view-transition-new(root) { mix-blend-mode: normal; }
  ::view-transition-old(root) { animation: none; }
  ::view-transition-new(root) { animation: 720ms cubic-bezier(0.6, 0, 0.2, 1) both ticker-page-open; }
  @keyframes ticker-page-open {
    from { clip-path: circle(64px at 30% 50%); }
    to { clip-path: circle(150vmax at 30% 50%); }
  }
}
`

export default function TickerOpenTransition() {
  useEffect(() => {
    const skip = (event: PageSwapEvent) => event.viewTransition?.skipTransition()
    window.addEventListener('pageswap', skip)
    return () => window.removeEventListener('pageswap', skip)
  }, [])

  return <style href="ticker-open-transition" precedence="default">{CSS}</style>
}
