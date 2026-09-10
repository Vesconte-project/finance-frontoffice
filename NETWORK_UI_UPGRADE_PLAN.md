# Correlation Network — UI Perfection Upgrade (live physics + arcs + glow)

## Context
The correlation network is live and data-correct (global map at `/markets/network`, per-ticker
peer web on `/stocks/[ticker]`). This plan is a **visual/interaction overhaul** to reach a
polished, "alive" feel, inspired by two references the owner gave:
- **Twitch Atlas** aesthetic: edges are **curved arcs**, not straight lines (woven, far less
  visual noise in dense graphs); big labeled nodes; dark canvas; community colours.
- **A live physics graph** (X/Twitter video): grab a node and the rest **react in real time**
  with spring tension; drag far → it stretches like elastic and on release **re-settles into a
  new arrangement** (does NOT snap exactly back); **glow/dandelion** highlight on the focused
  node + its links.

Owner decisions (2026-06-22):
- **Live + elastic physics** (the X behaviour). Applies to **both** the global map AND the
  per-ticker peer web. The peer web's current orbit animation is **replaced** by real physics.
- Arcs always; **colour = correlation sign**, **width/opacity = |correlation|**.
- **Glow / cluster highlight on focus** (hover/drag lights the node + its edges, dims the rest).
- **Future scale matters**: thousands of tickers eventually. Use **LOD** — when zoomed out,
  render/label only the highest-market-cap nodes. "Prefer the bigger work today than tomorrow."

## Tech decision: `react-force-graph-2d` (canvas)
Chosen after weighing the arcs-vs-scale tension:
- WebGL (cosmograph/sigma) scales to millions and has the best glow, BUT draws straight GL
  lines — **curved arcs are expensive/awkward in WebGL**, and arcs are a hard requirement here.
- Custom SVG (current) can't do a smooth live sim + glow at scale (per-frame React reconcile).
- **Canvas 2D** does arcs (`quadraticCurveTo`) + glow (additive paint) + live d3-force trivially,
  and with **market-cap LOD culling** the *rendered* element count stays bounded (~1–2k max),
  so canvas handles a very large *total* universe. `react-force-graph-2d` bundles exactly what
  we need: live d3-force (drag + elastic), curved links, custom canvas paint (glow), zoom/pan,
  hover/click hit-testing.
- Upgrade path: if we ever exceed ~5k *simultaneously visible* nodes, revisit WebGL/cosmograph.
  LOD keeps that far off.

Add dependency: `react-force-graph-2d` (+ its peer deps). It is **client-only** (`'use client'`,
dynamic import with `ssr: false`).

## Backend / data
**No backend change.** Keep the `/network` contract and `lib/network.ts`
(`getMarketNetwork` / `getTickerNetwork` already pass `topK` / `minAbsCorrelation`). The renderer
consumes the same `NetworkGraph` shape.

## What to PRESERVE (already built — do not regress)
- The Zone/Field **colour-mode toggle** and the **sector highlight filter** on the global page.
- **Country hue-family palette** (`countryColor`) and `sectorLabel` / `countryDisplayName`.
- **Node size = market cap**; **negative-correlation cue**; **center marker** on the peer web.
- The loosened **peer-web params** (`topK` 10 / `minAbsCorrelation` 0.2 in `getTickerNetwork`).
- The **"Correlations" nav tab** and the `/markets/network` page shell (header, controls, legend).
- **Fit-to-view on load** (the new lib provides `zoomToFit`; use it instead of our custom
  `computeFitTransform`).

## What to REPLACE / remove
- `components/MarketCorrelationNetwork.tsx` — the static d3 layout, the (now removed) clamp, the
  custom `computeFitTransform`, and the manual pan/zoom/`transform` handlers → all superseded by
  the library. Rebuild this component as a thin wrapper around `react-force-graph-2d`.
- `components/CorrelationNetwork.tsx` — the static layout + **orbit animation** + manual SVG
  render → rebuild as a focused (pinned-center) instance of the same library wrapper.
- Goal: ONE shared canvas graph component, configured differently for global vs peer-web.

## Feature spec

### 1. Shared graph component
A single `<NetworkGraphCanvas>` wrapping `ForceGraph2D`, parameterised for the two surfaces.
Props: `graph`, `colorMode`, `sectorFilter`, `mode: 'global' | 'peer'`, `centerTicker?`.

### 2. Live elastic physics
- Run the sim live (do NOT pre-tick-and-stop). Tune for an elastic feel: relatively high
  `d3Force('link').strength`, moderate `charge`, and `d3VelocityDecay` ~0.2–0.3 (springy, not
  sluggish). Expose these as constants so the feel is easy to tune.
- **Drag**: `enableNodeDrag`. On drag, the lib fixes the node to the cursor (fx/fy) and neighbours
  follow via link tension. On **drag end, release** (set fx/fy = null) and reheat
  (`d3ReheatSimulation`) so the graph **re-equilibrates to a new minimum** — this is exactly the
  "stretch far and it doesn't return to the original spot" behaviour (emergent; no custom code).
- **Idle**: let it cool (`cooldownTicks`/alpha decay) so it stops computing when settled; it
  re-heats on interaction. Important for CPU at scale.
- Optional polish (only if cheap): a subtle ambient "breathing" so a settled graph isn't dead —
  e.g. keep a tiny `alphaTarget`. Keep it very subtle; the orbit feel we had is no longer needed.

