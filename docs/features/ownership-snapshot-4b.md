# 4B — reported aggregate ownership

Part of ENG-172, original workstream 4. Founder instruction: continue filling the
existing research pages while SEC batch 5 and 4A merge await daytime operations.
Meaningful data integration; preserve the existing Ownership & Capital composition,
chapter order, tokens and Being built copy. No redesigned page or diagnostic UX.

## Implementation packet

Outcome: in Who owns the shares, read the explicit institutional and insider
ownership fractions already returned by the existing Yahoo info fetch. Present
these as two independent labelled readings. Neither is a trade, named-holder
list, a fund/pension classification, nor an exhaustive partition. Do not infer
retail/remainder, sum slices, normalize totals, compare dates, or create a pie.

Owners: data-ops `providers/ownership_snapshot.py` captures an atomic optional
text envelope; feature-store `features/ownership_snapshot.py` validates and
publishes it; backend `app/ownership_snapshot.py` exposes a typed optional field
on the existing summary, contract 2026-11-04.1 in the companion backend PR.
Frontend only validates eligibility and formats explicit fractions with Intl
percent formatting. No new endpoint, provider call, migration or SEC dependency.

Capture time is labelled Captured, not the unknown date of holdings. Invalid,
missing or stale readings keep Being built, including when only one is available.
The existing Largest holders aside and insider-trades chapter remain Being built.
Do not apply corporate ownership to fund pages. No new interactive control/motion.

Technical acceptance: unknown/stale/future/malformed/partial/zero snapshots;
explicit source/unit/symbol and max 14 calendar days; no made-up remainder or
currency conversion. Validate verify/build and canonical fixture browser QA,
320–1920 widths, text enlargement/reduced motion; inspect mobile/laptop/wide.

Product/visual/release acceptance remains with Francisco; a fixture run is not
provider coverage or human acceptance. PR stays draft, no merge or activation.
The server must review real field units/key presence and coverage before release.
All PRs target main; rebase and retest after 4A enters, since summary/schema/test
key sets and source exclusions overlap. No stacked-base merges.

## Validation — 04 November

`npm run verify` passed (two pre-existing lint warnings); canonical production
`npm run build` passed using an isolated copy of the existing dependencies.
Turbopack first refused an out-of-project dependency symlink; no app/config
workaround was committed. Canonical production-server Playwright: **3 passed**
(runtime preflight + two feature cases), widths 320/390/480/768/820/1024/1366/
1440/1536/1920, enlarged text/reduced motion, no horizontal overflow or page errors.
Mobile/laptop/wide chapter screenshots inspected together; no corrections needed.
Mechanical detector returned no findings. No new controls/motion were introduced.

Fixtures prove UI behavior only, not real source coverage, Preview review or human
acceptance. New code remains draft and unmerged. After 4A merges, rebase/retest
preserving both optional summary fields before coordinated release.

## Integration after 4A — 06 November

4B is now replayed onto main 26d38554, after the approved 4A merge.
Both analystConsensus and ownershipSnapshot remain optional, separate summary
components. Preserve the two captures from the same existing info request,
whole-envelope selection, source clock checks and exclusions of both reserved
metrics before numeric/FX/scorecard caps. Backend OpenAPI is regenerated from
the combined models (contract 2026-11-06.1). Tests exercise both components
together, not just a union of key names. Missing components still leave ordinary
page data valid; no new user-facing missingness labels or source requests.

Earlier validation/parent statements above describe the pre-rebase delivery.
Refreshed complete-suite and frontend results are recorded with the new PR heads.
No 5A scenario code or branch is changed; its rebase waits for 4B to merge.
This work performs no merge, deployment, migration, production read or refresh.

Validation refreshed 06 November: npm run verify and production build passed. Canonical browser QA: 5 passed, 0 skipped/flaky, running analyst-consensus and ownership scenarios together. Mobile/laptop screenshots inspected; both chapters render correctly.
The two invalidated local runs affected only data-ops/feature-store and were
repeated after restoring committed sources and locking managed worktrees.
No production DB or provider request; opt-in DB suites remain skipped.
