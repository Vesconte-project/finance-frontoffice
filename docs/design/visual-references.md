# Visual References Log

External work is inspiration for principles, never a source to copy branding, layouts, copy, code, or assets. Record enough provenance to review rights and transformation.

## Current repository references

| Reference | Status | Use |
| --- | --- | --- |
| `app/globals.css` and rendered components | Runtime source of truth | Tokens, utilities, responsive and interaction patterns |
| `design/direction-board.html` | Internal exploration | Directional comparison only |
| `design/hero-constellation-scroll.html` | Internal exploration | Related to the implemented homepage hero |
| `design/brand-navy-teal-system.html` | Historical exploration | Superseded palette; do not use as a runtime color source |
| Other `design/*.html` and `design/brand-tokens.css` | Historical/internal studies | Not canonical; verify against runtime before reuse |

## Runtime implementation exemplars

Study the rendered pattern, its responsive states, and its direct styling before extending it. These are implementation references, not components to copy wholesale. The identity in `docs/design/design-system.md` and `app/globals.css` takes precedence over dated descriptions below.

| Pattern | Study | What to preserve |
| --- | --- | --- |
| Marketing navigation and disclosure | `components/marketing/HeaderBar.tsx`, `components/marketing/SiteChromeMotion.tsx`, and the `.site-header*` rules in `app/globals.css` | Solid semantic surfaces, content hierarchy, CSS-owned morphing, open/close states, outside/Escape handling, and the desktop/mobile search transition |
| App navigation composition | `components/Nav.tsx`, `components/BrandHomeMenu.tsx`, and `components/marketing/site-chrome.tsx` | Active-state hierarchy, portal positioning, compact information density, and responsive search placement; treat it as a visual/compositional reference and re-check focus semantics for any new disclosure |
| Editorial typography and surfaces | `MarketingPageShell`, `SectionHeading`, and `GlassPanel` in `components/marketing/site-chrome.tsx` | Source Serif 4 headings, IBM Plex Sans body copy, constrained line length, solid surfaces, and restrained accent for active states |
| Dense financial cards | `components/ScreenerSignalCard.tsx` with `components/ui/Card.tsx` and `components/ui/SignalBlock.tsx` | Label/value hierarchy, tabular numerals, signal redundancy, progressive density, and mobile readability |
| Responsive narrative motion | `components/marketing/HomeTickerStory.tsx` | Separate mobile/desktop geometry, transform/opacity animation, stable scroll reversal, and a meaningful reduced-motion final state |
| Complex hero motion | `components/marketing/HeroConstellation.tsx`, `components/motion/ScrollRuntime.tsx`, and `docs/design/motion-guidelines.md` | Singleton Lenis ownership, explicit page profiles, scoped GSAP scenes, cleanup, nonblank static content, and reduced-motion behavior |
| Focus and compact control states | `components/ui/Button.tsx`, `Input.tsx`, `SegmentedControl.tsx`, and `FilterChip.tsx` | Visible focus rings, state semantics, touch sizing, pressed/selected contrast, shared timing, and `motion-reduce` behavior |

### Unmounted motion reference — 2026-09-05

`components/marketing/HomeTickerStory.tsx` is retained as the repository's unmounted reference implementation of scroll-driven collapse/scatter choreography with FLIP-style source capture. It no longer supplies or owns homepage content: callers must provide real card data, and its authored mobile/desktop position tables intentionally cap the technique at five items. The homepage stopped mounting it because its former hardcoded financial values were fabricated; the motion mechanics remain useful without preserving those claims.

`components/ui/Dialog.tsx` (2026-10-03) is the shared modal on the native `<dialog>` element: focus moves in on open, the browser contains focus and makes the page inert, Escape and a backdrop click close it, focus returns to the opening control, and the shared scroll runtime is locked while it is open. `e2e/watchlist-signed-out-recovery.spec.ts` verifies those behaviours on the signed-out watchlist and export prompts. There is still no drawer exemplar.

## Expanded ticker chart — 2026-10-03

