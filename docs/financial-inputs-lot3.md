# Financial inputs in the research pages — lot 3

Part of ENG-172. This lot connects existing page components to explicit raw and derived backend inputs, preserving the current visual structure and Being built wherever an input is missing. It adds no diagnostic/coverage/pagination interface, provider call, route, or request fanout.

## Resulting behavior

- Financials: explicit cost of revenue, total operating expenses and income tax populate the existing flow branches and cards. Income tax is labeled precisely rather than implying all residual costs. Share of sales and year-on-year changes come only from canonical annual ratio IDs at the exact selected period. Biggest changes ranks supplied changes; the browser does not calculate financial ratios or invent residual expenses.
- Fundamentals: the revenue toggle displays supplied annual revenue growth; the operating-margin chart displays supplied annual fractions. Existing current net cash uses its own native row currency in both Fundamentals and Overview.
- Valuation: current P/S, P/FCF and EV/EBITDA can display when canonical observations arrive. A latest NULL suppresses an older valid multiple rather than presenting it as today. A current snapshot does not create a ten-year series.

`statement-reading.ts` selects canonical IDs, deduplicates latest revisions (including NULL), and joins by exact period end. Raw monetary histories are limited to the latest declared currency cohort; a missing currency yields no monetary chart. Dimensionless ratios carry explicit fraction units, including values above 150% or very small fractions. Formatting/ranking are presentational; economic derivation stays in feature-store.

R&D/SG&A/interest aliases are available to the reader, but a complete decomposition of operating costs is not fabricated. Segments, retained capital, buyback/dividend allocation, ten-year cash/debt history, peer comparison, five-year CAGR, analyst targets and valuation models remain Being built.

## Technical validation

`npm run verify` passed (lint, TypeScript and the repository's test sequence). Production `npm run build` passed with existing Development-only Clerk credentials and the local backend stub; no secrets were copied to the branch.

Owned browser runner: `npm run qa:browser -- e2e/ticker-financial-inputs.spec.ts --project=chromium --workers=1`, using production server mode and fixed local fixture ports. Final run: 5 passed, including the runtime setup. It exercises all three financial routes, missing inputs, latest-null valuation, EUR source amounts despite a USD listing, keyboard, touch and reduced motion. Widths: 320, 390, 480, 768, 820, 1024, 1366, 1440, 1536 and 1920 CSS pixels; enlarged-root-text overflow checked at 1366. This is not a claim of a real-device pass or browser 200% page zoom. Screenshots were inspected at representative mobile/tablet/laptop/wide layouts; no new composition defect found. Existing layout and fixed flow geometry are preserved.

Two bounded browser rounds were run; the final run produced 18 screenshots with invented fixture data. The mechanical detector returned no findings for the changed visual components/CSS. Captures and logs are local task evidence, not production-data screenshots or product/visual acceptance. Commit-addressed Vercel Preview is created by the existing integration after pushing and remains a separate reviewer check.

## Release review

Draft only. Founder-authorized implementation follows the existing experience; product, visual and release acceptance remain pending independent review. Companion changes belong to finance-data-ops, finance-feature-store and finance-backend. Until their explicit inputs are ingested and published, the existing Being built state remains visible. No source-revenue earnings fix, ten-year historical ingestion, merge, production refresh or deploy is performed in this lot.
