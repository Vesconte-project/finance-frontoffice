# Feature Status: 2.5D Market Atlas

- **Objective:** Transform the market relationship surface from a free-orbit 3D scene into a legible, product-like top-down 2.5D map: locked camera, instanced rendering that scales to hundreds of visible nodes, region-based color encoding, and a finished inspector/legend/search chrome. Reference mockup: warm-paper atlas with left teaching rail, center map, right inspector.
- **Owner / last updated:** Main — 2026-08-06
- **Current state:** implementation — Stage 1 ✅; Stage 2: 2a ✅ (instanced nodes), 2c ✅ (batched ticker web + camera fit + raised caps), 2d ✅ (field-glow sprites); Stage 3 ✅ (region color + legend); immersive full-screen dashboard ✅ (no footer, no scroll); camera free-zoom fix ✅; navigation/world-scale pass ✅ (drag-to-pan, tighter topology-true world); **single relevance-graded map ✅ (Option A — proximity-LOD overlay removed)**. Remaining: palette-alignment decision, camera focus-on-select (optional), visual density polish. backend **deployed**.

## Design direction (grounded)

The market as a **territory you read**, not a galaxy you fly through. Thesis = the mockup's own line: *position shows relationships, not geography*. Each visual channel carries exactly one true variable:

- **Position** = correlation topology (backend-precomputed x/y/z; never recomputed in browser except the documented fallback).
- **Color** = region of origin (US violet, Europe green, China red, LatAm amber, Asia teal, Other slate).
- **Cluster label** = sector story (Healthcare, Financials, …).
- **Halo** = systemic reach (`centrality`/`importance`).
- **Motion (pulse)** = volatility.

Identity: keep the warm-paper ground (`#f3efe6`) — a deliberate analytical-map choice, not the cream-editorial cliché. Spend boldness in one place: the selected node's radial systemic-reach bloom. Everything else stays quiet.

## Decisions approved

- **Light/warm-paper ground, not dark.** Owner: user, 2026-08-06. Evidence: reference mockup on `#f3efe6`.
- **Camera locked to 2.5D (pan + zoom, no free rotation).** Owner: user, 2026-08-06. Evidence: mockup is flat top-down; direction confirmed in thread.
- **Node color moves sector → region; sector retained as cluster label.** Owner: user, 2026-08-06. Evidence: mockup legend (US/Europe/China/LatAm/Asia) + sector cluster labels.
- **Incremental refactor of the existing scene, not a greenfield rebuild.** Owner: Main, per AGENTS.md blast-radius guidance.
- **No new dependencies** (achieve glow via additive sprites, not `@react-three/postprocessing`). Revisit only with a recorded cost note if proven necessary.

## Work

### Completed
- **Stage 1 — camera flatten (2026-08-06).** `MarketUniverseScene.tsx`: `OrbitControls` rotation disabled + `screenSpacePanning` (drag = pan, wheel/pinch = zoom, view locked face-on); removed now-irrelevant polar/azimuth clamps; Canvas FOV 48 → 34 and near-face-on landing offset for a flatter map read with a hint of 2.5D depth via fog. `MarketUniverse.tsx`: legend copy "drag to orbit" → "drag to pan" / "Scroll|Pinch to zoom" (truthful to the new interaction). Also unblocked `e2e/market-universe.spec.ts`: its two `heading: 'The world economy, connected.'` assertions referenced copy removed in the earlier redesign (pre-existing red); repointed to the live `region: 'Market relationship map'` — the rest of the spec already matched the surface.