`components/stocks/ExpandedChartDialog.tsx` and `ExpandedPriceCanvas.tsx` (PRD-74) are the repository's own Canvas 2D price chart, opened from an icon button in the top-left corner of the ticker hero chart, on the shared `Dialog`: full screen on phones, a large modal from 900px. It draws candles or a close line, volume, axes, a reading crosshair and the reader's Fibonacci and trend drawings straight from the backend OHLC rows. A bar without an open is drawn in the neutral colour, never assumed to be rising. Pinch, drag, wheel and keyboard move the view. The pure range, scale and level logic lives in `lib/expanded-chart.ts`. No chart library or third-party mark was added. Indicator controls and the 1D/5D ranges stay visible and answer with an explicit error until ENG-152 and ENG-153 supply the data. The founder's direction came from a clickable prototype with generated sample prices; no prototype code or data was copied.

## Hero candles and two-day measurement — 2026-10-03

PRD-76 adds a candle icon beside the hero's expand icon. `TemporalLineChart` draws candles from the OHLC fields on its points when `mode="candles"`, and the choice is shared with the expanded chart for the visit. With `measurable`, a mouse drag, or a touch held still for `LONG_PRESS_MS` and then dragged, measures between two days. The expanded chart uses Shift and drag, because a plain drag pans. Both charts snap to each day's close and show the shared `components/charts/MeasureSummary.tsx`: the change and percentage in the up/down roles, days and sessions, and both dates. The arithmetic is in `lib/chart-measure.ts`, and the neutral rule for a candle with no open is in `lib/candles.ts`. Charts that do not opt in, such as the valuation history, are unchanged. Switching to candles reveals them left to right behind a soft-edged mask, on the line's draw-in timing, and shows them at once under reduced motion. `placeReading` puts the price reading beside, above or below the day it reads, inside the chart and clear of the hero's corner buttons.

## Ticker research chapters — 2026-10-04

`components/stocks/research/` (PRD-78, phase 1) holds the shared pieces the ticker tabs are rebuilt on, from the founder-accepted Spec *Página de ticker — leitura em camadas V1*:

- `ResearchChapter`: label, chart and the detail beside it.
  - The layout follows the chapter's own width through container queries.
  - From 56rem the detail sits beside the chart and stays in view.
  - From 30rem the detail cards form a grid under the chart; narrower than that, they stack.
  - `band` alternates `--bg` and `--surface-soft` without rules.
- `LeadStat`: the chapter's single large number.
- `ChapterCard`: a detail card for the side column.
- `ChartFrame` / `ChartPlot` / `ChartLabel`:
  - A chart can have a wide and a compact drawing; the compact one shows while the frame is narrower than 32.5rem.
  - The SVG stretches with the frame and keeps its stroke width.
  - Names and numbers are page text placed over the drawing by percentage, so they never scale. Stacked labels use `stackLabels` and `plotUnits` in `lib/chart-labels.ts`.
- `BeingBuilt`: the final place of a block whose data has not arrived. It shows the label, one sentence for the reader and the "Being built" badge; never a value, a dash or sample data.

The direction came from a clickable prototype with a fictional company and fictional numbers. No prototype code or data was copied. `tests/ticker-reader-copy.test.ts` keeps internal language ("canonical", "contract", "payload", "finance-backend", "Pending integration", "Data pending") out of every visible string on the ticker page.

## Ticker Overview and the Events layer — 2026-10-04

PRD-78 phase 2 rebuilds the Overview on the research chapters, in the Spec's order: Since your last visit, Technicals, Questions worth asking, Fundamentals and Relationships.

- **Hero:** Market cap and Next earnings sit under the chart; 30-day volatility is gone.
- **Score disc:**
  - Each slice is a button, by pointer and by keyboard, with the whole slice as its target.
  - Picking a slice opens the axis card. Its meaning and measures wait for ENG-155 and ENG-157.
