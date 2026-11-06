# Workstream 4A — current analyst consensus chapter

## Implementation packet

Original workstream 4 (datasets), independent of deferred implementation batch 5
(SEC history). Founder authorized advancing an independent remaining workstream;
Company OS/preflight waiver and prior push/draft-review authorization remain in
force. Full scope/status ledger: finance-data-ops `docs/frontend-data-plan.md`.

Preserve the accepted Valuation composition, chapter order, typography and existing
ResearchChapter/ChapterCard/LeadStat/BeingBuilt primitives. Populate the current
analyst chapter from the new additive **owned backend summary contract**; do not
redesign the page, add endpoints/fanout, infer economic values or show coverage
reasons. Frontend types/readers are consumption, not primary source semantics.
The backend's generated API/OpenAPI version is 2026-11-03.1; owner documents in
all three service repositories define source/projection/HTTP behavior.

Current data: native-currency low/median/high range, explicit median target,
canonical medianUpside fraction relative to the enclosed regular-market quote,
aggregate recommendation and analystOpinionCount. Mean remains a distinct contract
field and cannot fill median. Opinion count is not the buy/hold/sell distribution.
A reference quote comes from the **same provider info capture**; another component's
quote may be from a different time. The graphic states its price/date and source
observation date. No expected-return or vendor-publication timestamp is inferred.

The snapshot is checked for version, issuer, source, aware/fresh observedAt,
major currency, bounds, quote unit/date and finite values. Absent/stale/malformed
content keeps Being built. An unknown recommendation isn't rendered as a technical
code. Funds retain the existing absence of equity analyst chapters. Requested
backend FX annotations preserve original native values; this chapter uses those
native values and labels its currency, without client economic/FX calculations.

Not delivered: detailed recommendation counts, target history/90-day changes,
forward growth, segments/geography, shareholders/insiders, peer selection or
explanatory valuation models. These remain original scope, not newly invented
lots. Batch 5 historical normalisation/multiples remains pending separately.

## Technical evidence and human review

Unit/architecture checks plus canonical `npm run verify`, production build and
owned `npm run qa:browser` on synthetic fixtures. Browser cases cover supplied
range/canonical distance/opinions, missing median with existing mean (no fallback),
absent snapshot, ten widths 320–1920, enlarged root text, reduced motion and no
page errors/overflow. Mobile/laptop/wide chapter screenshots are inspected. No
real-device touch or browser page-zoom claim. Mechanical detector had no findings.

First inspection removed the redundant nested placeholder border; one bounded
confirmation pass followed. Existing visual identity and all unrelated page code
remain authority. Local QA uses existing Development auth in memory only; no
credentials in this branch. Vercel preview/human visual and source coverage review
remain pending. Local fixture proof does not certify production data or acceptance.
No merge/deploy/real provider call or SEC operation was performed.

## Server re-review and main integration — 05 November

Server approved 4A: feature-store full suite 943 passed. The accepted conservative
v1 currency rule withholds targets for 38 symbols (including HK/ADRs and other
quote/report currency mismatches), plus 12 without a quote marker. These are
server counts, not locally repeated measurements or a new conversion permission.
This branch reapplies 4A onto main cb9513c1. The sole content conflict was the
package.json test command: preserve all current main tests (including relationships,
events and currency comparisons), and add analyst-consensus.test.ts. Main fonts,
financial-flow and display-currency changes remain intact. The analyst UI and
contract were not redesigned. Frontend #100 enters before 4B and scenario; those
branches still require their own rebase/retest after predecessor merges.
