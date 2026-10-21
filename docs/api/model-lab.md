# Model Lab API (target contract)

Status: **not served by the backend yet.** This is the contract the frontoffice is built against. `lib/model-lab/contract.ts` holds the TypeScript types, `lib/model-lab/backend-source.ts` the client, and `lib/model-lab/fixtures/` a synthetic implementation of the same interface for design review and browser QA. When the backend serves these routes, the contract here and in `finance-backend/docs/api-contract.json` must be reconciled; the backend repository is the source of truth once it exists. Until then every call ends in `unavailable` or `not-found` and the pages say so instead of inventing data.

## Modes

| Variable | Effect |
|---|---|
| `MODEL_LAB_FIXTURES=true` | Synthetic in-memory data. Never active when `VERCEL_ENV=production`. The browser QA server sets it. |
| `MODEL_LAB_ENABLED=true` | Platform API under `/v1/model-lab` (needs the platform API to be on). |
| neither | `/models` shows "The Model Lab is not open yet". |

## Boundary

- The browser calls only `/api/model-lab/*` (one catch-all route, `app/api/model-lab/[...parts]/route.ts`). The route validates the request body (`lib/model-lab/validate.ts`) and calls the source. Browser code never reaches the backend or a provider directly.
- Server helpers call `/v1/model-lab/*` through `lib/platform-client.ts`, whose allowlist is closed: reads, writes and PATCH are listed per path; `POST /model-lab/runs` requires an `Idempotency-Key`.
- JSON is snake_case on the platform and camelCase in the frontoffice; `lib/model-lab/case.ts` converts at the edge.
- Every list is wrapped (`{ theses: [...] }`), never a bare array.

## Routes

| Method and path | Purpose | Who |
|---|---|---|
| `GET /model-lab/viewer` | Role (`investor` or `team`), plan, quota (`kind`, `unit`, `remaining`, `limit`, `period_ends_at`), unread alerts | signed in |
| `GET /model-lab/theses` · `GET /model-lab/theses/{id}` | Summaries; one thesis with notes, versions, tests and (team only) lineage | owner |
| `GET /model-lab/theses/{id}/evidence` | Checks, performance, contributions, limits, history, watch settings; `ordering` only for team | owner |
| `POST /model-lab/theses/{id}/notes` | Add a note (≤ 4000 chars) | owner |
| `PATCH /model-lab/theses/{id}/watch` | Re-test cadence and alert settings | owner |
| `POST /model-lab/theses/{id}/submit` | Submit a **copy** to Vesconte. Experiments are otherwise private | owner |
| `GET /model-lab/tests/{id}/results` | Variants of a set, dimensions, series | owner |
| `POST /model-lab/quotes` | Price and preflight findings for a draft; no side effects | Pro |
| `POST /model-lab/runs` | Start a run from a draft (202). Requires `Idempotency-Key`; the same key returns the same run | Pro |
| `GET /model-lab/runs/{id}` · `POST /model-lab/runs/{id}/cancel` | Progress, stages, failure and refund; cancel | owner |
| `GET /model-lab/library` | Tested models that can join a panel | owner |
| `GET/POST /model-lab/panels` · `GET/PATCH /model-lab/panels/{id}` | Panels; PATCH changes rule, hold, alerts and delivery | owner |
| `GET /model-lab/panels/{id}/today` · `/evidence` · `/alerts` | Today's flags, evidence, alert replays | owner |
| `GET /model-lab/alerts` · `POST /model-lab/alerts/read` | Inbox; mark ids or `all` | owner |
| `GET /model-lab/admin/queue`, `/pipeline/{thesis,reuse,panel}`, `/candidates`, `/access-requests`, `/data-health` · `POST /model-lab/admin/access-requests` | Team console | permission `research.internal.run` |

## Errors

`unauthenticated` (401), `forbidden` (403), `not-found` (404), `conflict` (409), `invalid` (400/422), `quota` (402), `rate-limited` (429 with `Retry-After`), `unavailable` (503), `upstream` (anything else). The frontoffice maps the status, never echoes backend text.

## Rules the backend must keep

- A customer's experiments are private to the account. Team access to an unsubmitted experiment is an exception per experiment: reason, expiry, audit record, owner notified.
- The platform returns numbers and thresholds ("3 of 5 checks hold"), never a verdict label about a thesis, and never a forecast.
- The quota `unit` is named by the API (`{ one, many }`); the UI renders whatever it names (unit still undecided, Linear PRD-80).
- A failed run refunds its cost and says so (`failure.refunded`).
- A draft's sentence, `values.horizon`, `values.label`, `values.gain`, `values.loss`, `values.regime` and `values.bench` must agree; `validate.ts` rejects a draft that does not.

## Engine pieces this relies on

- `finance-strategy-lab`: panel consensus routing (`strategy_lab/routing/panel_consensus.py`).
- `finance-ml-lab`: `label.reference_price_column` for benchmark-relative labels.
- Not yet built: feature-store "falling market" flag, orchestrator wiring that loads a panel from stored runs, the `/v1/model-lab` routes themselves.
