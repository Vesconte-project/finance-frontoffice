# Vesconte visual identity

`app/globals.css` is the runtime source of truth for color and font roles. Components and CSS modules own spacing, geometry, responsive behavior, and data presentation. Files under `design/` are historical explorations.

## Color roles

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F3EFE7` | `#0F1620` | Page and footer background |
| `--surface` | `#FAF7F1` | `#172130` | Solid panels, cards, menus, inputs |
| `--line` | `#D9D2C4` | `#2A3444` | Borders and dividers |
| `--text` | `#15202E` | `#ECE6DA` | Primary text and wordmark |
| `--text-muted` | `#3B4657` | `#A9B0BB` | Secondary text; the lightest permitted text role |
| `--accent` | `#A87A2A` | `#C99A48` | Focus, selection, active indicator, small ETF nodes in the homepage network |
| `--up` | `#3E7A55` | `#6FAF86` | Positive data and chart marks |
| `--down` | `#A34A3C` | `#D07565` | Negative data and chart marks |
| `--btn-primary-bg` / `--btn-primary-fg` | Ink / paper | Paper / ink | Primary actions |

The light theme is declared on `:root`; the dark theme follows the system preference unless the existing `html[data-theme]` or `.dark` / `.light` override applies. Legacy variables in `globals.css` are compatibility aliases to these roles. New components should consume the semantic roles directly and should not introduce literal colors. `--up-ink` is derived from `--up` and `--text` so small positive data labels reach normal-text contrast on the light background.

### Reading layers

The base palette above remains the only set of literal colours. `globals.css` derives `--surface-soft`, `--surface-raised`, `--line-soft`, `--line-strong`, and `--text-body` from those roles. Use `--text` for titles and decisive values, `--text-body` for prose and ordinary table values, and `--text-muted` for metadata. The derived body colour keeps normal-text contrast on the page and panel surfaces; muted text remains legible rather than disappearing into the background.

`Card` exposes `tone="default" | "featured" | "quiet"` for panels with different jobs. Default is the normal content surface, featured lifts an important result, and quiet holds supporting explanation. Use `.data-panel` around analytical chapters, `.reading-copy` for prose, and `.data-table` for financial tables; page CSS modules continue to own geometry and responsive layout. Search results share the same surface roles and use one accent edge only for the keyboard-selected row. These are semantic roles, not page-specific palettes.

## Type and logo

`app/layout.tsx` loads Source Serif 4, IBM Plex Sans, and IBM Plex Mono through `next/font`, each at 400 and 500. Page titles, the company name at the top of a company page, and the wordmark use Source Serif 4. Section headings, questions, interface copy, and controls use Plex Sans. Tickers, prices, scores, and dates use Plex Mono. Numbers use tabular figures.

The only logo is “Vesconte” in Source Serif 4 small caps, with approximately `0.06em` letter spacing and `--text`. There is no separate symbol. Do not add the old initials or footer slash mark.

## Components

Panels are solid `--surface` with a 1 px `--line` border. Buttons and cards use about 6 px radius; search uses about 8 px. Primary actions use the primary button roles. Secondary actions have a `--text` outline and transparent background. Search uses `--surface`, a `--text` outline, and `--accent` focus. Icons use approximately 1.5 px strokes. Avoid translucent panels, gradients, glow, blur, soft shadows, and pill shaped controls.

The homepage network distributes ETF nodes around the field in `--accent`. No single ticker is the fixed center. The compact scrolled header shows a search icon and expands the field on focus. Its result list keeps names, tickers, and tracking status; secondary source and exchange metadata stay in the full search panel.

Keep green and red in data displays. Ocre marks where the reader is: focus, selection, active navigation, and the selected network node. It should not cover large areas. Canvas and Three.js components resolve computed CSS tokens at the rendering boundary; they must not carry a second palette.
Absolute financial amounts use neutral ink marks in charts; signed changes may use the up/down roles. This prevents a large ocre chart from implying that every number is a selection.

## Accessibility and implementation

Normal text must reach 4.5:1 contrast in both themes. `--text` and `--text-muted` do so on both `--bg` and `--surface`. The light ocre is reserved for non-text indicators or large labels because it does not reach 4.5:1 as small text on paper. Preserve visible keyboard focus and reduced-motion behavior. `e2e/visual-identity.spec.ts` captures the homepage, company page, and footer in both themes and checks the core text and button contrast pairs.

Reuse `components/ui` primitives and existing navigation before adding new component styles. Add a new semantic role in `app/globals.css` only when the existing roles cannot express a real product meaning; keep geometry in the owning CSS module. Keep page structure and copy decisions separate from identity changes.
