---
name: Product change
about: Specify a meaningful product change before implementation
title: "[Product] "
labels: ""
assignees: ""
---

<!-- Lightweight changes do not require this template. Use it for meaningful changes to behavior, journeys, semantics, visual direction, entitlement, or scope. Do not send the discovery transcript to implementation. -->

## Classification, user, and problem

- **Path:** Meaningful
- **Why this is meaningful:** Changes anonymous ranking entitlement from ten rows to five; recorded from the product owner’s approved packet 10 BA decision, 2026-09-05.
- **Target user:** Signed-out readers of the homepage and all three /picks reading pages.
- **Observed problem and evidence:** Product owner considers ten ranked rows too much of the product before an account exists; homepage already shows five.
- **Desired outcome:** Anonymous readers receive five rows server-side; free and pro retain twenty-five. Homepage remains capped at five for every tier.
- **Non-goals:** No /picks redesign, scoring/filter changes, new backend support, or changes to free/pro entitlements.

## Approved experience

- **Entry point:** / and /picks/long-term, /picks/income, /picks/short-term.
- **End-to-end journey:** Read five entitled names; account creation opens the full twenty-five. Existing lock UI derives twenty withheld names from the actual result.
- **Loading:** Existing dynamic server rendering unchanged.
- **Empty:** Existing zero-qualified state; never insert example rows.
- **Partial/stale:** Retain upstream items/order/asOf and existing short-ranking behavior.
- **Error / timeout / retry:** Existing unavailable state and retry remain unchanged.
- **Unauthorized:** Anonymous access is allowed, cut to five before rendering; no hidden full-list payload.
- **Success:** Five entitled rows for anonymous; full list for free/pro; homepage presentation cap remains five.

### Responsive and input behavior

- **Mobile:** Inspect all three reading pages at 375px; report lock dominance without redesign.
- **Tablet/laptop:** Retain existing grid and content behavior.
- **Desktop/wide:** Inspect all three reading pages at 1440px: hero plus four cards and existing lock block.
- **Keyboard and focus:** Existing links and focus order unchanged.
- **Touch:** Existing targets unchanged.
- **Zoom/reflow:** Existing responsive layout unchanged.
- **Reduced motion:** No new motion in BA.
- **Not-applicable behavior above (with reasons):** No new interaction or data state; only the server allowance and documented presentation comment change.

## Semantic data requirements

| Meaning | Type / unit | Nullability | Coverage | Freshness | Privacy | Semantic owner | HTTP operation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ranked companies allowed by viewer tier | Integer count | Non-null | Existing available ranking, capped at5/25/25 | Existing snapshot | Session stays server-side | Product owner / finance-frontoffice | Existing ranking transport; unchanged |

- **Backend contract link and version / lookup result:** No backend contract change. Existing resolveVisiblePicks → cutToTier owns the cut; PICK_FULL_LIST remains25.
- **Explicit owned gap (owner and layer), if any:** None for BA; frontend entitlement policy is approved in packet10.
- **Upstream evidence:** lib/picks-access.ts, lib/picks-access-rules.ts and tests/picks-access.test.ts; no HTTP behavior added.
- **Why HTTP exposure is the missing layer, if applicable:** Not applicable: transport exists and is unchanged.

## Implementation specification

- **Scope and owned files/areas:** BA: lib/picks-access-rules.ts, tests/picks-access.test.ts, this decision record, HomeBoard.tsx presentation-cap comment.
- **Invariants:** free/pro=PICK_FULL_LIST; anonymous<free; no over-serving; omitted rows never reach the browser; no changes to ranking order.
- **Ownership and dependencies:** Product owner approved policy; Codex records/implements; existing server-only gate remains authoritative.
- **Acceptance tests:** Renamed five-row test; lockedCount20 of25; serialized payload excludes sixth name; existing anonymous<free invariant untouched; browser/HTML checks where available.
- **Implementation packet:** /home/franciscosantos/vesconte-plans/frontend-ticker-and-header/packet-10.md, section BA.

## Candidate validation

- **CI result:** Pending candidate validation; exact results recorded in running work log.
- **Commit-addressed Vercel Preview URL:** Pending Git-connected Preview.
- **Affected routes:** /, /picks/long-term, /picks/income, /picks/short-term.
- **Important states exercised:** Candidate checks pending; empty/unavailable behavior and signed-in limits retained.
- **Representative viewports/inputs:** 1440px and375px; HTML count plus visual lock-block assessment.
- **Preview or visual evidence N/A (with reason):** Required; availability/results in work log, not inferred from unit tests.

CI proves technical validity only. Screenshots, tests, and Preview evidence do not grant human acceptance.

## Human acceptance

- **Product acceptance (founder; accepted/rejected/N/A with reason):** Entitlement decision approved explicitly by product owner in packet10 BA; candidate outcome acceptance pending Preview review.
- **Visual acceptance (founder; accepted/rejected/N/A with reason):** Pending product-owner Preview review.
- **Release acceptance (accepted/rejected/N/A with reason):** Pending; do not merge.

## Production outcome follow-up

- **Production commit/deployment:** Not deployed or merged by this work.
- **Smoke evidence:** Pending candidate validation.
- **Outcome evidence:** Not yet measured in production.
- **Measurement limitation, if outcome evidence is unavailable:** Technical checks do not establish product/visual/release acceptance.
