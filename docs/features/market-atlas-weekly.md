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

## Code

- `lib/atlas-model.ts`: types and a defensive reader for every response; a malformed entry is dropped, never invented.
- `lib/atlas-view.ts`: camera, zoom-to-level rule, hit testing and zone colours; pure and unit-tested in `tests/atlas.test.ts`.
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