### 3. Curved arcs
- `linkCurvature` ~0.2–0.3 for the woven arc look (consistent direction so they bow nicely).
- `linkColor` by **sign** (reuse the blue/positive, red/negative scheme). `linkWidth` and alpha
  scale with **|correlation|**; **MST** edges drawn heavier/solid as the backbone.

### 4. Glow + focus highlight
- Custom `linkCanvasObject` / `nodeCanvasObject` (or `nodeCanvasObjectMode`) to paint:
  - Node: filled circle sized by market cap, coloured by the active colour mode (country/sector),
    with a soft glow (canvas `shadowBlur` or a radial-gradient halo).
  - On **hover/drag focus**: the focused node + its incident edges brighten/glow (dandelion),
    everything else dims (lower alpha). Reuse the existing connected-set logic.
- Negative edges keep the red treatment; the peer-web center keeps its distinct marker.

### 5. Colour modes + sector filter (preserve)
- Zone mode: node colour = country hue families. Field mode: node colour = GICS sector.
- Sector highlight filter: clicking a sector spotlights those nodes (dims rest) — same UX as now,
  re-implemented in canvas paint.

### 6. LOD by market cap (scale)
- Use the current zoom level (`globalScale` in the paint callbacks, or `onZoom`) to **cull**:
  below a zoom threshold, skip drawing low-cap nodes and their labels (show only the largest N);
  reveal more detail as you zoom in. Labels: only top nodes or on hover, never all at once.
- This is the mechanism that lets canvas serve a huge universe — keep the drawn count bounded.

### 7. Peer-web specifics
- `mode='peer'`: **pin the center node** (fx/fy at canvas center) so it stays put while peers are
  elastic and draggable. Spokes-only (center-incident edges), as now. Same arcs/glow.
- Keep the center marker + `Correlation vs <ticker>` tooltip semantics.

### 8. SSR / accessibility
- Client-only (`dynamic(() => import(...), { ssr: false })`) with a skeleton/placeholder during
  load. Node click → navigate to `/stocks/<ticker>` (via `onNodeClick` + router). Keep the
  empty-state for tickers with no edges.

## Suggested starting values (tune live with the owner)
Put these in named constants so they're trivial to adjust. They are starting points, not final.

**Physics (the elastic feel):**
- `d3VelocityDecay` ≈ **0.28** (lower than the 0.4 default → springier, keeps momentum; don't go
  below ~0.2 or it gets jittery).
- `d3AlphaDecay` ≈ **0.02** (slightly slower settle so it feels alive while you interact).
- Link force `strength(edge)` ≈ **`0.06 + absCorrelation * 0.28`**, with **MST edges ≈ 0.45**
  (backbone holds; ordinary edges spring softly).
- Link force `distance(edge)` ≈ **`45 + (1 - absCorrelation) * 140`** (strong corr ⇒ closer;
  this is what makes correlation read as proximity).
- Charge `strength` ≈ **−90** for the global map; ≈ **−180** for the peer-web (fewer nodes, want
  more spread). Consider scaling charge down as node count grows.
- Add a `forceCollide` ≈ **`node.radius + 6`** so nodes don't overlap.
- On **drag end**: set the node's `fx/fy = null` and call `d3ReheatSimulation()` (so it
  re-settles into a new minimum — the "doesn't snap back" behaviour).
- `cooldownTime` ≈ **15000ms** (settles then stops; re-heats on interaction).

**Arcs:**
- `linkCurvature` ≈ **0.25** (clear arc without looking like a loop).
- `linkWidth(edge)` ≈ **`(inMst ? 2.4 : 1) + absCorrelation * 2`**; link alpha ≈
  **`0.12 + absCorrelation * 0.6`**. Colour by sign (existing blue/red).

**Glow / focus:**
- Node glow: canvas `shadowBlur` ≈ **10** normally, **≈ 22** for the focused node + its edges.
- On focus: focused cluster alpha **1.0**, everything else dimmed to ≈ **0.12**.

**LOD (market-cap culling by zoom):**
- Below `globalScale` ≈ **0.7**, draw only the top nodes by market cap (e.g. largest ~150) and
  hide labels except the very largest; reveal more as you zoom in. Always draw labels on hover.

## Execution boundaries (who does what)
- **You (site code agent):** implement entirely in `finance-frontoffice` (add the dep, rebuild the two
  components, wire into the existing page/controls). No DB/server/live-service access. Validate with
  `tsc`, `npm run build`, and a browser check on `/markets/network` and a `/stocks/<ticker>`.
- **Owner:** deploys the site (Vercel).
- **Planner (Claude):** can verify the `/network` API via the configured `BACKEND_BASE_URL` if needed, but
  this round is front-end only.

## Out of scope (this round)
- Dot-grid layout for isolated nodes (owner did not select it).
- WebGL/cosmograph migration (LOD keeps canvas viable; revisit only past ~5k visible).
- Any backend/feature-store/data changes.

## Suggested sequencing
1. Add dep + build the shared `<NetworkGraphCanvas>` with live physics + arcs (no glow yet).
2. Wire the global page to it (preserve toggle/filter/legend/controls); add `zoomToFit` on load.
3. Add glow + focus highlight + negative cue + sizing/colour modes.
4. Add LOD culling by market cap / zoom.
5. Rebuild the peer-web as `mode='peer'` (pinned center), remove the orbit code.
6. Polish the elastic feel (link strength / velocityDecay / curvature) and verify build + browser.
```
