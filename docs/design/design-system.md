# Vesconte visual identity

`app/globals.css` is the runtime source of truth for color and font roles. Components and CSS modules own spacing, geometry, responsive behavior, and data presentation. Files under `design/` are historical explorations.

## Color roles

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F2F3F5` | `#0F1620` | Page and footer background; a neutral grey so white panels separate from it |
| `--surface` | `#FFFFFF` | `#172130` | Solid panels, cards, menus, inputs |
| `--line` | `#D3D8DF` | `#2A3444` | Borders and dividers |
| `--text` | `#0B1220` | `#ECE6DA` | Primary text and wordmark |
| `--text-muted` | `#566173` | `#A9B0BB` | Cool text base and low emphasis metadata; derived roles adjust reading hierarchy |
| `--accent` | `#2557D6` | `#C99A48` | Focus, selection, active indicator, small ETF nodes in the homepage network |
| `--up` | `#0F7B55` | `#6FAF86` | Positive data and chart marks |
| `--down` | `#C2362B` | `#D07565` | Negative data and chart marks |
| `--btn-primary-bg` / `--btn-primary-fg` | Blue / white | Paper / ink | Primary actions |

Light mode is the neutral-paper direction the founder chose on 2026-10-07: white panels on a neutral grey page, near-black ink, and one blue accent. Dark mode keeps its palette; both themes share the same surface relationship (`--surface` panels lifted from `--bg`, `--surface-soft` bands between them). The light theme is declared on `:root`; the dark theme follows the system preference unless the existing `html[data-theme]` or `.dark` / `.light` override applies. Legacy variables in `globals.css` are compatibility aliases to these roles. New components should consume the semantic roles directly and should not introduce literal colors. `--up-ink` is derived from `--up` and `--text` so small positive data labels reach normal-text contrast on the light background.

### Reading layers

The base palette above remains the only set of literal colours. `globals.css` derives `--surface-soft`, `--surface-raised`, `--line-soft`, `--line-strong`, `--text-body`, and `--text-small` from those roles. In dark mode, headlines and decisive values keep the warm `--text`; ordinary reading uses the cooler `--text-body`; small labels use the brighter `--text-small`. Size and temperature establish hierarchy without spending ocre on decoration. All three text roles maintain normal-text contrast on the page and surface.

`Card` exposes `tone="default" | "featured" | "quiet"` for panels with different jobs. Default is the normal content surface, featured is a quiet near-canvas surface, and quiet is transparent for supporting explanation. Use `.data-section` for editorial analytical chapters, `.reading-copy` for prose, and `.data-table` for financial tables; page CSS modules continue to own geometry and responsive layout. Search results share the same surface roles and use one accent edge only for the keyboard-selected row. These are semantic roles, not page-specific palettes.

## Type and logo

`app/layout.tsx` loads IBM Plex Sans and IBM Plex Mono through `next/font`, each at 400 and 500. `--font-display` resolves to Plex Sans: page and section headings, FAQ questions, the company name at the top of a company page, and the wordmark use it with slightly tight tracking (`-0.01em`). Interface copy and controls use Plex Sans. Tickers, prices, scores, and dates use Plex Mono. Numbers use tabular figures.

The only logo is “VESCONTE” in Plex Sans 500 uppercase, about 15 px, with `0.2em` letter spacing and `--text`. There is no separate symbol. Do not add the old initials or footer slash mark.

## Components

Panels are solid `--surface` with a 1 px `--line` border. Buttons and cards use about 6 px radius; search uses about 8 px. Primary actions use the primary button roles. Secondary actions have a `--text` outline and transparent background. Search uses `--surface`, a `--text` outline, and `--accent` focus. Icons use approximately 1.5 px strokes. Avoid translucent panels, gradients, glow, blur, soft shadows, and pill shaped controls.

**Scoped exception — liquid-glass selectors (founder decision, 2026-10-03).** Segmented selectors (`components/ui/SegmentedControl.tsx`) may use a capsule track and a translucent glass drop with a light blur, a specular rim (`--glass-lens-specular`) and a lift shadow while dragging. The drop can be dragged: it lifts, swells past the track, stretches with its speed and magnifies the labels beneath it, and commits the nearest option on release. Panels, cards, menus and other controls stay solid; the exception does not extend to them. Ocre marks the drop's rim, not small text. Reduced motion removes the springs and stretch; reduced transparency makes the drop solid; touch pointers get 44px targets.

**Adaptive layout.** Components respond to the space they are given, not to device classes. Prefer intrinsic layout (flex wrapping with an explicit priority order, `wrap-reverse`, fluid `clamp()` values) and container queries in `rem` over viewport breakpoints, and use `pointer`/`hover` media features — not widths — for input-dependent sizing. The ticker hero (`StockTickerIdentity`) and its chart footer are the reference implementation, verified by the width sweep in `e2e/ticker-hero-layout.spec.ts`. The working method is in `docs/qa/adaptive-layout-qa.md`.

The homepage network distributes ETF nodes around the field in `--accent`. Other nodes and links use `--network-node` (slate in light, `--text` in dark). Each ETF is a light source: the accent travels outward along the links, strongest at the ETF and fading with the distance covered, so a link is a gradient rather than a flat colour and the light dies out after three or four links (founder choice H9, 2026-10-07). Nodes themselves are not tinted and there is no glow around them. ETF labels use the accent. No single ticker is the fixed center. Opening a focused node's full page is a cross-document view transition: the orb morphs into the ticker page's identity node while the page opens as a circle from where the orb sat (`TickerOpenTransition`). Only that navigation animates, and never under reduced motion. The compact scrolled header shows a search icon and expands the field on focus. Its result list keeps names, tickers, and tracking status; secondary source and exchange metadata stay in the full search panel.

Keep green and red in data displays. The accent (blue in light, ocre in dark) marks where the reader is: focus, selection, active navigation, and the selected network node. It should not cover large areas. Canvas and Three.js components resolve computed CSS tokens at the rendering boundary; they must not carry a second palette.
Absolute financial amounts use neutral ink marks in charts; signed changes may use the up/down roles. This prevents a large accent-coloured chart from implying that every number is a selection.

## Accessibility and implementation

Normal text must reach 4.5:1 contrast in both themes. `--text` and `--text-muted` do so on both `--bg` and `--surface`. The light blue accent reaches 4.5:1 on both `--bg` and `--surface`; the dark ocre is still reserved for non-text indicators or large labels. Preserve visible keyboard focus and reduced-motion behavior. `e2e/visual-identity.spec.ts` captures the homepage, company page, and footer in both themes and checks the core text and button contrast pairs.

Reuse `components/ui` primitives and existing navigation before adding new component styles. Add a new semantic role in `app/globals.css` only when the existing roles cannot express a real product meaning; keep geometry in the owning CSS module. Keep page structure and copy decisions separate from identity changes.
