# ENG-147 review and authenticated preview proof

## Implemented

The proof is at `/dashboard/research/synthetic`, linked from Research only when
server-side `RESEARCH_SYNTHETIC_ENABLED=true`. It stays disabled by default and is
blocked in Vercel Production independently of that flag. Existing dashboard
navigation, serif headings, semantic surfaces, controls and focus treatment apply.
Two variants select logistic regression/random forest and thresholds 0.50/0.60;
fixture, target/features/horizon remain fixed by the trusted backend template.
There is no YAML, SQL, CLI, adapter, upload or model-promotion interface.

Submission is explicit. In-flight clicks are locked; reads poll every five seconds
while active and visible, without overlapping list requests. Errors retain the
last successful read as stale; refresh is explicit after an error. Partial
submission preserves returned IDs and makes the failed/missing member visible.
An unknown POST outcome blocks retries until a successful read. This is not an
idempotency mechanism. One active comparison is the existing Backend limit, not
an atomic resource reservation.

Run detail shows execution state, public parameters, definition version, snapshot
and lab run IDs, configuration/fixture hashes, permitted synthetic metrics, events,
and artefact metadata. Completion is explicitly separate from financial validity.
No performance ranking or advice is generated. A recorded declarative request can
be loaded into the form and explicitly submitted again; old records without it
say so. Only runs with an authoritative comparison ID are grouped, never by a
name/timestamp guess. History is limited to 50 runs; this is not full pagination.

Backend #18 adds `public_request` and `comparison_id`: enough to reconstruct the
user's closed request, including both variants and original name. It does not
expose internal execution configuration. Executed runtime SHA and
artefact contents/downloads remain unavailable; the UI does not invent them.
The old host proof's file references do not establish historical content digests.

