# Model Lab thesis composer

Status: first slice, behind a flag, for visual review on Preview. It has no backend.

## What it is

`/models/lab/new` lets a reader build a thesis as one sentence: *"I think recent winners among my whole watchlist will outperform the market over two weeks."* Every blank is a choice from a short list or a value on a line. A value the reader wants to compare takes several points on its line, and the summary counts the tests that implies.

The page builds the sentence only. Nothing is run, saved or sent, and there is no cost, quota or run button, because the units of use and the submission contract are not decided (see Blockers).

## Where it lives

- `lib/model-lab/thesis-sentence.ts`: the closed template (options, defaults, tracks), the sentence read-back and the test count. The options are what the product offers, not claims about any stock.
- `lib/model-lab/value-track.ts`: the value line maths (scales, snapping, add, move, remove, keyboard steps).
- `components/model-lab/ValueTrack.tsx`: the line. Click to place, drag to move, arrow keys on a focused point, Delete to remove, and a typed exact value. Ticks are shortcuts, never the only values.
- `components/model-lab/ThesisComposer.tsx`: the sentence and the choice panels.
- `lib/model-lab/flags.ts`: `MODEL_LAB_COMPOSER_ENABLED=true` opens the page. It never opens on Vercel Production, and an unset or other value returns 404.

## Behaviour to preserve

- A track never loses its last value. Landing a point on another merges them. A track holds at most eight values.
- Settings that do not apply to the chosen verb (gain and loss for "outperform") do not multiply the test count.
- The universe offered has no counts, because no source for them is verified here.
- Every action on a line has a keyboard route; touch targets are at least 44px.

## Checks

- Unit tests: `tests/model-lab-value-track.test.ts`, `tests/model-lab-thesis-sentence.test.ts`, `tests/model-lab-flags.test.ts` (listed in `npm test`).
- Browser tests: `e2e/model-lab-composer.spec.ts` (sentence read-back, verbs, gain and loss, several values, keyboard, click and typed values, no sideways overflow at 320, 390 and 768px). The QA server sets `MODEL_LAB_COMPOSER_ENABLED=true` in `playwright.config.ts`.

## Blockers and non-goals

- Submitting a thesis needs a contract the backend does not have. The research job accepts a closed comparison of two model variants; horizons, conditions and sets of variants are gaps to record with the owning layer before this page can submit.
- No quota or cost display until the unit of use is decided (Linear PRD-80).
- No stock picker. Ticker autocomplete must load `/api/tickers/index` once and filter locally, which is a separate change.
- No results, history or alerts in this slice.
