# Capital and cash research — lot 4

Draft for tomorrow's independent review; depends on frontend #96 and the lot 4 feature-store/backend companions. No PR merge or production deploy/refresh was performed. Existing design, data-source rules and Being built copy are preserved.

## Visible behavior

Fundamentals shows annual cash/debt bars with a net-cash line and a total-dividends-paid card alongside the existing per-share dividend history. Cash and debt use the actual reporting currency, which may differ from the listing. Debt is placed below zero only as chart geometry; net cash is supplied by the canonical backend, not subtracted in the browser.

Ownership & Capital prefers explicitly reported annual buyback cash amounts, showing the latest annual amount and the available annual history. It does not add those cash amounts to capital-event executions. The existing executed-buyback path remains a fallback when annual amounts are absent. A separate chart shows actual annual ordinary shares outstanding. Amounts never become quantities bought, shares issued to staff or value today. The 2016 share baseline stays Being built when absent; source share issuance/treasury balances cannot substitute for ordinary shares.

No ten-year claim is made for newly supplied annual history. The source currently has about four years; the UI plots supplied periods and labels the annual amount by the year-end date. The existing unfilled profit allocation / retained profit / sales-flow buyback/dividend branches remain Being built: cash-flow payments cannot safely be treated as an accrual-profit reconciliation.

## Reader and contracts

`lib/capital-statements.ts` uses exact annual line-item IDs and explicit derived provenance for `net_cash`, `dividends_paid_amount` and `share_repurchases_amount`. It rejects nonfinite/negative payment magnitudes, honors latest NULL, selects one declared currency cohort, and never computes ratios or economic differences. Counts need no monetary currency.

The cash/debt reader checks period/currency and raw ingredient values/knowledge dates against canonical net-cash evidence. If a raw write succeeded but its derived build failed, the mixed point is omitted instead of combining old and new ingredients. No customer diagnostic is added.

Each equity Fundamentals/Ownership route adds two bounded existing financial-statements reads (annual balance sheet and cash flow, requested limit 500, existing tier caps enforced). They run together, fail open individually, and are skipped for funds. No new endpoint, provider call, credentials, entitlement, pagination flow or request per chart/year is added.

## Validation and review

Unit/contract verification includes exact canonical IDs, alias/net-issuance exclusions, native currencies, latest NULL, raw-vs-derived known_at/value coherence and count semantics. Owned browser fixtures cover Fundamentals and Ownership, cash-only buybacks without executed quantities, missing shares/data, EUR amounts with a USD listing, keyboard/reduced motion and the viewport matrix. Logs and final results accompany the draft PR. Invented fixtures only; no real-device or production coverage claim.

Review the separate lot 4 changes against the pinned parent #96 head. Product/visual/release acceptance remains with the owner. Preview success and local tests do not authorize merges. Merge lot 3 first only after the owner approves tomorrow, then review/retarget the companion stacked PRs before any release.

### Final local evidence

`npm run verify` passed and the final production build passed. The final owned Chromium run passed all 8 tests (runtime setup, lot 4 flows and lot 3 regressions). Two bounded browser rounds were used; the resolved first-round failure was a test sign-format expectation, not a product calculation. The synthetic current net-cash period was also corrected to distinguish its current quarter from the older annual history. Final capture set: 30 screenshots; representative mobile/tablet/laptop/wide captures were inspected, with no new layout defect. Widths 320, 390, 480, 768, 820, 1024, 1366, 1440, 1536 and 1920; enlarged root text, keyboard/touch and reduced motion covered. This is not a browser 200% zoom or real-device claim. Mechanical detector: no findings.

Production source code was unchanged between the final build and final browser run; the last confirmation edits were in external test fixtures/assertions. A commit-addressed Vercel Preview is still a separate review surface, not visual acceptance.
