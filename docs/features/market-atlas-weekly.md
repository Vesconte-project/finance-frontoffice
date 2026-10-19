# Weekly market atlas

`/markets/network` draws the weekly relationship atlas served by the backend's
`/v1/atlas*` routes (finance-backend #56). Each week is one 2D map: regions are
companies whose prices move together once the whole market is taken out, and a
company's place reflects its ties.

## What each reader sees

The backend decides; the screen only draws what arrives and says what unlocks the rest.

| | Signed out | Free (signed in) | Pro |
|---|---|---|---|
| Regions | real centre, circle outline | real outline (line holding 80% of the region's weight) | same |
| Companies | levels 0–1, placed by region and size rank | every level, loaded by area as the reader zooms | same |
| Ties | only how many between regions | the strongest-ties tree in each region and the bundles between regions | same |
| Panels | region name, count and four largest companies | every member; a company's regions and strongest ties | same |
| Weeks | newest only | newest only ("History available on Pro") | history and movement (not registered yet) |

## On the map

After the approved prototype (version 18), from the backend's answer only:

- **Ground and wells:** signed in, the ground sinks under the 70 companies with the deepest wells (`well`², from the backend) and the view tilts 38° so the wells show. Signed out there are no wells, so the map is drawn straight down.
- **Regions:** tinted areas, with borders in the paper's colour where two overlap and a coastline around the rest. Signed out the circle keeps a dashed line.
- **Balls:** shaded, sized by market value in four fixed steps (≥ $200B, $50B, $10B), resting in their well with a shadow; a company that moves on its own is hollow.
- **Bundles:** signed in, every real tie between two regions whose two companies are on the map is a strand, gathered through the middle (Holten 2006). A tie with a company not loaded yet is left out. Pointing at a region shows its three strongest bundles with their tie counts (five when selected). Signed out, a region in focus shows only the counts, as dashed lines between region centres.
- **Focus:** a company under the pointer or selected lights up its lines, its bundle ties and, once its panel loads, the ten companies it moves most with.
- **Controls:** Browse atlas, How to read, Layers (names and key), Find on the map (companies and regions on the map; signed in, a ticker not loaded yet opens its panel and the map goes to its region), the zoom stack with the level, Aa (names) and Key.
- **Most connected:** signed in, the six companies with the largest `reach`, closed until opened.
- **The week's line:** the date, the counts and, signed in, "Average correlation 0.07 · lower for this market over the last year" from `marketCorrelation` (finance-backend #59); before a full year only the value.

Not built: themes (the backend serves no theme membership), the tool rail, movement and history (nobody is Pro), and the ring that splits a ball by region (the overview carries no memberships).

## Code

- `lib/atlas-model.ts`: types and a defensive reader for every response; a malformed entry is dropped, never invented.
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
reader with `E2E_STUB_SIGNED_IN=1`, to look at the signed-in map without Clerk.