- **Technicals:**
  - The summary shows a dial, the verdict with its position, and the votes as a split bar and in words.
  - Oscillators and Moving averages each take a compact row.
  - A Key readings card shows RSI (14), the distance to the 50- and 200-period averages, and MACD against its signal. They come from the existing OHLC calculations (`readings` in `buildTechnicalSummary`); nothing new is calculated.
- **Events layer:** a toggle in the expanded chart, off by default.
  - `lib/event-markers.ts` builds one marker per company event from the bitemporal events read model. The event id is its identity, so a revision moves the date instead of doubling it.
  - Each marker lands on the event's trading day.
  - Markers closer than a tap stack on one stem.
  - A tap on a marker, or the previous/next buttons, opens the card: what it was and when. No effect on the price is inferred.
  - The events are fetched without blocking the page, and the chart reads them when it opens.

## Ticker Fundamentals and Financials — 2026-10-05

PRD-78 phase 3. Founder rule for these tabs (2026-10-04): only values the backend reports. Growth, changes on the year before, ratios and differences between line items are Being built until the backend sends them (ENG-170, ENG-90).

- **Fundamentals:** Revenue, Operating margin, Cash and debt and Dividends, as chapters.
  - `ReportedBars` draws reported values from a zero line, with the numbers written on the bars. Losses hang below the line.
  - The wide drawing writes every bar's value. The compact drawing writes the ends and uses short years ('25).
  - At the two ends of a chart, labels align with the bar's outer edge so they stay on the plot.
  - Margins and net cash come from the summary rows the Overview reads, so a fact has one value across the tabs.
- **Financials:** "Where each dollar of sales goes". The card and "Biggest changes" sit beside the flow on wide screens and under it on narrow ones, like every chapter. With the 1400px page width the full flow appears from about 1300px.
  - From 900px of chart space the full flow runs left to right. The reported chain (sales → gross profit → operating income → net income) is drawn to scale and bottom-aligned, so profit runs along the bottom.
  - Branches that are not reported are outlined nodes of a fixed size, with a thin dashed ribbon. They say where money goes, never how much.
  - Below 900px: three columns. Sales is a bar; then its four parts (› where they open); then the children of the open part.
  - The year and Amount / % of sales use the liquid-glass segmented control.

## Ticker Valuation — 2026-10-05

PRD-78 phase 4. Same rule as phase 3: only reported values.

- `ReportedLine` draws a reported series over time, with time across and the value scale spanning the series.
  - The highest observation and today's value are written on the line, as page text.
  - Axis names are years when the span covers more than two years, months otherwise, thinned so they never collide.
- "All four" is a list of row buttons, 44px tall; the chosen row is outlined.
- The "What the price assumes" steps are round −/+ buttons, 44px. Until ENG-165 lands they answer in a status line.

## Ticker Business and buybacks — 2026-10-05

PRD-78 phase 5.

- **Business:**
  - Profile becomes Business on the research chapters, keeping the Spec's tab order.
  - The company's own description leads "How the business works" as page text, up to 44rem wide. The facts sit in the side card.
  - The buys → makes → pays map and "What it depends on" keep their final places with the Being built block.
- **Buybacks:**
  - Each reported execution is a bar (`ReportedBars`), with years named at their first execution. The first and last amounts are written on the chart.
  - The side card lists the latest eight executions: the period, then spent, shares and average price.

## Ticker conformance pass — 2026-10-05

A review against the accepted Spec (PRD-78) found these items, now fixed.

- **Screens:**
  - The ticker page and its chrome use the Spec's measures: 1400px maximum, and 20px side margins on phones (14px below 340px).
  - The detail column is beside the chart from 960px (300px, 340px from 1200px).
- **Overview:**
  - The hero chart opens on 1Y.
  - "What do you make of it?" shows Overdone / Fair / Not sure yet. A tap answers with the Spec's message and an OK; nothing is saved.
  - Key readings measure 50/200 days, 20/40 weeks or 10/20 months, by timeframe.
- **Events layer:**
  - The card shows the next session's move.
  - Guidance from the disclosures stream is a marker of its own.
  - Insider trades are marked as being built.
