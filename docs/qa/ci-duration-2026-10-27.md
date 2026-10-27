# Frontend QA duration incident — Part of ENG-196

## Evidence

Repository: finance-frontoffice. PR #83 head `8dba1cd`; workflow Frontend QA,
job Frontend candidate, run [40485593907](https://github.com/Vesconte-project/finance-frontoffice/actions/runs/40485593907).
The job ran 2026-10-27 10:04:07–11:14:38 UTC (70m31s).
Dependency installation took 16s and Chromium installation 21s. Verify/build
passed; the build took about 24s. Browser testing occupied about 68m34s.

The browser suite collected 201 tests on one worker. It ended with 104 failed,
46 passed and 51 skipped. Each failed test could run three times (two retries).
There was no Playwright global timeout or maxFailures setting and no job timeout
below the Actions default. Screenshots show Clerk JSON `resource_not_found`
instead of the application on home/ticker navigations; other tests waited for
missing UI and repeated identical failures. This was not a 70-minute build.

The last completed green main run was
[40192467920](https://github.com/Vesconte-project/finance-frontoffice/actions/runs/40192467920),
SHA `0dd5f3a`, 2026-10-25 12:17–12:23 UTC. The same 201-test browser suite
finished in about 4.6m: 160 passed, 41 skipped. It used the same public Frontend
API domain, `maximum-pangolin-3443.clerk.accounts.dev`. The intervening recent
draft runs were skipped, so there is no demonstrated first bad application
commit. On 2026-10-27 Francisco confirmed that this Development instance no
longer exists. No secrets or Clerk settings were changed during this work.

An independent read of `GET /v1/environment` on that domain returned HTTP 404
with code `resource_not_found`. It is public environment configuration, not a
user/session/organization lookup. The exact failing browser request cannot be
recovered from the old screenshot-only artifact: its traces and error contexts
were not uploaded. Do not present the independent request as the recorded
browser request or infer an affected user/organization ID.

## Changes

- One tested scope classifier shared by the two workflows. Exact robots/sitemap
  paths require verify/build; any UI change restores full browser QA. Dependency,
  harness and workflow changes always run full candidate QA. A manifest edit
  solely adding unit-test commands does not force UI browsing. Unknown manifest
  contents fail closed to the complete candidate. Deleted/renamed paths are
  classified conservatively with `git diff --no-renames`.
- Separate verify/build/browser steps provide timing and individual limits,
  preserving canonical npm commands and avoiding duplicate verification.
- A real browser readiness dependency checks local origin, successful HTML,
  main content and loaded Clerk SDK before UI tests. No auth bypass or mock is
  added to the application or actual suite. Local account-management tests stay
  excluded.
- No automatic retries, at most three CI failures, a 10-minute Playwright global
  timeout, a 12-minute browser step and a 25-minute candidate job ceiling. The
  last healthy 4.6-minute suite supports headroom, but these are ceilings rather
  than an unmeasured speed promise. Non-visual CI is capped at 10 minutes.
- Preserve HTML/JSON reports, traces, video, contexts and screenshots. Existing
  draft gating and cancellation of obsolete runs stay in place.

## Validation and remaining work

Clean offline Node 22 containers, UID 1000, read-only root/dependencies, no
network, private TMPDIR: verify passed 324 tests (301+1+14+4+4), lint and strict
typecheck passed. One existing unused-function lint warning remains. The
production Turbopack build passed with offline font-response fixtures and a
synthetic publishable-key hostname; this proves compilation, not real Clerk
availability or visual/font fidelity.

The actual PR #83 diff was replayed through the classifier: verify=true,
build=true, browser=false. An isolated real-Chromium harness importing the new
configuration proved: ready runtime and dependent pass; JSON 404 produces one
failed readiness check and prevents its dependent; a systemic fixture stops
after three failures with no retries. It also asserts the loaded 10-minute
global timeout. The synthetic harness proves orchestration, not Clerk auth.

Francisco will select/create a CI-only Development instance and update the
frontoffice Repository Variable `CLERK_CI_PUBLISHABLE_KEY` and Repository Secret
`CLERK_CI_SECRET_KEY` from the same instance. The current suite performs no login,
creates no users/organizations and uses no fixed Clerk IDs or testing tokens.
It loads the sign-up form anonymously. Email/password with sign-up available is
a simple form configuration; social login, MFA, organizations and token templates
are not test requirements. The local origin is http://localhost:3100, sign-in
/sign-in, sign-up /sign-up, post-auth /dashboard; no login redirect is exercised.

Only frontoffice Frontend QA references CLERK_CI_* in inspected current workflows.
Backoffice CI has lint/tests/build but no injected Clerk keys or browser login.
Backend CI uses generated signing keys and in-memory/mocked JWKS, not this live
instance. Separate dev-local/platform launchers use their own Development input
and are outside this Actions suite.

Preview key domains remain unverified: the configured Vercel connection returns
403 for companyoskiko and the two Preview URLs redirect to Vercel login. Ask the
Vercel agent to report only the decoded NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY hostname
for frontoffice/backoffice Preview targets, including branch/shared overrides,
and distinguish current configuration from already-built deployments. Do not
read CLERK_SECRET_KEY values or change settings. Updating GitHub CI variables
does not update Vercel Preview variables or rebuild an existing deployment.

No workflow has been merged or deployed by this work. A fresh full GitHub browser
run against the restored Development instance is still required; neither a
shorter failure nor a passing local fixture establishes that integration.

References: [Playwright CI](https://playwright.dev/docs/ci),
[configuration limits](https://playwright.dev/docs/api/class-testconfig),
[GitHub workflow timeouts](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[Clerk Playwright testing](https://clerk.com/docs/guides/development/testing/playwright/overview),
[Clerk Preview environments](https://clerk.com/docs/guides/development/managing-environments).
