# Weekly market atlas

`/markets/network` draws the weekly relationship atlas served by the backend's
`/v1/atlas*` routes (finance-backend #56). Each week is one 2D map: regions are
companies whose prices move together once the whole market is taken out, and a
company's place reflects its ties.

## What each reader sees

The backend decides; the screen only draws what arrives and says what unlocks the rest.

| | Signed out | Free (signed in) | Pro |
|---|---|---|---|
| Regions | real centre, circle outline | real outline (line holding 80% of the region's weight) | same; Layers › Region size can weigh it by market value (`contourByValue`) |
| Companies | levels 0–1, placed by region and size rank | every level, loaded by area as the reader zooms | same |
| Ties | only how many between regions | the strongest-ties tree in each region and the bundles between regions | same; the selected company's strong ties the map placed far away as dashed red lines |
| Panels | region name, count and four largest companies | every member; a company's regions, strongest ties (beyond market · total), "Map accuracy here", its themes | same, plus tie trends (↑ stronger / ↓ weaker) and "Then and now" |
| Themes | — | menu, highlight, theme card | same |
| Weeks, time bar, movement (6 mo / 1 yr), paths | locked (upsell) | locked (upsell) | yes |
| Total co-movement lens, fidelity ring, influence, cohesion chart | locked (upsell) | locked, no data | yes |
| Tool rail (select, compare, test a link, notebook, groups) | locked (upsell) | locked (upsell) | yes |

Locked UI follows prototype v27 §8: Pro tags on Layers sections, 55% opacity locked layers, an accent dot on gated buttons, and a non-modal upsell ("See plans" → `/pricing`, "Not now"; signed out also "Pro tools need an account. Create free account · Sign in"). Product decision ENG-232 wins over v27: free sees the newest week only (no six-month timeline or movement). Pro is `access.pro` from the backend; `atlas.pro` is not registered, so nobody is Pro in production yet.

## On the map

After the approved prototype (version 18), from the backend's answer only:

- **Ground and wells:** signed in, the ground sinks under the 70 companies with the deepest wells (`well`², from the backend) and the view tilts 38° so the wells show. Signed out there are no wells, so the map is drawn straight down.
- **Regions:** tinted areas, with borders in the paper's colour where two overlap and a coastline around the rest. Signed out the circle keeps a dashed line.
- **Balls:** shaded and resting in their well with a shadow, sized as the prototype sizes them: continuous in log market value (up to $4T), against the map's size on screen and the square root of the zoom, never under 1.4 px. Signed out, the backend's four steps stand for ≥ $200B, $50B, $10B and smaller. A company that moves on its own is hollow; one whose strongest ties are at least 15% outside its region wears a ring split by region (`memberships`, finance-backend #59) once the ball is larger than 3 px.
- **Bundles:** signed in, every real tie between two regions whose two companies are on the map is a strand, gathered through the middle (Holten 2006). A tie with a company not loaded yet is left out. Pointing at a region shows its three strongest bundles with their tie counts (five when selected). Signed out, a region in focus shows only the counts, as dashed lines between region centres.
- **Focus:** a company under the pointer or selected lights up its lines, its bundle ties and, once its panel loads, the ten companies it moves most with.
- **Controls:** Browse atlas, How to read, Layers (names and key), Find on the map (companies and regions on the map; signed in, a ticker not loaded yet opens its panel and the map goes to its region), the zoom stack with the level, Aa (names) and Key.
- **Most connected:** signed in, the six companies with the largest `reach`, closed until opened.
- **The week's line:** the date, the counts and, signed in, "Average correlation 0.07 · lower for this market over the last year" from `marketCorrelation` (finance-backend #59); before a full year only the value.

### Pro and history (pro-spec §1–§8)

- **Time bar:** Pro loads earlier weeks through `/api/atlas?asOf=` at full detail (once, four at a time, cached), aligns each onto today's map with a Procrustes fit (rotation, optional mirror, scale) and interpolates positions while playing (52 weeks in 9 s; whole weeks with reduced motion). On an earlier week ties, bundles and arrows are hidden; paths show the movers of the year's movement and the selected company, with the prototype's note under the bar. Not built: the prototype's ±4-week smoothing (positions are each week's own, aligned).
- **Movement (Off / 6 mo / 1 yr):** arrows for flows of at least two companies (`/v1/atlas/movement` `flows`), movers in the accent colour (fetched where they sit when not loaded), a ghost of a selected mover, and "Then and now" in the company panel (6 months unless the control says a year).
- **Layers:** Reading (names, key) and the Pro sections: What moves together (Beyond the market / Total co-movement, a second map from `lens=total`, no history or influence on it), Region size, Map accuracy ring, Influence between groups (arrows, list and empty states from `/v1/atlas/influence`).
- **Themes:** "Theme: All companies" menu (`/v1/atlas/themes`), members highlighted at every zoom (`/v1/atlas/themes/{id}`), theme card with the backend's verdict, and the company panel's theme sentence.
- **Browse:** Regions / Groups / Market tabs; Market shows the mean map accuracy and, for Pro, the cohesion chart from `/v1/atlas/weeks` `cohesion`.
- **Tool rail:** Explore, Select (lasso or shift-click; the lasso fetches the area so unloaded companies inside it count), Compare (`/v1/atlas/compare`), Test a link (`/v1/atlas/test`, GET; the session's test count raises the bar), Notebook (`atlas_notebook_v1`) and Groups (`atlas_groups_v1`) in this browser's storage, every access guarded. The tray shows companies, regions and market value; the prototype's "avg corr" is left out because no pairwise correlations are served.

A map served without `memberships` draws no rings; a missing Pro field leaves its feature on its empty state.

## Code

- `lib/atlas-model.ts`: types and a defensive reader for every response; a malformed entry is dropped, never invented.
- `lib/atlas-pro-model.ts`: defensive readers for weeks, movement, themes, influence, compare and the link test (each reads its own output again unchanged, since local routes pass parsed answers on).
- `lib/atlas-pro.ts`: pure Pro logic: upsell copy, Procrustes alignment and week frames, play timing, arrows, "Then and now", charts, the test table, the lasso, and the guarded storage of groups and notebook; unit-tested in `tests/atlas-pro.test.ts`.
- `components/atlas/Atlas*.tsx`: the explorer split into the time bar, tool rail, workbench (tray and dock), notebook, layers, browse tabs, theme menu, cards, panel, map key and upsell.
- `lib/atlas-view.ts`: the tilted camera, zoom-to-level rule, hit testing, zone colours, the ground's wells, bundle strands, search and "Most connected"; pure and unit-tested in `tests/atlas.test.ts`.
- `components/atlas/atlas-canvas.ts`: one Canvas 2D frame: ground, regions, lines, bundles, balls, names and counts.
- `lib/atlas.ts`: server reads with the reader's session; refusals keep their reason.
- `app/api/atlas/*`: local routes the browser calls for areas and panels.
- `components/atlas/AtlasExplorer.tsx`: Canvas 2D map, pan/zoom by pointer, wheel, pinch and keyboard, the panel, and the Browse atlas list as the keyboard and screen-reader path.
- `components/atlas/CompanyAtlasPlace.tsx`: the Relationships tab of a ticker.

The calendar's company grouping uses each company's atlas region (signed in), and
"Related to" uses a company's strongest ties. The homepage section "Behind one name"
draws a ranked company's strongest ties.

## QA

`e2e/market-atlas.spec.ts` covers the signed-out map at 375 and 1440 px (painted
canvas, no horizontal overflow, no console errors), the keyboard list path and
panels, and the local routes' refusals. The fixture backend answers as a free
reader with `E2E_STUB_SIGNED_IN=1` (`e2e/market-atlas-free.spec.ts`: locked UI, upsell,
themes, accuracy) and as a Pro reader with `E2E_STUB_TIER=pro`
(`e2e/market-atlas-pro.spec.ts`, synthetic history in `e2e/fixtures/market-atlas-pro.mjs`:
time bar, movement, layers, themes, influence, tool rail). Each spec skips unless the stub
answers in its tier, so run the three modes separately.