### Pending (staged, each independently shippable + verified)
1. **Camera flatten** — lock rotation, flatter FOV, screen-space pan, truthful legend copy. Smallest diff, biggest UX shift.
2. **Instanced render swap** — split into sub-steps:
   - **2a ✅ (2026-08-06):** overview node bodies + halos as drei `<Instances>` (2 draw calls, per-instance color/scale, raycast events); backend overview caps raised (landmarks 36→256, backbone 48→400). Density lands once backend is **deployed** (dev/e2e hit the live backend).
   - **2b:** convert field + focus layers to instanced (still per-node `CompanyNode`).
   - **2c ✅ (2026-08-06):** overview edges (cross-field ticker-to-ticker web only) batched into ONE `<lineSegments>` (vertex-colored, faintness via color-blend toward paper); community-centroid arcs (`AtlasCommunityLinks`) removed per the agreed model — lines run company→company, never centroid→centroid. Camera now fits the whole economy on open (`cameraFrame` → centroid+radius, `CameraRig` fit-distance). Frontend overview caps raised: `capacity` 6→14/community, edge slice 54→260. Legibility tuning: vivid nodes (less paper-blend), 1.5× overview node size, stronger edge web.
   - **2b:** convert field + focus layers to instanced (still per-node `CompanyNode`).
   - **2d ✅ (2026-08-06):** soft radial-gradient territory glow sprite per field (`FieldGlow`, one camera-facing sprite/community, region-colored with a warm fallback since most communities have null `dominantRegion`). Subtle so far — fields are spread far apart and the data is US-heavy/pale; density polish is the remaining visual work.