Contract coordinated with the ENG-148 agent in [Backend #19](https://github.com/Vesconte-project/finance-backend/pull/19):
execution, technical audit and financial validity are separate fields in the UI.
The BFF projects only the bounded `audit_summary`: two allowed diagnostic types,
status, counts and up to 100 finding identifiers per check. Raw diagnostics,
paths, commands and stderr never pass through. Missing/historical evidence says
“No audit evidence”; incomplete evidence is inconclusive. Failed checks remain
failed even when execution completed. Both technical checks passing still leaves
financial validity “Not established”. No ENG-148 implementation is changed here.

## Local evidence and boundaries

`npm run verify` covers the actual BFF proxy with injected server-resolved Clerk
identities and mocked upstream responses. The Backend suite uses its local API,
SQLite/fixture stores, owner dependencies and two distinct viewer identities. These
prove identity provenance at the code boundary and owner/other-viewer 200/404,
including events and artefact detail; they do not prove real Clerk cookies.

`e2e/synthetic-comparison.spec.ts` bundles the actual client component and existing
DashboardLayout for Playwright. It uses actual CSS/fonts and test-only BFF replies.
The fixture bundle exists only in temporary test output; no mock identity/bypass
or fixture route is added to the shipped application. It exercises empty, invalid,
partial, queued, running, completed, failed, expired-session, unavailable, unknown
submission and recoverable evidence states; repeat, keyboard, reduced motion,
overflow and screenshots at 320, 1366 and 1920px. The shipped default-off API is
also called directly. Tests do not execute the backend worker. Global header,
sticky positioning in the complete app and actual sign-in need preview review.

The local first browser pass used the existing Clerk keyless harness and created
ignored local Development configuration. The subsequent pass reused that local
Development configuration with keyless disabled. No real user sign-in occurred;
no keys or claim URLs belong in PRs, screenshots or evidence. Test credentials are
never sent to the synthetic mock boundary. No host jobs/artefacts/DB were touched.

## Proposed integration order — human review and merge only

1. Review Backend #18/#19 and Frontoffice #44 independently. #44 handles old projections
   and includes the missing Clerk middleware matcher; #18 enables faithful recovery.
2. Integrate Backend #18 and #19 through its separately authorised development release path.
   This task does not install it on the host or access its database.
3. Review the stacked UI PR against #44. After human integration of #44, retarget the
   UI to main and rerun CI. Main may publish; keep the flag absent/false in Production.
4. Complete the preview proof below before considering exposure beyond the proof.
   Do not treat green CI, a merge or preview readiness as product acceptance.

## Authenticated preview runbook — owner performs operational steps

1. Choose the exact UI branch/commit and isolated synthetic Backend release. Record
   both SHAs and the preview deployment ID. Do not use a production Backend URL.
2. Inspect Vercel environment metadata without decrypting secrets. The intended
   branch's **Preview** target needs `RESEARCH_SYNTHETIC_ENABLED=true`,
   `BACKEND_BASE_URL`, `BACKEND_SHARED_SECRET`, `RESEARCH_BFF_SECRET`, and any required
   `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`. Backend must use the matching
   research BFF secret, nonproduction environment, trusted template and fixture hash.
   Do not set the flag on Production. No `NEXT_PUBLIC_` research secret exists.
3. Preview Clerk must use the paired Development `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   and `CLERK_SECRET_KEY` (`pk_test_` / `sk_test_`). Set
   `NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=1` consistently for build/browser. Verify the
   intended development instance and allowed preview redirect origins; do not
   substitute Production keys. Environment additions apply to a new build, so the
   owner prepares an authorised preview; this agent did not deploy or change variables.
4. Separate Vercel Deployment Protection redirects from Clerk errors. In a clean
   browser without a session, verify sign-in and direct API `401` while the flag is
   enabled. Verify page hydration, sign-in/sign-out and the Research entry link.
5. Sign in as Development viewer A. Submit the default distinct variants; record
   comparison/run IDs, public request and fixture/definition/configuration hashes.
   Observe queued → running → completed or failed and event timestamps. Refresh and
   reload the page, inspect both variants and missing-metric states. Completion must
   retain the explicit financial-validity limitation. Check failed/inconclusive and
   absent historical audit evidence independently of execution state. Do not assert success if the
   worker is not reachable.
6. In a separate profile sign in as viewer B. List must exclude A's runs. Request A's
   detail, events, artefact list and artefact detail via the local BFF; all must be
   `404`. Spoof viewer/secret headers and JSON fields; no identity change is permitted.
7. Inspect browser requests and returned JSON: browser submits only the closed
   declarative request; responses/bundles contain no BFF secret, owner identity,
   internal config, host paths, command, env or stderr. Capture network evidence
   with credentials/cookies redacted, never export session tokens.
8. With operational approval, use a disposable preview branch missing the BFF secret
   and confirm `503` plus recoverable UI. Invalid payload is rejected before execution.
   Test partial enqueue/failure using the approved isolated fixture path, not by
   modifying live jobs or database. Mocks already cover these UI states; an actual
   worker failure, timeout, partial enqueue, idempotency and concurrency proof remain
   separate runtime evidence until deliberately exercised.
9. Load the recorded request to repeat after both jobs are terminal; explicitly
   submit it. New run/comparison IDs must differ; compare recorded definition hashes
   and synthetic results. Do not expect execution config hashes to match: snapshot
   versions are isolated per submission. Determinism is an observation to measure.
10. Review 320px mobile, short laptop, wide desktop, dark mode, keyboard focus under
    both sticky headers, 200% zoom, touch and a real mobile keyboard. Store sanitised
    screenshots with route, viewer label A/B, viewport, commit and expected/actual.

Outstanding: real Clerk → BFF → isolated Backend/worker; preview env reachability;
complete app chrome and real-device input; executed code lineage, real worker audit evidence,
artefact content integrity and runtime idempotency/concurrency. None is inferred from
local mocks or the previously reported host API proof.

## Review evidence — 2026-10-01

- Local Frontoffice verify: 193 tests passed; lint/typecheck passed with the existing
  unused `takeLast` warning. Production build passed.
- Combined Backend #18/#19: five isolated FastAPI scenarios passed at local commit
  `40f7c30`, using actual public responses and owner/other-viewer 200/404 for detail,
  events and artefacts. The captured synthetic responses drive BFF and browser
  tests. This fixture proof does not execute the worker or use a real Clerk session.
- Local Backend (original #18 validation): 504 tests and 15 subtests passed; generated-contract check passed.
- Focused Playwright: eleven tests passed on the production-build harness. A focused
  result-capture confirmation also passed after restoring capture scroll.
- Independent finish reviewer: repeated Inspect and sticky capture findings resolved;
  review passes within the local harness scope. Real authenticated preview remains
  an outstanding evidence limitation, not an implementation acceptance.
- [Backend CI, PR #18](https://github.com/Vesconte-project/finance-backend/actions/runs/36795057095) passed.
- [Frontoffice CI, PR #44](https://github.com/Vesconte-project/finance-frontoffice/actions/runs/36795280723)
  and [complete Frontend QA](https://github.com/Vesconte-project/finance-frontoffice/actions/runs/36795280678) passed at head `2c2844159b568f853f724ad4973ff4664250819a`.
- The UI's current checks are on [Draft PR #48](https://github.com/Vesconte-project/finance-frontoffice/pull/48).
  The complete authenticated preview proof remains separate from those checks.

No merge, manual deployment or environment mutation was performed. The existing
GitHub/Vercel integration automatically built PR previews after pushes; readiness
does not prove Clerk, backend connectivity or feature activation. The proof flag
remains absent/false by default and refuses Vercel Production.
