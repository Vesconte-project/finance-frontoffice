# Model Lab

Status: built against a target contract the backend does not serve yet (`docs/api/model-lab.md`). It runs on synthetic fixtures for Preview and browser QA (`MODEL_LAB_FIXTURES=true`), and on the platform API when `MODEL_LAB_ENABLED=true`.

One Model Lab for a self-directed investor, replacing the three older labs. Depth is Guided, Advanced or Lab in the same product; team members use the same product behind `research.internal.run` and see the Lab depth and the Team page. Founder direction is in `docs/product/decision-register.md`.

## Pages

| Route | What |
|---|---|
| `/models` | Your theses, "since you last looked" alerts, first-use explanation |
| `/models/new` | Composer: the thesis as a sentence, stock picker (ticker index loaded once, filtered locally), rigor, settings by depth with a value line for every number, "compare several values", live quote and preflight, submit |
| `/models/runs/[id]` | Progress, stages, cancel, failure with refund |
| `/models/theses/[id]` | Evidence, Tests, Watching, Notes and versions, How it was calculated (Lab) |
| `/models/tests/[id]` | Set of variants: grid by measure, slices, one-cell warning, pinned lines |
| `/models/compare` | Two to four theses side by side |
| `/models/panels`, `/new`, `/[id]` | Combine tested models: Today, Models and rule, Evidence, Alerts, How it was calculated (Lab) |
| `/models/alerts` | Inbox with filters, day groups, mark as read |
| `/models/team` | Queue, pipeline, candidates, access requests, data health (permission) |

## Where it lives

- `lib/model-lab/`: `contract.ts` (types), `source.ts` (interface), `backend-source.ts` and `fixtures/` (two implementations), `bff.ts` + `validate.ts` (route logic), `params.ts` (settings by layer and depth), `thesis-sentence.ts`, `value-track.ts`, `mode.ts`.
- `components/model-lab/`: composer (`Composer`, `SentenceBuilder`, `ParamEditor`, `ValueTrack`, `StockPicker`), run and results, thesis tabs, panel tabs, alerts, team.
- `app/(app)/models/**` pages and `app/api/model-lab/[...parts]/route.ts`.

## Behaviour to preserve

- The platform shows numbers against thresholds, never a verdict or a forecast.
- Settings change what is retrained (model), reused (rules) or only re-simulated (trading assumptions); the quote prices them differently.
- A track never loses its last value; at most eight values; settings that do not apply to the chosen verb do not multiply the test count.
- Every action has a keyboard route; touch targets are at least 44px.
- Fixture "States" control (cookie `model_lab_preview`) exists only in fixtures mode.

## Checks

- Unit: `tests/model-lab-*.test.ts` (in `npm test`), `tests/platform-client.test.ts`.
- Browser: `e2e/model-lab-composer.spec.ts`, `e2e/model-lab-flow.spec.ts`.

## Not done

- Backend routes (`finance-backend`), feature-store "falling market" flag, strategy-lab panel loading from stored runs, the panel's own-conditions builder and the Linear `[Gap]` records.