### Navigation + world-scale pass (2026-08-06)
Response to interactive feedback (can't drag, opens too far/off-center, fields feel disconnected + distances wrong, zoom-reveal reads as an overlay):
- **Drag-to-pan fixed:** `OrbitControls` had `enableRotate={false}` but kept the default LEFT=rotate binding, so left-drag was a no-op (you had to right-drag to pan). Remapped `mouseButtons` (LEFT/RIGHT = PAN, MIDDLE = DOLLY) and `touches` (ONE = PAN, TWO = DOLLY_PAN); raised `panSpeed` 0.62→0.9.
- **Opens centered + closer:** `economyCommunityPositions` bounds shrunk (desktop width 32→16, height 20→10, depth 15→6; mobile 13.5→9 / 13→8 / 7.4→4), and Canvas FOV 34→42. The whole-economy fit no longer pushes the camera ~100 units back (verified via overview screenshot: economy fills the frame, centered).
- **Distances honor topology:** `dispersion` 0.38→0.12 (was overwriting 38% of each field's true correlation position with a random circle) and `spacing` 3.65→0.6 (fields were forced ≥5.5 units apart regardless of correlation). Fields now pack nearly tangent so related economies sit close and the map reads as one connected territory.
- **Denser overview, less pop-in:** per-field `capacity` 14→20 (desktop) / 6→8 (mobile) so members are already present (faded by relevance) instead of appearing only on zoom; intra-field spread widened slightly (`fieldOffset` 0.36→0.46 floor).
- **Still open:** the proximity-LOD detail layer (`SemanticDetailLayer` + `fieldScene`) re-projects a separate node cloud anchored at the field center and fades it in over the overview balls — a different projection, so it reads as an image laid over the map rather than new balls integrating. This is the "overscreen" complaint; fixing it is an interaction-model decision (single relevance-graded layer vs. keep proximity LOD but align + de-duplicate). Deferred pending user direction.
- Verified: typecheck clean in edited files (pre-existing `tests/ticker-*` regex/target errors unrelated), eslint clean, `PLAYWRIGHT_CAPTURE=1` market-universe e2e → 2 pass (33.8s), overview/field/mobile screenshots reviewed.

### Progressive in-place detail — corrected model (2026-08-06)
Course-correction after user feedback: Option A had removed load-more-on-approach *entirely*, but the user only ever objected to the ugly *execution* (a misaligned re-projected cloud floated over the map), not the concept. The map should NOT dump the whole ~700-ticker universe on open — it should stay the "from afar" landmark set and **load more as the camera nears a field**, integrated in place. Backend caps stay at 256/400 (a brief 256→2000 experiment was made and fully reverted — backend is unchanged).
- **Layout (`market-universe-layout.ts`):** `overviewScene` now accepts `fieldDetails: Map<communityId, RelationshipAtlasDetail>` and emits `overview.memberNodesByCommunity` — for each loaded field, its members beyond the landmarks, positioned with the SAME field center + `fieldOffset`, continuing the index sequence after the landmarks so landmark positions never move (unit-tested). Node prominence is graded by relevance (`nodeBodyColor` now blends the long tail toward paper by centrality) so density reads as layers, not a blob.
- **Scene (`MarketUniverseScene.tsx`):** `ProximityField` — one instanced batch per field. Its reveal is gated by TWO independent things, NOT raw eye-distance (which conflated them and made every field reveal on any zoom-in, "loading even the ones far to the side"): a **height gate** (camera→plane distance = zoom) and a **lateral gate** (the field's XY offset from the look-point), so zooming in only fills in the field you're actually centred over. No camera-driven loading at all — the reveal is purely visual against data that's already present.
- **Data loading (`MarketUniverse.tsx`) — deliberately simple:** ALL field members load once, when the atlas loads, via a single `useEffect` scheduled with `requestIdleCallback` (setTimeout fallback) so the ~24 bounded requests fire after first paint instead of competing with the canvas init. No prefetch queue, no proximity trigger, no interaction gate, no concurrency throttle, no camera loading callbacks — all of that was removed. The dataset is bounded (~24 fields × ≤84 nodes) and flat in universe size, so there's nothing to stagger. (History: this replaced an over-engineered stack — proximity ring + throttled queue + first-interaction gate + 700ms timer — that the user rightly called patchwork; the first field still spawned because warming only started on first zoom. Loading everything at idle removes the spawn entirely and is far less code.)
- **Parent (`MarketUniverse.tsx`):** `fieldDetails` state + `loadedFieldIds`/`approachLoading` guards; `approachCommunity()` is best-effort/idempotent/silent; `selectCommunity` also feeds `fieldDetails`; `selectAtlas` clears it. Also fixed drag-to-pan (OrbitControls left-drag was a no-op → remapped mouseButtons/touches) and tightened the world (dispersion 0.38→0.12, spacing 3.65→0.6, bounds ~halved, FOV 34→42) so fields sit at topology-true distances and the economy opens centered/close.
- Verified: typecheck + eslint clean; 74/74 unit tests (incl. new members-in-place test); e2e test 2 (mobile) passes with `consoleErrors===[]`; test 1 renders overview+field (ProximityField mounts without error) and only trips the 30s total-test budget on cumulative `/api/tickers/index` latency. **Needs interactive confirmation** of the fade-in-on-approach (not screenshot-verifiable — camera stays far in e2e).

### Single relevance-graded map — Option A (2026-08-06, superseded above)
User chose "one relevance-graded map" over "keep zoom-to-reveal but fix it." Implemented:
- **Removed the proximity-LOD path entirely.** `CameraRig` no longer requests a field detail load on `onEnd` (deleted `handleCameraEnd` + `onLodCandidate`); `MarketUniverse` dropped `lodCommunityId`/`lodDetail`/`lodRequestId`/`requestLodCommunity`. Zooming no longer auto-fetches or overlays anything.
- **Removed the re-projected detail overlay** (`SemanticDetailLayer`) and its per-node components (`CompanyNode`, `VolatilityHalo`) from `MarketUniverseScene`. The scene now renders only the overview (communities + glows + instanced nodes + the cross-field ticker web + active-node edges). The overview *is* the map; members are present from the start, faded by relevance (`capacity` 20/field + centrality-based opacity).
- **Selection is inspector-driven.** Clicking a field/company still loads `detail`/`neighborhood` to populate the inspector (unchanged), and highlights on the map (selected field glow; active-node bloom + its overview edges) — but never spawns a separate cloud. `MarketUniverseScene` props slimmed to `atlas / selectedCommunityId / activeSymbol / reducedMotion / mobile / onSelectCommunity / onSelectNode`.
- **Known tradeoff / next step:** field selection's *spatial* feedback is now subtle (glow bump + inspector) with no camera move. A gentle **camera focus-on-select** (ease toward the selected field/node using the existing transition machinery) is the recommended follow-up to make click-to-explore feel intentional. The lib still computes `field`/`company` layers (now unrendered, fed `null` detail) — could be pruned when we commit fully.
- Verified: typecheck + eslint clean; e2e test 2 (mobile) **passes** incl. `consoleErrors===[]` + no h-overflow on the Option A scene; test 1 reaches line 39 (field grid visible after full economy→field→company→back drill) and only trips the 30s **total-test budget** at the final overflow poll under a slow-backend window (`/api/tickers/index` 4.5–5.6s each) — environmental latency, not a regression (the change removes fetches). Field/overview/mobile screenshots confirm no overlay; the map is one consistent surface.

### Immersive dashboard + camera (2026-08-06)
- **Full-screen dashboard on `/markets/network`:** marketing footer hidden via `ConditionalFooter` gate in `app/layout.tsx` (route-scoped, keeps `SiteFooter` a server component passed as children); page scroll locked via `AtlasImmersiveMode` (sets `html`/`body` overflow hidden directly on mount, reverts on unmount — a globals.css body-class approach did NOT reliably apply in the test server, so this is done in JS). Verified: `footerPresent=false`, `htmlOverflow=hidden`, no v/h scroll.
- **Camera free-zoom fix:** the landing effect now only fits the economy on first mount and on view/window change (`lastLandedKey` gate), not on the scene rebuilds a selection/zoom-detail-load triggers — which was yanking the camera back to a fixed area. Needs interactive confirmation (not screenshot-verifiable).
3. **Region color encoding + region legend ✅ (2026-08-06).** Nodes + community fields colored by region via the existing `marketRegionColor` tokens (reused, not forked — those tokens are also used by `MarketCorrelationNetwork`/`NetworkGraphCanvas`, so the shared palette was left unchanged). Region legend (present-regions only) folded into the existing legend bar. **Two honest notes:** (a) the current materialized universe is US-heavy, so the map reads mostly blue (North America) + slate (Unknown) — more hues appear as international coverage grows; this is data, not code. (b) The shared palette's hues differ from the mockup (North America is blue `#36B3FF`, not the mockup's violet). Aligning to the exact mockup palette is a pending decision: shared-token change (affects the other network surfaces) vs. an atlas-local override. `npx playwright test` → 2 pass (one earlier run failed on a 30s **total-test timeout** during a slow-backend window — probed and confirmed zero horizontal overflow at every drilldown step; not a regression).
4. **Inspector finish** — country flag, circular stat-cards (reach/bridge/vol), freshness line; surface entity-aware fields (`primaryListingSymbol`, `siblingSymbols`, `identityConfidence`, `provenance`) currently dropped in `lib/network-atlas.ts`. Hybrid-membership section stubbed with graceful degrade.
5. **Search (top-center) + left teaching rail (dismissible first-run).**
6. **Mobile pass + a11y/reduced-motion audit + full `npm run qa:frontend`.**

### Explicit non-goals
- No new backend endpoints; bind to existing `/network/atlas`, `/communities/:id`, `/neighborhoods/:ticker`.
- No renderer swap away from R3F (Cosmograph/Sigma/Pixi are plan-B only).
- No client-side ticker enrichment in search — index-only per `DATA_SOURCE_POLICY.md`.
- No Bloom/postprocessing dependency unless proven and cost-recorded.

## Data contracts

- **APIs used:** `GET /api/network/atlas`, `GET /api/network/atlas/communities/:id`, `GET /api/network/atlas/neighborhoods/:ticker` (→ `lib/network.ts` → finance-backend `/network/*`). Search reuses `/api/tickers/index` (load once, filter locally).
- **APIs/fields missing:** none recorded. Per-node community membership weights, once listed here as missing, are exposed as `AtlasNodeResponse.memberships[]` (`{ communityId, weight }`) and normalized in `lib/network-atlas.ts` (verified 2026-09-23).
- **Fields already sent but dropped by the frontend:** `AtlasNodeResponse.primaryListingSymbol`, `listingCount`, `siblingSymbols`, `identityConfidence`, plus top-level `provenance`. Surface in Stage 4.
- **Fallbacks:** loading veil + skeleton (`UniverseWait`); non-materialized views → 503 message; market view → `deriveFallbackAtlas`; scene error boundary → `StaticUniverse` accessible fallback. All preserved.

## Implementation map

- `components/MarketUniverse.tsx` — state machine, data fetching/caching, chrome, inspector, accessible fallbacks. **Reuse; extend inspector/legend/search.**
- `components/MarketUniverseScene.tsx` — R3F scene (camera, controls, nodes, edges, fields). **Primary edit surface** for Stages 1–3.
- `lib/market-universe-layout.ts` — scene assembly / LOD selection.
- `lib/network-atlas.ts` — normalizers/types (extend for entity-aware fields, Stage 4).
- `lib/network-regions.ts` — color mapping (add region palette, Stage 3).
- `components/MarketUniverse.module.css` — chrome/inspector/legend styling.

## Validation

- **Stage 1 (2026-08-06):**
  - `npm test` → **73 pass / 0 fail** (unit + contract).
  - `npm run lint` → 0 errors (5 pre-existing warnings, unrelated files).
  - `npm run typecheck` → only 4 **pre-existing** errors in generated `.next/**/validator.ts` (removed routes `labs/perspective`, `stocks/[ticker]/lens`); **zero** in edited files. Chains under `verify` so it blocks the test step; tests run clean directly.
  - `npx playwright test e2e/market-universe.spec.ts` (PLAYWRIGHT_CAPTURE=1) → **2 pass / 0 fail (14.2s)**, real backend data (community `market-93c33d8a17`, neighborhood `PCVX`), full economy→field→company→back drill-down, no console errors, no horizontal scroll (desktop 1440×920 + mobile 390×844 reduced-motion). Screenshots: `test-results/.../economic-atlas-{overview,field,mobile-reduced}.png`.
  - Visual: overview confirms locked face-on view + truthful pan/zoom legend. Watch item → the scene is sparse (pre-existing node cap); density is Stage 2's job.
- **Stage 2a (2026-08-06):**
  - Backend (`finance-backend/app/relationship_atlas.py`): `ATLAS_LANDMARK_LIMIT 36→256`, `ATLAS_BACKBONE_LIMIT 48→400`; matching assertions in `tests/test_network_endpoint.py`. Query cost is O(limit) not O(tickers) — overview is a fixed legibility budget. **`finance-backend` tests: 12 + 37 = 49 relationship/atlas tests pass** (via `/home/user/.venv`; had to `pip install fastapi PyYAML pydantic-settings httpx` into that venv to run them — additive, low-harm). **Deploy pending — until then the live API still returns 36 landmarks.**
  - Frontend (`components/MarketUniverseScene.tsx`): overview node bodies + halos rendered as two drei `<Instances>` batches (per-instance color/scale, per-instance raycast click/hover), replacing the per-node `CompanyNode` map. Contextual fade via color-blend toward paper (no per-instance alpha on shared material). Field/focus layers still `CompanyNode` (2b).
  - `npm run typecheck` → 0 errors in edited files (only the 2 pre-existing `.next` stale-route errors). `eslint components/MarketUniverseScene.tsx` → clean. `npx playwright test e2e/market-universe.spec.ts` → **2 pass / 0 fail (16.7s)**, full drill-down, no console errors. Screenshot confirms instanced bodies+halos render with lit/dimensional look.
- Per-stage: `verify` after logic stages, `qa:browser` after visual stages, `qa:frontend` at Stage 6. Viewport matrix: `docs/qa/viewport-matrix.md`.

## Continuation

- **Risks:** matching the mockup's node density live is Stage 2's core risk (fill-rate on mobile → cut field-sprite resolution before node count); region coverage gaps fall to "Other" slate; camera flatten changes muscle memory for orbit users (note in PR).
- **Blockers:** hybrid-membership data (backend) — non-blocking; section degrades.
- **Exact next step:** Stage 1 — flatten camera in `MarketUniverseScene.tsx` and correct legend copy.