- **Every block** with a summary figure shows the date it refers to.
- **Signals, Ownership, AI Research and Methodology** follow the design rules:
  - no page header and no footnotes;
  - no section numbers and no dashes in place of values;
  - controls that are not ready answer with a message instead of sitting disabled.

## Rankings — 2026-10-07

The ranking pages (`/picks/*`, the weekly cut) and a company's Rankings section carry the homepage identity into a working page. `components/picks/Rankings.module.css` owns the pattern.

- **Universe band:** `RankingsUniverse` draws the same resting universe the ticker page keeps under its identity (`lib/ticker-universe`, `drawUniverseFrame` at rest), turning around the header's own accent node and fading out at the band's bottom edge. It pauses off screen and in background tabs; reduced motion draws one still frame.
- **Editorial list, not boxes:** ranked companies are rows on hairlines: rank, ticker and name, the measured parts as thin bars in the model's order, and the score. The whole row is the link.
- **Light along the hairlines:** a short run of accent light travels along each row's hairline as the list arrives and again under the pointer, the same gesture as the network's light along its links (H9).
- **Below the paid tier,** the list is drawn as its silhouette with one solid offer panel over it.
- **A company's standing** is a field of nodes from bottom to top, with the company's own node in the accent and light running from it toward the top.
- **Disclosure** is one line on a hairline with the full statement in a fold, present on every ranking surface.

Motion is CSS-only (rise, fill, pop, light) and reduced motion removes all of it.

## Expanding selector study — 2026-07-21

The reusable expanding selector transforms mechanics from the references below into a Vesconte-specific analytical control. It carries no ticker, investment-horizon, URL, or routing semantics. No reference code, assets, branding, or layout was copied.

| Reference | Source inspected | Principle retained | Rejected or replaced |
| --- | --- | --- | --- |
| [Glass Calendar](https://21st.dev/community/components/ravikatiyar/glass-calendar/default) | Rendered demo, registry component, demo source, and compiled CSS | Native horizontal overflow inside one glass vessel; touch-friendly item selection | Calendar composition, date state, and the absence of snap/radio semantics |
| [Expandable Tabs](https://21st.dev/community/components/victorwelander/expandable-tabs/default) | Rendered demo, component source, demo source, and compiled CSS | Compact-to-expanded disclosure and short label continuity | Conventional tab row, spring bounce, and button-only semantics |
| [Sliding Tabs](https://21st.dev/community/components/ruixen.ui/sliding-tabs) | Rendered demo, registry source, and demo source | Measured active geometry, `ResizeObserver`, keyboard model, and continuous indicator motion | A moving tab pill and permanently visible four-option layout |
| [Tubelight Navbar](https://21st.dev/community/components/ayushmxxn/tubelight-navbar/default) | Rendered demo, component source, and demo source | Restrained shared active-state continuity and responsive density | Navbar styling, icon substitution, and pronounced glow |
| [Liquid Weather Glass](https://21st.dev/community/components/ui-layouts/liquid-weather-glass/default), [Liquid Glass by Suraj](https://21st.dev/community/components/suraj-xd/liquid-glass), and [Liquid Glass by Pace](https://21st.dev/community/components/paceui/liquid-glass/default) | Rendered demos, registry/component source, demo source, and compiled CSS where exposed | Separate tint, highlight, edge, blur, and content layers | SVG displacement over text, global pointer followers, hidden cursors, elastic drag, and strong refraction |
| [Skewed Adjacent Hover Tabs](https://recent.design/i/nnkaerr-skewed-adjacent-hover-tabs) | Public demo description and rendered reference | Adjacent choices react with small opacity and scale changes | Skew and decorative hover choreography |
| [Mixing Horizontal and Vertical Scroll](https://www.awwwards.com/inspiration/mixing-horizontal-and-vertical-scroll) and [Horizontal and Vertical Scroll](https://www.awwwards.com/inspiration/horizontal-and-vertical-scroll) | Rendered inspiration pages and linked project context | Clipped continuation cues for local horizontal movement inside a stable vertical page | Page-level scroll hijacking and narrative scroll effects |

Vesconte transformation: a stationary center window sits over a native snap viewport; real radio inputs remain the semantic source of truth; drag previews a controlled choice and the parent owns the committed state. Reduced motion removes smooth travel and scale transitions because none of the inspected implementations supplied a complete reduced-motion path.

## Ticker selected-node direction — 2026-08-03

| Reference | Principle retained | Rejected or replaced |
| --- | --- | --- |
| User-provided ticker-page composition sketch | A selected colored node establishes identity before company name and price; a sparse relationship field connects the product page to the homepage topology | Exact spacing, typography, navigation geometry, chart styling, decorative density, and any implied third-party brand language |
| `components/marketing/HeroConstellation.tsx` | Focused-node projection, slow spatial drift, depth-based de-emphasis, separate blurred-background and sharp-connection passes, deterministic static reduced-motion state, and clear foreground/background separation | Homepage pinning, ScrollTrigger, Lenis ownership, node focus dialog, fabricated ticker values, and page-level scroll narrative |

Vesconte transformation: the ticker hero uses a non-interactive, hero-local 3D Canvas field built from the relationship data already loaded for the page. The Canvas measures the semantic-color DOM node beside company identity and uses its exact center as the origin of every relevant edge. Relationship strength and confidence control sharp edge and endpoint prominence; unrelated points remain grey in a separately scaled and blurred depth layer. GSAP animates only the initial 550ms focus interpolation—there is no ticker-page ScrollTrigger, pinning, or Lenis instance. The field pauses offscreen and when the document is hidden, reduces density and relation count on mobile, and renders its final state without a loop under reduced motion. No external assets or code were copied.

## Shared scroll runtime — 2026-08-03

The homepage remains the motion reference, but its document-level mechanics now live in `components/motion/ScrollRuntime.tsx` and mount once from the root layout. Ordinary routes inherit `standard`, the app route group declares `operational`, and the homepage opts into `narrative`; only its constellation registers a ScrollTrigger scene, unpinned, so the sections scroll over the field while its camera turns. Header and ticker-story observers subscribe to the same scroll channel. Motion tokens preserve the approved `0.1` Lenis interpolation, cinematic scrub, depth bands, and homepage distances. Document overscroll is contained, route navigation cancels residual inertia, and marked tables, menus, and local panels retain native nested scroll. Reduced motion deactivates Lenis and registered scenes while retaining native document flow and complete static content. Future pages must reuse the runtime, profile, lock, nested-scroll, and scene contracts rather than copying listeners or creating another smooth-scroll controller.

## Relationships observatory — 2026-08-03

The dedicated Relationships view extends the approved ticker selected-node language into an analytical instrument. It retains the semantic center node and deterministic topology, while sector color, relative raw strength, and a broader point field make the universe useful for discovery rather than decorative ranking. Canvas owns connection geometry and directional traces; accessible DOM buttons own node selection, focus and touch. Strength controls geometry and uses a nonlinear connection-weight curve; confidence controls resting clarity, while selection always restores focus. The selected company flows into a compact comparison lab with company name as the primary identity, two indexed-price paths overlaid in one frame with independent vertical scales, factual company context, and a separate navigation action; discovery cards expose the remaining active-layer companies. The saved expanding selector is a circular three-position reel: previous and next choices wrap around a legible selected view without resembling route navigation. A concise, persistent map key explains strength, confidence, sector color, and directional arrows. The canonical numeric evidence window uses the compact shared segmented toggle. `probableSpurious`, causal explanations, analysis/trading modes, named investment horizons, and invented lead/lag intervals remain visually unencoded until the backend supplies confirmed edge-level contracts.

## Add a reference

| Field | Value |
| --- | --- |
| URL or approved file |  |
| Owner/creator |  |
| Date accessed |  |
| Why it is relevant |  |
| Principles extracted |  |
| Planned transformation |  |
| Assets/code copied | None; otherwise stop and obtain explicit rights |
| Licensing/privacy notes |  |
| Decision owner |  |

Do not add an external reference merely to justify a predetermined visual. State what was learned, what was rejected, and how the result remains specific to Vesconte.

## Liquid-glass selector drop — 2026-10-03

| Reference | Principle retained | Rejected or replaced |
| --- | --- | --- |
| iOS 26 segmented controls and tab bars, as described by the founder from use on a phone | Press-and-drag selection: the selection lifts as a drop of glass, magnifies what is beneath it, follows the finger and settles on the nearest option when released | Refraction of the backdrop through an SVG displacement filter (not supported by Safari's `backdrop-filter`), system tint and vibrancy colours, and any Apple assets or code |
| `components/ui/ExpandingSelector.tsx` (2026-07-21 study above) | Pointer capture with a direction threshold, so vertical page scroll still wins; controlled commit owned by the parent | The reel layout, which stays specific to that selector |

Vesconte transformation: the magnification is a second, clipped copy of the labels inside the drop, counter-scaled against the drop's own stretch so text grows uniformly and works the same in every engine. The drop's geometry, lift and stretch are driven by damped springs in script; commit goes through the option's own click so selection and telemetry match a tap. The track is a solid `--surface` capsule; only the drop is translucent. No external code or assets were copied.

## Events calendar week view — 2026-10-08

The public calendar (`/calendar`, `/calendar/[category]`) opens on a week board (`components/calendar/WeekBoard.tsx`, `CalendarLanding.tsx`, `CalendarWeek.module.css`). The founder pointed to earnings-calendar sites that show a week of company tiles. Only the idea of reading a week of companies at a glance was taken; no layout, colours, logos or code were copied.

- **Header band:** one line on wide screens. The types sit on the left; on the right sit the window ("Oct 5 – 11, 2026 · 28 events", small in Plex Mono) and the Week/Month and week controls. Below 1100px the controls wrap above the types and stay on the right. Behind the band (the header line and the companies bar) turns the Rankings universe with `subject={false}`. Its seeded node is moved to the field's invisible centre and loses its links, so the field is centred in the band and nothing on screen is the subject. It turns slowly; reduced motion draws one still frame. There is no large title and no introductory copy (founder, 2026-10-08).
- **Type navigation:** the Rankings switcher, with a 2px accent rule under the current type.
- **Days are columns on hairlines,** Monday to Friday. A weekend day appears only when something falls on it. Below 52rem of container width the days stack.
- **Each day groups its events by type** under a mono label with its count ("EARNINGS 18"). Accent light runs along the label's hairline as the week arrives.
- **A company is a node:** a hollow ring in `--network-node`, the ticker in Plex Mono and the company name from the ticker index (`lib/calendar-names.ts`, server-only, fails open to tickers alone). It fills with the accent under the pointer or focus. There are no boxes and no logos, because no logo source exists. After fourteen companies a native `<details>` opens the rest in place.
- **The accent marks today:** the date, and a breathing dot beside "Today".
- **Locked weeks and the month view** use the Rankings silhouette: ghost nodes built from nothing, with one solid offer panel over them.
- **The month grid** (`EventCalendar`, shared with the ticker Events tab) drops the bare count in the corner and names what remains, for example "+50 more earnings". On `/calendar` it renders `bare`, under the same header band.

- **Companies bar** under the header: All · My watchlist · Related to [ticker] · Sector. Watchlist and Related need an account and show a lock for a signed-out reader. Related is a plain GET form with no suggestions, so it adds no lookup path. The sector list counts the window's companies per sector and loads on change (`SectorSelect`, the page's only client piece; without script a button does the same). The company in focus has its node lit in the accent and comes first on its day. Every related company shows how it relates in small mono ("Theme: …", "Moves with it", "Moves before it").

Known gaps, not filled in the frontend: supplier/customer links (no source), and earnings timing (before open / after close) is not exposed by `/site/calendar`. The backend earnings read model has `report_time`, but the public projection leaves it out and the data-ops source currently writes it empty. Company logos have no source.
